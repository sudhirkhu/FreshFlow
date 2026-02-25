import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Sparkles, LayoutDashboard, Package, Truck, Store, LogOut, Plus, Briefcase } from 'lucide-react';

export default function DashboardLayout({ children, role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavItems = () => {
    if (role === 'customer') {
      return [
        { path: '/customer/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/customer/orders', icon: Package, label: 'My Orders' },
        { path: '/customer/new-order', icon: Plus, label: 'New Order' }
      ];
    } else if (role === 'provider') {
      return [
        { path: '/provider/dashboard', icon: Store, label: 'Dashboard' },
        { path: '/provider/dashboard', icon: Package, label: 'Orders' }
      ];
    } else if (role === 'driver') {
      return [
        { path: '/driver/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/driver/available-jobs', icon: Briefcase, label: 'Available Jobs' }
      ];
    }
    return [];
  };

  const navItems = getNavItems();

  return (
    <div data-testid="dashboard-layout" className="min-h-screen bg-[#F8FAFC]">
      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-100 p-6 hidden md:flex flex-col z-40">
        <div className="flex items-center gap-2 mb-8">
          <Sparkles className="w-8 h-8 text-sky-500" />
          <span className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>FreshFlow</span>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  isActive 
                    ? 'bg-sky-50 text-sky-600' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 pt-4">
          <div className="px-4 py-3 mb-2">
            <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="text-xs text-slate-600">{user?.email}</p>
          </div>
          <Button
            data-testid="logout-btn"
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-slate-600 hover:text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 p-4 pb-8 z-50 md:hidden">
        <div className="flex justify-around items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 ${
                  isActive ? 'text-sky-600' : 'text-slate-600'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
          <button
            data-testid="mobile-logout-btn"
            onClick={handleLogout}
            className="flex flex-col items-center gap-1 text-slate-600"
          >
            <LogOut className="w-6 h-6" />
            <span className="text-xs font-medium">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="md:ml-64 min-h-screen p-6 md:p-12 pb-24 md:pb-12">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
