import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    if (!token) {
      setValidToken(false);
      setVerifying(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/auth/verify-reset-token?token=${token}`);
      setValidToken(response.data.valid);
    } catch (error) {
      setValidToken(false);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API_URL}/auth/reset-password`, {
        token: token,
        new_password: formData.password
      });
      
      setResetSuccess(true);
      toast.success('Password reset successful!');
      
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-pulse text-sky-600 text-xl font-semibold">Verifying reset link...</div>
        </div>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Sparkles className="w-10 h-10 text-sky-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Invalid Reset Link</h1>
            <p className="text-slate-600">This password reset link is invalid or has expired.</p>
          </div>
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100 text-center">
            <p className="text-slate-600 mb-6">Please request a new password reset link from the login page.</p>
            <Button
              onClick={() => navigate('/login')}
              className="rounded-full px-6 py-5 bg-gradient-to-r from-sky-500 to-blue-600"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (resetSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Password Reset Successful!
            </h2>
            <p className="text-slate-600 mb-6">You can now login with your new password.</p>
            <p className="text-sm text-slate-500">Redirecting to login page...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="reset-password-page" className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Sparkles className="w-10 h-10 text-sky-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Create New Password
          </h1>
          <p className="text-slate-600">Enter your new password below</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100">
          <form data-testid="reset-password-form" onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="password" className="text-slate-700 font-medium">New Password</Label>
              <Input
                data-testid="new-password-input"
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                className="mt-2 rounded-xl h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500/20 transition-all"
                placeholder="••••••••"
              />
              <p className="text-xs text-slate-500 mt-1">Must be at least 6 characters</p>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">Confirm New Password</Label>
              <Input
                data-testid="confirm-password-input"
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                minLength={6}
                className="mt-2 rounded-xl h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500/20 transition-all"
                placeholder="••••••••"
              />
            </div>

            <Button
              data-testid="reset-password-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full rounded-full h-12 bg-gradient-to-r from-sky-500 to-blue-600 hover:shadow-lg transition-all font-semibold"
            >
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
