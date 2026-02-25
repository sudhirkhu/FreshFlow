import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Store, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AVAILABLE_SERVICES = [
  'Wash & Fold',
  'Dry Cleaning',
  'Ironing',
  'Alterations',
  'Stain Removal',
  'Eco-Friendly Cleaning'
];

export default function ProviderOnboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    business_name: '',
    address: '',
    city: '',
    state: '',
    zipcode: '',
    price_per_lb: ''
  });
  const [selectedServices, setSelectedServices] = useState([]);

  const toggleService = (service) => {
    if (selectedServices.includes(service)) {
      setSelectedServices(selectedServices.filter(s => s !== service));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedServices.length === 0) {
      toast.error('Please select at least one service');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API_URL}/providers/profile`, {
        ...formData,
        price_per_lb: parseFloat(formData.price_per_lb),
        services: selectedServices
      });
      
      toast.success('Profile created! Awaiting admin approval.');
      navigate('/provider/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="provider-onboarding" className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-10 h-10 text-sky-500" />
            <span className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>FreshFlow</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Provider Onboarding
          </h1>
          <p className="text-slate-600">Set up your business profile to start receiving orders</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <Store className="w-8 h-8 text-sky-500" />
            <h2 className="text-2xl font-semibold text-slate-900">Business Information</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="business_name">Business Name</Label>
              <Input
                data-testid="business-name-input"
                id="business_name"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                required
                className="mt-2 rounded-xl h-12 bg-slate-50"
                placeholder="Fresh Clean Laundromat"
              />
            </div>

            <div>
              <Label htmlFor="address">Street Address</Label>
              <Input
                data-testid="address-input"
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
                className="mt-2 rounded-xl h-12 bg-slate-50"
                placeholder="123 Business Ave"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  data-testid="city-input"
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                  className="mt-2 rounded-xl h-12 bg-slate-50"
                  placeholder="New York"
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  data-testid="state-input"
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  required
                  className="mt-2 rounded-xl h-12 bg-slate-50"
                  placeholder="NY"
                />
              </div>
              <div>
                <Label htmlFor="zipcode">ZIP Code</Label>
                <Input
                  data-testid="zipcode-input"
                  id="zipcode"
                  value={formData.zipcode}
                  onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })}
                  required
                  className="mt-2 rounded-xl h-12 bg-slate-50"
                  placeholder="10001"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="price_per_lb">Price per Pound ($)</Label>
              <Input
                data-testid="price-input"
                id="price_per_lb"
                type="number"
                step="0.01"
                value={formData.price_per_lb}
                onChange={(e) => setFormData({ ...formData, price_per_lb: e.target.value })}
                required
                className="mt-2 rounded-xl h-12 bg-slate-50"
                placeholder="2.50"
              />
            </div>

            <div>
              <Label className="mb-3 block">Services Offered</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AVAILABLE_SERVICES.map((service) => (
                  <div
                    key={service}
                    data-testid={`service-${service.toLowerCase().replace(/\s+/g, '-')}`}
                    className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 hover:border-sky-300 transition-colors"
                  >
                    <Checkbox
                      id={service}
                      checked={selectedServices.includes(service)}
                      onCheckedChange={() => toggleService(service)}
                    />
                    <Label htmlFor={service} className="flex-1 cursor-pointer font-normal">
                      {service}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Button
              data-testid="submit-btn"
              type="submit"
              disabled={loading}
              className="w-full rounded-full h-12 bg-gradient-to-r from-sky-500 to-blue-600 hover:shadow-lg transition-all font-semibold"
            >
              {loading ? 'Creating Profile...' : 'Complete Setup'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
