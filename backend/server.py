from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict
import uuid
import secrets
import string
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
JWT_SECRET = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 10080))

# Stripe
STRIPE_API_KEY = os.getenv("STRIPE_API_KEY")

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str
    phone: Optional[str] = None

class UserRegister(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str
    status: str = "active"
    referral_code: str = ""
    referred_by: Optional[str] = None
    wallet_balance: float = 0.0

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

class ServiceProviderProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    business_name: str
    address: str
    city: str
    state: str
    zipcode: str
    services: List[str]
    price_per_lb: float
    rating: float = 0.0
    total_orders: int = 0
    status: str = "pending"
    created_at: str

class ServiceProviderCreate(BaseModel):
    business_name: str
    address: str
    city: str
    state: str
    zipcode: str
    services: List[str]
    price_per_lb: float

class DriverProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    vehicle_type: str
    license_number: str
    status: str = "offline"
    current_location: Optional[Dict[str, float]] = None
    rating: float = 0.0
    total_deliveries: int = 0
    created_at: str

class DriverCreate(BaseModel):
    vehicle_type: str
    license_number: str

class OrderItem(BaseModel):
    service_type: str
    weight: float
    price: float

class OrderCreate(BaseModel):
    provider_id: str
    items: List[OrderItem]
    pickup_address: str
    pickup_city: str
    pickup_state: str
    pickup_zipcode: str
    pickup_time: str
    notes: Optional[str] = None

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    customer_id: str
    provider_id: str
    driver_id: Optional[str] = None
    items: List[OrderItem]
    total_amount: float
    pickup_address: str
    pickup_city: str
    pickup_state: str
    pickup_zipcode: str
    pickup_time: str
    delivery_time: Optional[str] = None
    status: str
    payment_status: str = "pending"
    notes: Optional[str] = None
    created_at: str
    updated_at: str

class OrderStatusUpdate(BaseModel):
    status: str

class DriverLocationUpdate(BaseModel):
    latitude: float
    longitude: float

class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    session_id: str
    user_id: str
    order_id: Optional[str] = None
    amount: float
    currency: str
    payment_status: str
    metadata: Dict
    created_at: str
    updated_at: str

class CheckoutRequest(BaseModel):
    order_id: str
    origin_url: str

class ReferralStats(BaseModel):
    model_config = ConfigDict(extra="ignore")
    referral_code: str
    total_referrals: int
    total_credits_earned: float
    referrals: List[Dict]

class ApplyReferralRequest(BaseModel):
    referral_code: str

class WalletBalance(BaseModel):
    balance: float
    currency: str = "USD"

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        role = payload.get("role")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"user_id": user_id, "role": role}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth endpoints
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_dict = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "phone": user_data.phone,
        "password": hash_password(user_data.password),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_dict)
    
    token = create_access_token({"sub": user_id, "role": user_data.role})
    user_dict.pop("password")
    
    return TokenResponse(
        access_token=token,
        user=User(**user_dict)
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    user.pop("password")
    
    return TokenResponse(
        access_token=token,
        user=User(**user)
    )

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user)

# Service Provider endpoints
@api_router.post("/providers/profile", response_model=ServiceProviderProfile)
async def create_provider_profile(profile: ServiceProviderCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "provider":
        raise HTTPException(status_code=403, detail="Only providers can create provider profiles")
    
    existing = await db.service_providers.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Provider profile already exists")
    
    profile_dict = {
        "user_id": current_user["user_id"],
        **profile.model_dump(),
        "rating": 0.0,
        "total_orders": 0,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.service_providers.insert_one(profile_dict)
    return ServiceProviderProfile(**profile_dict)

@api_router.get("/providers", response_model=List[ServiceProviderProfile])
async def get_providers(city: Optional[str] = None):
    query = {"status": "active"}
    if city:
        query["city"] = city
    
    providers = await db.service_providers.find(query, {"_id": 0}).to_list(100)
    return [ServiceProviderProfile(**p) for p in providers]

@api_router.get("/providers/me", response_model=ServiceProviderProfile)
async def get_my_provider_profile(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "provider":
        raise HTTPException(status_code=403, detail="Only providers can access this")
    
    profile = await db.service_providers.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    return ServiceProviderProfile(**profile)

# Driver endpoints
@api_router.post("/drivers/profile", response_model=DriverProfile)
async def create_driver_profile(profile: DriverCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can create driver profiles")
    
    existing = await db.drivers.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Driver profile already exists")
    
    profile_dict = {
        "user_id": current_user["user_id"],
        **profile.model_dump(),
        "status": "offline",
        "rating": 0.0,
        "total_deliveries": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.drivers.insert_one(profile_dict)
    return DriverProfile(**profile_dict)

@api_router.get("/drivers/me", response_model=DriverProfile)
async def get_my_driver_profile(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can access this")
    
    profile = await db.drivers.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    return DriverProfile(**profile)

@api_router.patch("/drivers/location")
async def update_driver_location(location: DriverLocationUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can update location")
    
    await db.drivers.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"current_location": {"lat": location.latitude, "lng": location.longitude}}}
    )
    return {"message": "Location updated"}

@api_router.patch("/drivers/status")
async def update_driver_status(status: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can update status")
    
    await db.drivers.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"status": status}}
    )
    return {"message": "Status updated"}

@api_router.get("/drivers/available-orders", response_model=List[Order])
async def get_available_orders(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can access this")
    
    orders = await db.orders.find(
        {"status": "ready_for_pickup", "driver_id": None},
        {"_id": 0}
    ).to_list(50)
    return [Order(**o) for o in orders]

@api_router.patch("/orders/{order_id}/accept-driver")
async def accept_order_as_driver(order_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can accept orders")
    
    order = await db.orders.find_one({"id": order_id, "driver_id": None}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not available")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"driver_id": current_user["user_id"], "status": "driver_assigned", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Order accepted"}

# Order endpoints
@api_router.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "customer":
        raise HTTPException(status_code=403, detail="Only customers can create orders")
    
    provider = await db.service_providers.find_one({"user_id": order_data.provider_id}, {"_id": 0})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    total = sum(item.price for item in order_data.items)
    order_id = str(uuid.uuid4())
    
    order_dict = {
        "id": order_id,
        "customer_id": current_user["user_id"],
        "provider_id": order_data.provider_id,
        "driver_id": None,
        "items": [item.model_dump() for item in order_data.items],
        "total_amount": total,
        "pickup_address": order_data.pickup_address,
        "pickup_city": order_data.pickup_city,
        "pickup_state": order_data.pickup_state,
        "pickup_zipcode": order_data.pickup_zipcode,
        "pickup_time": order_data.pickup_time,
        "delivery_time": None,
        "status": "pending",
        "payment_status": "pending",
        "notes": order_data.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.insert_one(order_dict)
    return Order(**order_dict)

@api_router.get("/orders", response_model=List[Order])
async def get_orders(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user["role"] == "customer":
        query["customer_id"] = current_user["user_id"]
    elif current_user["role"] == "provider":
        query["provider_id"] = current_user["user_id"]
    elif current_user["role"] == "driver":
        query["driver_id"] = current_user["user_id"]
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [Order(**o) for o in orders]

@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if current_user["role"] == "customer" and order["customer_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user["role"] == "provider" and order["provider_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user["role"] == "driver" and order["driver_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return Order(**order)

@api_router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, status_update: OrderStatusUpdate, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": status_update.status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Order status updated"}

# Payment endpoints
@api_router.post("/payments/create-checkout", response_model=CheckoutSessionResponse)
async def create_checkout_session(checkout_req: CheckoutRequest, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": checkout_req.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["customer_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    host_url = checkout_req.origin_url
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    success_url = f"{host_url}/customer/orders?session_id={{{{CHECKOUT_SESSION_ID}}}}"
    cancel_url = f"{host_url}/customer/orders"
    
    checkout_request = CheckoutSessionRequest(
        amount=order["total_amount"],
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "order_id": checkout_req.order_id,
            "user_id": current_user["user_id"]
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    transaction_id = str(uuid.uuid4())
    transaction_dict = {
        "id": transaction_id,
        "session_id": session.session_id,
        "user_id": current_user["user_id"],
        "order_id": checkout_req.order_id,
        "amount": order["total_amount"],
        "currency": "usd",
        "payment_status": "pending",
        "metadata": {"order_id": checkout_req.order_id},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payment_transactions.insert_one(transaction_dict)
    
    return session

@api_router.get("/payments/status/{session_id}", response_model=CheckoutStatusResponse)
async def get_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction["payment_status"] == "paid":
        return CheckoutStatusResponse(
            status="complete",
            payment_status="paid",
            amount_total=int(transaction["amount"] * 100),
            currency=transaction["currency"],
            metadata=transaction["metadata"]
        )
    
    host_url = os.getenv("REACT_APP_BACKEND_URL", "http://localhost:8001")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    status_response = await stripe_checkout.get_checkout_status(session_id)
    
    if status_response.payment_status == "paid" and transaction["payment_status"] != "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        order_id = transaction.get("order_id")
        if order_id:
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {"payment_status": "paid", "status": "confirmed", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
    
    return status_response

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    body = await request.body()
    
    host_url = os.getenv("REACT_APP_BACKEND_URL", "http://localhost:8001")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, stripe_signature)
        
        if webhook_response.payment_status == "paid":
            transaction = await db.payment_transactions.find_one({"session_id": webhook_response.session_id}, {"_id": 0})
            if transaction and transaction["payment_status"] != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                
                order_id = transaction.get("order_id")
                if order_id:
                    await db.orders.update_one(
                        {"id": order_id},
                        {"$set": {"payment_status": "paid", "status": "confirmed", "updated_at": datetime.now(timezone.utc).isoformat()}}
                    )
        
        return {"status": "success"}
    except Exception as e:
        logging.error(f"Webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()