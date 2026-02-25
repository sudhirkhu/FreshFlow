import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'customer'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await register(formData);
      toast.success('Account created successfully!');
      
      if (user.role === 'provider') {
        navigate('/provider/onboarding');
      } else if (user.role === 'driver') {
        navigate('/driver/onboarding');
      } else {
        navigate('/customer/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="register-page" className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <Sparkles className="w-10 h-10 text-sky-500" />
            <span className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>FreshFlow</span>
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Join FreshFlow</h1>
          <p className="text-slate-600">Create your account to get started</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100">
          <form data-testid="register-form" onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name" className="text-slate-700 font-medium">Full Name</Label>
              <Input
                data-testid="name-input"
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="mt-2 rounded-xl h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500/20 transition-all"
                placeholder="John Doe"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-slate-700 font-medium">Email</Label>
              <Input
                data-testid="email-input"
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="mt-2 rounded-xl h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500/20 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-slate-700 font-medium">Phone (Optional)</Label>
              <Input
                data-testid="phone-input"
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-2 rounded-xl h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500/20 transition-all"
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
              <Input
                data-testid="password-input"
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                className="mt-2 rounded-xl h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500/20 transition-all"
                placeholder="••••••••"
              />
            </div>

            <div>
              <Label className="text-slate-700 font-medium mb-3 block">I want to join as:</Label>
              <RadioGroup 
                data-testid="role-selector"
                value={formData.role} 
                onValueChange={(value) => setFormData({ ...formData, role: value })}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 hover:border-sky-300 transition-colors">
                  <RadioGroupItem value="customer" id="customer" />
                  <Label htmlFor="customer" className="flex-1 cursor-pointer">
                    <div className="font-semibold text-slate-900">Customer</div>
                    <div className="text-sm text-slate-600">Order laundry services</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 hover:border-sky-300 transition-colors">
                  <RadioGroupItem value="provider" id="provider" />
                  <Label htmlFor="provider" className="flex-1 cursor-pointer">
                    <div className="font-semibold text-slate-900">Service Provider</div>
                    <div className="text-sm text-slate-600">Offer laundry/dry cleaning services</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 hover:border-sky-300 transition-colors">
                  <RadioGroupItem value="driver" id="driver" />
                  <Label htmlFor="driver" className="flex-1 cursor-pointer">
                    <div className="font-semibold text-slate-900">Driver</div>
                    <div className="text-sm text-slate-600">Pickup and deliver orders</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              data-testid="register-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full rounded-full h-12 bg-gradient-to-r from-sky-500 to-blue-600 hover:shadow-lg transition-all font-semibold"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="text-sky-500 hover:text-sky-600 font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
