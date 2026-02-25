import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Store, Package, DollarSign, TrendingUp, Clock } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ProviderDashboard() {
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
        axios.get(`${API_URL}/providers/me`),
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

  const stats = {
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'confirmed').length,
    totalRevenue: orders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + o.total_amount, 0)
  };

  if (loading) {
    return (
      <DashboardLayout role="provider">
        <div className="text-center py-12">
          <div className="animate-pulse text-slate-600">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout role="provider">
        <div data-testid="no-profile" className="text-center py-12">
          <Store className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Profile Setup Required</h3>
          <p className="text-slate-600">Please complete your provider onboarding</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="provider">
      <div data-testid="provider-dashboard" className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {profile.business_name}
          </h1>
          <p className="text-slate-600 mt-2">
            {profile.status === 'pending' ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                <Clock className="w-4 h-4" />
                Awaiting Admin Approval
              </span>
            ) : profile.status === 'active' ? (
              <span className="text-emerald-600 font-medium">Active</span>
            ) : (
              <span className="text-slate-600">{profile.status}</span>
            )}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Orders</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalOrders}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-sky-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Pending</p>
                <p className="text-3xl font-bold text-sky-500">{stats.pendingOrders}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Revenue</p>
                <p className="text-3xl font-bold text-emerald-500">${stats.totalRevenue.toFixed(2)}</p>
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

        {/* Orders */}
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Recent Orders
          </h2>

          {orders.length === 0 ? (
            <div data-testid="no-orders" className="bg-white rounded-xl p-12 text-center border border-slate-100">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No orders yet</h3>
              <p className="text-slate-600">Orders will appear here once customers place them</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  data-testid={`order-${order.id}`}
                  className="bg-white rounded-2xl p-6 border-l-4 border-sky-500 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">Order #{order.id.slice(0, 8)}</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">${order.total_amount.toFixed(2)}</p>
                      <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${
                        order.status === 'confirmed' ? 'bg-sky-100 text-sky-700' :
                        order.status === 'in_progress' ? 'bg-indigo-100 text-indigo-700' :
                        order.status === 'ready_for_pickup' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {order.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    {order.status === 'confirmed' && (
                      <Button
                        data-testid={`start-processing-${order.id}`}
                        onClick={() => updateOrderStatus(order.id, 'in_progress')}
                        size="sm"
                        className="rounded-full bg-sky-500"
                      >
                        Start Processing
                      </Button>
                    )}
                    {order.status === 'in_progress' && (
                      <Button
                        data-testid={`mark-ready-${order.id}`}
                        onClick={() => updateOrderStatus(order.id, 'ready_for_pickup')}
                        size="sm"
                        className="rounded-full bg-emerald-500"
                      >
                        Mark Ready for Pickup
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
