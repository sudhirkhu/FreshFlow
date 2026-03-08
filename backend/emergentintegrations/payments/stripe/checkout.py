"""Stub for emergentintegrations.payments.stripe.checkout"""
from pydantic import BaseModel
from typing import Optional, Dict


class CheckoutSessionRequest(BaseModel):
    amount: float
    currency: str = "usd"
    success_url: str = ""
    cancel_url: str = ""
    metadata: Dict = {}


class CheckoutSessionResponse(BaseModel):
    session_id: str = ""
    url: str = ""


class CheckoutStatusResponse(BaseModel):
    status: str = ""
    payment_status: str = ""
    amount_total: int = 0
    currency: str = "usd"
    metadata: Dict = {}


class StripeCheckout:
    def __init__(self, api_key=None, webhook_url=None):
        self.api_key = api_key
        self.webhook_url = webhook_url

    async def create_checkout_session(self, request: CheckoutSessionRequest) -> CheckoutSessionResponse:
        return CheckoutSessionResponse(session_id="stub_session", url="#")

    async def get_checkout_status(self, session_id: str) -> CheckoutStatusResponse:
        return CheckoutStatusResponse(status="pending", payment_status="unpaid")

    async def handle_webhook(self, body, signature):
        return CheckoutStatusResponse(status="pending", payment_status="unpaid")
