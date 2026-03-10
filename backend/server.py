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
import stripe

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
    pickup_ride_id: Optional[str] = None
    pickup_ride_status: Optional[str] = None
    delivery_ride_id: Optional[str] = None
    delivery_ride_status: Optional[str] = None
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

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def generate_referral_code() -> str:
    """Generate a unique 8-character referral code"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(8))

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
    referral_code = generate_referral_code()
    
    # Ensure referral code is unique
    while await db.users.find_one({"referral_code": referral_code}):
        referral_code = generate_referral_code()
    
    user_dict = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "phone": user_data.phone,
        "password": hash_password(user_data.password),
        "status": "active",
        "referral_code": referral_code,
        "referred_by": None,
        "wallet_balance": 0.0,
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

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Request a password reset token"""
    user = await db.users.find_one({"email": request.email}, {"_id": 0})
    if not user:
        # Don't reveal if email exists or not for security
        return {"message": "If your email is registered, you will receive a password reset link"}
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    reset_expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Store reset token in database
    await db.password_resets.insert_one({
        "user_id": user["id"],
        "token": reset_token,
        "expires_at": reset_expiry.isoformat(),
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # In production, send email with reset link
    # For now, return the token (in production this would only be in email)
    reset_link = f"http://localhost:3000/reset-password?token={reset_token}"
    
    # Log for demonstration purposes
    logger.info(f"Password reset requested for {request.email}. Token: {reset_token}")
    
    return {
        "message": "If your email is registered, you will receive a password reset link",
        "reset_link": reset_link  # Remove this in production
    }

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password using a valid token"""
    # Find valid token
    reset_record = await db.password_resets.find_one({
        "token": request.token,
        "used": False
    }, {"_id": 0})
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check if token has expired
    expiry_time = datetime.fromisoformat(reset_record["expires_at"])
    if datetime.now(timezone.utc) > expiry_time:
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    # Update user password
    new_password_hash = hash_password(request.new_password)
    await db.users.update_one(
        {"id": reset_record["user_id"]},
        {"$set": {"password": new_password_hash}}
    )
    
    # Mark token as used
    await db.password_resets.update_one(
        {"token": request.token},
        {"$set": {"used": True}}
    )
    
    return {"message": "Password successfully reset. You can now login with your new password"}

@api_router.post("/auth/verify-reset-token")
async def verify_reset_token(token: str):
    """Verify if a reset token is valid"""
    reset_record = await db.password_resets.find_one({
        "token": token,
        "used": False
    }, {"_id": 0})
    
    if not reset_record:
        return {"valid": False}
    
    # Check if token has expired
    expiry_time = datetime.fromisoformat(reset_record["expires_at"])
    if datetime.now(timezone.utc) > expiry_time:
        return {"valid": False}
    
    return {"valid": True}

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

# Referral endpoints
@api_router.post("/referrals/apply")
async def apply_referral_code(referral_req: ApplyReferralRequest, current_user: dict = Depends(get_current_user)):
    # Check if user already has a referrer
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0})
    if user.get("referred_by"):
        raise HTTPException(status_code=400, detail="You have already used a referral code")
    
    # Find the referrer
    referrer = await db.users.find_one({"referral_code": referral_req.referral_code}, {"_id": 0})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    if referrer["id"] == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="You cannot use your own referral code")
    
    # Credit both users
    REFERRAL_BONUS = 10.0
    
    # Update referred user
    await db.users.update_one(
        {"id": current_user["user_id"]},
        {
            "$set": {"referred_by": referrer["id"]},
            "$inc": {"wallet_balance": REFERRAL_BONUS}
        }
    )
    
    # Update referrer
    await db.users.update_one(
        {"id": referrer["id"]},
        {"$inc": {"wallet_balance": REFERRAL_BONUS}}
    )
    
    # Track referral
    referral_record = {
        "id": str(uuid.uuid4()),
        "referrer_id": referrer["id"],
        "referred_user_id": current_user["user_id"],
        "bonus_amount": REFERRAL_BONUS,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.referrals.insert_one(referral_record)
    
    return {
        "message": f"Referral code applied! You and {referrer['name']} both received ${REFERRAL_BONUS} credits!",
        "bonus_amount": REFERRAL_BONUS
    }

@api_router.get("/referrals/my-stats", response_model=ReferralStats)
async def get_referral_stats(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all users referred by this user
    referred_users = await db.users.find(
        {"referred_by": current_user["user_id"]},
        {"_id": 0, "name": 1, "email": 1, "created_at": 1}
    ).to_list(100)
    
    # Get referral records
    referral_records = await db.referrals.find(
        {"referrer_id": current_user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    total_credits = sum(r.get("bonus_amount", 0) for r in referral_records)
    
    return ReferralStats(
        referral_code=user.get("referral_code", ""),
        total_referrals=len(referred_users),
        total_credits_earned=total_credits,
        referrals=[
            {
                "name": u["name"],
                "email": u["email"],
                "joined_date": u["created_at"]
            }
            for u in referred_users
        ]
    )

@api_router.get("/wallet/balance", response_model=WalletBalance)
async def get_wallet_balance(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return WalletBalance(balance=user.get("wallet_balance", 0.0))

# Uber-like Ride endpoints
@api_router.post("/orders/{order_id}/request-pickup-ride")
async def request_pickup_ride(order_id: str, current_user: dict = Depends(get_current_user)):
    """Request a ride for laundry pickup (simulated Uber-like service)"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["customer_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Simulate ride request
    ride_id = str(uuid.uuid4())
    ride_data = {
        "id": ride_id,
        "order_id": order_id,
        "type": "pickup",
        "pickup_address": order["pickup_address"],
        "pickup_city": order["pickup_city"],
        "pickup_state": order["pickup_state"],
        "pickup_zipcode": order["pickup_zipcode"],
        "dropoff_address": "Provider Location",  # Would be provider's address
        "status": "requested",
        "driver_name": None,
        "driver_phone": None,
        "vehicle_info": None,
        "eta_minutes": None,
        "ride_cost": 12.50,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.rides.insert_one(ride_data)
    
    # Update order with ride info
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "pickup_ride_id": ride_id,
                "pickup_ride_status": "requested",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Simulate driver assignment after a moment
    import random
    driver_names = ["Mike Johnson", "Sarah Williams", "David Brown", "Lisa Garcia"]
    ride_data["status"] = "driver_assigned"
    ride_data["driver_name"] = random.choice(driver_names)
    ride_data["driver_phone"] = f"(972) 555-{random.randint(1000, 9999)}"
    ride_data["vehicle_info"] = f"{random.choice(['Toyota', 'Honda', 'Ford'])} {random.choice(['Camry', 'Accord', 'Focus'])}"
    ride_data["eta_minutes"] = random.randint(5, 15)
    
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": ride_data}
    )
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"pickup_ride_status": "driver_assigned"}}
    )
    
    ride_data.pop("_id", None)
    return ride_data

@api_router.post("/orders/{order_id}/request-delivery-ride")
async def request_delivery_ride(order_id: str, current_user: dict = Depends(get_current_user)):
    """Request a ride for laundry delivery (simulated Uber-like service)"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Simulate ride request
    ride_id = str(uuid.uuid4())
    ride_data = {
        "id": ride_id,
        "order_id": order_id,
        "type": "delivery",
        "pickup_address": "Provider Location",
        "dropoff_address": order["pickup_address"],
        "dropoff_city": order["pickup_city"],
        "dropoff_state": order["pickup_state"],
        "dropoff_zipcode": order["pickup_zipcode"],
        "status": "requested",
        "driver_name": None,
        "driver_phone": None,
        "vehicle_info": None,
        "eta_minutes": None,
        "ride_cost": 12.50,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.rides.insert_one(ride_data)
    
    # Update order with ride info
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "delivery_ride_id": ride_id,
                "delivery_ride_status": "requested",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Simulate driver assignment
    import random
    driver_names = ["Mike Johnson", "Sarah Williams", "David Brown", "Lisa Garcia"]
    ride_data["status"] = "driver_assigned"
    ride_data["driver_name"] = random.choice(driver_names)
    ride_data["driver_phone"] = f"(972) 555-{random.randint(1000, 9999)}"
    ride_data["vehicle_info"] = f"{random.choice(['Toyota', 'Honda', 'Ford'])} {random.choice(['Camry', 'Accord', 'Focus'])}"
    ride_data["eta_minutes"] = random.randint(10, 20)
    
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": ride_data}
    )
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"delivery_ride_status": "driver_assigned"}}
    )
    
    ride_data.pop("_id", None)
    return ride_data

@api_router.get("/rides/{ride_id}")
async def get_ride_status(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Get ride status"""
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    return ride

# Payment endpoints
class CheckoutSessionResponse(BaseModel):
    session_id: str
    checkout_url: str

class CheckoutStatusResponse(BaseModel):
    status: str
    payment_status: str
    amount_total: Optional[int] = None
    currency: Optional[str] = None
    metadata: Optional[Dict] = None

@api_router.post("/payments/create-checkout", response_model=CheckoutSessionResponse)
async def create_checkout_session(checkout_req: CheckoutRequest, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": checkout_req.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order["customer_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    host_url = checkout_req.origin_url
    success_url = f"{host_url}/customer/orders?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{host_url}/customer/orders"

    stripe.api_key = STRIPE_API_KEY
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "usd",
                "unit_amount": int(order["total_amount"] * 100),
                "product_data": {
                    "name": f"FreshFlow Order #{checkout_req.order_id[:8]}"
                }
            },
            "quantity": 1
        }],
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "order_id": checkout_req.order_id,
            "user_id": current_user["user_id"]
        }
    )

    transaction_id = str(uuid.uuid4())
    transaction_dict = {
        "id": transaction_id,
        "session_id": session.id,
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

    return CheckoutSessionResponse(session_id=session.id, checkout_url=session.url)

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

    stripe.api_key = STRIPE_API_KEY
    session = stripe.checkout.Session.retrieve(session_id)

    payment_status = "paid" if session.payment_status == "paid" else session.payment_status

    if payment_status == "paid" and transaction["payment_status"] != "paid":
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

    return CheckoutStatusResponse(
        status=session.status,
        payment_status=payment_status,
        amount_total=session.amount_total,
        currency=session.currency,
        metadata=dict(session.metadata) if session.metadata else {}
    )

STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    body = await request.body()

    stripe.api_key = STRIPE_API_KEY

    try:
        event = stripe.Webhook.construct_event(body, stripe_signature, STRIPE_WEBHOOK_SECRET)

        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            session_id = session["id"]
            payment_status = session.get("payment_status", "")

            if payment_status == "paid":
                transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
                if transaction and transaction["payment_status"] != "paid":
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

        return {"status": "success"}
    except stripe.error.SignatureVerificationError as e:
        logging.error(f"Webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
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