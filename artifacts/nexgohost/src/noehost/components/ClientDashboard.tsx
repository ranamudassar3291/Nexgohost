import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Server, CreditCard, LifeBuoy, LogOut, 
  Bell, Search, Menu, X, ChevronRight, ExternalLink, 
  Clock, CheckCircle, AlertCircle, Plus, Globe 
} from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  user: any;
  setUser: (user: any) => void;
}

const ClientDashboard: React.FC<DashboardProps> = ({ user, setUser }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
        return res.json();
      })
      .then(d => {
        setData(d);
      })
      .catch(err => {
        console.error('Dashboard Fetch Error:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    navigate('/');
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Loading Dashboard...</div>;
  if (!data) return <div className="h-screen flex items-center justify-center text-red-500 font-bold">Error loading dashboard data. Please check your connection.</div>;

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Overview', path: '/dashboard' },
    { icon: <Server size={20} />, label: 'Services', path: '/dashboard/services' },
    { icon: <CreditCard size={20} />, label: 'Billing', path: '/dashboard/billing' },
    { icon: <LifeBuoy size={20} />, label: 'Support', path: '/dashboard/support' },
  ];

  const Sidebar = () => (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-secondary text-white transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out`}>
      <div className="flex flex-col h-full">
        <div className="p-6 flex items-center justify-between">
          <Link to="/" className="text-2xl font-black tracking-tighter text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Server size={18} />
            </div>
            NEOHOST
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-grow px-4 space-y-2 mt-4">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                location.pathname === item.path 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="p-4 bg-white/5 rounded-2xl mb-4">
            <p className="text-xs text-slate-500 mb-1 uppercase font-bold tracking-wider">Logged in as</p>
            <p className="text-sm font-bold truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-400/10 rounded-xl font-medium transition-all"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </div>
    </div>
  );

  const Overview = () => (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Mission Control</h1>
          <p className="text-slate-500">Welcome back, {user.name.split(' ')[0]}! Here's what's happening with your account.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-white"></span>
          </button>
          <button className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-600 transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
            <Plus size={20} />
            New Service
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Services', value: data.services.length, icon: <Server className="text-blue-500" />, color: 'bg-blue-50' },
          { label: 'Domains', value: data.services.length, icon: <Globe className="text-primary" />, color: 'bg-primary/5' },
          { label: 'Unpaid Invoices', value: data.invoices.filter((i:any) => i.status === 'unpaid').length, icon: <CreditCard className="text-amber-500" />, color: 'bg-amber-50' },
          { label: 'Open Tickets', value: data.tickets.filter((t:any) => t.status === 'open').length, icon: <LifeBuoy className="text-emerald-500" />, color: 'bg-emerald-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${stat.color} flex items-center justify-center`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Active Services</h3>
              <Link to="/dashboard/services" className="text-sm font-bold text-primary hover:text-primary-600">View All</Link>
            </div>
            <div className="divide-y divide-slate-50">
              {data.services.map((service: any) => (
                <div key={service.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                      <Server size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{service.plan_name}</p>
                      <p className="text-sm text-slate-500">{service.domain}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="hidden md:block text-right">
                      <p className="text-xs text-slate-400 uppercase font-bold">Next Due</p>
                      <p className="text-sm font-medium text-slate-700">{new Date(service.next_due_date).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      service.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {service.status}
                    </span>
                    <button className="p-2 text-slate-400 hover:text-slate-600">
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50">
              <h3 className="font-bold text-slate-900">Activity Feed</h3>
            </div>
            <div className="p-6 space-y-6">
              {data.activity.length > 0 ? data.activity.map((act: any) => (
                <div key={act.id} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <Clock size={14} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-800 font-medium">{act.action}</p>
                    <p className="text-xs text-slate-400">{new Date(act.created_at).toLocaleString()}</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-sm italic">No recent activity</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ServicesList = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-slate-900">My Services</h1>
        <button className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-600 transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
          <Plus size={20} />
          Order New
        </button>
      </div>
      
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50">
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Service / Domain</th>
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Pricing</th>
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Next Due</th>
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.services.map((service: any) => (
              <tr key={service.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-6">
                  <p className="font-bold text-slate-900">{service.plan_name}</p>
                  <p className="text-sm text-slate-500">{service.domain}</p>
                </td>
                <td className="p-6">
                  <p className="font-bold text-slate-900">$2.99</p>
                  <p className="text-xs text-slate-400">Monthly</p>
                </td>
                <td className="p-6">
                  <p className="text-sm font-medium text-slate-700">{new Date(service.next_due_date).toLocaleDateString()}</p>
                </td>
                <td className="p-6">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    service.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {service.status}
                  </span>
                </td>
                <td className="p-6">
                  <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-all">
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const Billing = () => (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold text-slate-900">Billing & Invoices</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <h3 className="font-bold text-slate-900">Invoice History</h3>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Invoice #</th>
                <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-6 font-bold text-slate-900">#INV-{inv.id.toString().padStart(4, '0')}</td>
                  <td className="p-6 text-sm text-slate-500">{new Date(inv.created_at).toLocaleDateString()}</td>
                  <td className="p-6 font-bold text-slate-900">${inv.amount.toFixed(2)}</td>
                  <td className="p-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="p-6">
                    {inv.status === 'unpaid' ? (
                      <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-600 transition-all">
                        Pay Now
                      </button>
                    ) : (
                      <button className="text-slate-400 hover:text-primary transition-all">
                        <ExternalLink size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div className="bg-primary rounded-3xl p-8 text-white shadow-xl shadow-primary/20">
            <h3 className="text-xl font-bold mb-4">Account Balance</h3>
            <div className="text-4xl font-black mb-6">$0.00</div>
            <button className="w-full py-3 bg-white text-primary rounded-xl font-bold hover:bg-slate-50 transition-all">
              Add Funds
            </button>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">Payment Methods</h3>
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-4">
              <div className="w-10 h-6 bg-slate-800 rounded flex items-center justify-center text-[8px] font-bold text-white">VISA</div>
              <div className="flex-grow">
                <p className="text-sm font-bold text-slate-900">•••• 4242</p>
                <p className="text-xs text-slate-400">Expires 12/26</p>
              </div>
              <CheckCircle size={18} className="text-green-500" />
            </div>
            <button className="w-full py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all text-sm">
              Add New Method
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const Support = () => {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleCreateTicket = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      await fetch('/api/dashboard/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message }),
      });
      // Refresh data
      const res = await fetch('/api/dashboard');
      const d = await res.json();
      setData(d);
      setSubject('');
      setMessage('');
      setSubmitting(false);
    };

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold text-slate-900">Support Center</h1>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            24/7 Support Online
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-50">
                <h3 className="font-bold text-slate-900">My Support Tickets</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {data.tickets.length > 0 ? data.tickets.map((ticket: any) => (
                  <div key={ticket.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-bold text-slate-900">{ticket.subject}</p>
                      <p className="text-sm text-slate-500 truncate max-w-md">{ticket.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{new Date(ticket.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      ticket.status === 'open' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {ticket.status}
                    </span>
                  </div>
                )) : (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
                      <LifeBuoy size={32} />
                    </div>
                    <p className="text-slate-500">You don't have any support tickets yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <h3 className="font-bold text-slate-900 mb-6">Open New Ticket</h3>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Subject</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="Technical Issue"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Message</label>
                <textarea 
                  required
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="Describe your issue in detail..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                ></textarea>
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Submit Ticket'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-64">
      <Sidebar />
      
      {/* Mobile Header */}
      <header className="lg:hidden bg-secondary text-white p-4 flex items-center justify-between sticky top-0 z-40">
        <Link to="/" className="text-xl font-black tracking-tighter">NEOHOST</Link>
        <button onClick={() => setSidebarOpen(true)} className="p-2">
          <Menu size={24} />
        </button>
      </header>

      <main className="p-6 lg:p-10 max-w-7xl mx-auto">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/services" element={<ServicesList />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/support" element={<Support />} />
        </Routes>
      </main>
    </div>
  );
};

const Loader2 = ({ size = 24, className = "" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={`animate-spin ${className}`}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default ClientDashboard;
