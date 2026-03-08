"""
Order Workflow Orchestrator.

Coordinates the full post-order pipeline:

  Step 1 – Notify the backend/ops team about the new order
  Step 2 – Auto-select the nearest laundry provider (if not chosen by user)
  Step 3 – Invoke Uber Direct to schedule pickup from user → laundry
  Step 4 – Generate and upload a receipt

Each step is logged as a workflow event in the `workflow_events` collection
so the team has full visibility into what happened and when.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Optional

from services.notification_service import notify_team
from services.provider_selection import select_nearest_provider
from services.uber_service import create_pickup_delivery
from services.receipt_service import generate_and_store_receipt

logger = logging.getLogger(__name__)


async def _log_workflow_event(
    db,
    order_id: str,
    step: int,
    step_name: str,
    status: str,
    details: Optional[Dict] = None,
):
    event = {
        "order_id": order_id,
        "step": step,
        "step_name": step_name,
        "status": status,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.workflow_events.insert_one(event)
    logger.info(
        "[Workflow] order=%s step=%d(%s) status=%s",
        order_id, step, step_name, status,
    )


async def process_order(db, order: Dict) -> Dict:
    """
    Execute the full order workflow.  Returns a summary dict with results
    from each step.

    Parameters
    ----------
    db : AsyncIOMotorDatabase
    order : dict – the order document (as stored in MongoDB)

    Returns
    -------
    dict with keys: notification, provider, uber_delivery, receipt, workflow_status
    """

    order_id = order["id"]
    result = {
        "order_id": order_id,
        "workflow_status": "in_progress",
        "steps_completed": [],
    }

    # ------------------------------------------------------------------
    # STEP 1: Notify backend team
    # ------------------------------------------------------------------
    try:
        items_summary = ", ".join(
            f"{i['service_type']} ({i['weight']} lbs)"
            for i in order.get("items", [])
        )
        notification = await notify_team(
            db,
            event_type="order_placed",
            order_id=order_id,
            message=f"New order placed. Total: ${order['total_amount']:.2f}. Items: {items_summary}",
            details={
                "customer_id": order["customer_id"],
                "pickup_address": order["pickup_address"],
                "pickup_city": order["pickup_city"],
                "pickup_zipcode": order["pickup_zipcode"],
                "items_count": len(order.get("items", [])),
                "total_amount": order["total_amount"],
            },
        )
        result["notification"] = notification
        result["steps_completed"].append("notification")
        await _log_workflow_event(db, order_id, 1, "notify_team", "completed")
    except Exception as exc:
        logger.error("[Workflow] Step 1 (notify) failed for order %s: %s", order_id, exc)
        await _log_workflow_event(
            db, order_id, 1, "notify_team", "failed", {"error": str(exc)}
        )

    # ------------------------------------------------------------------
    # STEP 2: Select nearest provider (if not already selected)
    # ------------------------------------------------------------------
    provider = None
    provider_auto_selected = False
    try:
        provider = await db.service_providers.find_one(
            {"user_id": order["provider_id"]}, {"_id": 0}
        )

        if not provider:
            # Provider ID was not valid or not set – auto-select
            requested_services = [
                i["service_type"] for i in order.get("items", [])
            ]
            provider = await select_nearest_provider(
                db,
                pickup_city=order["pickup_city"],
                pickup_zipcode=order["pickup_zipcode"],
                requested_services=requested_services,
            )
            if provider:
                provider_auto_selected = True
                await db.orders.update_one(
                    {"id": order_id},
                    {
                        "$set": {
                            "provider_id": provider["user_id"],
                            "provider_auto_selected": True,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }
                    },
                )
                order["provider_id"] = provider["user_id"]

                await notify_team(
                    db,
                    event_type="provider_auto_selected",
                    order_id=order_id,
                    message=f"Auto-selected provider: {provider['business_name']}",
                    details={
                        "provider_user_id": provider["user_id"],
                        "business_name": provider["business_name"],
                        "address": provider["address"],
                        "city": provider["city"],
                    },
                )

        result["provider"] = {
            "user_id": provider["user_id"] if provider else None,
            "business_name": provider.get("business_name") if provider else None,
            "auto_selected": provider_auto_selected,
        }
        result["steps_completed"].append("provider_selection")
        await _log_workflow_event(
            db, order_id, 2, "provider_selection", "completed",
            {"auto_selected": provider_auto_selected,
             "provider": provider.get("business_name") if provider else None},
        )
    except Exception as exc:
        logger.error("[Workflow] Step 2 (provider) failed for order %s: %s", order_id, exc)
        await _log_workflow_event(
            db, order_id, 2, "provider_selection", "failed", {"error": str(exc)}
        )

    if not provider:
        result["workflow_status"] = "failed"
        result["error"] = "No provider available"
        await _log_workflow_event(
            db, order_id, 0, "workflow", "failed",
            {"reason": "no_provider_available"},
        )
        return result

    # ------------------------------------------------------------------
    # STEP 3: Invoke Uber Direct for pickup
    # ------------------------------------------------------------------
    delivery = None
    try:
        customer = await db.users.find_one(
            {"id": order["customer_id"]}, {"_id": 0}
        )
        customer_name = customer.get("name", "FreshFlow Customer") if customer else "FreshFlow Customer"
        customer_phone = customer.get("phone", "") if customer else ""

        delivery = await create_pickup_delivery(
            db=db,
            order_id=order_id,
            customer_name=customer_name,
            customer_phone=customer_phone or "(000) 000-0000",
            pickup_address=order["pickup_address"],
            pickup_city=order["pickup_city"],
            pickup_state=order["pickup_state"],
            pickup_zipcode=order["pickup_zipcode"],
            dropoff_business_name=provider.get("business_name", "Laundry Provider"),
            dropoff_address=provider.get("address", ""),
            dropoff_city=provider.get("city", ""),
            dropoff_state=provider.get("state", ""),
            dropoff_zipcode=provider.get("zipcode", ""),
            items=order.get("items", []),
            notes=order.get("notes"),
        )

        # Update the order with the Uber delivery reference
        await db.orders.update_one(
            {"id": order_id},
            {
                "$set": {
                    "uber_delivery_id": delivery["id"],
                    "uber_delivery_status": delivery.get("status", "pending"),
                    "uber_tracking_url": delivery.get("tracking_url"),
                    "pickup_ride_id": delivery["id"],
                    "pickup_ride_status": delivery.get("status", "pending"),
                    "status": "pickup_scheduled",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

        result["uber_delivery"] = {
            "delivery_id": delivery["id"],
            "status": delivery.get("status"),
            "courier": delivery.get("courier"),
            "eta_minutes": delivery.get("eta_minutes"),
            "tracking_url": delivery.get("tracking_url"),
            "estimated_cost": delivery.get("estimated_cost"),
        }
        result["steps_completed"].append("uber_pickup")

        await notify_team(
            db,
            event_type="uber_pickup_scheduled",
            order_id=order_id,
            message=(
                f"Uber pickup scheduled. Courier: {delivery.get('courier', {}).get('name', 'TBD')}. "
                f"ETA: {delivery.get('eta_minutes', '?')} min."
            ),
            details={
                "delivery_id": delivery["id"],
                "courier": delivery.get("courier"),
                "eta_minutes": delivery.get("eta_minutes"),
                "pickup": order["pickup_address"],
                "dropoff": provider.get("address"),
            },
        )

        await _log_workflow_event(
            db, order_id, 3, "uber_pickup", "completed",
            {"delivery_id": delivery["id"], "eta": delivery.get("eta_minutes")},
        )
    except Exception as exc:
        logger.error("[Workflow] Step 3 (Uber pickup) failed for order %s: %s", order_id, exc)
        await _log_workflow_event(
            db, order_id, 3, "uber_pickup", "failed", {"error": str(exc)}
        )

    # ------------------------------------------------------------------
    # STEP 4: Generate and upload receipt
    # ------------------------------------------------------------------
    try:
        if delivery:
            customer = await db.users.find_one(
                {"id": order["customer_id"]}, {"_id": 0}
            )
            customer_name = customer.get("name", "Customer") if customer else "Customer"

            receipt = await generate_and_store_receipt(
                db=db,
                order=order,
                provider=provider,
                delivery=delivery,
                customer_name=customer_name,
            )
            result["receipt"] = {
                "receipt_id": receipt["id"],
                "s3_url": receipt.get("s3_url"),
            }
            result["steps_completed"].append("receipt")

            await db.orders.update_one(
                {"id": order_id},
                {"$set": {"receipt_id": receipt["id"]}},
            )

            await _log_workflow_event(
                db, order_id, 4, "receipt_generated", "completed",
                {"receipt_id": receipt["id"]},
            )
    except Exception as exc:
        logger.error("[Workflow] Step 4 (receipt) failed for order %s: %s", order_id, exc)
        await _log_workflow_event(
            db, order_id, 4, "receipt_generated", "failed", {"error": str(exc)}
        )

    # ------------------------------------------------------------------
    # Final status
    # ------------------------------------------------------------------
    expected_steps = {"notification", "provider_selection", "uber_pickup", "receipt"}
    completed = set(result["steps_completed"])
    if completed >= expected_steps:
        result["workflow_status"] = "completed"
    elif completed >= {"notification", "provider_selection", "uber_pickup"}:
        result["workflow_status"] = "completed_partial"
    else:
        result["workflow_status"] = "failed_partial"

    await _log_workflow_event(
        db, order_id, 99, "workflow_complete", result["workflow_status"],
        {"steps_completed": result["steps_completed"]},
    )

    return result
