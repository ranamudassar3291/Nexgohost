import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Server, Activity, Shield, LogOut,
  Bell, Menu, X, ChevronRight, TrendingUp,
  DollarSign, Briefcase, LifeBuoy, MoreVertical,
  CheckCircle, AlertCircle, RefreshCw, Filter, Edit3, Save, Globe, List, Plus, Trash2, Zap, Star,
  Home, Settings, FileText, Eye, EyeOff, Image, Link2, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, Layers, Layout, Type, Hash, AlignLeft, Phone, Mail, Twitter,
  Github, Linkedin, MessageSquare, Award, Package, Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useContent } from '../ContentContext';
import SharedHostingEditor from './admin/SharedHostingEditor';
import VPSHostingEditor from './admin/VPSHostingEditor';
import WordPressHostingEditor from './admin/WordPressHostingEditor';
import ResellerHostingEditor from './admin/ResellerHostingEditor';
import AboutEditor from './admin/AboutEditor';
import ContactEditor from './admin/ContactEditor';
import LegalPageEditor from './admin/LegalPageEditor';
import DomainPricingEditor from './admin/DomainPricingEditor';

interface AdminDashboardProps {
  user: any;
  setUser: (user: any) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, setUser }) => {
  const { content, updateContent, refreshContent, firebaseConnected } = useContent();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    const token = localStorage.getItem('noehost_token');
    await fetch('/api/auth/logout', { method: 'POST', headers: token ? { 'Authorization': `Bearer ${token}` } : {} }).catch(() => {});
    localStorage.removeItem('noehost_token');
    setUser(null);
    navigate('/');
  };

  const menuGroups = [
    {
      label: 'Homepage',
      items: [
        { icon: <Home size={16} />, label: 'Hero Section', path: '/admin/hero' },
        { icon: <Zap size={16} />, label: 'Features', path: '/admin/features' },
        { icon: <Package size={16} />, label: 'Services', path: '/admin/services' },
        { icon: <TrendingUp size={16} />, label: 'Promotions', path: '/admin/promo' },
        { icon: <Layers size={16} />, label: 'Control & Efficiency', path: '/admin/control-efficiency' },
        { icon: <Layout size={16} />, label: 'Feature Showcase', path: '/admin/feature-showcase' },
        { icon: <Star size={16} />, label: 'Testimonials', path: '/admin/testimonials' },
        { icon: <MessageSquare size={16} />, label: 'FAQ', path: '/admin/faq' },
        { icon: <Award size={16} />, label: 'CTA Banner', path: '/admin/cta' },
      ]
    },
    {
      label: 'Hosting Pages',
      items: [
        { icon: <Server size={16} />, label: 'Shared Hosting', path: '/admin/page-shared-hosting' },
        { icon: <Cpu size={16} />, label: 'VPS Hosting', path: '/admin/page-vps-hosting' },
        { icon: <Layout size={16} />, label: 'WordPress Hosting', path: '/admin/page-wordpress-hosting' },
        { icon: <Users size={16} />, label: 'Reseller Hosting', path: '/admin/page-reseller-hosting' },
      ]
    },
    {
      label: 'Packages & Pricing',
      items: [
        { icon: <DollarSign size={16} />, label: 'Pricing Plans', path: '/admin/pricing' },
        { icon: <Globe size={16} />, label: 'Domain Pricing', path: '/admin/domain-pricing' },
      ]
    },
    {
      label: 'Info Pages',
      items: [
        { icon: <Star size={16} />, label: 'About Us', path: '/admin/page-about' },
        { icon: <Phone size={16} />, label: 'Contact Us', path: '/admin/page-contact' },
        { icon: <Shield size={16} />, label: 'Privacy Policy', path: '/admin/page-privacy' },
        { icon: <FileText size={16} />, label: 'Terms & Conditions', path: '/admin/page-terms' },
        { icon: <RefreshCw size={16} />, label: 'Refund Policy', path: '/admin/page-refund' },
      ]
    },
    {
      label: 'Global Settings',
      items: [
        { icon: <Globe size={16} />, label: 'Navigation & Logo', path: '/admin/navigation' },
        { icon: <Shield size={16} />, label: 'Footer', path: '/admin/footer' },
        { icon: <Settings size={16} />, label: 'Top Bar', path: '/admin/topbar' },
        { icon: <Settings size={16} />, label: 'Global Config', path: '/admin/config' },
      ]
    }
  ];

  const isActive = (path: string) => location.pathname === path;

  const Sidebar = () => (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out`}
        style={{ background: 'linear-gradient(180deg, #0e0e11 0%, #09090c 100%)', borderRight: '1px solid rgba(103,61,230,0.15)' }}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b" style={{ borderColor: 'rgba(103,61,230,0.15)' }}>
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #673de6, #8b5cf6)' }}>
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <div className="text-white font-black text-sm tracking-tight">NEOHOST</div>
              <div className="text-[9px] font-bold tracking-widest uppercase" style={{ color: '#673de6' }}>CMS PANEL</div>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-500 hover:text-white p-1 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-grow overflow-y-auto py-4 px-3 space-y-6 scrollbar-thin">
          {menuGroups.map((group, gi) => (
            <div key={gi}>
              <div className="px-3 mb-2">
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(103,61,230,0.6)' }}>{group.label}</span>
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group ${isActive(item.path)
                        ? 'text-white shadow-lg'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    style={isActive(item.path) ? { background: 'linear-gradient(135deg, rgba(103,61,230,0.4), rgba(103,61,230,0.15))', border: '1px solid rgba(103,61,230,0.3)' } : {}}
                  >
                    <span className={isActive(item.path) ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'}>{item.icon}</span>
                    {item.label}
                    {isActive(item.path) && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400" />}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="p-4 border-t" style={{ borderColor: 'rgba(103,61,230,0.15)' }}>
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl mb-2" style={{ background: 'rgba(103,61,230,0.08)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: 'linear-gradient(135deg, #673de6, #8b5cf6)' }}>
              {user?.name?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-bold truncate">{user?.name || 'Admin'}</div>
              <div className="text-slate-500 text-[10px] truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:bg-red-400/10 hover:text-red-300 rounded-xl text-sm font-semibold transition-all"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );

  // Reusable field components styled for dark theme
  const Field = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(103,61,230,0.8)' }}>{label}</label>
      {children}
    </div>
  );

  const inputCls = "w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-500 font-medium outline-none transition-all focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
  const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(103,61,230,0.2)' };

  const Input = ({ value, onChange, placeholder = '', type = 'text' }: any) => (
    <input type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder}
      className={inputCls} style={inputStyle} />
  );

  const Textarea = ({ value, onChange, placeholder = '', rows = 4 }: any) => (
    <textarea value={value ?? ''} onChange={onChange} placeholder={placeholder} rows={rows}
      className={inputCls} style={inputStyle} />
  );

  const Toggle = ({ checked, onChange, label }: { checked: boolean, onChange: any, label: string }) => (
    <label className="flex items-center gap-3 cursor-pointer group">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-all ${checked ? 'bg-purple-600' : 'bg-slate-700'}`}
      >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </button>
      <span className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">{label}</span>
    </label>
  );

  const PageCard = ({ title, children, onSave, saving }: { title: string, children: React.ReactNode, onSave: () => void, saving: boolean }) => (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(103,61,230,0.15)' }}>
      <div className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'rgba(103,61,230,0.1)', background: 'rgba(103,61,230,0.05)' }}>
        <h2 className="text-lg font-black text-white tracking-tight">{title}</h2>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 shadow-lg active:scale-95"
          style={{ background: saving ? '#555' : 'linear-gradient(135deg, #673de6, #8b5cf6)', boxShadow: '0 4px 15px rgba(103,61,230,0.35)' }}
        >
          {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
      <div className="p-6 space-y-6">{children}</div>
    </div>
  );

  const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(103,61,230,0.1)' }}>
      <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'rgba(103,61,230,0.7)' }}>{title}</div>
      {children}
    </div>
  );

  const ListEditor = ({ items, onChange, renderItem, newItem }: { items: any[], onChange: (v: any[]) => void, renderItem: (item: any, idx: number, update: (v: any) => void, remove: () => void) => React.ReactNode, newItem: any }) => (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="relative rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(103,61,230,0.1)' }}>
          {renderItem(
            item,
            idx,
            (val: any) => { const n = [...items]; n[idx] = { ...n[idx], ...val }; onChange(n); },
            () => onChange(items.filter((_, k) => k !== idx))
          )}
        </div>
      ))}
      <button
        onClick={() => onChange([...items, newItem])}
        className="w-full py-3 rounded-xl text-sm font-bold text-purple-400 hover:text-purple-300 transition-all flex items-center justify-center gap-2"
        style={{ border: '2px dashed rgba(103,61,230,0.3)', background: 'rgba(103,61,230,0.04)' }}
      >
        <Plus size={16} /> Add Item
      </button>
    </div>
  );

  const DeleteBtn = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="absolute top-3 right-3 p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-all">
      <Trash2 size={14} />
    </button>
  );

  const PageHeader = ({ title, subtitle, icon }: { title: string, subtitle: string, icon: React.ReactNode }) => (
    <div className="mb-8 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, rgba(103,61,230,0.3), rgba(103,61,230,0.1))', border: '1px solid rgba(103,61,230,0.3)' }}>
        <span className="text-purple-400">{icon}</span>
      </div>
      <div>
        <h1 className="text-2xl font-black text-white">{title}</h1>
        <p className="text-slate-400 text-sm">{subtitle}</p>
      </div>
    </div>
  );

  // ─── MANAGERS ────────────────────────────────────────────────────────────────

  const HeroManager = () => {
    const [data, setData] = useState(content?.hero || {});
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (content?.hero) setData(content.hero); }, [content]);

    const save = async () => {
      setSaving(true);
      try { await updateContent('hero', data); } catch { alert('Failed to save'); } finally { setSaving(false); }
    };

    return (
      <div className="space-y-6">
        <PageHeader title="Hero Section" subtitle="Edit the main banner shown at the top of your homepage" icon={<Home size={22} />} />
        <PageCard title="Hero Content" onSave={save} saving={saving}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Badge Text"><Input value={data.badge} onChange={(e: any) => setData({ ...data, badge: e.target.value })} placeholder="SPECIAL OFFER: SAVE 75% TODAY" /></Field>
            <Field label="Main Title"><Input value={data.title} onChange={(e: any) => setData({ ...data, title: e.target.value })} placeholder="Empower Your Digital Future" /></Field>
          </div>
          <Field label="Description"><Textarea value={data.description} onChange={(e: any) => setData({ ...data, description: e.target.value })} placeholder="Experience blazing-fast performance..." /></Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Starting Price (USD/mo)"><input type="number" step="0.01" min="0" value={data.startingPrice ?? 1.99} onChange={(e: any) => setData({ ...data, startingPrice: parseFloat(e.target.value) || 1.99 })} className={inputCls} style={inputStyle} placeholder="1.99" /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Primary Button Text"><Input value={data.ctaPrimary} onChange={(e: any) => setData({ ...data, ctaPrimary: e.target.value })} placeholder="Get Started" /></Field>
            <Field label="Primary Button Link"><Input value={data.ctaPrimaryHref} onChange={(e: any) => setData({ ...data, ctaPrimaryHref: e.target.value })} placeholder="/shared-hosting" /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Secondary Button Text"><Input value={data.ctaSecondary} onChange={(e: any) => setData({ ...data, ctaSecondary: e.target.value })} placeholder="See Plans" /></Field>
            <Field label="Secondary Button Link"><Input value={data.ctaSecondaryHref} onChange={(e: any) => setData({ ...data, ctaSecondaryHref: e.target.value })} placeholder="/#pricing" /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Toggle checked={data.showCtaPrimary !== false} onChange={(v: boolean) => setData({ ...data, showCtaPrimary: v })} label="Show Primary Button" />
            <Toggle checked={data.showCtaSecondary !== false} onChange={(v: boolean) => setData({ ...data, showCtaSecondary: v })} label="Show Secondary Button" />
          </div>

          <Section title="Key Features (Checklist)">
            <ListEditor
              items={data.features || []}
              onChange={(v) => setData({ ...data, features: v })}
              newItem=""
              renderItem={(item, idx, update, remove) => (
                <div className="flex gap-2 items-center">
                  <input value={item} onChange={(e) => { const n = [...(data.features || [])]; n[idx] = e.target.value; setData({ ...data, features: n }); }}
                    className={inputCls + " flex-1"} style={inputStyle} placeholder="Free Domain for 1st Year" />
                  <button onClick={remove} className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={14} /></button>
                </div>
              )}
            />
          </Section>
        </PageCard>
      </div>
    );
  };

  const FeaturesManager = () => {
    const [data, setData] = useState(content?.features || {});
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (content?.features) setData(content.features); }, [content]);
    const save = async () => { setSaving(true); try { await updateContent('features', data); } catch { alert('Failed'); } finally { setSaving(false); } };

    return (
      <div className="space-y-6">
        <PageHeader title="Features Section" subtitle="Manage the features grid on the homepage" icon={<Zap size={22} />} />
        <PageCard title="Features Content" onSave={save} saving={saving}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Section Title"><Input value={data.title} onChange={(e: any) => setData({ ...data, title: e.target.value })} /></Field>
            <Field label="Section Description"><Input value={data.description} onChange={(e: any) => setData({ ...data, description: e.target.value })} /></Field>
          </div>
          <Section title="Feature Items">
            <ListEditor
              items={data.items || []}
              onChange={(v) => setData({ ...data, items: v })}
              newItem={{ title: '', description: '' }}
              renderItem={(item, idx, update, remove) => (
                <div className="space-y-3 pr-8">
                  <DeleteBtn onClick={remove} />
                  <Input value={item.title} onChange={(e: any) => update({ title: e.target.value })} placeholder="Feature Title" />
                  <Textarea value={item.description} onChange={(e: any) => update({ description: e.target.value })} placeholder="Feature Description" rows={2} />
                </div>
              )}
            />
          </Section>
        </PageCard>
      </div>
    );
  };

  const ServicesManager = () => {
    const [data, setData] = useState(content?.services || {});
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (content?.services) setData(content.services); }, [content]);
    const save = async () => { setSaving(true); try { await updateContent('services', data); } catch { alert('Failed'); } finally { setSaving(false); } };

    return (
      <div className="space-y-6">
        <PageHeader title="Services Section" subtitle="Edit the services grid cards" icon={<Package size={22} />} />
        <PageCard title="Services Content" onSave={save} saving={saving}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Section Title"><Input value={data.title} onChange={(e: any) => setData({ ...data, title: e.target.value })} /></Field>
            <Field label="Section Description"><Input value={data.description} onChange={(e: any) => setData({ ...data, description: e.target.value })} /></Field>
          </div>
          <Section title="Service Cards">
            <ListEditor
              items={data.items || []}
              onChange={(v) => setData({ ...data, items: v })}
              newItem={{ title: '', description: '', color: 'text-primary', bg: 'bg-primary/10' }}
              renderItem={(item, idx, update, remove) => (
                <div className="space-y-3 pr-8">
                  <DeleteBtn onClick={remove} />
                  <Input value={item.title} onChange={(e: any) => update({ title: e.target.value })} placeholder="Service Title" />
                  <Textarea value={item.description} onChange={(e: any) => update({ description: e.target.value })} placeholder="Service Description" rows={2} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={item.color} onChange={(e: any) => update({ color: e.target.value })} placeholder="Color class e.g. text-primary" />
                    <Input value={item.bg} onChange={(e: any) => update({ bg: e.target.value })} placeholder="BG class e.g. bg-primary/10" />
                  </div>
                </div>
              )}
            />
          </Section>
        </PageCard>
      </div>
    );
  };

  const PromoManager = () => {
    const [data, setData] = useState(content?.promo || {});
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (content?.promo) setData(content.promo); }, [content]);
    const save = async () => { setSaving(true); try { await updateContent('promo', data); } catch { alert('Failed'); } finally { setSaving(false); } };

    return (
      <div className="space-y-6">
        <PageHeader title="Promotions Section" subtitle="Edit the onboarding steps / promotion section" icon={<TrendingUp size={22} />} />
        <PageCard title="Promo Content" onSave={save} saving={saving}>
          <Field label="Section Title"><Input value={data.title} onChange={(e: any) => setData({ ...data, title: e.target.value })} /></Field>
          <Field label="Section Description"><Textarea value={data.description} onChange={(e: any) => setData({ ...data, description: e.target.value })} rows={2} /></Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Button Text"><Input value={data.btnText} onChange={(e: any) => setData({ ...data, btnText: e.target.value })} placeholder="Start Your Business Now" /></Field>
            <Field label="Button Link"><Input value={data.btnHref} onChange={(e: any) => setData({ ...data, btnHref: e.target.value })} placeholder="/shared-hosting" /></Field>
          </div>
          <Toggle checked={data.showBtn !== false} onChange={(v: boolean) => setData({ ...data, showBtn: v })} label="Show Button" />
          <Section title="Onboarding Steps">
            <ListEditor
              items={data.steps || []}
              onChange={(v) => setData({ ...data, steps: v })}
              newItem={{ title: '', description: '', color: 'bg-primary' }}
              renderItem={(item, idx, update, remove) => (
                <div className="space-y-3 pr-8">
                  <DeleteBtn onClick={remove} />
                  <Input value={item.title} onChange={(e: any) => update({ title: e.target.value })} placeholder="Step Title" />
                  <Textarea value={item.description} onChange={(e: any) => update({ description: e.target.value })} placeholder="Step Description" rows={2} />
                  <Input value={item.color} onChange={(e: any) => update({ color: e.target.value })} placeholder="Color class e.g. bg-primary" />
                </div>
              )}
            />
          </Section>
        </PageCard>
      </div>
    );
  };

  const FAQManager = () => {
    const [data, setData] = useState(content?.faq || {});
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (content?.faq) setData(content.faq); }, [content]);
    const save = async () => { setSaving(true); try { await updateContent('faq', data); } catch { alert('Failed'); } finally { setSaving(false); } };

    return (
      <div className="space-y-6">
        <PageHeader title="FAQ Section" subtitle="Manage frequently asked questions" icon={<MessageSquare size={22} />} />
        <PageCard title="FAQ Content" onSave={save} saving={saving}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Section Title"><Input value={data.title} onChange={(e: any) => setData({ ...data, title: e.target.value })} /></Field>
            <Field label="Section Description"><Input value={data.description} onChange={(e: any) => setData({ ...data, description: e.target.value })} /></Field>
          </div>
          <Section title="FAQ Items">
            <ListEditor
              items={data.items || []}
              onChange={(v) => setData({ ...data, items: v })}
              newItem={{ question: '', answer: '' }}
              renderItem={(item, idx, update, remove) => (
                <div className="space-y-3 pr-8">
                  <DeleteBtn onClick={remove} />
                  <Input value={item.question} onChange={(e: any) => update({ question: e.target.value })} placeholder="Question" />
                  <Textarea value={item.answer} onChange={(e: any) => update({ answer: e.target.value })} placeholder="Answer" rows={3} />
                </div>
              )}
            />
          </Section>
        </PageCard>
      </div>
    );
  };

  const TestimonialsManager = () => {
    const [data, setData] = useState(content?.testimonials || {});
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (content?.testimonials) setData(content.testimonials); }, [content]);
    const save = async () => { setSaving(true); try { await updateContent('testimonials', data); } catch { alert('Failed'); } finally { setSaving(false); } };

    return (
      <div className="space-y-6">
        <PageHeader title="Testimonials" subtitle="Manage customer reviews and partner logos" icon={<Star size={22} />} />
        <PageCard title="Testimonials Content" onSave={save} saving={saving}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Section Title"><Input value={data.title} onChange={(e: any) => setData({ ...data, title: e.target.value })} /></Field>
            <Field label="Section Description"><Input value={data.description} onChange={(e: any) => setData({ ...data, description: e.target.value })} /></Field>
          </div>
          <Section title="Testimonial Cards">
            <ListEditor
              items={data.items || []}
              onChange={(v) => setData({ ...data, items: v })}
              newItem={{ name: '', role: '', content: '', avatar: '' }}
              renderItem={(item, idx, update, remove) => (
                <div className="space-y-3 pr-8">
                  <DeleteBtn onClick={remove} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={item.name} onChange={(e: any) => update({ name: e.target.value })} placeholder="Customer Name" />
                    <Input value={item.role} onChange={(e: any) => update({ role: e.target.value })} placeholder="Role / Company" />
                  </div>
                  <Textarea value={item.content} onChange={(e: any) => update({ content: e.target.value })} placeholder="Review text" rows={2} />
                  <Input value={item.avatar} onChange={(e: any) => update({ avatar: e.target.value })} placeholder="Avatar URL" />
                </div>
              )}
            />
          </Section>
          <Section title="Partner / Trust Logos (Names)">
            <div className="space-y-2">
              {(data.partners || []).map((p: string, i: number) => (
                <div key={i} className="flex gap-2">
                  <input value={p} onChange={(e) => { const n = [...(data.partners || [])]; n[i] = e.target.value; setData({ ...data, partners: n }); }}
                    className={inputCls + " flex-1"} style={inputStyle} placeholder="Partner name" />
                  <button onClick={() => setData({ ...data, partners: data.partners.filter((_: any, k: number) => k !== i) })}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-500/10"><Trash2 size={14} /></button>
                </div>
              ))}
              <button onClick={() => setData({ ...data, partners: [...(data.partners || []), ''] })}
                className="flex items-center gap-2 text-sm font-bold text-purple-400 hover:text-purple-300 mt-2">
                <Plus size={14} /> Add Partner
              </button>
            </div>
          </Section>
        </PageCard>
      </div>
    );
  };

  const CTAManager = () => {
    const [data, setData] = useState(content?.cta || {});
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (content?.cta) setData(content.cta); }, [content]);
    const save = async () => { setSaving(true); try { await updateContent('cta', data); } catch { alert('Failed'); } finally { setSaving(false); } };

    return (
      <div className="space-y-6">
        <PageHeader title="CTA Banner" subtitle="Edit the call-to-action section" icon={<Award size={22} />} />
        <PageCard title="CTA Content" onSave={save} saving={saving}>
          <Field label="Badge Text"><Input value={data.badge} onChange={(e: any) => setData({ ...data, badge: e.target.value })} /></Field>
          <Field label="Title"><Input value={data.title} onChange={(e: any) => setData({ ...data, title: e.target.value })} /></Field>
          <Field label="Description"><Textarea value={data.description} onChange={(e: any) => setData({ ...data, description: e.target.value })} rows={3} /></Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Primary Button Text"><Input value={data.ctaPrimary} onChange={(e: any) => setData({ ...data, ctaPrimary: e.target.value })} /></Field>
            <Field label="Primary Button Link"><Input value={data.ctaPrimaryHref} onChange={(e: any) => setData({ ...data, ctaPrimaryHref: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Secondary Button Text"><Input value={data.ctaSecondary} onChange={(e: any) => setData({ ...data, ctaSecondary: e.target.value })} /></Field>
            <Field label="Secondary Button Link"><Input value={data.ctaSecondaryHref} onChange={(e: any) => setData({ ...data, ctaSecondaryHref: e.target.value })} /></Field>
          </div>
          <Field label="Footer Note Text"><Input value={data.footer} onChange={(e: any) => setData({ ...data, footer: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Toggle checked={data.showCtaPrimary !== false} onChange={(v: boolean) => setData({ ...data, showCtaPrimary: v })} label="Show Primary Button" />
            <Toggle checked={data.showCtaSecondary !== false} onChange={(v: boolean) => setData({ ...data, showCtaSecondary: v })} label="Show Secondary Button" />
          </div>
        </PageCard>
      </div>
    );
  };

  const PricingManager = () => {
    const DEFAULT_PRICING = {
      header: { title: 'Choose your Web Hosting plan', subtitle: 'Get the best value for your money with our feature-rich plans. All plans include a 30-day money-back guarantee.' },
      shared: [
        { name: 'Single', monthly: 1.99, yearly: 1.49, btnText: 'Add to cart', btnUrl: '/register', features: ['1 Website', '50GB SSD', '100GB Bandwidth', 'Free SSL', 'Weekly Backups'], popular: false, badge: '' },
        { name: 'Premium', monthly: 2.99, yearly: 2.49, btnText: 'Add to cart', btnUrl: '/register', features: ['100 Websites', '100GB SSD', 'Unlimited Bandwidth', 'Free SSL', 'Free Domain ($9.99 value)', 'Weekly Backups'], popular: true, badge: '+ 3 Months Free' },
        { name: 'Business', monthly: 3.99, yearly: 2.99, btnText: 'Add to cart', btnUrl: '/register', features: ['100 Websites', '200GB NVMe SSD', 'Unlimited Bandwidth', 'Free SSL', 'Free Domain', 'Daily Backups', 'CDN Included'], popular: false, badge: '' },
      ],
      reseller: [
        { name: 'Reseller Lite', monthly: 19.99, yearly: 14.99, btnText: 'Add to cart', btnUrl: '/register', features: ['20 cPanel Accounts', '40GB SSD', 'White Label', 'Free WHMCS', 'Private Nameservers'], popular: false, badge: '' },
        { name: 'Reseller Pro', monthly: 39.99, yearly: 29.99, btnText: 'Add to cart', btnUrl: '/register', features: ['50 cPanel Accounts', '100GB SSD', 'White Label', 'Free Billing Software', 'Priority Support'], popular: true, badge: '' },
      ],
      allFeatures: [
        { category: 'Performance', items: ['NVMe Storage', 'Object Cache', 'CDN Included', '99.9% Uptime Guarantee'] },
        { category: 'Security', items: ['Free SSL', 'DDoS Protection', 'Web Application Firewall', 'Daily Backups'] },
        { category: 'Support', items: ['24/7 Live Chat', 'Priority Support', 'Knowledge Base', 'Video Tutorials'] },
        { category: 'Tools', items: ['WordPress Staging', 'AI Website Builder', 'GIT Integration', 'SSH Access'] },
      ],
    };

    const [data, setData] = useState<any>(content?.pricing || DEFAULT_PRICING);
    const [pricingSaving, setPricingSaving] = useState(false);
    const [pricingSaved, setPricingSaved] = useState(false);
    const [tab, setTab] = useState<'shared' | 'reseller' | 'allfeatures' | 'header'>('shared');
    const [openPlan, setOpenPlan] = useState<number | null>(null);
    const [openCat, setOpenCat] = useState<number | null>(null);

    useEffect(() => {
      if (content?.pricing) {
        const p = content.pricing;
        setData({
          header: p.header || DEFAULT_PRICING.header,
          shared: p.shared || DEFAULT_PRICING.shared,
          reseller: p.reseller || DEFAULT_PRICING.reseller,
          allFeatures: p.allFeatures || DEFAULT_PRICING.allFeatures,
        });
      }
    }, [content?.pricing]);

    const save = async () => {
      setPricingSaving(true);
      try {
        await updateContent('pricing', data);
        setPricingSaved(true);
        setTimeout(() => setPricingSaved(false), 2500);
      } catch { alert('Failed'); }
      finally { setPricingSaving(false); }
    };

    const updatePlan = (category: string, idx: number, field: string, val: any) => {
      setData((prev: any) => {
        const arr = [...(prev[category] || [])];
        arr[idx] = { ...arr[idx], [field]: val };
        return { ...prev, [category]: arr };
      });
    };

    const deletePlan = (category: string, idx: number) => {
      setData((prev: any) => ({ ...prev, [category]: prev[category].filter((_: any, k: number) => k !== idx) }));
    };

    const addPlan = (category: string) => {
      setData((prev: any) => ({
        ...prev,
        [category]: [...(prev[category] || []), { name: 'New Plan', monthly: 4.99, yearly: 3.99, btnText: 'Add to cart', btnUrl: '/register', features: [], popular: false, badge: '' }]
      }));
    };

    const updateCat = (catIdx: number, field: string, val: any) => {
      setData((prev: any) => {
        const arr = [...(prev.allFeatures || [])];
        arr[catIdx] = { ...arr[catIdx], [field]: val };
        return { ...prev, allFeatures: arr };
      });
    };

    const updateCatItem = (catIdx: number, itemIdx: number, val: string) => {
      setData((prev: any) => {
        const arr = [...(prev.allFeatures || [])];
        const items = [...(arr[catIdx].items || [])];
        items[itemIdx] = val;
        arr[catIdx] = { ...arr[catIdx], items };
        return { ...prev, allFeatures: arr };
      });
    };

    const TABS = [
      { key: 'header', label: 'Section Header' },
      { key: 'shared', label: 'Web Hosting Plans' },
      { key: 'reseller', label: 'Reseller Plans' },
      { key: 'allfeatures', label: 'See All Features Popup' },
    ];

    return (
      <div className="space-y-6">
        <PageHeader title="Pricing Plans" subtitle="Edit homepage pricing plans, features, and section header" icon={<DollarSign size={22} />} />

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2 flex-wrap">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${tab === t.key ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                style={tab === t.key ? { background: 'linear-gradient(135deg, #673de6, #8b5cf6)' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(103,61,230,0.15)' }}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {pricingSaved && <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full">Saved!</span>}
            <button onClick={save} disabled={pricingSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #673de6, #8b5cf6)' }}>
              {pricingSaving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              Save All
            </button>
          </div>
        </div>

        {/* Section Header */}
        {tab === 'header' && (
          <div className="rounded-2xl p-6 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(103,61,230,0.15)' }}>
            <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'rgba(103,61,230,0.8)' }}>Section Header</p>
            <Field label="Section Title">
              <Input value={data.header?.title || ''} onChange={(e: any) => setData((p: any) => ({ ...p, header: { ...p.header, title: e.target.value } }))} placeholder="Choose your Web Hosting plan" />
            </Field>
            <Field label="Section Subtitle">
              <Textarea value={data.header?.subtitle || ''} onChange={(e: any) => setData((p: any) => ({ ...p, header: { ...p.header, subtitle: e.target.value } }))} rows={2} placeholder="Get the best value..." />
            </Field>
            <div className="pt-2 border-t" style={{ borderColor: 'rgba(103,61,230,0.15)' }}>
              <Toggle
                checked={data.showReseller === true}
                onChange={(v: boolean) => setData((p: any) => ({ ...p, showReseller: v }))}
                label="Show Reseller Hosting tab on homepage"
              />
              <p className="text-xs text-slate-500 mt-1 ml-1">When disabled, only Web Hosting plans are shown. Enable to display the Reseller Hosting tab.</p>
            </div>
          </div>
        )}

        {/* Plans (shared or reseller) */}
        {(tab === 'shared' || tab === 'reseller') && (
          <div className="space-y-3">
            {(data[tab] || []).map((plan: any, idx: number) => (
              <div key={idx} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: plan.popular ? '1px solid rgba(103,61,230,0.5)' : '1px solid rgba(103,61,230,0.15)' }}>
                <div className="px-5 py-3 flex items-center justify-between border-b cursor-pointer hover:bg-white/5 transition-colors"
                  style={{ borderColor: 'rgba(103,61,230,0.1)', background: plan.popular ? 'rgba(103,61,230,0.1)' : 'rgba(103,61,230,0.03)' }}
                  onClick={() => setOpenPlan(openPlan === idx ? null : idx)}>
                  <span className="font-bold text-white text-sm">{plan.name || 'Unnamed Plan'}</span>
                  <div className="flex items-center gap-3">
                    {plan.popular && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-widest">Popular</span>}
                    <button onClick={e => { e.stopPropagation(); deletePlan(tab, idx); }} className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={14} /></button>
                    {openPlan === idx ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </div>
                </div>
                {openPlan === idx && (
                  <div className="p-5 space-y-4 border-t" style={{ borderColor: 'rgba(103,61,230,0.1)' }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Plan Name"><Input value={plan.name} onChange={(e: any) => updatePlan(tab, idx, 'name', e.target.value)} /></Field>
                      <Field label="Badge (e.g. + 3 Months Free)"><Input value={plan.badge || ''} onChange={(e: any) => updatePlan(tab, idx, 'badge', e.target.value)} /></Field>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Monthly Price (USD)">
                        <input type="number" step="0.01" min="0" value={plan.monthly ?? plan.price ?? 0}
                          onChange={(e) => updatePlan(tab, idx, 'monthly', parseFloat(e.target.value) || 0)}
                          className="w-full px-4 py-2.5 rounded-xl text-sm text-white font-medium outline-none"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(103,61,230,0.2)', color: '#e2e8f0' }} />
                      </Field>
                      <Field label="Annual Price (USD/mo equivalent)">
                        <input type="number" step="0.01" min="0" value={plan.yearly ?? plan.price ?? 0}
                          onChange={(e) => updatePlan(tab, idx, 'yearly', parseFloat(e.target.value) || 0)}
                          className="w-full px-4 py-2.5 rounded-xl text-sm text-white font-medium outline-none"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(103,61,230,0.2)', color: '#e2e8f0' }} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Button Text"><Input value={plan.btnText || 'Add to cart'} onChange={(e: any) => updatePlan(tab, idx, 'btnText', e.target.value)} /></Field>
                      <Field label="Button Link"><Input value={plan.btnUrl || '/register'} onChange={(e: any) => updatePlan(tab, idx, 'btnUrl', e.target.value)} /></Field>
                    </div>
                    <Field label="Features (one per line)">
                      <Textarea
                        value={(plan.features || []).join('\n')}
                        onChange={(e: any) => updatePlan(tab, idx, 'features', e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean))}
                        rows={5}
                        placeholder={"1 Website\n50GB SSD\nFree SSL"}
                      />
                    </Field>
                    <Toggle checked={plan.popular} onChange={(v: boolean) => updatePlan(tab, idx, 'popular', v)} label="Mark as Popular Plan" />
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => addPlan(tab)}
              className="w-full py-4 rounded-xl text-sm font-bold text-purple-400 hover:text-purple-300 transition-all flex items-center justify-center gap-2"
              style={{ border: '2px dashed rgba(103,61,230,0.25)', background: 'rgba(103,61,230,0.03)' }}>
              <Plus size={16} /> Add Plan
            </button>
          </div>
        )}

        {/* All Features popup */}
        {tab === 'allfeatures' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400 font-medium px-1">These categories appear in the "See all features" popup on every plan card.</p>
            {(data.allFeatures || []).map((cat: any, catIdx: number) => (
              <div key={catIdx} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(103,61,230,0.15)' }}>
                <div className="px-5 py-3 flex items-center justify-between border-b cursor-pointer hover:bg-white/5 transition-colors"
                  style={{ borderColor: 'rgba(103,61,230,0.1)' }}
                  onClick={() => setOpenCat(openCat === catIdx ? null : catIdx)}>
                  <span className="font-bold text-white text-sm">{cat.category || `Category ${catIdx + 1}`}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={e => { e.stopPropagation(); setData((p: any) => ({ ...p, allFeatures: p.allFeatures.filter((_: any, k: number) => k !== catIdx) })); }}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={14} /></button>
                    {openCat === catIdx ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </div>
                </div>
                {openCat === catIdx && (
                  <div className="p-5 space-y-3 border-t" style={{ borderColor: 'rgba(103,61,230,0.1)' }}>
                    <Field label="Category Name">
                      <Input value={cat.category} onChange={(e: any) => updateCat(catIdx, 'category', e.target.value)} placeholder="e.g. Performance" />
                    </Field>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">Features in this category</p>
                    {(cat.items || []).map((item: string, itemIdx: number) => (
                      <div key={itemIdx} className="flex gap-2">
                        <Input value={item} onChange={(e: any) => updateCatItem(catIdx, itemIdx, e.target.value)} placeholder="Feature name" />
                        <button onClick={() => {
                          const items = cat.items.filter((_: any, k: number) => k !== itemIdx);
                          updateCat(catIdx, 'items', items);
                        }} className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    <button onClick={() => updateCat(catIdx, 'items', [...(cat.items || []), 'New Feature'])}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-white transition-all hover:opacity-80"
                      style={{ background: 'rgba(103,61,230,0.25)', border: '1px solid rgba(103,61,230,0.3)' }}>
                      <Plus size={13} /> Add Feature
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setData((p: any) => ({ ...p, allFeatures: [...(p.allFeatures || []), { category: 'New Category', items: [] }] }))}
              className="w-full py-4 rounded-xl text-sm font-bold text-purple-400 hover:text-purple-300 transition-all flex items-center justify-center gap-2"
              style={{ border: '2px dashed rgba(103,61,230,0.25)', background: 'rgba(103,61,230,0.03)' }}>
              <Plus size={16} /> Add Category
            </button>
          </div>
        )}
      </div>
    );
  };

  const NavigationManager = () => {
    const [data, setData] = useState(content?.navbar || { logo: 'NEOHOST', links: [] });
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (content?.navbar) setData(content.navbar); }, [content]);
    const save = async () => { setSaving(true); try { await updateContent('navbar', data); } catch { alert('Failed'); } finally { setSaving(false); } };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => setData({ ...data, logoImage: reader.result as string });
        reader.readAsDataURL(file);
      }
    };

    return (
      <div className="space-y-6">
        <PageHeader title="Navigation & Logo" subtitle="Edit the top navbar, logo and menu links" icon={<Globe size={22} />} />
        <PageCard title="Branding" onSave={save} saving={saving}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Field label="Logo Text (Fallback)"><Input value={data.logo} onChange={(e: any) => setData({ ...data, logo: e.target.value })} placeholder="NEOHOST" /></Field>
              <Field label="Logo Image URL"><Input value={data.logoUrl} onChange={(e: any) => setData({ ...data, logoUrl: e.target.value })} placeholder="https://..." /></Field>
              <Field label="Upload Logo">
                <input type="file" accept="image/*" onChange={handleLogoUpload}
                  className="text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:text-purple-300 cursor-pointer"
                  style={{ background: 'rgba(103,61,230,0.1)' }} />
              </Field>
            </div>
            <div className="rounded-xl flex items-center justify-center p-8" style={{ background: '#050505', border: '1px solid rgba(103,61,230,0.2)' }}>
              {data.logoImage || data.logoUrl ? (
                <img src={data.logoImage || data.logoUrl} alt="Logo Preview" className="max-h-14 object-contain" />
              ) : (
                <span className="text-2xl font-black text-white tracking-tighter">{data.logo || 'NEOHOST'}</span>
              )}
            </div>
          </div>
          <Section title="Navigation Links">
            <ListEditor
              items={data.links || []}
              onChange={(v) => setData({ ...data, links: v })}
              newItem={{ name: '', href: '' }}
              renderItem={(item, idx, update, remove) => (
                <div className="grid grid-cols-2 gap-3 pr-8">
                  <DeleteBtn onClick={remove} />
                  <Input value={item.name} onChange={(e: any) => update({ name: e.target.value })} placeholder="Link Name" />
                  <Input value={item.href} onChange={(e: any) => update({ href: e.target.value })} placeholder="URL e.g. /about-us" />
                </div>
              )}
            />
          </Section>
        </PageCard>
      </div>
    );
  };

  const TopBarManager = () => {
    const [data, setData] = useState(content?.config?.topbar || { show: true, email: 'support@noehost.com', phone: '+1 (800) NEO-HOST', announcement: 'Flash Sale: 50% Off all Shared Plans! Use code: NEO50', announcements: [] });
    const [saving, setSaving] = useState(false);
    useEffect(() => {
      if (content?.config?.topbar) setData(content.config.topbar);
    }, [content]);

    const save = async () => {
      setSaving(true);
      try {
        await updateContent('config', { ...content?.config, topbar: data });
      } catch { alert('Failed'); } finally { setSaving(false); }
    };

    return (
      <div className="space-y-6">
        <PageHeader title="Top Bar" subtitle="Edit the announcement bar at the very top of the site" icon={<Bell size={22} />} />
        <PageCard title="Top Bar Settings" onSave={save} saving={saving}>
          <Toggle checked={data.show} onChange={(v: boolean) => setData({ ...data, show: v })} label="Show Top Bar" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Support Email"><Input value={data.email} onChange={(e: any) => setData({ ...data, email: e.target.value })} placeholder="support@noehost.com" /></Field>
            <Field label="Support Phone"><Input value={data.phone} onChange={(e: any) => setData({ ...data, phone: e.target.value })} placeholder="+1 (800) NEO-HOST" /></Field>
          </div>
          <Field label="Announcement / Flash Sale Text">
            <Input value={data.announcement} onChange={(e: any) => setData({ ...data, announcement: e.target.value })} placeholder="Flash Sale: 50% Off all Shared Plans! Use code: NEO50" />
          </Field>

          <Section title="Additional Announcements (Rotating, Optional)">
            <div className="space-y-2">
              {(data.announcements || []).map((a: string, i: number) => (
                <div key={i} className="flex gap-2">
                  <input value={a} onChange={(e) => { const n = [...(data.announcements || [])]; n[i] = e.target.value; setData({ ...data, announcements: n }); }}
                    className={inputCls + " flex-1"} style={inputStyle} placeholder="Announcement text" />
                  <button onClick={() => setData({ ...data, announcements: (data.announcements || []).filter((_: any, k: number) => k !== i) })}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-500/10"><Trash2 size={14} /></button>
                </div>
              ))}
              <button onClick={() => setData({ ...data, announcements: [...(data.announcements || []), ''] })}
                className="flex items-center gap-2 text-sm font-bold text-purple-400 hover:text-purple-300 mt-2">
                <Plus size={14} /> Add Announcement
              </button>
            </div>
          </Section>
        </PageCard>
      </div>
    );
  };

  const FooterManager = () => {
    const [data, setData] = useState(content?.footer || { about: '', contact: {}, social: {} });
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (content?.footer) setData(content.footer); }, [content]);
    const save = async () => { setSaving(true); try { await updateContent('footer', data); } catch { alert('Failed'); } finally { setSaving(false); } };

    return (
      <div className="space-y-6">
        <PageHeader title="Footer" subtitle="Edit footer content, contact info, and social links" icon={<Shield size={22} />} />
        <PageCard title="Footer Content" onSave={save} saving={saving}>
          <Field label="About / Tagline Text">
            <Textarea value={data.about} onChange={(e: any) => setData({ ...data, about: e.target.value })} rows={3} />
          </Field>
          <Section title="Contact Information">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Email"><Input value={data.contact?.email} onChange={(e: any) => setData({ ...data, contact: { ...data.contact, email: e.target.value } })} placeholder="support@noehost.com" /></Field>
              <Field label="Phone"><Input value={data.contact?.phone} onChange={(e: any) => setData({ ...data, contact: { ...data.contact, phone: e.target.value } })} placeholder="+1 (800) NEO-HOST" /></Field>
              <Field label="Address"><Input value={data.contact?.address} onChange={(e: any) => setData({ ...data, contact: { ...data.contact, address: e.target.value } })} placeholder="123 Main St, City" /></Field>
            </div>
          </Section>
          <Section title="Social Links">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Twitter / X"><Input value={data.social?.twitter} onChange={(e: any) => setData({ ...data, social: { ...data.social, twitter: e.target.value } })} placeholder="https://twitter.com/..." /></Field>
              <Field label="GitHub"><Input value={data.social?.github} onChange={(e: any) => setData({ ...data, social: { ...data.social, github: e.target.value } })} placeholder="https://github.com/..." /></Field>
              <Field label="LinkedIn"><Input value={data.social?.linkedin} onChange={(e: any) => setData({ ...data, social: { ...data.social, linkedin: e.target.value } })} placeholder="https://linkedin.com/..." /></Field>
            </div>
          </Section>
        </PageCard>
      </div>
    );
  };

  const ControlEfficiencyManager = () => {
    const [data, setData] = useState(content?.controlEfficiency || {});
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (content?.controlEfficiency) setData(content.controlEfficiency); }, [content]);
    const save = async () => { setSaving(true); try { await updateContent('controlEfficiency', data); } catch { alert('Failed'); } finally { setSaving(false); } };

    return (
      <div className="space-y-6">
        <PageHeader title="Control & Efficiency" subtitle="Edit the dashboard showcase section" icon={<Layers size={22} />} />
        <PageCard title="Section Content" onSave={save} saving={saving}>
          <Field label="Section Title"><Input value={data.title} onChange={(e: any) => setData({ ...data, title: e.target.value })} /></Field>
          <Section title="Main Card">
            <Field label="Card Title"><Input value={data.mainCard?.title} onChange={(e: any) => setData({ ...data, mainCard: { ...data.mainCard, title: e.target.value } })} /></Field>
            <Field label="Card Description"><Textarea value={data.mainCard?.description} onChange={(e: any) => setData({ ...data, mainCard: { ...data.mainCard, description: e.target.value } })} rows={2} /></Field>
            <Field label="Card Image URL"><Input value={data.mainCard?.image} onChange={(e: any) => setData({ ...data, mainCard: { ...data.mainCard, image: e.target.value } })} /></Field>
            <Field label="Features (comma separated)">
              <Input value={(data.mainCard?.features || []).join(', ')} onChange={(e: any) => setData({ ...data, mainCard: { ...data.mainCard, features: e.target.value.split(',').map((s: string) => s.trim()) } })} />
            </Field>
          </Section>
          <Section title="Feature Grid Items">
            <ListEditor
              items={data.items || []}
              onChange={(v) => setData({ ...data, items: v })}
              newItem={{ title: '', description: '', icon: 'Zap', img: '', color: 'bg-slate-100 text-slate-900' }}
              renderItem={(item, idx, update, remove) => (
                <div className="space-y-3 pr-8">
                  <DeleteBtn onClick={remove} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={item.title} onChange={(e: any) => update({ title: e.target.value })} placeholder="Title" />
                    <Input value={item.icon} onChange={(e: any) => update({ icon: e.target.value })} placeholder="Lucide icon name" />
                  </div>
                  <Textarea value={item.description} onChange={(e: any) => update({ description: e.target.value })} placeholder="Description" rows={2} />
                </div>
              )}
            />
          </Section>
        </PageCard>
      </div>
    );
  };

  const FeatureShowcaseManager = () => {
    const [data, setData] = useState(content?.featureShowcase || {});
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (content?.featureShowcase) setData(content.featureShowcase); }, [content]);
    const save = async () => { setSaving(true); try { await updateContent('featureShowcase', data); } catch { alert('Failed'); } finally { setSaving(false); } };

    const RowEditor = ({ rowKey, label }: { rowKey: 'row1' | 'row2', label: string }) => (
      <Section title={label}>
        <Field label="Row Title"><Input value={data[rowKey]?.title} onChange={(e: any) => setData({ ...data, [rowKey]: { ...data[rowKey], title: e.target.value } })} /></Field>
        <Field label="Description"><Textarea value={data[rowKey]?.description} onChange={(e: any) => setData({ ...data, [rowKey]: { ...data[rowKey], description: e.target.value } })} rows={2} /></Field>
        <Field label="Image URL"><Input value={data[rowKey]?.image} onChange={(e: any) => setData({ ...data, [rowKey]: { ...data[rowKey], image: e.target.value } })} /></Field>
        <div className="space-y-3">
          {(data[rowKey]?.features || []).map((f: any, fIdx: number) => (
            <div key={fIdx} className="relative rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(103,61,230,0.08)' }}>
              <DeleteBtn onClick={() => { const n = [...data[rowKey].features]; n.splice(fIdx, 1); setData({ ...data, [rowKey]: { ...data[rowKey], features: n } }); }} />
              <div className="grid grid-cols-2 gap-2 pr-6">
                <Input value={f.title} onChange={(e: any) => { const n = [...data[rowKey].features]; n[fIdx] = { ...n[fIdx], title: e.target.value }; setData({ ...data, [rowKey]: { ...data[rowKey], features: n } }); }} placeholder="Feature Title" />
                <Input value={f.icon} onChange={(e: any) => { const n = [...data[rowKey].features]; n[fIdx] = { ...n[fIdx], icon: e.target.value }; setData({ ...data, [rowKey]: { ...data[rowKey], features: n } }); }} placeholder="Icon name" />
              </div>
              <Textarea value={f.description} onChange={(e: any) => { const n = [...data[rowKey].features]; n[fIdx] = { ...n[fIdx], description: e.target.value }; setData({ ...data, [rowKey]: { ...data[rowKey], features: n } }); }} placeholder="Description" rows={2} />
            </div>
          ))}
          <button onClick={() => { const n = [...(data[rowKey]?.features || []), { title: '', description: '', icon: 'Zap' }]; setData({ ...data, [rowKey]: { ...data[rowKey], features: n } }); }}
            className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 mt-2">
            <Plus size={12} /> Add Feature
          </button>
        </div>
      </Section>
    );

    return (
      <div className="space-y-6">
        <PageHeader title="Feature Showcase" subtitle="Edit the two-row feature detail section" icon={<Layout size={22} />} />
        <PageCard title="Feature Showcase Content" onSave={save} saving={saving}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Section Badge"><Input value={data.badge} onChange={(e: any) => setData({ ...data, badge: e.target.value })} /></Field>
            <Field label="Section Title"><Input value={data.title} onChange={(e: any) => setData({ ...data, title: e.target.value })} /></Field>
          </div>
          <Field label="Section Description"><Textarea value={data.description} onChange={(e: any) => setData({ ...data, description: e.target.value })} rows={2} /></Field>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RowEditor rowKey="row1" label="Row 1 — Hosting & Growth" />
            <RowEditor rowKey="row2" label="Row 2 — Performance" />
          </div>
        </PageCard>
      </div>
    );
  };

  // ─── SIMPLE PAGE EDITORS ─────────────────────────────────────────────────────
  const SimplePageEditor = ({ pageKey, title, subtitle, icon }: { pageKey: string, title: string, subtitle: string, icon: React.ReactNode }) => {
    const [data, setData] = useState((content?.pages || {})[pageKey] || { heroTitle: '', heroSubtitle: '', heroDescription: '', sections: [] });
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (content?.pages?.[pageKey]) setData(content.pages[pageKey]); }, [content, pageKey]);
    const save = async () => {
      setSaving(true);
      try { await updateContent('pages', { ...(content?.pages || {}), [pageKey]: data }); } catch { alert('Failed'); } finally { setSaving(false); }
    };

    return (
      <div className="space-y-6">
        <PageHeader title={title} subtitle={subtitle} icon={icon} />
        <PageCard title="Page Hero" onSave={save} saving={saving}>
          <Field label="Page Title"><Input value={data.heroTitle} onChange={(e: any) => setData({ ...data, heroTitle: e.target.value })} placeholder="Page Title" /></Field>
          <Field label="Page Subtitle"><Input value={data.heroSubtitle} onChange={(e: any) => setData({ ...data, heroSubtitle: e.target.value })} placeholder="Short subtitle or tag" /></Field>
          <Field label="Page Description"><Textarea value={data.heroDescription} onChange={(e: any) => setData({ ...data, heroDescription: e.target.value })} rows={3} placeholder="Introductory paragraph" /></Field>
        </PageCard>

        <PageCard title="Page Sections" onSave={save} saving={saving}>
          <ListEditor
            items={data.sections || []}
            onChange={(v) => setData({ ...data, sections: v })}
            newItem={{ heading: '', body: '', visible: true }}
            renderItem={(item, idx, update, remove) => (
              <div className="space-y-3 pr-8">
                <DeleteBtn onClick={remove} />
                <div className="flex items-center gap-3">
                  <Input value={item.heading} onChange={(e: any) => update({ heading: e.target.value })} placeholder="Section heading" />
                  <Toggle checked={item.visible !== false} onChange={(v: boolean) => update({ visible: v })} label="Visible" />
                </div>
                <Textarea value={item.body} onChange={(e: any) => update({ body: e.target.value })} placeholder="Section body text / content" rows={4} />
              </div>
            )}
          />
        </PageCard>
      </div>
    );
  };

  const GlobalConfigManager = () => {
    const [data, setData] = useState(content?.config || {});
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (content?.config) setData(content.config); }, [content]);
    const save = async () => { setSaving(true); try { await updateContent('config', data); } catch { alert('Failed'); } finally { setSaving(false); } };

    return (
      <div className="space-y-6">
        <PageHeader title="Global Config" subtitle="Site-wide settings and meta information" icon={<Settings size={22} />} />
        <PageCard title="Site Identity" onSave={save} saving={saving}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Site Name"><Input value={data.siteName} onChange={(e: any) => setData({ ...data, siteName: e.target.value })} placeholder="Noehost" /></Field>
            <Field label="Tagline"><Input value={data.tagline} onChange={(e: any) => setData({ ...data, tagline: e.target.value })} placeholder="Powering the web..." /></Field>
          </div>
          <Field label="Meta Description"><Textarea value={data.metaDescription} onChange={(e: any) => setData({ ...data, metaDescription: e.target.value })} rows={2} placeholder="SEO description" /></Field>
        </PageCard>
      </div>
    );
  };

  // ─── DASHBOARD OVERVIEW ────────────────────────────────────────────────────
  const DashboardOverview = () => (
    <div className="space-y-8">
      <PageHeader title="CMS Dashboard" subtitle="Welcome back — manage your entire website from here" icon={<LayoutDashboard size={22} />} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sections', value: '13', icon: <Layers size={20} />, color: '#673de6' },
          { label: 'Pages', value: '9', icon: <FileText size={20} />, color: '#00d1ff' },
          { label: 'Pricing Plans', value: (content?.pricing ? (content.pricing.shared?.length || 0) + (content.pricing.reseller?.length || 0) : 0).toString(), icon: <DollarSign size={20} />, color: '#10b981' },
          { label: 'Firebase Sync', value: 'Live', icon: <Zap size={20} />, color: '#f59e0b' },
        ].map((stat, i) => (
          <div key={i} className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(103,61,230,0.15)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${stat.color}20`, color: stat.color }}>
              {stat.icon}
            </div>
            <div className="text-2xl font-black text-white mb-1">{stat.value}</div>
            <div className="text-xs font-semibold text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-6" style={{ background: firebaseConnected ? 'rgba(16,185,129,0.08)' : 'rgba(103,61,230,0.08)', border: firebaseConnected ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(103,61,230,0.25)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-2.5 h-2.5 rounded-full ${firebaseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className={`text-sm font-bold ${firebaseConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
            Firebase Realtime Database — {firebaseConnected ? 'Connected & Live' : 'Not Connected (Using Local Database)'}
          </span>
        </div>
        {firebaseConnected ? (
          <p className="text-slate-400 text-sm">All changes are instantly pushed to Firebase and reflected on your website in real-time — no page reload needed by visitors.</p>
        ) : (
          <div className="text-slate-400 text-sm space-y-2">
            <p>To enable Firebase Realtime Database:</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-500">
              <li>Go to <span className="text-purple-400">console.firebase.google.com</span> → your project</li>
              <li>Click <strong className="text-slate-300">Build → Realtime Database → Create Database</strong></li>
              <li>Choose a location and set rules to allow read/write</li>
              <li>The app will auto-connect and sync all content to Firebase</li>
            </ol>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'rgba(103,61,230,0.7)' }}>Quick Access</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {menuGroups.flatMap(g => g.items).map((item) => (
            <Link key={item.path} to={item.path}
              className="flex items-center gap-3 p-4 rounded-xl text-sm font-semibold text-slate-400 hover:text-white transition-all group"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(103,61,230,0.1)' }}>
              <span className="text-slate-500 group-hover:text-purple-400 transition-colors">{item.icon}</span>
              {item.label}
              <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-purple-400" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64" style={{ background: '#08080a' }}>
      <Sidebar />

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b" style={{ background: '#0e0e11', borderColor: 'rgba(103,61,230,0.2)' }}>
        <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-400 hover:text-white transition-colors">
          <Menu size={22} />
        </button>
        <span className="text-white font-black text-sm tracking-tight">NEOHOST CMS</span>
        <Link to="/" className="p-2 text-slate-400 hover:text-white transition-colors"><Globe size={18} /></Link>
      </header>

      <main className="p-6 lg:p-10 max-w-5xl mx-auto">
        <Routes>
          <Route path="/" element={<DashboardOverview />} />
          <Route path="/hero" element={<HeroManager />} />
          <Route path="/features" element={<FeaturesManager />} />
          <Route path="/services" element={<ServicesManager />} />
          <Route path="/promo" element={<PromoManager />} />
          <Route path="/control-efficiency" element={<ControlEfficiencyManager />} />
          <Route path="/feature-showcase" element={<FeatureShowcaseManager />} />
          <Route path="/cta" element={<CTAManager />} />
          <Route path="/faq" element={<FAQManager />} />
          <Route path="/navigation" element={<NavigationManager />} />
          <Route path="/pricing" element={<PricingManager />} />
          <Route path="/domain-pricing" element={<DomainPricingEditor />} />
          <Route path="/footer" element={<FooterManager />} />
          <Route path="/testimonials" element={<TestimonialsManager />} />
          <Route path="/topbar" element={<TopBarManager />} />
          <Route path="/config" element={<GlobalConfigManager />} />
          <Route path="/page-shared-hosting" element={<SharedHostingEditor />} />
          <Route path="/page-vps-hosting" element={<VPSHostingEditor />} />
          <Route path="/page-wordpress-hosting" element={<WordPressHostingEditor />} />
          <Route path="/page-reseller-hosting" element={<ResellerHostingEditor />} />
          <Route path="/page-about" element={<AboutEditor />} />
          <Route path="/page-contact" element={<ContactEditor />} />
          <Route path="/page-privacy" element={<LegalPageEditor pageKey="privacy" title="Privacy Policy" subtitle="Edit Privacy Policy page content and sections" />} />
          <Route path="/page-terms" element={<LegalPageEditor pageKey="terms" title="Terms & Conditions" subtitle="Edit Terms & Conditions page content and sections" />} />
          <Route path="/page-refund" element={<LegalPageEditor pageKey="refund" title="Refund Policy" subtitle="Edit Refund Policy page content and sections" />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminDashboard;
