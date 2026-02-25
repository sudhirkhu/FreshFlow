import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Truck, Package, DollarSign, TrendingUp, MapPin } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profileRes, ordersRes] = await Promise.all([
        axios.get(`${API_URL}/drivers/me`),
        axios.get(`${API_URL}/orders`)
      ]);
      setProfile(profileRes.data);
      setOrders(ordersRes.data);
    } catch (error) {
      if (error.response?.status === 404) {
        // Profile doesn't exist yet
      } else {
        toast.error('Failed to load data');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await axios.patch(`${API_URL}/orders/${orderId}/status`, { status: newStatus });
      toast.success('Order status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const toggleDriverStatus = async () => {
    try {
      const newStatus = profile.status === 'online' ? 'offline' : 'online';
      await axios.patch(`${API_URL}/drivers/status?status=${newStatus}`);
      setProfile({ ...profile, status: newStatus });
      toast.success(`You are now ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const activeOrders = orders.filter(o => ['driver_assigned', 'in_transit'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'delivered');
  const totalEarnings = completedOrders.reduce((sum, o) => sum + (o.total_amount * 0.2), 0); // 20% commission

  if (loading) {
    return (
      <DashboardLayout role="driver">
        <div className="text-center py-12">
          <div className="animate-pulse text-slate-600">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout role="driver">
        <div data-testid="no-profile" className="text-center py-12">
          <Truck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Profile Setup Required</h3>
          <p className="text-slate-600">Please complete your driver onboarding</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="driver">
      <div data-testid="driver-dashboard" className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Welcome, {user?.name}!
            </h1>
            <p className="text-slate-600 mt-2">Vehicle: {profile.vehicle_type}</p>
          </div>
          <Button
            data-testid="toggle-status-btn"
            onClick={toggleDriverStatus}
            className={`rounded-full px-6 py-6 font-semibold transition-all ${
              profile.status === 'online'
                ? 'bg-emerald-500 hover:bg-emerald-600'
                : 'bg-slate-500 hover:bg-slate-600'
            }`}
          >
            {profile.status === 'online' ? 'Go Offline' : 'Go Online'}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Active Deliveries</p>
                <p className="text-3xl font-bold text-sky-500">{activeOrders.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-sky-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Completed</p>
                <p className="text-3xl font-bold text-emerald-500">{completedOrders.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Truck className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Earnings</p>
                <p className="text-3xl font-bold text-indigo-500">${totalEarnings.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-indigo-500" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sky-100 mb-1">Rating</p>
                <p className="text-3xl font-bold">{profile.rating.toFixed(1)}</p>
              </div>
              <TrendingUp className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="flex gap-4">
            <Button
              data-testid="view-available-jobs-btn"
              onClick={() => navigate('/driver/available-jobs')}
              className="rounded-full px-6 py-5 bg-gradient-to-r from-sky-500 to-blue-600"
            >
              <MapPin className="w-4 h-4 mr-2" />
              View Available Jobs
            </Button>
          </div>
        </div>

        {/* Active Orders */}
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Active Deliveries
          </h2>

          {activeOrders.length === 0 ? (
            <div data-testid="no-active-orders" className="bg-white rounded-xl p-12 text-center border border-slate-100">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No active deliveries</h3>
              <p className="text-slate-600 mb-6">Check available jobs to start earning</p>
              <Button
                data-testid="check-jobs-btn"
                onClick={() => navigate('/driver/available-jobs')}
                className="rounded-full px-6 py-5 bg-gradient-to-r from-sky-500 to-blue-600"
              >
                Check Available Jobs
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeOrders.map((order) => (
                <div
                  key={order.id}
                  data-testid={`active-order-${order.id}`}
                  className="bg-white rounded-2xl p-6 border-l-4 border-sky-500 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">Order #{order.id.slice(0, 8)}</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        {order.pickup_address}, {order.pickup_city}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      order.status === 'driver_assigned' ? 'bg-sky-100 text-sky-700' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {order.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>

                  <div className="flex gap-2 mt-4">
                    {order.status === 'driver_assigned' && (
                      <Button
                        data-testid={`start-pickup-${order.id}`}
                        onClick={() => updateOrderStatus(order.id, 'in_transit')}
                        size="sm"
                        className="rounded-full bg-sky-500"
                      >
                        Start Pickup
                      </Button>
                    )}
                    {order.status === 'in_transit' && (
                      <Button
                        data-testid={`complete-delivery-${order.id}`}
                        onClick={() => updateOrderStatus(order.id, 'delivered')}
                        size="sm"
                        className="rounded-full bg-emerald-500"
                      >
                        Complete Delivery
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
