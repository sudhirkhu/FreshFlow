import React, { useEffect, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { Store, MapPin, Star, Package, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminProviders() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await axios.get(`${API_URL}/providers`);
      setProviders(res.data);
    } catch (error) {
      toast.error('Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="text-center py-12">
          <div className="animate-pulse text-slate-600">Loading providers...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Service Providers
          </h1>
          <p className="text-slate-600 mt-2">{providers.length} registered providers</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((provider) => (
            <div key={provider.user_id} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center">
                  <Store className="w-6 h-6 text-sky-500" />
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  provider.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {provider.status}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-slate-900 mb-2">{provider.business_name}</h3>

              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{provider.address}, {provider.city}, {provider.state} {provider.zipcode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span>{provider.rating.toFixed(1)} rating</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-400" />
                  <span>{provider.total_orders} total orders</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span>${provider.price_per_lb.toFixed(2)}/lb</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1">
                {provider.services.map((service) => (
                  <span key={service} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs">
                    {service}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
