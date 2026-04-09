import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Menu, X, Server, User, LogOut, LayoutDashboard, Shield, ChevronDown, 
  Zap, Globe, Activity, Briefcase, Search, RefreshCw, Info, Home, 
  Cpu, Users, Layout, CreditCard, ShieldCheck, Mail, Settings, 
  Database, HardDrive, Terminal, Code, Headphones, HelpCircle, 
  FileText, ShieldAlert, Lock, Cloud, Box, Layers, Monitor, Smartphone, 
  Tablet, Watch, Camera, Video, Music, Image, Mic, Speaker, 
  Headset, Mouse, Keyboard, Printer, Wifi, Bluetooth, Cast, 
  Share2, Download, Upload, CloudDownload, CloudUpload, 
  Save, Trash2, Edit, Plus, Minus, Check, AlertTriangle, 
  CheckCircle2, XCircle, Clock, Calendar, MapPin, Phone, 
  Mail as MailIcon, ExternalLink, Github, Twitter, Linkedin, 
  Facebook, Instagram, Youtube, Slack, Twitch, 
  Figma, Chrome, Github as GithubIcon, MessageCircle
} from 'lucide-react';
import { useContent } from '@/context/ContentContext';

interface NavbarProps {
  user?: any;
  setUser?: (user: any) => void;
}

const IconMap: any = {
  Home: <Home size={18} />,
  Server: <Server size={18} />,
  Cpu: <Cpu size={18} />,
  Users: <Users size={18} />,
  Layout: <Layout size={18} />,
  CreditCard: <CreditCard size={18} />,
  Zap: <Zap size={18} />,
  Shield: <Shield size={18} />,
  Globe: <Globe size={18} />,
  Activity: <Activity size={18} />,
  Briefcase: <Briefcase size={18} />,
  Search: <Search size={18} />,
  RefreshCw: <RefreshCw size={18} />,
  Info: <Info size={18} />,
  ShieldCheck: <ShieldCheck size={18} />,
  Mail: <Mail size={18} />,
  Settings: <Settings size={18} />,
  Database: <Database size={18} />,
  HardDrive: <HardDrive size={18} />,
  Terminal: <Terminal size={18} />,
  Code: <Code size={18} />,
  Headphones: <Headphones size={18} />,
  HelpCircle: <HelpCircle size={18} />,
  FileText: <FileText size={18} />,
  ShieldAlert: <ShieldAlert size={18} />,
  Lock: <Lock size={18} />,
  Cloud: <Cloud size={18} />,
  Box: <Box size={18} />,
  Layers: <Layers size={18} />,
  Monitor: <Monitor size={18} />,
  Smartphone: <Smartphone size={18} />,
  Tablet: <Tablet size={18} />,
  Watch: <Watch size={18} />,
  Camera: <Camera size={18} />,
  Video: <Video size={18} />,
  Music: <Music size={18} />,
  Image: <Image size={18} />,
  Mic: <Mic size={18} />,
  Speaker: <Speaker size={18} />,
  Headset: <Headset size={18} />,
  Mouse: <Mouse size={18} />,
  Keyboard: <Keyboard size={18} />,
  Printer: <Printer size={18} />,
  Wifi: <Wifi size={18} />,
  Bluetooth: <Bluetooth size={18} />,
  Cast: <Cast size={18} />,
  Share2: <Share2 size={18} />,
  Download: <Download size={18} />,
  Upload: <Upload size={18} />,
  CloudDownload: <CloudDownload size={18} />,
  CloudUpload: <CloudUpload size={18} />,
  Save: <Save size={18} />,
  Trash2: <Trash2 size={18} />,
  Edit: <Edit size={18} />,
  Plus: <Plus size={18} />,
  Minus: <Minus size={18} />,
  Check: <Check size={18} />,
  AlertTriangle: <AlertTriangle size={18} />,
  CheckCircle2: <CheckCircle2 size={18} />,
  XCircle: <XCircle size={18} />,
  Clock: <Clock size={18} />,
  Calendar: <Calendar size={18} />,
  MapPin: <MapPin size={18} />,
  Phone: <Phone size={18} />,
  MailIcon: <MailIcon size={18} />,
  ExternalLink: <ExternalLink size={18} />,
  Github: <Github size={18} />,
  Twitter: <Twitter size={18} />,
  Linkedin: <Linkedin size={18} />,
  Facebook: <Facebook size={18} />,
  Instagram: <Instagram size={18} />,
  Youtube: <Youtube size={18} />,
  Slack: <Slack size={18} />,
  Discord: <MessageCircle size={18} />,
  Twitch: <Twitch size={18} />,
  Figma: <Figma size={18} />,
  Chrome: <Chrome size={18} />,
};

const HOSTING_NAMES = ['shared', 'vps', 'reseller', 'wordpress'];

const HOSTING_META: Record<string, { desc: string; badge?: string; badgeColor?: string }> = {
  shared:    { desc: 'Secure, speedy, reliable services', badge: 'POPULAR', badgeColor: 'bg-primary/10 text-primary' },
  vps:       { desc: 'Full root access with dedicated resources', badge: 'POPULAR', badgeColor: 'bg-primary/10 text-primary' },
  reseller:  { desc: 'White-label hosting for your business' },
  wordpress: { desc: 'Optimized for the world\'s most popular CMS' },
};

const Navbar: React.FC<NavbarProps> = ({ user, setUser }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hostingOpen, setHostingOpen] = useState(false);
  const [mobileHostingOpen, setMobileHostingOpen] = useState(false);
  const hostingRef = useRef<HTMLDivElement>(null);
  const { content } = useContent();
  const [location, navigate] = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (hostingRef.current && !hostingRef.current.contains(e.target as Node)) {
        setHostingOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    if (setUser) setUser(null);
    navigate('/');
  };

  const navData = content?.navbar || {
    logo: 'NOEHOST',
    logoUrl: '',
    logoImage: '',
    links: [
      { name: 'Home', href: '/', icon: 'Home', color: 'text-primary' },
      { name: 'Shared', href: '/shared-hosting', icon: 'Server', color: 'text-blue-500' },
      { name: 'VPS', href: '/vps-hosting', icon: 'Cpu', color: 'text-purple-500' },
      { name: 'Reseller', href: '/reseller-hosting', icon: 'Users', color: 'text-rose-500' },
      { name: 'WordPress', href: '/wordpress-hosting', icon: 'Layout', color: 'text-emerald-500' },
      { name: 'Domains', href: '/domains', icon: 'Globe', color: 'text-cyan-500' },
      { name: 'About', href: '/about', icon: 'Info', color: 'text-sky-500' },
      { name: 'Contact', href: '/contact', icon: 'Mail', color: 'text-teal-500' },
    ]
  };

  const hostingLinks = navData.links.filter((l: any) =>
    HOSTING_NAMES.includes(l.name.toLowerCase())
  );
  const otherLinks = navData.links.filter((l: any) =>
    !HOSTING_NAMES.includes(l.name.toLowerCase()) &&
    l.name.toLowerCase() !== 'pricing'
  );

  const Logo = () => {
    if (navData.logoImage) {
      return <img src={navData.logoImage} alt={navData.logo} className="h-8 w-auto object-contain" />;
    }
    if (navData.logoUrl) {
      return <img src={navData.logoUrl} alt={navData.logo} className="h-8 w-auto object-contain" referrerPolicy="no-referrer" />;
    }
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/20">
          <Server size={20} />
        </div>
        <span className="text-xl font-black tracking-tighter text-white">{navData.logo}</span>
      </div>
    );
  };

  return (
    <nav
      className={`transition-all duration-300 w-full z-[100] ${
        isScrolled
          ? 'bg-[#080811]/95 backdrop-blur-xl py-3 shadow-2xl shadow-black/60 border-b border-white/5'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-12">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center gap-6">
            {/* Home link first */}
            {otherLinks.filter((l: any) => l.name.toLowerCase() === 'home').map((link: any, idx: number) => (
              <Link
                key={idx}
                to={link.href}
                className="flex items-center gap-2 font-black text-xs transition-all py-2 uppercase tracking-widest group text-slate-300 hover:text-white"
              >
                <span className={`${link.color || 'text-primary'} group-hover:scale-110 transition-transform`}>
                  {IconMap[link.icon] || <Zap size={18} />}
                </span>
                {link.name}
              </Link>
            ))}

            {/* Hosting Dropdown (after Home) */}
            {hostingLinks.length > 0 && (
              <div ref={hostingRef} className="relative">
                <button
                  onClick={() => setHostingOpen(o => !o)}
                  className="flex items-center gap-2 font-black text-xs transition-all py-2 uppercase tracking-widest group text-slate-300 hover:text-white"
                >
                  <span className="text-primary group-hover:scale-110 transition-transform">
                    <Server size={18} />
                  </span>
                  Hosting
                  <ChevronDown size={14} className={`transition-transform duration-200 ${hostingOpen ? 'rotate-180' : ''}`} />
                </button>

                {hostingOpen && (
                  <div className="absolute top-full left-0 mt-3 bg-[#0d0d1f] rounded-2xl shadow-2xl border border-white/10 z-50 overflow-hidden"
                    style={{ minWidth: '340px' }}
                  >
                    {/* Header */}
                    <div className="px-5 pt-5 pb-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">Hosting</span>
                    </div>

                    {/* Items */}
                    <div className="px-2 pb-3">
                      {hostingLinks.map((link: any, idx: number) => {
                        const meta = HOSTING_META[link.name.toLowerCase()] || {};
                        return (
                          <Link
                            key={idx}
                            to={link.href}
                            onClick={() => setHostingOpen(false)}
                            className="flex items-start gap-4 px-3 py-3.5 rounded-xl hover:bg-white/5 transition-all group"
                          >
                            {/* Icon box */}
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/5 group-hover:bg-primary/20 transition-all ${link.color || 'text-primary'}`}>
                              {IconMap[link.icon] || <Server size={18} />}
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-bold text-white group-hover:text-primary-300 transition-colors">
                                  {link.name === 'Shared' ? 'Shared Hosting' :
                                   link.name === 'VPS' ? 'VPS Hosting' :
                                   link.name === 'Reseller' ? 'Reseller Hosting' :
                                   link.name === 'WordPress' ? 'WordPress Hosting' : link.name}
                                </span>
                                {meta.badge && (
                                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.badgeColor || 'bg-white/10 text-slate-400'}`}>
                                    {meta.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 font-medium leading-snug">{meta.desc}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>

                    {/* Footer CTA */}
                    <div className="border-t border-white/10 px-5 py-3.5 bg-white/5 flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Not sure which plan?</span>
                      <Link
                        to="/#pricing"
                        onClick={() => setHostingOpen(false)}
                        className="text-xs font-black text-primary-300 hover:text-primary transition-colors"
                      >
                        Compare all plans →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Remaining links: Domains, About, Contact */}
            {otherLinks.filter((l: any) => l.name.toLowerCase() !== 'home').map((link: any, idx: number) => (
              <Link
                key={idx}
                to={link.href}
                className="flex items-center gap-2 font-black text-xs transition-all py-2 uppercase tracking-widest group text-slate-300 hover:text-white"
              >
                <span className={`${link.color || 'text-primary'} group-hover:scale-110 transition-transform`}>
                  {IconMap[link.icon] || <Zap size={18} />}
                </span>
                {link.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-6">
          {user ? (
            <div className="flex items-center gap-4">
              <Link
                to={user.role === 'admin' ? '/admin' : '/dashboard'}
                className="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary-600 text-white rounded-xl font-black text-sm transition-all shadow-xl shadow-primary/20"
              >
                {user.role === 'admin' ? <Shield size={18} /> : <LayoutDashboard size={18} />}
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className={`p-3 rounded-xl transition-all border ${
                  'bg-white/5 border-white/5 text-slate-400 hover:text-red-500'
                }`}
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <>
              <Link
                to="/client/login"
                className="font-black text-sm transition-colors uppercase tracking-widest text-slate-300 hover:text-white"
              >
                Log In
              </Link>
              <Link
                to="/client/register"
                className="px-10 py-3.5 bg-primary hover:bg-primary/80 text-white rounded-xl font-black text-sm transition-all shadow-xl shadow-primary/30 uppercase tracking-widest"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-xl transition-all text-white bg-white/10 hover:bg-white/20"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-[#080811] border-t border-white/5 shadow-2xl shadow-black/50 p-8 flex flex-col gap-6 animate-in slide-in-from-top-4 duration-500 max-h-[85vh] overflow-y-auto z-[100]">
          {/* Home link first */}
          {otherLinks.filter((l: any) => l.name.toLowerCase() === 'home').map((link: any, idx: number) => (
            <Link
              key={idx}
              to={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-4 group"
            >
              <div className={`p-3 rounded-xl bg-white/5 ${link.color || 'text-primary'} group-hover:bg-primary group-hover:text-white transition-all`}>
                {IconMap[link.icon] || <Zap size={18} />}
              </div>
              <span className="text-sm font-black text-slate-300 group-hover:text-white transition-colors uppercase tracking-widest">{link.name}</span>
            </Link>
          ))}

          {/* Mobile Hosting Group */}
          {hostingLinks.length > 0 && (
            <div>
              <button
                onClick={() => setMobileHostingOpen(o => !o)}
                className="flex items-center gap-4 group w-full"
              >
                <div className="p-3 rounded-xl bg-white/5 text-primary group-hover:bg-primary group-hover:text-white transition-all">
                  <Server size={18} />
                </div>
                <span className="text-sm font-black text-slate-300 group-hover:text-white transition-colors uppercase tracking-widest flex-1 text-left">Hosting</span>
                <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${mobileHostingOpen ? 'rotate-180' : ''}`} />
              </button>
              {mobileHostingOpen && (
                <div className="mt-3 flex flex-col gap-1">
                  {hostingLinks.map((link: any, idx: number) => {
                    const meta = HOSTING_META[link.name.toLowerCase()] || {};
                    return (
                      <Link
                        key={idx}
                        to={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all group"
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/5 group-hover:bg-primary/20 transition-all ${link.color || 'text-primary'}`}>
                          {IconMap[link.icon] || <Zap size={16} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                              {link.name === 'Shared' ? 'Shared Hosting' :
                               link.name === 'VPS' ? 'VPS Hosting' :
                               link.name === 'Reseller' ? 'Reseller Hosting' :
                               link.name === 'WordPress' ? 'WordPress Hosting' : link.name}
                            </span>
                            {meta.badge && (
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.badgeColor || 'bg-white/10 text-slate-400'}`}>
                                {meta.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-medium">{meta.desc}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Remaining mobile links: Domains, About, Contact */}
          {otherLinks.filter((l: any) => l.name.toLowerCase() !== 'home').map((link: any, idx: number) => (
            <Link
              key={idx}
              to={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-4 group"
            >
              <div className={`p-3 rounded-xl bg-white/5 ${link.color || 'text-primary'} group-hover:bg-primary group-hover:text-white transition-all`}>
                {IconMap[link.icon] || <Zap size={18} />}
              </div>
              <span className="text-sm font-black text-slate-300 group-hover:text-white transition-colors uppercase tracking-widest">{link.name}</span>
            </Link>
          ))}

          <hr className="border-white/5" />
          {user ? (
            <div className="flex flex-col gap-4">
              <Link
                to={user.role === 'admin' ? '/admin' : '/dashboard'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-3 py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20"
              >
                <LayoutDashboard size={20} /> Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-3 py-5 bg-white/5 text-red-400 rounded-2xl font-black border border-white/10"
              >
                <LogOut size={20} /> Logout
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Link
                to="/client/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-black text-white text-center py-5 border border-white/10 rounded-2xl uppercase tracking-widest hover:bg-white/5 transition-all"
              >
                Log In
              </Link>
              <Link
                to="/client/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-5 bg-primary text-white rounded-2xl font-black text-center shadow-2xl shadow-primary/30 uppercase tracking-widest"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
