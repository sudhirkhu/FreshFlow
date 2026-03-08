"""
Receipt generation and upload service.

After an Uber Direct pickup is scheduled, this service generates a receipt
summarising the order, items, pickup/delivery details, and stores it in
MongoDB (and optionally uploads to S3).
"""

import os
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
import uuid

logger = logging.getLogger(__name__)

S3_BUCKET = os.getenv("RECEIPT_S3_BUCKET")
S3_REGION = os.getenv("RECEIPT_S3_REGION", "us-east-1")


def _build_receipt_content(
    order: Dict,
    provider: Dict,
    delivery: Dict,
    customer_name: str,
) -> str:
    """Build a plaintext receipt for the order."""
    items_lines = []
    for i, item in enumerate(order.get("items", []), 1):
        items_lines.append(
            f"  {i}. {item['service_type']:20s}  "
            f"{item['weight']:.1f} lbs  "
            f"${item['price']:.2f}"
        )

    courier = delivery.get("courier") or {}

    receipt = f"""
=====================================
       FRESHFLOW LAUNDRY RECEIPT
=====================================

Order ID:    {order['id']}
Date:        {order['created_at']}
Customer:    {customer_name}

----- PICKUP -----
Address:     {order['pickup_address']}
             {order['pickup_city']}, {order['pickup_state']} {order['pickup_zipcode']}
Pickup Time: {order.get('pickup_time', 'ASAP')}

----- LAUNDRY PROVIDER -----
Name:        {provider.get('business_name', 'N/A')}
Address:     {provider.get('address', 'N/A')}
             {provider.get('city', '')}, {provider.get('state', '')} {provider.get('zipcode', '')}

----- ITEMS -----
{chr(10).join(items_lines)}

----- TOTALS -----
Laundry Total:   ${order['total_amount']:.2f}
Delivery Fee:    ${delivery.get('estimated_cost', 0):.2f}
Grand Total:     ${order['total_amount'] + (delivery.get('estimated_cost', 0) or 0):.2f}

----- UBER PICKUP -----
Delivery ID:  {delivery.get('id', 'N/A')}
Courier:      {courier.get('name', 'Assigning...')}
Vehicle:      {courier.get('vehicle', 'N/A')}
ETA:          {delivery.get('eta_minutes', '?')} minutes
Tracking:     {delivery.get('tracking_url', 'N/A')}

Status:       {delivery.get('status', 'pending').upper()}
=====================================
    Thank you for using FreshFlow!
=====================================
""".strip()

    return receipt


async def generate_and_store_receipt(
    db,
    order: Dict,
    provider: Dict,
    delivery: Dict,
    customer_name: str,
) -> Dict:
    """Generate a receipt and store it in MongoDB. Optionally upload to S3."""

    receipt_id = str(uuid.uuid4())
    content = _build_receipt_content(order, provider, delivery, customer_name)

    receipt_record = {
        "id": receipt_id,
        "order_id": order["id"],
        "delivery_id": delivery.get("id"),
        "provider_id": provider.get("user_id"),
        "content": content,
        "format": "text",
        "s3_url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # Upload to S3 if configured
    if S3_BUCKET:
        try:
            import boto3

            s3 = boto3.client("s3", region_name=S3_REGION)
            s3_key = f"receipts/{order['id']}/{receipt_id}.txt"
            s3.put_object(
                Bucket=S3_BUCKET,
                Key=s3_key,
                Body=content.encode("utf-8"),
                ContentType="text/plain",
            )
            receipt_record["s3_url"] = (
                f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
            )
            logger.info("Receipt uploaded to S3: %s", receipt_record["s3_url"])
        except Exception as exc:
            logger.warning("Failed to upload receipt to S3: %s", exc)

    await db.receipts.insert_one({**receipt_record})
    logger.info("Receipt %s generated for order %s", receipt_id, order["id"])

    return receipt_record
