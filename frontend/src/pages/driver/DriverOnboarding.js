import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DriverOnboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_type: '',
    license_number: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API_URL}/drivers/profile`, formData);
      toast.success('Driver profile created successfully!');
      navigate('/driver/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="driver-onboarding" className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-10 h-10 text-sky-500" />
            <span className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>FreshFlow</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Driver Onboarding
          </h1>
          <p className="text-slate-600">Complete your driver profile to start earning</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <Truck className="w-8 h-8 text-sky-500" />
            <h2 className="text-2xl font-semibold text-slate-900">Vehicle Information</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="vehicle_type">Vehicle Type</Label>
              <Select
                value={formData.vehicle_type}
                onValueChange={(value) => setFormData({ ...formData, vehicle_type: value })}
              >
                <SelectTrigger data-testid="vehicle-type-select" className="mt-2 rounded-xl h-12 bg-slate-50">
                  <SelectValue placeholder="Select vehicle type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Car">Car</SelectItem>
                  <SelectItem value="Van">Van</SelectItem>
                  <SelectItem value="Truck">Truck</SelectItem>
                  <SelectItem value="Motorcycle">Motorcycle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="license_number">Driver's License Number</Label>
              <Input
                data-testid="license-input"
                id="license_number"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                required
                className="mt-2 rounded-xl h-12 bg-slate-50"
                placeholder="DL12345678"
              />
            </div>

            <Button
              data-testid="submit-btn"
              type="submit"
              disabled={loading || !formData.vehicle_type}
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
