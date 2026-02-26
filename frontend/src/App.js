import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import CustomerDashboard from '@/pages/customer/CustomerDashboard';
import CustomerOrders from '@/pages/customer/CustomerOrders';
import NewOrderPage from '@/pages/customer/NewOrderPage';
import ProviderDashboard from '@/pages/provider/ProviderDashboard';
import ProviderOnboarding from '@/pages/provider/ProviderOnboarding';
import DriverDashboard from '@/pages/driver/DriverDashboard';
import DriverOnboarding from '@/pages/driver/DriverOnboarding';
import AvailableJobs from '@/pages/driver/AvailableJobs';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          
          <Route path="/customer/*" element={
            <ProtectedRoute requiredRole="customer">
              <Routes>
                <Route path="dashboard" element={<CustomerDashboard />} />
                <Route path="orders" element={<CustomerOrders />} />
                <Route path="new-order" element={<NewOrderPage />} />
              </Routes>
            </ProtectedRoute>
          } />
          
          <Route path="/provider/*" element={
            <ProtectedRoute requiredRole="provider">
              <Routes>
                <Route path="onboarding" element={<ProviderOnboarding />} />
                <Route path="dashboard" element={<ProviderDashboard />} />
              </Routes>
            </ProtectedRoute>
          } />
          
          <Route path="/driver/*" element={
            <ProtectedRoute requiredRole="driver">
              <Routes>
                <Route path="onboarding" element={<DriverOnboarding />} />
                <Route path="dashboard" element={<DriverDashboard />} />
                <Route path="available-jobs" element={<AvailableJobs />} />
              </Routes>
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
