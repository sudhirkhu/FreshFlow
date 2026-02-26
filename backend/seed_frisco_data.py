"""
Seed script to populate database with Frisco-based laundry service providers
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone
import uuid
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Frisco-based service providers data
FRISCO_PROVIDERS = [
    {
        "business_name": "Fresh & Clean Laundry - Frisco Main",
        "address": "5 Main St",
        "city": "Frisco",
        "state": "TX",
        "zipcode": "75034",
        "services": ["Wash & Fold", "Dry Cleaning", "Ironing", "Eco-Friendly Cleaning"],
        "price_per_lb": 2.50,
        "rating": 4.8,
        "total_orders": 156,
        "status": "active"
    },
    {
        "business_name": "Sparkle Clean Dry Cleaners",
        "address": "8950 Main St Suite 100",
        "city": "Frisco",
        "state": "TX",
        "zipcode": "75034",
        "services": ["Dry Cleaning", "Alterations", "Stain Removal", "Ironing"],
        "price_per_lb": 3.00,
        "rating": 4.9,
        "total_orders": 243,
        "status": "active"
    },
    {
        "business_name": "Wash World - Frisco Square",
        "address": "6801 Gaylord Pkwy",
        "city": "Frisco",
        "state": "TX",
        "zipcode": "75034",
        "services": ["Wash & Fold", "Dry Cleaning", "Eco-Friendly Cleaning"],
        "price_per_lb": 2.25,
        "rating": 4.7,
        "total_orders": 198,
        "status": "active"
    },
    {
        "business_name": "Premium Dry Clean - Stonebriar",
        "address": "2601 Preston Rd Suite 1042",
        "city": "Frisco",
        "state": "TX",
        "zipcode": "75034",
        "services": ["Dry Cleaning", "Alterations", "Stain Removal", "Ironing", "Eco-Friendly Cleaning"],
        "price_per_lb": 3.50,
        "rating": 4.9,
        "total_orders": 312,
        "status": "active"
    },
    {
        "business_name": "Quick Wash Laundromat",
        "address": "8380 Warren Pkwy",
        "city": "Frisco",
        "state": "TX",
        "zipcode": "75034",
        "services": ["Wash & Fold", "Ironing"],
        "price_per_lb": 2.00,
        "rating": 4.6,
        "total_orders": 89,
        "status": "active"
    },
    {
        "business_name": "Elite Clean Services",
        "address": "5290 El Dorado Pkwy",
        "city": "Frisco",
        "state": "TX",
        "zipcode": "75035",
        "services": ["Wash & Fold", "Dry Cleaning", "Ironing", "Alterations", "Eco-Friendly Cleaning"],
        "price_per_lb": 2.75,
        "rating": 4.8,
        "total_orders": 267,
        "status": "active"
    },
    {
        "business_name": "Fresh Start Laundry Co.",
        "address": "3535 Legacy Dr",
        "city": "Frisco",
        "state": "TX",
        "zipcode": "75034",
        "services": ["Wash & Fold", "Eco-Friendly Cleaning", "Stain Removal"],
        "price_per_lb": 2.40,
        "rating": 4.7,
        "total_orders": 134,
        "status": "active"
    },
    {
        "business_name": "Pristine Cleaners - North Frisco",
        "address": "10655 Stonebrook Pkwy",
        "city": "Frisco",
        "state": "TX",
        "zipcode": "75035",
        "services": ["Dry Cleaning", "Alterations", "Ironing"],
        "price_per_lb": 3.25,
        "rating": 4.8,
        "total_orders": 176,
        "status": "active"
    }
]

# User accounts for providers
PROVIDER_USERS = [
    {
        "name": "John Martinez",
        "email": "john.martinez@freshclean.com",
        "password": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aqaJP1r9jU4K",  # password123
        "role": "provider",
        "phone": "(972) 555-0101",
        "status": "active"
    },
    {
        "name": "Sarah Johnson",
        "email": "sarah.j@sparkleclean.com",
        "password": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aqaJP1r9jU4K",
        "role": "provider",
        "phone": "(972) 555-0102",
        "status": "active"
    },
    {
        "name": "David Chen",
        "email": "david.chen@washworld.com",
        "password": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aqaJP1r9jU4K",
        "role": "provider",
        "phone": "(972) 555-0103",
        "status": "active"
    },
    {
        "name": "Maria Rodriguez",
        "email": "maria.r@premiumdry.com",
        "password": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aqaJP1r9jU4K",
        "role": "provider",
        "phone": "(972) 555-0104",
        "status": "active"
    },
    {
        "name": "Tom Wilson",
        "email": "tom.w@quickwash.com",
        "password": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aqaJP1r9jU4K",
        "role": "provider",
        "phone": "(972) 555-0105",
        "status": "active"
    },
    {
        "name": "Lisa Anderson",
        "email": "lisa.a@eliteclean.com",
        "password": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aqaJP1r9jU4K",
        "role": "provider",
        "phone": "(972) 555-0106",
        "status": "active"
    },
    {
        "name": "Robert Lee",
        "email": "robert.l@freshstart.com",
        "password": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aqaJP1r9jU4K",
        "role": "provider",
        "phone": "(972) 555-0107",
        "status": "active"
    },
    {
        "name": "Jennifer Kim",
        "email": "jennifer.k@pristinecleaners.com",
        "password": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aqaJP1r9jU4K",
        "role": "provider",
        "phone": "(972) 555-0108",
        "status": "active"
    }
]

async def seed_data():
    """Seed the database with Frisco-based providers"""
    print("🌱 Starting to seed Frisco-based providers...")
    
    # Create provider users first
    created_users = []
    for i, user_data in enumerate(PROVIDER_USERS):
        # Check if user already exists
        existing = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
        if existing:
            print(f"⚠️  User {user_data['email']} already exists, skipping...")
            created_users.append(existing)
            continue
        
        user_id = str(uuid.uuid4())
        user_doc = {
            "id": user_id,
            **user_data,
            "referral_code": f"FRISCO{i+1:02d}",
            "referred_by": None,
            "wallet_balance": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(user_doc)
        created_users.append(user_doc)
        print(f"✅ Created provider user: {user_data['name']}")
    
    # Create provider profiles
    for i, provider_data in enumerate(FRISCO_PROVIDERS):
        # Check if provider already exists
        existing = await db.service_providers.find_one(
            {"business_name": provider_data["business_name"]}, 
            {"_id": 0}
        )
        if existing:
            print(f"⚠️  Provider {provider_data['business_name']} already exists, skipping...")
            continue
        
        provider_doc = {
            "user_id": created_users[i]["id"],
            **provider_data,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.service_providers.insert_one(provider_doc)
        print(f"✅ Created provider: {provider_data['business_name']}")
    
    print("\n🎉 Seeding completed successfully!")
    print(f"📊 Total providers created: {len(FRISCO_PROVIDERS)}")
    print(f"📍 All providers located in Frisco, TX")
    print("\n💡 Provider login credentials (all use password: password123):")
    for user in PROVIDER_USERS:
        print(f"   - {user['email']}")

async def main():
    try:
        await seed_data()
    except Exception as e:
        print(f"❌ Error seeding data: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
