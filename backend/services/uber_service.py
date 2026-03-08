"""
Uber Direct API integration for scheduling laundry pickup & delivery.

Uses the Uber Direct (Delivery) API to create a delivery request that picks up
laundry from the customer's address and drops it at the selected laundry
provider.

Env vars required:
  UBER_CLIENT_ID        – Uber developer app client ID
  UBER_CLIENT_SECRET    – Uber developer app client secret
  UBER_CUSTOMER_ID      – Your Uber Direct customer/merchant ID

When credentials are not configured, the service falls back to a realistic
simulation so the workflow still runs end-to-end in development.

Uber Direct API reference:
  https://developer.uber.com/docs/deliveries/guides/create-a-delivery
"""

import os
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
import uuid

import httpx

logger = logging.getLogger(__name__)

UBER_CLIENT_ID = os.getenv("UBER_CLIENT_ID")
UBER_CLIENT_SECRET = os.getenv("UBER_CLIENT_SECRET")
UBER_CUSTOMER_ID = os.getenv("UBER_CUSTOMER_ID")
UBER_AUTH_URL = "https://login.uber.com/oauth/v2/token"
UBER_DIRECT_BASE = "https://api.uber.com/v1/customers"

_cached_token: Optional[str] = None
_token_expiry: Optional[datetime] = None


def _is_configured() -> bool:
    return bool(UBER_CLIENT_ID and UBER_CLIENT_SECRET and UBER_CUSTOMER_ID)


async def _get_access_token() -> str:
    """Obtain an OAuth2 access token from Uber (client_credentials flow)."""
    global _cached_token, _token_expiry

    if _cached_token and _token_expiry and datetime.now(timezone.utc) < _token_expiry:
        return _cached_token

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            UBER_AUTH_URL,
            data={
                "client_id": UBER_CLIENT_ID,
                "client_secret": UBER_CLIENT_SECRET,
                "grant_type": "client_credentials",
                "scope": "eats.deliveries",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        _cached_token = data["access_token"]
        from datetime import timedelta
        _token_expiry = datetime.now(timezone.utc) + timedelta(
            seconds=data.get("expires_in", 2700) - 60
        )
        return _cached_token


def _build_items_manifest(items: List[Dict]) -> List[Dict]:
    """Convert order items into Uber Direct manifest_items format."""
    manifest = []
    for item in items:
        manifest.append({
            "name": item.get("service_type", "Laundry"),
            "quantity": 1,
            "weight": item.get("weight", 0),
            "dimensions": {"length": 30, "height": 20, "depth": 20},  # cm, bag estimate
        })
    return manifest


async def create_pickup_delivery(
    db,
    order_id: str,
    customer_name: str,
    customer_phone: str,
    pickup_address: str,
    pickup_city: str,
    pickup_state: str,
    pickup_zipcode: str,
    dropoff_business_name: str,
    dropoff_address: str,
    dropoff_city: str,
    dropoff_state: str,
    dropoff_zipcode: str,
    items: List[Dict],
    notes: Optional[str] = None,
) -> Dict:
    """
    Create an Uber Direct delivery request to pick up laundry from the
    customer and deliver it to the laundry provider.

    Returns a dict with the delivery details (uber_delivery_id, status, etc.).
    """

    pickup_full = f"{pickup_address}, {pickup_city}, {pickup_state} {pickup_zipcode}"
    dropoff_full = f"{dropoff_address}, {dropoff_city}, {dropoff_state} {dropoff_zipcode}"

    total_weight = sum(i.get("weight", 0) for i in items)
    total_pieces = len(items)
    item_types = ", ".join(set(i.get("service_type", "Laundry") for i in items))

    if _is_configured():
        return await _create_real_delivery(
            db=db,
            order_id=order_id,
            customer_name=customer_name,
            customer_phone=customer_phone,
            pickup_full=pickup_full,
            dropoff_full=dropoff_full,
            dropoff_business_name=dropoff_business_name,
            items=items,
            total_weight=total_weight,
            notes=notes,
        )

    # ---- Simulation mode (no Uber credentials configured) ----
    logger.info(
        "[UberDirect-SIM] Creating simulated delivery for order %s", order_id
    )

    import random

    uber_delivery_id = f"sim_del_{uuid.uuid4().hex[:12]}"
    tracking_url = f"https://uber.com/track/{uber_delivery_id}"

    delivery_record = {
        "id": uber_delivery_id,
        "order_id": order_id,
        "type": "pickup_to_laundry",
        "status": "pending",
        "pickup_address": pickup_full,
        "dropoff_address": dropoff_full,
        "dropoff_business_name": dropoff_business_name,
        "items_summary": {
            "total_pieces": total_pieces,
            "total_weight_lbs": total_weight,
            "item_types": item_types,
        },
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "notes": notes,
        "courier": {
            "name": random.choice(["Alex Rivera", "Priya Patel", "Jordan Lee", "Sam Nguyen"]),
            "phone": f"(972) 555-{random.randint(2000, 9999)}",
            "vehicle": random.choice(["Toyota Corolla", "Honda Civic", "Ford Escape", "Hyundai Tucson"]),
            "rating": round(random.uniform(4.5, 5.0), 1),
        },
        "eta_minutes": random.randint(8, 20),
        "estimated_cost": round(random.uniform(8.0, 18.0), 2),
        "tracking_url": tracking_url,
        "simulated": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.uber_deliveries.insert_one({**delivery_record})

    logger.info(
        "[UberDirect-SIM] Delivery %s created: %s → %s | %d items, %.1f lbs",
        uber_delivery_id,
        pickup_full,
        dropoff_full,
        total_pieces,
        total_weight,
    )

    return delivery_record


async def _create_real_delivery(
    db,
    order_id: str,
    customer_name: str,
    customer_phone: str,
    pickup_full: str,
    dropoff_full: str,
    dropoff_business_name: str,
    items: List[Dict],
    total_weight: float,
    notes: Optional[str],
) -> Dict:
    """Call the actual Uber Direct API to create a delivery."""
    token = await _get_access_token()

    manifest_items = _build_items_manifest(items)

    payload = {
        "pickup_name": customer_name,
        "pickup_phone_number": customer_phone,
        "pickup_address": pickup_full,
        "pickup_notes": notes or "Laundry pickup – please ring doorbell",
        "dropoff_name": dropoff_business_name,
        "dropoff_address": dropoff_full,
        "dropoff_phone_number": "",
        "dropoff_notes": f"FreshFlow Order. {len(items)} item(s), {total_weight:.1f} lbs total.",
        "manifest_items": manifest_items,
        "manifest_total_value": 0,  # non-retail goods
    }

    url = f"{UBER_DIRECT_BASE}/{UBER_CUSTOMER_ID}/deliveries"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    delivery_record = {
        "id": data.get("id", str(uuid.uuid4())),
        "order_id": order_id,
        "type": "pickup_to_laundry",
        "status": data.get("status", "pending"),
        "pickup_address": pickup_full,
        "dropoff_address": dropoff_full,
        "dropoff_business_name": dropoff_business_name,
        "items_summary": {
            "total_pieces": len(items),
            "total_weight_lbs": total_weight,
            "item_types": ", ".join(set(i.get("service_type", "Laundry") for i in items)),
        },
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "notes": notes,
        "courier": data.get("courier"),
        "eta_minutes": data.get("pickup_eta"),
        "estimated_cost": data.get("fee"),
        "tracking_url": data.get("tracking_url"),
        "simulated": False,
        "uber_raw_response": data,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.uber_deliveries.insert_one({**delivery_record})

    logger.info(
        "[UberDirect] Delivery %s created via Uber API for order %s",
        delivery_record["id"],
        order_id,
    )

    return delivery_record


async def get_delivery_status(db, uber_delivery_id: str) -> Optional[Dict]:
    """Fetch current delivery status – from DB or live Uber API."""
    record = await db.uber_deliveries.find_one({"id": uber_delivery_id}, {"_id": 0})
    if not record:
        return None

    if record.get("simulated") or not _is_configured():
        return record

    # Live status check
    try:
        token = await _get_access_token()
        url = f"{UBER_DIRECT_BASE}/{UBER_CUSTOMER_ID}/deliveries/{uber_delivery_id}"
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
            resp.raise_for_status()
            data = resp.json()

        await db.uber_deliveries.update_one(
            {"id": uber_delivery_id},
            {"$set": {
                "status": data.get("status", record["status"]),
                "courier": data.get("courier", record.get("courier")),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        record["status"] = data.get("status", record["status"])
        record["courier"] = data.get("courier", record.get("courier"))
    except Exception as exc:
        logger.warning("Failed to refresh Uber delivery status: %s", exc)

    return record
