import React, { useEffect, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Package, Users, Store, Truck, DollarSign, Clock, CheckCircle, AlertCircle, Filter } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-sky-100 text-sky-700',
  picked_up: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  ready_for_pickup: 'bg-emerald-100 text-emerald-700',
  driver_assigned: 'bg-purple-100 text-purple-700',
  out_for_delivery: 'bg-orange-100 text-orange-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_FLOW = ['confirmed', 'picked_up', 'processing', 'ready_for_pickup'];

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [providers, setProviders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, providersRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/admin/orders`),
        axios.get(`${API_URL}/providers`),
        axios.get(`${API_URL}/admin/stats`),
      ]);
      setOrders(ordersRes.data);
      setProviders(providersRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await axios.patch(`${API_URL}/orders/${orderId}/status`, { status: newStatus });
      toast.success(`Order updated to ${newStatus.replace(/_/g, ' ')}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update order');
    }
  };

  const getNextStatus = (currentStatus) => {
    const idx = STATUS_FLOW.indexOf(currentStatus);
    if (idx >= 0 && idx < STATUS_FLOW.length - 1) return STATUS_FLOW[idx + 1];
    return null;
  };

  const getProviderName = (providerId) => {
    const p = providers.find(p => p.user_id === providerId);
    return p ? p.business_name : `Provider ${providerId.slice(0, 6)}...`;
  };

  const filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter(o => o.status === statusFilter);

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="text-center py-12">
          <div className="animate-pulse text-slate-600">Loading admin dashboard...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Admin Dashboard
          </h1>
          <p className="text-slate-600 mt-2">Manage all orders, providers, and platform activity</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Orders</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.total_orders}</p>
                </div>
                <Package className="w-8 h-8 text-sky-400" />
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Active Orders</p>
                  <p className="text-2xl font-bold text-sky-500">{stats.active_orders}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400" />
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Delivered</p>
                  <p className="text-2xl font-bold text-emerald-500">{stats.delivered_orders}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Revenue</p>
                  <p className="text-2xl font-bold text-emerald-500">${stats.total_revenue.toFixed(2)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Providers</p>
                  <p className="text-2xl font-bold text-indigo-500">{stats.total_providers}</p>
                </div>
                <Store className="w-8 h-8 text-indigo-400" />
              </div>
            </div>
          </div>
        )}

        {/* Orders Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              All Orders
            </h2>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="picked_up">Picked Up</option>
                <option value="processing">Processing</option>
                <option value="in_progress">In Progress</option>
                <option value="ready_for_pickup">Ready for Pickup</option>
                <option value="driver_assigned">Driver Assigned</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-slate-100">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No orders found</h3>
              <p className="text-slate-600">
                {statusFilter === 'all' ? 'Orders will appear here once customers place them' : `No orders with status "${statusFilter.replace(/_/g, ' ')}"`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const nextStatus = getNextStatus(order.status);
                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Order Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-slate-900">Order #{order.id.slice(0, 8)}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-slate-100 text-slate-700'}`}>
                            {order.status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Store className="w-3.5 h-3.5" />
                            <span className="truncate">{getProviderName(order.provider_id)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            <span>{order.items.length} items - ${order.total_amount.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{new Date(order.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-slate-500">
                          Pickup: {order.pickup_address}, {order.pickup_city}
                          {order.driver_id && (
                            <span className="ml-3 inline-flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5" /> Driver assigned
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {nextStatus && (
                          <Button
                            onClick={() => updateOrderStatus(order.id, nextStatus)}
                            size="sm"
                            className="rounded-full bg-sky-500 hover:bg-sky-600"
                          >
                            {nextStatus === 'picked_up' && 'Mark Picked Up'}
                            {nextStatus === 'processing' && 'Start Processing'}
                            {nextStatus === 'ready_for_pickup' && 'Mark Ready'}
                          </Button>
                        )}
                        {order.status === 'pending' && order.payment_status !== 'paid' && (
                          <span className="text-xs text-yellow-600 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Awaiting payment
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
