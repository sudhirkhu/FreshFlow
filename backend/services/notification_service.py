"""
Notification service for alerting the backend/ops team about order events.

Supports multiple channels:
- Database logging (always on)
- Webhook (configurable via NOTIFICATION_WEBHOOK_URL)
- Email via SMTP (configurable via SMTP_* env vars)
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, List

import httpx

logger = logging.getLogger(__name__)

WEBHOOK_URL = os.getenv("NOTIFICATION_WEBHOOK_URL")
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
NOTIFY_EMAIL_TO = os.getenv("NOTIFY_EMAIL_TO")  # comma-separated list


async def notify_team(
    db,
    event_type: str,
    order_id: str,
    message: str,
    details: Optional[Dict] = None,
):
    """Send a notification to the backend/ops team through all configured channels."""

    notification = {
        "event_type": event_type,
        "order_id": order_id,
        "message": message,
        "details": details or {},
        "channels_sent": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # 1. Always persist to DB
    await db.notifications.insert_one({**notification})
    notification["channels_sent"].append("database")
    logger.info("[Notification] %s | order=%s | %s", event_type, order_id, message)

    # 2. Webhook (Slack, Teams, PagerDuty, custom)
    if WEBHOOK_URL:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                payload = {
                    "event": event_type,
                    "order_id": order_id,
                    "message": message,
                    "details": details or {},
                    "timestamp": notification["created_at"],
                }
                resp = await client.post(WEBHOOK_URL, json=payload)
                resp.raise_for_status()
                notification["channels_sent"].append("webhook")
                logger.info("[Notification] Webhook delivered for order %s", order_id)
        except Exception as exc:
            logger.warning("[Notification] Webhook failed for order %s: %s", order_id, exc)

    # 3. Email via SMTP
    if SMTP_HOST and SMTP_USER and NOTIFY_EMAIL_TO:
        try:
            import smtplib
            from email.mime.text import MIMEText

            body = (
                f"FreshFlow Order Alert\n"
                f"---------------------\n"
                f"Event: {event_type}\n"
                f"Order ID: {order_id}\n"
                f"Message: {message}\n"
                f"Details: {details}\n"
                f"Time: {notification['created_at']}\n"
            )
            msg = MIMEText(body)
            msg["Subject"] = f"[FreshFlow] {event_type} - Order {order_id[:8]}"
            msg["From"] = SMTP_USER
            msg["To"] = NOTIFY_EMAIL_TO

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)

            notification["channels_sent"].append("email")
            logger.info("[Notification] Email sent for order %s", order_id)
        except Exception as exc:
            logger.warning("[Notification] Email failed for order %s: %s", order_id, exc)

    return notification
