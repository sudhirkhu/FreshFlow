import requests
import sys
import json
from datetime import datetime

class LaundryServiceAPITester:
    def __init__(self, base_url="https://cleancare-hub-2.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.user_role = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_result(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "status": "PASS" if success else "FAIL",
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status_emoji = "✅" if success else "❌"
        print(f"{status_emoji} {name}")
        if details:
            print(f"   {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=10)
            else:
                self.log_result(name, False, f"Unsupported method: {method}")
                return False, {}

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
            
            self.log_result(name, success, details)
            
            try:
                return success, response.json() if success else {}
            except:
                return success, {}

        except requests.exceptions.RequestException as e:
            self.log_result(name, False, f"Request failed: {str(e)}")
            return False, {}

    def test_user_registration(self, role="customer"):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_user_data = {
            "name": f"Test {role.title()} {timestamp}",
            "email": f"test_{role}_{timestamp}@test.com",
            "phone": "555-123-4567",
            "password": "TestPass123!",
            "role": role
        }
        
        success, response = self.run_test(
            f"Register {role.title()} User",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            self.user_role = response['user']['role']
            return True, response['user']
        return False, {}

    def test_user_login(self, email, password):
        """Test user login"""
        login_data = {
            "email": email,
            "password": password
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            self.user_role = response['user']['role']
            return True, response['user']
        return False, {}

    def test_get_user_profile(self):
        """Test getting current user profile"""
        success, response = self.run_test(
            "Get User Profile",
            "GET",
            "auth/me",
            200
        )
        return success, response

    def test_provider_profile_creation(self):
        """Test provider profile creation"""
        if self.user_role != "provider":
            self.log_result("Create Provider Profile", False, "Not a provider user")
            return False, {}
            
        provider_data = {
            "business_name": f"Test Laundry {datetime.now().strftime('%H%M%S')}",
            "address": "123 Test Street",
            "city": "New York",
            "state": "NY",
            "zipcode": "10001",
            "services": ["Wash & Fold", "Dry Cleaning"],
            "price_per_lb": 2.50
        }
        
        success, response = self.run_test(
            "Create Provider Profile",
            "POST",
            "providers/profile",
            200,
            data=provider_data
        )
        return success, response

    def test_get_provider_profile(self):
        """Test getting provider profile"""
        success, response = self.run_test(
            "Get Provider Profile",
            "GET",
            "providers/me",
            200
        )
        return success, response

    def test_get_providers_list(self):
        """Test getting list of providers"""
        success, response = self.run_test(
            "Get Providers List",
            "GET",
            "providers",
            200
        )
        return success, response

    def test_driver_profile_creation(self):
        """Test driver profile creation"""
        if self.user_role != "driver":
            self.log_result("Create Driver Profile", False, "Not a driver user")
            return False, {}
            
        driver_data = {
            "vehicle_type": "Sedan",
            "license_number": f"TEST{datetime.now().strftime('%H%M%S')}"
        }
        
        success, response = self.run_test(
            "Create Driver Profile",
            "POST",
            "drivers/profile",
            200,
            data=driver_data
        )
        return success, response

    def test_get_driver_profile(self):
        """Test getting driver profile"""
        success, response = self.run_test(
            "Get Driver Profile",
            "GET",
            "drivers/me",
            200
        )
        return success, response

    def test_order_creation(self, provider_id):
        """Test order creation"""
        if self.user_role != "customer":
            self.log_result("Create Order", False, "Not a customer user")
            return False, {}
            
        order_data = {
            "provider_id": provider_id,
            "items": [
                {
                    "service_type": "Wash & Fold",
                    "weight": 5.0,
                    "price": 12.50
                }
            ],
            "pickup_address": "456 Customer Street",
            "pickup_city": "New York",
            "pickup_state": "NY",
            "pickup_zipcode": "10002",
            "pickup_time": "2026-12-25T10:00:00",
            "notes": "Test order"
        }
        
        success, response = self.run_test(
            "Create Order",
            "POST",
            "orders",
            200,
            data=order_data
        )
        return success, response

    def test_get_orders(self):
        """Test getting orders"""
        success, response = self.run_test(
            "Get Orders",
            "GET",
            "orders",
            200
        )
        return success, response

    def test_order_status_update(self, order_id, new_status):
        """Test order status update"""
        status_data = {
            "status": new_status
        }
        
        success, response = self.run_test(
            f"Update Order Status to {new_status}",
            "PATCH",
            f"orders/{order_id}/status",
            200,
            data=status_data
        )
        return success, response

    def test_payment_checkout(self, order_id):
        """Test payment checkout creation"""
        checkout_data = {
            "order_id": order_id,
            "origin_url": "https://cleancare-hub-2.preview.emergentagent.com"
        }
        
        success, response = self.run_test(
            "Create Payment Checkout",
            "POST",
            "payments/create-checkout",
            200,
            data=checkout_data
        )
        return success, response

    def run_comprehensive_test(self):
        """Run comprehensive API tests"""
        print(f"🧪 Starting Laundry Service API Tests")
        print(f"🔗 Base URL: {self.base_url}")
        print("=" * 60)

        # Test customer workflow
        print("\n🙋‍♂️ Testing Customer Workflow:")
        customer_success, customer_user = self.test_user_registration("customer")
        if not customer_success:
            print("❌ Customer registration failed, skipping customer tests")
        else:
            self.test_get_user_profile()
            customer_token = self.token

        # Test provider workflow
        print("\n🏪 Testing Provider Workflow:")
        provider_success, provider_user = self.test_user_registration("provider")
        provider_id = None
        if not provider_success:
            print("❌ Provider registration failed, skipping provider tests")
        else:
            provider_profile_success, provider_profile = self.test_provider_profile_creation()
            if provider_profile_success:
                provider_id = provider_user['id']
            self.test_get_provider_profile()
            self.test_get_providers_list()

        # Test driver workflow
        print("\n🚛 Testing Driver Workflow:")
        driver_success, driver_user = self.test_user_registration("driver")
        if not driver_success:
            print("❌ Driver registration failed, skipping driver tests")
        else:
            self.test_driver_profile_creation()
            self.test_get_driver_profile()

        # Test order workflow with customer
        print("\n📦 Testing Order Workflow:")
        if customer_success and provider_id:
            # Switch back to customer token
            self.token = customer_token
            self.user_role = "customer"
            
            order_success, order_data = self.test_order_creation(provider_id)
            if order_success:
                order_id = order_data.get('id')
                self.test_get_orders()
                
                # Test payment
                if order_id:
                    self.test_payment_checkout(order_id)
                    
                    # Test status updates (would need provider/driver tokens)
                    # For now, just test if the endpoint accepts the request structure
        else:
            print("❌ Skipping order tests - missing customer or provider")

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. See details above.")
            return False

def main():
    """Main test runner"""
    tester = LaundryServiceAPITester()
    
    try:
        success = tester.run_comprehensive_test()
        
        # Save detailed results
        with open('/app/test_results_backend.json', 'w') as f:
            json.dump({
                'summary': {
                    'total_tests': tester.tests_run,
                    'passed_tests': tester.tests_passed,
                    'success_rate': f"{(tester.tests_passed/tester.tests_run)*100:.1f}%" if tester.tests_run > 0 else "0%",
                    'timestamp': datetime.now().isoformat()
                },
                'detailed_results': tester.test_results
            }, f, indent=2)
        
        return 0 if success else 1
        
    except Exception as e:
        print(f"❌ Test runner failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())