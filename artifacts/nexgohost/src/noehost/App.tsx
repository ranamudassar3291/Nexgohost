import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import TopBar from './components/TopBar';
import Hero from './components/Hero';
import Pricing from './components/Pricing';
import ControlEfficiency from './components/ControlEfficiency';
import FeatureShowcase from './components/FeatureShowcase';
import Promo from './components/Promo';
import Services from './components/Services';
import Features from './components/Features';
import CTA from './components/CTA';
import FAQ from './components/FAQ';
import Testimonials from './components/Testimonials';
import Footer from './components/Footer';
import LiveChatWidget from '@/components/LiveChatWidget';
import HostingPageLayout from './components/pages/HostingPageLayout';
import SharedHosting from './components/pages/SharedHosting';
import VPSHosting from './components/pages/VPSHosting';
import WordPressHosting from './components/pages/WordPressHosting';
import ResellerHosting from './components/pages/ResellerHosting';
import AboutUs from './components/pages/AboutUs';
import ContactUs from './components/pages/ContactUs';
import Domains from './components/pages/Domains';
import PrivacyPolicy from './components/pages/PrivacyPolicy';
import TermsAndConditions from './components/pages/TermsAndConditions';
import RefundPolicy from './components/pages/RefundPolicy';
import ServerStatus from './components/pages/ServerStatus';
import CartSidebar from './components/CartSidebar';
import AdminDashboard from './components/AdminDashboard';
import { useContent } from './ContentContext';
import { CartProvider } from './context/CartContext';
import { Link } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';

function AdminNoeEmbed() {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999 }}>
      <iframe
        src="/client/admin/noe"
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Admin Panel"
      />
    </div>
  );
}

function AdminCMSLogin({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid credentials'); return; }
      if (data.user?.role !== 'admin') { setError('Admin access only'); return; }
      localStorage.setItem('noehost_token', data.token);
      onLogin(data.user);
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #08080a 0%, #0e0a1f 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl" style={{ background: 'linear-gradient(135deg, #673de6, #8b5cf6)', boxShadow: '0 0 40px rgba(103,61,230,0.4)' }}>
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">CMS Admin</h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">Sign in to manage your website content</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl p-8 space-y-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(103,61,230,0.2)', backdropFilter: 'blur(20px)' }}>
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-red-400" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span>⚠</span> {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'rgba(103,61,230,0.8)' }}>Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@noehost.com"
              required
              autoComplete="username"
              className="w-full px-4 py-3.5 rounded-xl text-sm text-white placeholder-slate-500 font-medium outline-none transition-all focus:ring-2 focus:ring-purple-500/30"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(103,61,230,0.25)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'rgba(103,61,230,0.8)' }}>Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3.5 pr-12 rounded-xl text-sm text-white placeholder-slate-500 font-medium outline-none transition-all focus:ring-2 focus:ring-purple-500/30"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(103,61,230,0.25)' }}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl font-black text-white text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #673de6, #8b5cf6)', boxShadow: '0 4px 20px rgba(103,61,230,0.4)' }}
          >
            {loading ? <><Loader2 size={18} className="animate-spin" /> Signing In...</> : <><Shield size={16} /> Sign In to CMS</>}
          </button>

          <div className="text-center pt-2">
            <a href="/admin/noe" className="text-xs text-slate-500 hover:text-purple-400 transition-colors font-medium">
              Go to Backend Admin Panel →
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminCMSProtected({ user, setUser }: { user: any; setUser: (u: any) => void }) {
  if (!user || user.role !== 'admin') {
    return <AdminCMSLogin onLogin={setUser} />;
  }
  return <AdminDashboard user={user} setUser={setUser} />;
}

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-dark text-center px-6">
      <div className="text-8xl font-black text-white/10 mb-4">404</div>
      <h1 className="text-3xl font-black text-white mb-3">Page Not Found</h1>
      <p className="text-slate-400 font-medium mb-8 max-w-md">
        This page doesn't exist. Let's take you back to the homepage.
      </p>
      <Link
        to="/"
        className="px-8 py-3.5 bg-primary hover:bg-primary-600 text-white rounded-xl font-black text-sm transition-all shadow-xl shadow-primary/30"
      >
        Back to Home
      </Link>
    </div>
  );
}

const AppRoutes: React.FC<{ user: any; setUser: (u: any) => void }> = ({ user, setUser }) => {
  return (
    <>
      <CartSidebar />
      <Routes>
        <Route path="/" element={
          <>
            <header className="fixed top-0 left-0 right-0 z-[100]">
              <TopBar />
              <Navbar user={user} setUser={setUser} />
            </header>
            <main className="flex-grow pt-[116px] lg:pt-[100px]">
              <Hero />
              <Pricing />
              <ControlEfficiency />
              <FeatureShowcase />
              <Promo />
              <Services />
              <Features />
              <CTA />
              <FAQ />
              <Testimonials />
            </main>
            <Footer />
            <LiveChatWidget autoPopup source="website" />
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="fixed bottom-28 right-8 w-12 h-12 bg-slate-900/10 hover:bg-slate-900/20 backdrop-blur-md rounded-full flex items-center justify-center text-slate-600 transition-all z-[100]"
            >
              ↑
            </button>
          </>
        } />

        <Route path="/shared-hosting" element={
          <HostingPageLayout user={user} setUser={setUser}><SharedHosting /></HostingPageLayout>
        } />
        <Route path="/vps-hosting" element={
          <HostingPageLayout user={user} setUser={setUser}><VPSHosting /></HostingPageLayout>
        } />
        <Route path="/wordpress-hosting" element={
          <HostingPageLayout user={user} setUser={setUser}><WordPressHosting /></HostingPageLayout>
        } />
        <Route path="/reseller-hosting" element={
          <HostingPageLayout user={user} setUser={setUser}><ResellerHosting /></HostingPageLayout>
        } />
        <Route path="/domains" element={
          <HostingPageLayout user={user} setUser={setUser}><Domains /></HostingPageLayout>
        } />
        <Route path="/about" element={
          <HostingPageLayout user={user} setUser={setUser}><AboutUs /></HostingPageLayout>
        } />
        <Route path="/about-us" element={
          <HostingPageLayout user={user} setUser={setUser}><AboutUs /></HostingPageLayout>
        } />
        <Route path="/contact" element={
          <HostingPageLayout user={user} setUser={setUser}><ContactUs /></HostingPageLayout>
        } />
        <Route path="/contact-us" element={
          <HostingPageLayout user={user} setUser={setUser}><ContactUs /></HostingPageLayout>
        } />
        <Route path="/privacy-policy" element={
          <HostingPageLayout user={user} setUser={setUser}><PrivacyPolicy /></HostingPageLayout>
        } />
        <Route path="/terms-and-conditions" element={
          <HostingPageLayout user={user} setUser={setUser}><TermsAndConditions /></HostingPageLayout>
        } />
        <Route path="/refund-policy" element={
          <HostingPageLayout user={user} setUser={setUser}><RefundPolicy /></HostingPageLayout>
        } />
        <Route path="/status" element={
          <HostingPageLayout user={user} setUser={setUser}><ServerStatus /></HostingPageLayout>
        } />

        <Route path="/admin/noe" element={<AdminNoeEmbed />} />
        <Route path="/admin" element={<AdminCMSProtected user={user} setUser={setUser} />} />
        <Route path="/admin/*" element={<AdminCMSProtected user={user} setUser={setUser} />} />

        {/* Removed routes — redirect to nexgohost */}
        <Route path="/login" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<Navigate to="/register" replace />} />
        <Route path="/cart" element={<Navigate to="/dashboard/cart" replace />} />
        <Route path="/checkout" element={<Navigate to="/dashboard/checkout" replace />} />

        {/* 404 fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  useContent();

  useEffect(() => {
    const token = localStorage.getItem('noehost_token');
    if (!token) return;
    fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => setUser(data))
      .catch(() => localStorage.removeItem('noehost_token'));
  }, []);

  return (
    <CartProvider>
      <Router basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <div className="min-h-screen flex flex-col selection:bg-primary/30">
          <AppRoutes user={user} setUser={setUser} />
        </div>
      </Router>
    </CartProvider>
  );
};

export default App;
