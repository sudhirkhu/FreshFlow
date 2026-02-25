import React, { useEffect, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Package, MapPin, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AvailableJobs() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAvailableOrders();
  }, []);

  const fetchAvailableOrders = async () => {
    try {
      const response = await axios.get(`${API_URL}/drivers/available-orders`);
      setOrders(response.data);
    } catch (error) {
      toast.error('Failed to load available orders');
    } finally {
      setLoading(false);
    }
  };

  const acceptOrder = async (orderId) => {
    try {
      await axios.patch(`${API_URL}/orders/${orderId}/accept-driver`);
      toast.success('Order accepted! Check your active deliveries.');
      fetchAvailableOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to accept order');
    }
  };

  return (
    <DashboardLayout role="driver">
      <div data-testid="available-jobs-page" className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Available Jobs
          </h1>
          <p className="text-slate-600 mt-2">Accept delivery jobs and start earning</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-slate-600">Loading available jobs...</div>
          </div>
        ) : orders.length === 0 ? (
          <div data-testid="no-jobs" className="bg-white rounded-xl p-12 text-center border border-slate-100">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No available jobs</h3>
            <p className="text-slate-600">Check back later for new delivery opportunities</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                data-testid={`job-${order.id}`}
                className="bg-white rounded-2xl p-6 border-l-4 border-emerald-500 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex flex-col lg:flex-row justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-4">
                      <h3 className="text-xl font-semibold text-slate-900">
                        Order #{order.id.slice(0, 8)}
                      </h3>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        {order.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 text-slate-400" />
                        <div>
                          <p className="font-medium text-slate-900">Pickup Location</p>
                          <p>{order.pickup_address}, {order.pickup_city}, {order.pickup_state} {order.pickup_zipcode}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400" />
                        <span>{order.items.length} items - {order.items.reduce((sum, item) => sum + item.weight, 0).toFixed(1)} lbs total</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-slate-400" />
                        <span className="font-semibold text-emerald-600">
                          Earn ${(order.total_amount * 0.2).toFixed(2)} (20% commission)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-end">
                    <div className="text-right mb-4">
                      <p className="text-sm text-slate-600 mb-1">Order Value</p>
                      <p className="text-2xl font-bold text-slate-900">${order.total_amount.toFixed(2)}</p>
                    </div>
                    
                    <Button
                      data-testid={`accept-job-${order.id}`}
                      onClick={() => acceptOrder(order.id)}
                      className="rounded-full px-6 py-5 bg-gradient-to-r from-emerald-500 to-green-600 hover:shadow-lg transition-all"
                    >
                      Accept Job
                    </Button>
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
