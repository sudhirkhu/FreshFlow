import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Package, Clock, CheckCircle, TrendingUp, Gift, Copy, Wallet } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [referralStats, setReferralStats] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    fetchOrders();
    fetchReferralData();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API_URL}/orders`);
      setOrders(response.data);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchReferralData = async () => {
    try {
      const [statsRes, balanceRes] = await Promise.all([
        axios.get(`${API_URL}/referrals/my-stats`),
        axios.get(`${API_URL}/wallet/balance`)
      ]);
      setReferralStats(statsRes.data);
      setWalletBalance(balanceRes.data.balance);
    } catch (error) {
      console.error('Failed to load referral data:', error);
    }
  };

  const copyReferralCode = () => {
    if (referralStats?.referral_code) {
      navigator.clipboard.writeText(referralStats.referral_code);
      toast.success('Referral code copied to clipboard!');
    }
  };

  const stats = {
    total: orders.length,
    active: orders.filter(o => ['pending', 'confirmed', 'in_progress', 'ready_for_pickup', 'driver_assigned', 'in_transit'].includes(o.status)).length,
    completed: orders.filter(o => o.status === 'delivered').length
  };

  return (
    <DashboardLayout role="customer">
      <div data-testid="customer-dashboard" className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Welcome, {user?.name}!
            </h1>
            <p className="text-slate-600 mt-2">Manage your laundry orders and track deliveries</p>
          </div>
          <Button
            data-testid="new-order-btn"
            onClick={() => navigate('/customer/new-order')}
            className="rounded-full px-6 py-6 bg-gradient-to-r from-sky-500 to-blue-600 hover:shadow-lg transition-all"
          >
            New Order
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div data-testid="stat-total-orders" className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Orders</p>
                <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-sky-500" />
              </div>
            </div>
          </div>

          <div data-testid="stat-active-orders" className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Active Orders</p>
                <p className="text-3xl font-bold text-sky-500">{stats.active}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </div>

          <div data-testid="stat-completed-orders" className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Completed</p>
                <p className="text-3xl font-bold text-emerald-500">{stats.completed}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-indigo-500" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sky-100 mb-1">Wallet Balance</p>
                <p className="text-2xl font-bold">${walletBalance.toFixed(2)}</p>
              </div>
              <Wallet className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Referral Section */}
        {referralStats && (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-8 border border-emerald-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Gift className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Refer Friends, Earn $10
                </h2>
                <p className="text-slate-600">Share your code and both of you get $10 credit!</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 border border-slate-100">
                <p className="text-sm text-slate-600 mb-2">Your Referral Code</p>
                <div className="flex items-center gap-3">
                  <div data-testid="referral-code" className="flex-1 bg-slate-50 rounded-lg px-4 py-3 font-mono text-2xl font-bold text-sky-600 tracking-wider">
                    {referralStats.referral_code}
                  </div>
                  <Button
                    data-testid="copy-referral-code-btn"
                    onClick={copyReferralCode}
                    size="sm"
                    className="rounded-full bg-sky-500 hover:bg-sky-600"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Friends Referred</p>
                    <p data-testid="total-referrals" className="text-3xl font-bold text-emerald-600">{referralStats.total_referrals}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Credits Earned</p>
                    <p data-testid="total-credits-earned" className="text-3xl font-bold text-emerald-600">${referralStats.total_credits_earned.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {referralStats.referrals.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Your Referrals</h3>
                <div className="space-y-2">
                  {referralStats.referrals.map((referral, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 border border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-slate-900">{referral.name}</p>
                        <p className="text-sm text-slate-600">{referral.email}</p>
                      </div>
                      <p className="text-xs text-slate-500">
                        {new Date(referral.joined_date).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Orders */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Recent Orders
            </h2>
            <Button
              data-testid="view-all-orders-btn"
              variant="ghost"
              onClick={() => navigate('/customer/orders')}
              className="text-sky-500 hover:text-sky-600"
            >
              View All
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-pulse text-slate-600">Loading orders...</div>
            </div>
          ) : orders.length === 0 ? (
            <div data-testid="no-orders" className="bg-white rounded-xl p-12 text-center border border-slate-100">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No orders yet</h3>
              <p className="text-slate-600 mb-6">Create your first order to get started</p>
              <Button
                data-testid="create-first-order-btn"
                onClick={() => navigate('/customer/new-order')}
                className="rounded-full px-6 py-5 bg-gradient-to-r from-sky-500 to-blue-600"
              >
                Create First Order
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  data-testid={`order-card-${order.id}`}
                  className="bg-white rounded-2xl p-6 border-l-4 border-sky-500 shadow-sm hover:shadow-md transition-all cursor-pointer"
                  onClick={() => navigate('/customer/orders')}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-slate-900">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-slate-600 mt-1">
                        {new Date(order.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">{order.items.length} items</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">${order.total_amount.toFixed(2)}</p>
                      <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                        order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                        order.status === 'in_transit' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-sky-100 text-sky-700'
                      }`}>
                        {order.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
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
