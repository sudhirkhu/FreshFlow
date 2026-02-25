import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Store } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    provider_id: '',
    pickup_address: '',
    pickup_city: '',
    pickup_state: '',
    pickup_zipcode: '',
    pickup_time: '',
    notes: ''
  });
  const [items, setItems] = useState([{
    service_type: 'Wash & Fold',
    weight: '',
    price: ''
  }]);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await axios.get(`${API_URL}/providers`);
      setProviders(response.data);
    } catch (error) {
      toast.error('Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, { service_type: 'Wash & Fold', weight: '', price: '' }]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    if (field === 'weight' && value) {
      const selectedProvider = providers.find(p => p.user_id === formData.provider_id);
      if (selectedProvider) {
        newItems[index].price = (parseFloat(value) * selectedProvider.price_per_lb).toFixed(2);
      }
    }
    
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.provider_id) {
      toast.error('Please select a provider');
      return;
    }
    
    if (items.some(item => !item.weight || !item.price)) {
      toast.error('Please fill in all item details');
      return;
    }

    setSubmitting(true);

    try {
      const orderData = {
        ...formData,
        items: items.map(item => ({
          service_type: item.service_type,
          weight: parseFloat(item.weight),
          price: parseFloat(item.price)
        }))
      };

      await axios.post(`${API_URL}/orders`, orderData);
      toast.success('Order created successfully!');
      navigate('/customer/orders');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

  return (
    <DashboardLayout role="customer">
      <div data-testid="new-order-page" className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Create New Order
          </h1>
          <p className="text-slate-600 mt-2">Schedule a laundry pickup with your preferred provider</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Provider Selection */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Select Provider</h2>
            
            {loading ? (
              <div className="text-center py-8 text-slate-600">Loading providers...</div>
            ) : providers.length === 0 ? (
              <div data-testid="no-providers" className="text-center py-8">
                <Store className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-600">No providers available in your area</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providers.map((provider) => (
                  <div
                    key={provider.user_id}
                    data-testid={`provider-${provider.user_id}`}
                    onClick={() => setFormData({ ...formData, provider_id: provider.user_id })}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      formData.provider_id === provider.user_id
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-slate-200 hover:border-sky-300'
                    }`}
                  >
                    <h3 className="font-semibold text-slate-900">{provider.business_name}</h3>
                    <p className="text-sm text-slate-600 mt-1">{provider.city}, {provider.state}</p>
                    <p className="text-sm font-medium text-sky-600 mt-2">${provider.price_per_lb}/lb</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-slate-600">Rating: {provider.rating.toFixed(1)}</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-600">{provider.total_orders} orders</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pickup Details */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Pickup Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  data-testid="address-input"
                  id="address"
                  value={formData.pickup_address}
                  onChange={(e) => setFormData({ ...formData, pickup_address: e.target.value })}
                  required
                  className="mt-2 rounded-xl h-12 bg-slate-50"
                  placeholder="123 Main St"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  data-testid="city-input"
                  id="city"
                  value={formData.pickup_city}
                  onChange={(e) => setFormData({ ...formData, pickup_city: e.target.value })}
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
                  value={formData.pickup_state}
                  onChange={(e) => setFormData({ ...formData, pickup_state: e.target.value })}
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
                  value={formData.pickup_zipcode}
                  onChange={(e) => setFormData({ ...formData, pickup_zipcode: e.target.value })}
                  required
                  className="mt-2 rounded-xl h-12 bg-slate-50"
                  placeholder="10001"
                />
              </div>
              <div>
                <Label htmlFor="pickup_time">Pickup Time</Label>
                <Input
                  data-testid="pickup-time-input"
                  id="pickup_time"
                  type="datetime-local"
                  value={formData.pickup_time}
                  onChange={(e) => setFormData({ ...formData, pickup_time: e.target.value })}
                  required
                  className="mt-2 rounded-xl h-12 bg-slate-50"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="notes">Special Instructions (Optional)</Label>
                <Textarea
                  data-testid="notes-input"
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="mt-2 rounded-xl bg-slate-50"
                  placeholder="Any special instructions for pickup or cleaning..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-900">Items</h2>
              <Button
                data-testid="add-item-btn"
                type="button"
                onClick={addItem}
                size="sm"
                className="rounded-full"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} data-testid={`item-${index}`} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label>Service Type</Label>
                    <Select
                      value={item.service_type}
                      onValueChange={(value) => updateItem(index, 'service_type', value)}
                    >
                      <SelectTrigger data-testid={`service-type-${index}`} className="mt-2 rounded-xl h-12 bg-slate-50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Wash & Fold">Wash & Fold</SelectItem>
                        <SelectItem value="Dry Cleaning">Dry Cleaning</SelectItem>
                        <SelectItem value="Ironing">Ironing</SelectItem>
                        <SelectItem value="Alterations">Alterations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <Label>Weight (lbs)</Label>
                    <Input
                      data-testid={`weight-${index}`}
                      type="number"
                      step="0.1"
                      value={item.weight}
                      onChange={(e) => updateItem(index, 'weight', e.target.value)}
                      required
                      className="mt-2 rounded-xl h-12 bg-slate-50"
                      placeholder="5.0"
                    />
                  </div>
                  <div className="w-32">
                    <Label>Price ($)</Label>
                    <Input
                      data-testid={`price-${index}`}
                      type="number"
                      step="0.01"
                      value={item.price}
                      readOnly
                      className="mt-2 rounded-xl h-12 bg-slate-100"
                      placeholder="0.00"
                    />
                  </div>
                  {items.length > 1 && (
                    <Button
                      data-testid={`remove-item-${index}`}
                      type="button"
                      onClick={() => removeItem(index)}
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Summary & Submit */}
          <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Total Amount</h3>
              <p data-testid="total-amount" className="text-4xl font-bold">${totalAmount.toFixed(2)}</p>
            </div>
            <Button
              data-testid="create-order-btn"
              type="submit"
              disabled={submitting || !formData.provider_id}
              className="w-full rounded-full h-12 bg-white text-sky-600 hover:bg-slate-50 font-semibold"
            >
              {submitting ? 'Creating Order...' : 'Create Order & Proceed to Payment'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
