"""
FreshFlow End-to-End Test Suite
Tests the complete laundry order lifecycle:
1. User Registration & Auth
2. Provider listing & nearest laundry selection
3. Order placement
4. Pickup ride request (Uber-like)
5. Order status updates through processing
6. Next-day delivery ride & completion
7. Referral system & wallet
8. Password reset flow
"""
import requests
import json
import sys
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8001/api"

class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    END = "\033[0m"

def log_pass(test_name, detail=""):
    print(f"  {Colors.GREEN}PASS{Colors.END} {test_name} {Colors.CYAN}{detail}{Colors.END}")

def log_fail(test_name, detail=""):
    print(f"  {Colors.RED}FAIL{Colors.END} {test_name} {Colors.RED}{detail}{Colors.END}")

def log_section(title):
    print(f"\n{Colors.BOLD}{Colors.YELLOW}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.YELLOW}  {title}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.YELLOW}{'='*60}{Colors.END}")

class FreshFlowE2ETest:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.customer_token = None
        self.customer_id = None
        self.customer_referral_code = None
        self.driver_token = None
        self.driver_id = None
        self.provider_token = None
        self.provider_id = None
        self.selected_provider = None
        self.order_id = None
        self.pickup_ride_id = None
        self.delivery_ride_id = None
        self.second_customer_token = None

    def check(self, test_name, condition, detail=""):
        if condition:
            self.passed += 1
            log_pass(test_name, detail)
            return True
        else:
            self.failed += 1
            log_fail(test_name, detail)
            return False

    def auth_header(self, token):
        return {"Authorization": f"Bearer {token}"}

    # =========================================================
    # PHASE 1: Authentication & Registration
    # =========================================================
    def test_customer_registration(self):
        log_section("PHASE 1: User Registration & Authentication")

        r = requests.post(f"{BASE_URL}/auth/register", json={
            "email": "testcustomer@freshflow.com",
            "name": "Test Customer",
            "role": "customer",
            "phone": "(972) 555-9001",
            "password": "testpass123"
        })
        self.check("Customer registration", r.status_code == 200, f"status={r.status_code}")

        if r.status_code == 200:
            data = r.json()
            self.customer_token = data["access_token"]
            self.customer_id = data["user"]["id"]
            self.customer_referral_code = data["user"]["referral_code"]
            self.check("Customer token received", self.customer_token is not None)
            self.check("Customer referral code generated", len(self.customer_referral_code) == 8,
                       f"code={self.customer_referral_code}")

    def test_driver_registration(self):
        r = requests.post(f"{BASE_URL}/auth/register", json={
            "email": "testdriver@freshflow.com",
            "name": "Test Driver",
            "role": "driver",
            "phone": "(972) 555-9002",
            "password": "testpass123"
        })
        self.check("Driver registration", r.status_code == 200, f"status={r.status_code}")

        if r.status_code == 200:
            data = r.json()
            self.driver_token = data["access_token"]
            self.driver_id = data["user"]["id"]

    def test_duplicate_registration(self):
        r = requests.post(f"{BASE_URL}/auth/register", json={
            "email": "testcustomer@freshflow.com",
            "name": "Test Customer Dup",
            "role": "customer",
            "password": "testpass123"
        })
        self.check("Duplicate email rejected", r.status_code == 400, f"status={r.status_code}")

    def test_customer_login(self):
        r = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "testcustomer@freshflow.com",
            "password": "testpass123"
        })
        self.check("Customer login", r.status_code == 200, f"status={r.status_code}")
        data = r.json()
        self.check("Login returns user data", data["user"]["name"] == "Test Customer")

    def test_invalid_login(self):
        r = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "testcustomer@freshflow.com",
            "password": "wrongpassword"
        })
        self.check("Invalid password rejected", r.status_code == 401, f"status={r.status_code}")

    def test_get_current_user(self):
        r = requests.get(f"{BASE_URL}/auth/me", headers=self.auth_header(self.customer_token))
        self.check("Get current user (me)", r.status_code == 200, f"status={r.status_code}")
        data = r.json()
        self.check("User data correct", data["email"] == "testcustomer@freshflow.com")
        self.check("User role correct", data["role"] == "customer")

    def test_provider_login(self):
        r = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "john.martinez@freshclean.com",
            "password": "password123"
        })
        self.check("Provider login (seeded user)", r.status_code == 200, f"status={r.status_code}")

        if r.status_code == 200:
            data = r.json()
            self.provider_token = data["access_token"]
            self.provider_id = data["user"]["id"]

    # =========================================================
    # PHASE 2: Driver Onboarding
    # =========================================================
    def test_driver_onboarding(self):
        log_section("PHASE 2: Driver Onboarding")

        r = requests.post(f"{BASE_URL}/drivers/profile",
            headers=self.auth_header(self.driver_token),
            json={
                "vehicle_type": "SUV",
                "license_number": "TX-DRV-2026-001"
            })
        self.check("Driver profile creation", r.status_code == 200, f"status={r.status_code}")

        if r.status_code == 200:
            data = r.json()
            self.check("Driver vehicle type saved", data["vehicle_type"] == "SUV")
            self.check("Driver starts offline", data["status"] == "offline")

    def test_driver_go_online(self):
        r = requests.patch(f"{BASE_URL}/drivers/status?status=online",
            headers=self.auth_header(self.driver_token))
        self.check("Driver go online", r.status_code == 200, f"status={r.status_code}")

    def test_driver_update_location(self):
        r = requests.patch(f"{BASE_URL}/drivers/location",
            headers=self.auth_header(self.driver_token),
            json={"latitude": 33.1507, "longitude": -96.8236})
        self.check("Driver update location (Frisco, TX)", r.status_code == 200, f"status={r.status_code}")

    def test_driver_get_profile(self):
        r = requests.get(f"{BASE_URL}/drivers/me", headers=self.auth_header(self.driver_token))
        self.check("Get driver profile", r.status_code == 200, f"status={r.status_code}")
        if r.status_code == 200:
            data = r.json()
            self.check("Driver is online", data["status"] == "online")
            self.check("Driver location set", data["current_location"] is not None)

    # =========================================================
    # PHASE 3: Browse Providers & Select Nearest Laundry
    # =========================================================
    def test_browse_providers(self):
        log_section("PHASE 3: Browse Providers & Select Nearest Laundry")

        r = requests.get(f"{BASE_URL}/providers?city=Frisco")
        self.check("List Frisco providers", r.status_code == 200, f"status={r.status_code}")

        if r.status_code == 200:
            providers = r.json()
            self.check("Multiple providers available", len(providers) >= 5, f"count={len(providers)}")

            # Select nearest/cheapest provider (Quick Wash at $2.00/lb)
            cheapest = min(providers, key=lambda p: p["price_per_lb"])
            self.selected_provider = cheapest
            self.check("Cheapest provider found", cheapest["price_per_lb"] == 2.00,
                       f"{cheapest['business_name']} @ ${cheapest['price_per_lb']}/lb")

            # Also check highest rated
            best_rated = max(providers, key=lambda p: p["rating"])
            self.check("Highest rated provider found", best_rated["rating"] >= 4.9,
                       f"{best_rated['business_name']} rating={best_rated['rating']}")

            # Select the nearest one (cheapest for this test)
            print(f"\n  {Colors.CYAN}Selected Provider: {self.selected_provider['business_name']}{Colors.END}")
            print(f"  {Colors.CYAN}  Address: {self.selected_provider['address']}, {self.selected_provider['city']}, {self.selected_provider['state']}{Colors.END}")
            print(f"  {Colors.CYAN}  Services: {', '.join(self.selected_provider['services'])}{Colors.END}")
            print(f"  {Colors.CYAN}  Price: ${self.selected_provider['price_per_lb']}/lb{Colors.END}")

    def test_get_provider_profile(self):
        r = requests.get(f"{BASE_URL}/providers/me", headers=self.auth_header(self.provider_token))
        self.check("Provider can view own profile", r.status_code == 200, f"status={r.status_code}")

    # =========================================================
    # PHASE 4: Place an Order
    # =========================================================
    def test_place_order(self):
        log_section("PHASE 4: Place Order with Selected Laundry")

        pickup_time = (datetime.now() + timedelta(hours=1)).isoformat()

        order_items = [
            {"service_type": "Wash & Fold", "weight": 8.5, "price": 8.5 * self.selected_provider["price_per_lb"]},
            {"service_type": "Ironing", "weight": 3.0, "price": 3.0 * self.selected_provider["price_per_lb"]}
        ]
        total = sum(i["price"] for i in order_items)

        r = requests.post(f"{BASE_URL}/orders",
            headers=self.auth_header(self.customer_token),
            json={
                "provider_id": self.selected_provider["user_id"],
                "items": order_items,
                "pickup_address": "1234 Elm Street",
                "pickup_city": "Frisco",
                "pickup_state": "TX",
                "pickup_zipcode": "75034",
                "pickup_time": pickup_time,
                "notes": "Please handle delicates with care"
            })
        self.check("Order created", r.status_code == 200, f"status={r.status_code}")

        if r.status_code == 200:
            data = r.json()
            self.order_id = data["id"]
            self.check("Order ID assigned", self.order_id is not None)
            self.check("Order status is pending", data["status"] == "pending")
            self.check("Payment status is pending", data["payment_status"] == "pending")
            self.check("Total amount calculated", data["total_amount"] == total,
                       f"${data['total_amount']}")
            self.check("Order has 2 items", len(data["items"]) == 2)
            self.check("Notes saved", data["notes"] == "Please handle delicates with care")

            print(f"\n  {Colors.CYAN}Order #{self.order_id[:8]}...{Colors.END}")
            print(f"  {Colors.CYAN}  Total: ${data['total_amount']:.2f}{Colors.END}")
            print(f"  {Colors.CYAN}  Items: {len(data['items'])} services{Colors.END}")

    def test_customer_view_orders(self):
        r = requests.get(f"{BASE_URL}/orders", headers=self.auth_header(self.customer_token))
        self.check("Customer can list orders", r.status_code == 200, f"status={r.status_code}")
        if r.status_code == 200:
            orders = r.json()
            self.check("Customer sees their order", len(orders) >= 1)

    def test_get_order_detail(self):
        r = requests.get(f"{BASE_URL}/orders/{self.order_id}",
            headers=self.auth_header(self.customer_token))
        self.check("Get order detail", r.status_code == 200, f"status={r.status_code}")

    def test_provider_view_orders(self):
        r = requests.get(f"{BASE_URL}/orders", headers=self.auth_header(self.provider_token))
        self.check("Provider can list their orders", r.status_code == 200, f"status={r.status_code}")

    # =========================================================
    # PHASE 5: Request Pickup Ride (Uber-like)
    # =========================================================
    def test_request_pickup_ride(self):
        log_section("PHASE 5: Request Uber Pickup Ride")

        r = requests.post(f"{BASE_URL}/orders/{self.order_id}/request-pickup-ride",
            headers=self.auth_header(self.customer_token))
        self.check("Pickup ride requested", r.status_code == 200, f"status={r.status_code}")

        if r.status_code == 200:
            data = r.json()
            self.pickup_ride_id = data["id"]
            self.check("Ride ID assigned", self.pickup_ride_id is not None)
            self.check("Driver auto-assigned", data["driver_name"] is not None,
                       f"driver={data['driver_name']}")
            self.check("Vehicle info provided", data["vehicle_info"] is not None,
                       f"vehicle={data['vehicle_info']}")
            self.check("ETA provided", data["eta_minutes"] is not None,
                       f"ETA={data['eta_minutes']} min")
            self.check("Ride cost set", data["ride_cost"] == 12.50, f"${data['ride_cost']}")
            self.check("Ride type is pickup", data["type"] == "pickup")

            print(f"\n  {Colors.CYAN}Pickup Ride Details:{Colors.END}")
            print(f"  {Colors.CYAN}  Driver: {data['driver_name']}{Colors.END}")
            print(f"  {Colors.CYAN}  Vehicle: {data['vehicle_info']}{Colors.END}")
            print(f"  {Colors.CYAN}  ETA: {data['eta_minutes']} minutes{Colors.END}")
            print(f"  {Colors.CYAN}  Cost: ${data['ride_cost']}{Colors.END}")

    def test_get_ride_status(self):
        r = requests.get(f"{BASE_URL}/rides/{self.pickup_ride_id}",
            headers=self.auth_header(self.customer_token))
        self.check("Get pickup ride status", r.status_code == 200, f"status={r.status_code}")
        if r.status_code == 200:
            data = r.json()
            self.check("Ride status is driver_assigned", data["status"] == "driver_assigned")

    def test_order_has_ride_info(self):
        r = requests.get(f"{BASE_URL}/orders/{self.order_id}",
            headers=self.auth_header(self.customer_token))
        if r.status_code == 200:
            data = r.json()
            self.check("Order linked to pickup ride", data["pickup_ride_id"] == self.pickup_ride_id)
            self.check("Order pickup ride status updated", data["pickup_ride_status"] == "driver_assigned")

    # =========================================================
    # PHASE 6: Order Processing Workflow
    # =========================================================
    def test_order_processing(self):
        log_section("PHASE 6: Order Processing (Provider Workflow)")

        # Provider confirms the order
        r = requests.patch(f"{BASE_URL}/orders/{self.order_id}/status",
            headers=self.auth_header(self.provider_token),
            json={"status": "confirmed"})
        self.check("Provider confirms order", r.status_code == 200, f"status={r.status_code}")

        # Simulate: clothes picked up and delivered to laundry
        r = requests.patch(f"{BASE_URL}/orders/{self.order_id}/status",
            headers=self.auth_header(self.provider_token),
            json={"status": "picked_up"})
        self.check("Order marked as picked up", r.status_code == 200, f"status={r.status_code}")

        # Provider starts processing
        r = requests.patch(f"{BASE_URL}/orders/{self.order_id}/status",
            headers=self.auth_header(self.provider_token),
            json={"status": "processing"})
        self.check("Order in processing", r.status_code == 200, f"status={r.status_code}")

        # Verify order status
        r = requests.get(f"{BASE_URL}/orders/{self.order_id}",
            headers=self.auth_header(self.customer_token))
        if r.status_code == 200:
            self.check("Customer sees processing status", r.json()["status"] == "processing")

    # =========================================================
    # PHASE 7: Next Day - Ready & Delivery
    # =========================================================
    def test_next_day_ready(self):
        log_section("PHASE 7: Next Day - Ready for Delivery")

        # Provider marks order as ready
        r = requests.patch(f"{BASE_URL}/orders/{self.order_id}/status",
            headers=self.auth_header(self.provider_token),
            json={"status": "ready_for_pickup"})
        self.check("Order marked ready for delivery", r.status_code == 200, f"status={r.status_code}")

    def test_driver_sees_available_order(self):
        r = requests.get(f"{BASE_URL}/drivers/available-orders",
            headers=self.auth_header(self.driver_token))
        self.check("Driver sees available orders", r.status_code == 200, f"status={r.status_code}")
        if r.status_code == 200:
            orders = r.json()
            self.check("Order appears in available jobs",
                       any(o["id"] == self.order_id for o in orders),
                       f"available_orders={len(orders)}")

    def test_driver_accepts_order(self):
        r = requests.patch(f"{BASE_URL}/orders/{self.order_id}/accept-driver",
            headers=self.auth_header(self.driver_token))
        self.check("Driver accepts order", r.status_code == 200, f"status={r.status_code}")

        # Verify driver assigned
        r = requests.get(f"{BASE_URL}/orders/{self.order_id}",
            headers=self.auth_header(self.customer_token))
        if r.status_code == 200:
            data = r.json()
            self.check("Driver assigned to order", data["driver_id"] == self.driver_id)
            self.check("Order status is driver_assigned", data["status"] == "driver_assigned")

    def test_request_delivery_ride(self):
        log_section("PHASE 7b: Request Delivery Ride")

        r = requests.post(f"{BASE_URL}/orders/{self.order_id}/request-delivery-ride",
            headers=self.auth_header(self.customer_token))
        self.check("Delivery ride requested", r.status_code == 200, f"status={r.status_code}")

        if r.status_code == 200:
            data = r.json()
            self.delivery_ride_id = data["id"]
            self.check("Delivery ride ID assigned", self.delivery_ride_id is not None)
            self.check("Delivery driver assigned", data["driver_name"] is not None,
                       f"driver={data['driver_name']}")
            self.check("Delivery ETA provided", data["eta_minutes"] is not None,
                       f"ETA={data['eta_minutes']} min")
            self.check("Ride type is delivery", data["type"] == "delivery")
            self.check("Dropoff is customer address", data["dropoff_address"] == "1234 Elm Street")

            print(f"\n  {Colors.CYAN}Delivery Ride Details:{Colors.END}")
            print(f"  {Colors.CYAN}  Driver: {data['driver_name']}{Colors.END}")
            print(f"  {Colors.CYAN}  Vehicle: {data['vehicle_info']}{Colors.END}")
            print(f"  {Colors.CYAN}  ETA: {data['eta_minutes']} minutes{Colors.END}")
            print(f"  {Colors.CYAN}  Delivering to: {data['dropoff_address']}{Colors.END}")

    def test_order_delivered(self):
        # Mark as out for delivery
        r = requests.patch(f"{BASE_URL}/orders/{self.order_id}/status",
            headers=self.auth_header(self.driver_token),
            json={"status": "out_for_delivery"})
        self.check("Order out for delivery", r.status_code == 200, f"status={r.status_code}")

        # Mark as delivered
        r = requests.patch(f"{BASE_URL}/orders/{self.order_id}/status",
            headers=self.auth_header(self.driver_token),
            json={"status": "delivered"})
        self.check("Order delivered", r.status_code == 200, f"status={r.status_code}")

        # Verify final status
        r = requests.get(f"{BASE_URL}/orders/{self.order_id}",
            headers=self.auth_header(self.customer_token))
        if r.status_code == 200:
            data = r.json()
            self.check("Final status is delivered", data["status"] == "delivered")
            self.check("Order has pickup ride", data["pickup_ride_id"] is not None)
            self.check("Order has delivery ride", data["delivery_ride_id"] is not None)

            print(f"\n  {Colors.CYAN}Order Complete!{Colors.END}")
            print(f"  {Colors.CYAN}  Status: {data['status']}{Colors.END}")
            print(f"  {Colors.CYAN}  Total: ${data['total_amount']:.2f}{Colors.END}")

    # =========================================================
    # PHASE 8: Referral System & Wallet
    # =========================================================
    def test_referral_system(self):
        log_section("PHASE 8: Referral System & Wallet")

        # Register second customer
        r = requests.post(f"{BASE_URL}/auth/register", json={
            "email": "customer2@freshflow.com",
            "name": "Second Customer",
            "role": "customer",
            "phone": "(972) 555-9003",
            "password": "testpass123"
        })
        self.check("Second customer registered", r.status_code == 200)

        if r.status_code == 200:
            self.second_customer_token = r.json()["access_token"]

        # Apply referral code
        r = requests.post(f"{BASE_URL}/referrals/apply",
            headers=self.auth_header(self.second_customer_token),
            json={"referral_code": self.customer_referral_code})
        self.check("Referral code applied", r.status_code == 200, f"status={r.status_code}")

        if r.status_code == 200:
            data = r.json()
            self.check("Referral bonus is $10", data["bonus_amount"] == 10.0)

    def test_self_referral_blocked(self):
        r = requests.post(f"{BASE_URL}/referrals/apply",
            headers=self.auth_header(self.customer_token),
            json={"referral_code": self.customer_referral_code})
        self.check("Self-referral blocked", r.status_code == 400, f"status={r.status_code}")

    def test_wallet_balance(self):
        r = requests.get(f"{BASE_URL}/wallet/balance",
            headers=self.auth_header(self.customer_token))
        self.check("Get wallet balance", r.status_code == 200, f"status={r.status_code}")
        if r.status_code == 200:
            data = r.json()
            self.check("Referrer got $10 credit", data["balance"] == 10.0, f"${data['balance']}")

        # Check referred user balance
        r = requests.get(f"{BASE_URL}/wallet/balance",
            headers=self.auth_header(self.second_customer_token))
        if r.status_code == 200:
            data = r.json()
            self.check("Referred user got $10 credit", data["balance"] == 10.0, f"${data['balance']}")

    def test_referral_stats(self):
        r = requests.get(f"{BASE_URL}/referrals/my-stats",
            headers=self.auth_header(self.customer_token))
        self.check("Get referral stats", r.status_code == 200, f"status={r.status_code}")
        if r.status_code == 200:
            data = r.json()
            self.check("Total referrals = 1", data["total_referrals"] == 1)
            self.check("Total credits = $10", data["total_credits_earned"] == 10.0)

    # =========================================================
    # PHASE 9: Password Reset Flow
    # =========================================================
    def test_password_reset(self):
        log_section("PHASE 9: Password Reset Flow")

        # Request password reset
        r = requests.post(f"{BASE_URL}/auth/forgot-password",
            json={"email": "testcustomer@freshflow.com"})
        self.check("Password reset requested", r.status_code == 200, f"status={r.status_code}")

        if r.status_code == 200:
            data = r.json()
            reset_link = data.get("reset_link", "")
            token = reset_link.split("token=")[-1] if "token=" in reset_link else None
            self.check("Reset token generated", token is not None)

            if token:
                # Verify token
                r = requests.post(f"{BASE_URL}/auth/verify-reset-token?token={token}")
                self.check("Reset token is valid", r.status_code == 200 and r.json().get("valid") == True)

                # Reset password
                r = requests.post(f"{BASE_URL}/auth/reset-password",
                    json={"token": token, "new_password": "newpassword123"})
                self.check("Password reset successful", r.status_code == 200, f"status={r.status_code}")

                # Login with new password
                r = requests.post(f"{BASE_URL}/auth/login", json={
                    "email": "testcustomer@freshflow.com",
                    "password": "newpassword123"
                })
                self.check("Login with new password works", r.status_code == 200)

                # Old password should fail
                r = requests.post(f"{BASE_URL}/auth/login", json={
                    "email": "testcustomer@freshflow.com",
                    "password": "testpass123"
                })
                self.check("Old password rejected", r.status_code == 401)

                # Token can't be reused
                r = requests.post(f"{BASE_URL}/auth/reset-password",
                    json={"token": token, "new_password": "anotherpass"})
                self.check("Used token rejected", r.status_code == 400)

    def test_forgot_password_unknown_email(self):
        r = requests.post(f"{BASE_URL}/auth/forgot-password",
            json={"email": "unknown@example.com"})
        self.check("Unknown email doesn't reveal existence", r.status_code == 200)

    # =========================================================
    # PHASE 10: Authorization & Edge Cases
    # =========================================================
    def test_authorization_checks(self):
        log_section("PHASE 10: Authorization & Edge Cases")

        # Customer can't create driver profile
        r = requests.post(f"{BASE_URL}/drivers/profile",
            headers=self.auth_header(self.customer_token),
            json={"vehicle_type": "Car", "license_number": "XXX"})
        self.check("Customer can't create driver profile", r.status_code == 403)

        # Driver can't create order
        r = requests.post(f"{BASE_URL}/orders",
            headers=self.auth_header(self.driver_token),
            json={
                "provider_id": "fake",
                "items": [{"service_type": "Wash", "weight": 1, "price": 5}],
                "pickup_address": "123 St",
                "pickup_city": "Frisco",
                "pickup_state": "TX",
                "pickup_zipcode": "75034",
                "pickup_time": datetime.now().isoformat()
            })
        self.check("Driver can't create order", r.status_code == 403)

        # Unauthenticated access
        r = requests.get(f"{BASE_URL}/auth/me")
        self.check("Unauthenticated access rejected", r.status_code == 403)

        # Invalid token
        r = requests.get(f"{BASE_URL}/auth/me",
            headers={"Authorization": "Bearer invalid_token_here"})
        self.check("Invalid token rejected", r.status_code == 401)

        # Non-existent order
        r = requests.get(f"{BASE_URL}/orders/nonexistent-id",
            headers=self.auth_header(self.customer_token))
        self.check("Non-existent order returns 404", r.status_code == 404)

    # =========================================================
    # RUN ALL TESTS
    # =========================================================
    def run_all(self):
        print(f"\n{Colors.BOLD}{'*'*60}{Colors.END}")
        print(f"{Colors.BOLD}  FreshFlow E2E Test Suite{Colors.END}")
        print(f"{Colors.BOLD}  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.END}")
        print(f"{Colors.BOLD}{'*'*60}{Colors.END}")

        # Phase 1: Auth
        self.test_customer_registration()
        self.test_driver_registration()
        self.test_duplicate_registration()
        self.test_customer_login()
        self.test_invalid_login()
        self.test_get_current_user()
        self.test_provider_login()

        # Phase 2: Driver Onboarding
        self.test_driver_onboarding()
        self.test_driver_go_online()
        self.test_driver_update_location()
        self.test_driver_get_profile()

        # Phase 3: Browse Providers
        self.test_browse_providers()
        self.test_get_provider_profile()

        # Phase 4: Place Order
        self.test_place_order()
        self.test_customer_view_orders()
        self.test_get_order_detail()
        self.test_provider_view_orders()

        # Phase 5: Pickup Ride
        self.test_request_pickup_ride()
        self.test_get_ride_status()
        self.test_order_has_ride_info()

        # Phase 6: Processing
        self.test_order_processing()

        # Phase 7: Next Day Delivery
        self.test_next_day_ready()
        self.test_driver_sees_available_order()
        self.test_driver_accepts_order()
        self.test_request_delivery_ride()
        self.test_order_delivered()

        # Phase 8: Referrals
        self.test_referral_system()
        self.test_self_referral_blocked()
        self.test_wallet_balance()
        self.test_referral_stats()

        # Phase 9: Password Reset
        self.test_password_reset()
        self.test_forgot_password_unknown_email()

        # Phase 10: Auth Checks
        self.test_authorization_checks()

        # Summary
        total = self.passed + self.failed
        print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
        print(f"{Colors.BOLD}  TEST RESULTS{Colors.END}")
        print(f"{Colors.BOLD}{'='*60}{Colors.END}")
        print(f"  Total:  {total}")
        print(f"  {Colors.GREEN}Passed: {self.passed}{Colors.END}")
        print(f"  {Colors.RED}Failed: {self.failed}{Colors.END}")
        print(f"  Rate:   {(self.passed/total*100):.1f}%" if total > 0 else "")
        print(f"{Colors.BOLD}{'='*60}{Colors.END}\n")

        return self.failed == 0

if __name__ == "__main__":
    test = FreshFlowE2ETest()
    success = test.run_all()
    sys.exit(0 if success else 1)
