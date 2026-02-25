import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Clock, Shield, Truck, CheckCircle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      const path = user.role === 'customer' ? '/customer/dashboard' : 
                  user.role === 'provider' ? '/provider/dashboard' : 
                  '/driver/dashboard';
      navigate(path);
    } else {
      navigate('/register');
    }
  };

  return (
    <div data-testid="landing-page" className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-sky-500" />
            <span className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>FreshFlow</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Button 
                data-testid="dashboard-btn"
                onClick={handleGetStarted}
                className="rounded-full px-6 py-5 bg-gradient-to-r from-sky-500 to-blue-600 hover:shadow-lg transition-all"
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button 
                  data-testid="login-btn"
                  variant="ghost" 
                  onClick={() => navigate('/login')}
                  className="rounded-full hover:bg-slate-100"
                >
                  Sign In
                </Button>
                <Button 
                  data-testid="get-started-btn"
                  onClick={handleGetStarted}
                  className="rounded-full px-6 py-5 bg-gradient-to-r from-sky-500 to-blue-600 hover:shadow-lg transition-all"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 
              data-testid="hero-title"
              className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              Laundry & Dry Cleaning,
              <span className="text-sky-500"> Delivered Fresh</span>
            </h1>
            <p className="text-lg md:text-xl leading-relaxed text-slate-600 mb-10 max-w-2xl mx-auto">
              Schedule pickup, track your order in real-time, and get fresh, clean laundry delivered to your door. Supporting local businesses with seamless service.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                data-testid="hero-cta-btn"
                onClick={handleGetStarted}
                size="lg"
                className="rounded-full px-8 py-6 text-lg font-semibold bg-gradient-to-r from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 transition-all active:scale-95"
              >
                Order Now
              </Button>
              <Button 
                data-testid="become-partner-btn"
                onClick={() => navigate('/register')}
                size="lg"
                variant="outline"
                className="rounded-full px-8 py-6 text-lg font-semibold bg-white border-slate-200 hover:bg-slate-50 transition-all"
              >
                Become a Partner
              </Button>
            </div>
          </motion.div>

          {/* Hero Image */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-16 rounded-2xl overflow-hidden shadow-2xl"
          >
            <img 
              src="https://images.pexels.com/photos/4049148/pexels-photo-4049148.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
              alt="Neatly stacked fresh clothes"
              className="w-full h-[500px] object-cover"
            />
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 
              className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 mb-4"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              How FreshFlow Works
            </h2>
            <p className="text-lg text-slate-600">Simple, fast, and reliable laundry service in three easy steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
            >
              <div className="w-14 h-14 rounded-full bg-sky-100 flex items-center justify-center mb-6">
                <Clock className="w-7 h-7 text-sky-500" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>Schedule Pickup</h3>
              <p className="text-base leading-relaxed text-slate-600">
                Choose your preferred pickup time and location. Our drivers will collect your laundry at your convenience.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
                <CheckCircle className="w-7 h-7 text-emerald-500" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>Professional Cleaning</h3>
              <p className="text-base leading-relaxed text-slate-600">
                Local trusted providers clean your items with care using eco-friendly products and premium service.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
            >
              <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mb-6">
                <Truck className="w-7 h-7 text-indigo-500" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>Fast Delivery</h3>
              <p className="text-base leading-relaxed text-slate-600">
                Track your order in real-time and receive fresh, folded laundry delivered right to your doorstep.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 
                className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 mb-6"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                Trusted by Thousands
              </h2>
              <p className="text-lg leading-relaxed text-slate-600 mb-8">
                Join thousands of satisfied customers who trust FreshFlow for their laundry needs. We partner with verified local businesses to ensure quality and reliability.
              </p>
              <div className="flex items-center gap-8">
                <div>
                  <div className="text-3xl font-bold text-sky-500">10K+</div>
                  <div className="text-sm text-slate-600">Happy Customers</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-emerald-500">500+</div>
                  <div className="text-sm text-slate-600">Partner Providers</div>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <div className="text-3xl font-bold text-slate-900">4.9</div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-xl">
              <img 
                src="https://images.unsplash.com/photo-1753900124843-de8323c20f69?crop=entropy&cs=srgb&fm=jpg&q=85"
                alt="Happy customer"
                className="w-full h-[400px] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 
            className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 mb-6"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            Ready to Experience Fresh?  
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Sign up today and get your first order with express delivery.
          </p>
          <Button 
            data-testid="footer-cta-btn"
            onClick={handleGetStarted}
            size="lg"
            className="rounded-full px-8 py-6 text-lg font-semibold bg-gradient-to-r from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 transition-all active:scale-95"
          >
            Get Started Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-6 bg-white">
        <div className="max-w-7xl mx-auto text-center text-slate-600">
          <p>&copy; 2026 FreshFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
