import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await login(formData.email, formData.password);
      toast.success('Welcome back!');
      
      const path = user.role === 'customer' ? '/customer/dashboard' : 
                  user.role === 'provider' ? '/provider/dashboard' : 
                  '/driver/dashboard';
      navigate(path);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="login-page" className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <Sparkles className="w-10 h-10 text-sky-500" />
            <span className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>FreshFlow</span>
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Welcome Back</h1>
          <p className="text-slate-600">Sign in to your account to continue</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100">
          <form data-testid="login-form" onSubmit={handleSubmit} className="space-y-6">
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
              <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
              <Input
                data-testid="password-input"
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="mt-2 rounded-xl h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500/20 transition-all"
                placeholder="••••••••"
              />
            </div>

            <Button
              data-testid="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full rounded-full h-12 bg-gradient-to-r from-sky-500 to-blue-600 hover:shadow-lg transition-all font-semibold"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-sky-500 hover:text-sky-600 font-semibold">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
