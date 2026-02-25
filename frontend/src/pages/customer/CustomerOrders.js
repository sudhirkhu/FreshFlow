import React, { useEffect, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Package, MapPin, Clock, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CustomerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pollingSessionId, setPollingSessionId] = useState(null);

  useEffect(() => {
    fetchOrders();
    
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId) {
      setPollingSessionId(sessionId);
      pollPaymentStatus(sessionId);
    }
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

  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 5;
    
    if (attempts >= maxAttempts) {
      toast.error('Payment verification timeout. Please check your order status.');
      window.history.replaceState({}, '', '/customer/orders');
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/payments/status/${sessionId}`);
      
      if (response.data.payment_status === 'paid') {
        toast.success('Payment successful! Your order is confirmed.');
        window.history.replaceState({}, '', '/customer/orders');
        fetchOrders();
        return;
      } else if (response.data.status === 'expired') {
        toast.error('Payment session expired. Please try again.');
        window.history.replaceState({}, '', '/customer/orders');
        return;
      }

      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), 2000);
    } catch (error) {
      toast.error('Error checking payment status');
      window.history.replaceState({}, '', '/customer/orders');
    }
  };

  const handlePayNow = async (orderId) => {
    try {
      const originUrl = window.location.origin;
      const response = await axios.post(`${API_URL}/payments/create-checkout`, {
        order_id: orderId,
        origin_url: originUrl
      });
      
      window.location.href = response.data.url;
    } catch (error) {
      toast.error('Failed to initiate payment');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-700',
      confirmed: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-indigo-100 text-indigo-700',
      ready_for_pickup: 'bg-purple-100 text-purple-700',
      driver_assigned: 'bg-cyan-100 text-cyan-700',
      in_transit: 'bg-sky-100 text-sky-700',
      delivered: 'bg-emerald-100 text-emerald-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  return (
    <DashboardLayout role="customer">
      <div data-testid="customer-orders-page" className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            My Orders
          </h1>
          <p className="text-slate-600 mt-2">Track and manage all your laundry orders</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-slate-600">Loading orders...</div>
          </div>
        ) : orders.length === 0 ? (
          <div data-testid="no-orders-message" className="bg-white rounded-xl p-12 text-center border border-slate-100">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No orders yet</h3>
            <p className="text-slate-600">Your order history will appear here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                data-testid={`order-${order.id}`}
                className="bg-white rounded-2xl p-6 border-l-4 border-sky-500 shadow-sm"
              >
                <div className="flex flex-col lg:flex-row justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-4">
                      <h3 className="text-xl font-semibold text-slate-900">
                        Order #{order.id.slice(0, 8)}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      {order.payment_status === 'pending' && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                          Payment Pending
                        </span>
                      )}
                    </div>

                    <div className="space-y-3 text-sm text-slate-600">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 text-slate-400" />
                        <span>{order.pickup_address}, {order.pickup_city}, {order.pickup_state} {order.pickup_zipcode}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>Pickup: {new Date(order.pickup_time).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400" />
                        <span>{order.items.length} items</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-sm text-slate-600 mb-2">Items:</p>
                      <div className="space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="text-sm text-slate-700">
                            {item.service_type} - {item.weight} lbs (${item.price.toFixed(2)})
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-end">
                    <div className="text-right">
                      <p className="text-sm text-slate-600 mb-1">Total Amount</p>
                      <p className="text-3xl font-bold text-slate-900">${order.total_amount.toFixed(2)}</p>
                    </div>
                    
                    {order.payment_status === 'pending' && order.status === 'pending' && (
                      <Button
                        data-testid={`pay-now-btn-${order.id}`}
                        onClick={() => handlePayNow(order.id)}
                        className="rounded-full px-6 py-5 bg-gradient-to-r from-sky-500 to-blue-600 hover:shadow-lg transition-all"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pay Now
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
