import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  Menu, X, Server, LogOut, LayoutDashboard, Shield, ChevronDown,
  Zap, Globe, Cpu, Users, Layout, Info, Mail, ShoppingCart,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/context/CartContext";

const HOSTING_META: Record<string, { desc: string; badge?: string; badgeColor?: string }> = {
  shared:    { desc: "Secure, speedy, reliable services", badge: "POPULAR", badgeColor: "bg-primary/10 text-primary" },
  vps:       { desc: "Full root access with dedicated resources", badge: "POWER", badgeColor: "bg-primary/10 text-primary" },
  reseller:  { desc: "White-label hosting for your business" },
  wordpress: { desc: "Optimized for the world's most popular CMS" },
};

const NAV_HOSTING = [
  { name: "Shared",    href: "/order",  icon: <Server size={18} />, color: "text-blue-400",    key: "shared" },
  { name: "VPS",       href: "/vps",    icon: <Cpu size={18} />,    color: "text-purple-400",  key: "vps" },
  { name: "Reseller",  href: "/order",  icon: <Users size={18} />,  color: "text-rose-400",    key: "reseller" },
  { name: "WordPress", href: "/order",  icon: <Layout size={18} />, color: "text-emerald-400", key: "wordpress" },
];

const NAV_OTHER = [
  { name: "Domains",  href: "/client/domain-search", icon: <Globe size={18} />, color: "text-cyan-400" },
  { name: "Contact",  href: "/contact",              icon: <Mail size={18} />,  color: "text-teal-400" },
];

export function SiteNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hostingOpen, setHostingOpen] = useState(false);
  const [mobileHostingOpen, setMobileHostingOpen] = useState(false);
  const hostingRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { count: cartCount } = useCart();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (hostingRef.current && !hostingRef.current.contains(e.target as Node)) {
        setHostingOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const dashboardPath = user?.role === "admin" ? "/admin/dashboard" : "/client/dashboard";

  const Logo = () => (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/20">
        <Server size={20} />
      </div>
      <span className="text-xl font-black tracking-tighter text-white">NOEHOST</span>
    </div>
  );

  return (
    <nav className={`transition-all duration-300 w-full z-[100] ${isScrolled ? "bg-[#0F172A] py-3 shadow-2xl shadow-black/30 border-b border-white/5" : "bg-[#0F172A]/80 backdrop-blur-sm py-5"}`}>
      <div className="container mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-black text-xs transition-all py-2 uppercase tracking-widest text-slate-300 hover:text-white group">
              <span className="text-primary group-hover:scale-110 transition-transform"><Zap size={16} /></span>
              Home
            </Link>

            {/* Hosting Dropdown */}
            <div ref={hostingRef} className="relative">
              <button onClick={() => setHostingOpen(o => !o)}
                className="flex items-center gap-2 font-black text-xs transition-all py-2 uppercase tracking-widest text-slate-300 hover:text-white group">
                <span className="text-primary group-hover:scale-110 transition-transform"><Server size={16} /></span>
                Hosting
                <ChevronDown size={14} className={`transition-transform duration-200 ${hostingOpen ? "rotate-180" : ""}`} />
              </button>

              {hostingOpen && (
                <div className="absolute top-full left-0 mt-3 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden" style={{ minWidth: "340px" }}>
                  <div className="px-5 pt-5 pb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Hosting Plans</span>
                  </div>
                  <div className="px-2 pb-3">
                    {NAV_HOSTING.map((link) => {
                      const meta = HOSTING_META[link.key] || {};
                      return (
                        <Link key={link.key} href={link.href} onClick={() => setHostingOpen(false)}
                          className="flex items-start gap-4 px-3 py-3.5 rounded-xl hover:bg-slate-50 transition-all group">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-100 group-hover:bg-primary/10 transition-all ${link.color}`}>
                            {link.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-bold text-slate-800 group-hover:text-primary transition-colors">
                                {link.name === "Shared" ? "Shared Hosting" : link.name === "VPS" ? "VPS Hosting" : link.name === "Reseller" ? "Reseller Hosting" : "WordPress Hosting"}
                              </span>
                              {meta.badge && (
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.badgeColor || "bg-slate-100 text-slate-500"}`}>{meta.badge}</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 font-medium leading-snug">{meta.desc}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  <div className="border-t border-slate-100 px-5 py-3.5 bg-slate-50/60 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Not sure which plan?</span>
                    <Link href="/order" onClick={() => setHostingOpen(false)} className="text-xs font-black text-primary hover:underline">Compare all plans →</Link>
                  </div>
                </div>
              )}
            </div>

            {NAV_OTHER.map(link => (
              <Link key={link.name} href={link.href}
                className="flex items-center gap-2 font-black text-xs transition-all py-2 uppercase tracking-widest text-slate-300 hover:text-white group">
                <span className={`${link.color} group-hover:scale-110 transition-transform`}>{link.icon}</span>
                {link.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Desktop Right Actions */}
        <div className="hidden lg:flex items-center gap-4">
          {/* Cart */}
          <button onClick={() => setLocation(user ? "/client/cart" : "/client/login")}
            className="relative p-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white transition-all hover:bg-white/10">
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none">
                {cartCount}
              </span>
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <Link href={dashboardPath}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-black text-sm transition-all shadow-xl shadow-primary/20 uppercase tracking-widest">
                {user.role === "admin" ? <Shield size={16} /> : <LayoutDashboard size={16} />}
                Dashboard
              </Link>
              <button onClick={handleLogout}
                className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-red-400 transition-all">
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <>
              <Link href="/client/login"
                className="font-black text-sm text-slate-300 hover:text-white transition-colors uppercase tracking-widest">
                Log In
              </Link>
              <Link href="/register"
                className="px-8 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-black text-sm transition-all shadow-xl shadow-primary/30 uppercase tracking-widest">
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <div className="lg:hidden flex items-center gap-3">
          <button onClick={() => setLocation(user ? "/client/cart" : "/client/login")}
            className="relative p-2 text-slate-300 hover:text-white transition-colors">
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-primary text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5">
                {cartCount}
              </span>
            )}
          </button>
          <button onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-xl text-white bg-white/10 transition-all">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-[#0F172A] border-t border-white/5 shadow-2xl p-8 flex flex-col gap-6 z-[100] max-h-[85vh] overflow-y-auto">
          <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-4 group">
            <div className="p-3 rounded-xl bg-white/5 text-primary group-hover:bg-primary group-hover:text-white transition-all"><Zap size={18} /></div>
            <span className="text-sm font-black text-slate-200 uppercase tracking-widest">Home</span>
          </Link>

          <div>
            <button onClick={() => setMobileHostingOpen(o => !o)} className="flex items-center gap-4 group w-full">
              <div className="p-3 rounded-xl bg-white/5 text-primary group-hover:bg-primary group-hover:text-white transition-all"><Server size={18} /></div>
              <span className="text-sm font-black text-slate-200 uppercase tracking-widest flex-1 text-left">Hosting</span>
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${mobileHostingOpen ? "rotate-180" : ""}`} />
            </button>
            {mobileHostingOpen && (
              <div className="mt-3 flex flex-col gap-1 pl-4">
                {NAV_HOSTING.map(link => (
                  <Link key={link.key} href={link.href} onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all group">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 group-hover:bg-primary/10 ${link.color}`}>{link.icon}</div>
                    <span className="text-sm font-bold text-slate-300 group-hover:text-primary transition-colors">
                      {link.name === "Shared" ? "Shared Hosting" : link.name === "VPS" ? "VPS Hosting" : link.name === "Reseller" ? "Reseller Hosting" : "WordPress Hosting"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {NAV_OTHER.map(link => (
            <Link key={link.name} href={link.href} onClick={() => setMobileOpen(false)} className="flex items-center gap-4 group">
              <div className={`p-3 rounded-xl bg-white/5 group-hover:bg-primary group-hover:text-white transition-all ${link.color}`}>{link.icon}</div>
              <span className="text-sm font-black text-slate-200 uppercase tracking-widest">{link.name}</span>
            </Link>
          ))}

          <hr className="border-white/5" />

          {user ? (
            <div className="flex flex-col gap-4">
              <Link href={dashboardPath} onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-3 py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 uppercase tracking-widest">
                <LayoutDashboard size={20} /> Dashboard
              </Link>
              <button onClick={handleLogout}
                className="flex items-center justify-center gap-3 py-5 bg-white/5 text-red-400 rounded-2xl font-black border border-white/5 uppercase tracking-widest">
                <LogOut size={20} /> Logout
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Link href="/client/login" onClick={() => setMobileOpen(false)}
                className="text-sm font-black text-slate-200 text-center py-5 border border-white/10 rounded-2xl uppercase tracking-widest hover:bg-white/5 transition-all">
                Log In
              </Link>
              <Link href="/register" onClick={() => setMobileOpen(false)}
                className="w-full py-5 bg-primary text-white rounded-2xl font-black text-center shadow-2xl shadow-primary/30 uppercase tracking-widest">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
