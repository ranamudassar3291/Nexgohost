import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { useCurrency } from "@/context/CurrencyProvider";
import { useTheme } from "@/context/ThemeProvider";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut, Menu, X, ShieldAlert, ChevronDown, ChevronRight,
  AlertTriangle, Plus, Settings, HelpCircle,
  ExternalLink, BookOpen, Server, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { routesByRole } from "@/config/routes";
import type { LucideIcon } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { AiChatWidget } from "@/components/AiChatWidget";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { useQuery } from "@tanstack/react-query";

interface LayoutProps {
  children: ReactNode;
  role: "admin" | "client";
}

interface NavGroup {
  label: string;
  items: { name: string; href: string; icon: LucideIcon }[];
}

// ─── Contextual Help Guides ───────────────────────────────────────────────────
const HELP_CONTEXT: Record<string, { title: string; articles: { label: string; desc: string }[] }> = {
  "/client/hosting": {
    title: "Hosting Guides",
    articles: [
      { label: "Getting started with cPanel", desc: "Set up files, databases and SSL in minutes." },
      { label: "Create & manage email accounts", desc: "Add custom email addresses for your domain." },
      { label: "1-click WordPress installation", desc: "Launch WordPress from your control panel." },
    ],
  },
  "/client/domains": {
    title: "Domain Guides",
    articles: [
      { label: "Transfer a domain to us", desc: "Move your domain and keep existing settings." },
      { label: "Configure DNS records", desc: "Point your domain to the right servers." },
      { label: "Enable WHOIS privacy", desc: "Hide your contact info from public lookups." },
    ],
  },
  "/client/billing": {
    title: "Billing Guides",
    articles: [
      { label: "Pay an invoice", desc: "Step-by-step payment instructions." },
      { label: "Apply a promo code", desc: "Save on your next order with a discount." },
      { label: "Understanding renewals", desc: "When and how you're billed for renewals." },
    ],
  },
  "/client/tickets": {
    title: "Support Guides",
    articles: [
      { label: "Open a support ticket", desc: "Describe your issue for a fast response." },
      { label: "Response time SLA", desc: "Our commitment by priority level." },
      { label: "Escalate an issue", desc: "When and how to request priority handling." },
    ],
  },
  "/client/account": {
    title: "Account Guides",
    articles: [
      { label: "Update contact details", desc: "Keep your billing info and email current." },
      { label: "Enable two-factor auth", desc: "Secure your account with 2FA." },
      { label: "Notification preferences", desc: "Choose which emails you receive." },
    ],
  },
  "/admin/servers": {
    title: "Server Guides",
    articles: [
      { label: "Connecting a WHM server", desc: "Link your cPanel/WHM server in minutes." },
      { label: "Adding server nodes", desc: "Scale by adding more provisioning nodes." },
      { label: "Monitoring server health", desc: "Read live usage stats and alerts." },
    ],
  },
};
const DEFAULT_HELP = {
  title: "Help & Guides",
  articles: [
    { label: "Getting started guide", desc: "A complete walkthrough of the client portal." },
    { label: "Managing your services", desc: "How to view, upgrade, and cancel services." },
    { label: "Contacting our support team", desc: "When and how to reach us for help." },
  ],
};

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard",    href: "/admin/dashboard", icon: (() => null) as any },
      { name: "Clients",      href: "/admin/clients",   icon: (() => null) as any },
    ],
  },
  {
    label: "Services",
    items: [
      { name: "Domains",   href: "/admin/domains",  icon: (() => null) as any },
      { name: "Hosting",   href: "/admin/hosting",  icon: (() => null) as any },
      { name: "Orders",    href: "/admin/orders",   icon: (() => null) as any },
    ],
  },
  {
    label: "Customer Care",
    items: [
      { name: "Support",   href: "/admin/support",  icon: (() => null) as any },
      { name: "Finance",   href: "/admin/finance",  icon: (() => null) as any },
      { name: "Abuse",     href: "/admin/abuse",    icon: (() => null) as any },
    ],
  },
  {
    label: "Technical",
    items: [
      { name: "Servers",         href: "/admin/servers",          icon: (() => null) as any },
      { name: "Analytics",       href: "/admin/analytics",        icon: (() => null) as any },
      { name: "System",          href: "/admin/system",           icon: (() => null) as any },
      { name: "IP Unblocker",    href: "/admin/ip-unblocker",     icon: (() => null) as any },
      { name: "Command Center",  href: "/admin/command-center",   icon: (() => null) as any },
    ],
  },
  {
    label: "Website",
    items: [
      { name: "Website Admin", href: "/admin/website",        icon: (() => null) as any },
      { name: "SEO Engine",    href: "/admin/seo-engine",    icon: (() => null) as any },
      { name: "Sales Funnel",  href: "/admin/sales-funnel",  icon: (() => null) as any },
    ],
  },
];

/* ─── Client nav: pinned shortcuts at top, rest of nav below ─── */
const CLIENT_NAV_TOP      = ["/client/dashboard", "/client/billing", "/client/orders"];
const CLIENT_NAV_SERVICES = ["/client/hosting", "/client/domains"];
const CLIENT_NAV_BOTTOM   = ["/client/tickets", "/client/growth", "/client/security", "/client/team", "/client/affiliate", "/client/credits", "/client/help", "/client/account"];

export function AppLayout({ children, role }: LayoutProps) {
  const { user, logout } = useAuth();
  const { logoUrl, faviconUrl, siteName } = useBranding();
  const { currency, setCurrency, allCurrencies } = useCurrency();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(
    () => location.startsWith("/client/hosting") || location.startsWith("/client/domains")
  );

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (faviconUrl && link) link.href = faviconUrl;
  }, [faviconUrl]);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const { data: priceGuardData } = useQuery<any>({
    queryKey: ["spaceship-balance-alert"],
    queryFn: async () => {
      const res = await fetch("/api/admin/domains/tld-price-guard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: role === "admin" && !!token,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const showLowBalanceAlert = role === "admin" && priceGuardData?.hasRegistrar && priceGuardData?.lowBalance;
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Client portal dynamic theme colours
  const C = {
    pageBg:        isDark ? "#0F172A" : "#F7F8FA",
    headerBg:      isDark ? "#1E293B" : "#ffffff",
    headerBorder:  isDark ? "#334155" : "#F0F0F5",
    headerShadow:  isDark ? "0 1px 3px rgba(0,0,0,0.3)"  : "0 1px 3px rgba(0,0,0,0.04)",
    footerBg:      isDark ? "#1E293B" : "#ffffff",
    footerBorder:  isDark ? "#334155" : "#F0F0F5",
    titleColor:    isDark ? "#F1F5F9" : "#1A202C",
    bellColor:     isDark ? "#94A3B8" : "#94A3B8",
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const allClientLinks = routesByRole.client
    .filter(r => r.inNav)
    .filter(r => r.path !== "/client/migrations" || (user as any)?.canMigrate === true)
    .map(r => ({ name: r.label, href: r.path, icon: r.icon }));

  const clientLinksTop      = allClientLinks.filter(l => CLIENT_NAV_TOP.includes(l.href));
  const clientLinksServices = allClientLinks.filter(l => CLIENT_NAV_SERVICES.includes(l.href));
  const clientLinksBottom   = allClientLinks.filter(l => CLIENT_NAV_BOTTOM.includes(l.href));

  const helpContextKey = Object.keys(HELP_CONTEXT).find(k => location.startsWith(k));
  const helpContext = helpContextKey ? HELP_CONTEXT[helpContextKey] : DEFAULT_HELP;

  const routeIconMap = routesByRole.admin.reduce<Record<string, LucideIcon>>((acc, r) => {
    acc[r.path] = r.icon;
    return acc;
  }, {});

  const adminNavGroups: NavGroup[] = ADMIN_NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.map(item => ({
      ...item,
      icon: routeIconMap[item.href] ?? item.icon,
    })),
  }));

  const MASTER_CHILDREN: Record<string, string[]> = {
    "/admin/domains":   ["/admin/domain-registrars", "/admin/domain-transfers", "/admin/domains/extensions"],
    "/admin/hosting":   ["/admin/packages", "/admin/pending-activations", "/admin/vps"],
    "/admin/orders":    ["/admin/invoices", "/admin/transactions"],
    "/admin/support":   ["/admin/tickets", "/admin/migrations", "/admin/knowledge-base", "/admin/announcements", "/admin/cancellation-requests"],
    "/admin/finance":   ["/admin/promo-codes", "/admin/payment-methods", "/admin/currencies", "/admin/product-groups", "/admin/affiliates", "/admin/credits"],
    "/admin/servers":   ["/admin/twenty-i", "/admin/modules", "/admin/server-nodes"],
    "/admin/analytics": ["/admin/reports", "/admin/transactions", "/admin/fraud-logs", "/admin/cron-logs", "/admin/server-logs", "/admin/backups", "/admin/whatsapp", "/admin/email-marketing", "/admin/whmcs-import"],
    "/admin/system":    ["/admin/settings", "/admin/admin-users", "/admin/email-templates", "/admin/api-settings", "/admin/api-docs", "/admin/security", "/admin/firewall", "/admin/ip-unblocker"],
    "/admin/website":   [],
  };

  const isActive = (href: string) => {
    if (location === href || location.startsWith(`${href}/`)) return true;
    const children = MASTER_CHILDREN[href] ?? [];
    return children.some(child => location === child || location.startsWith(`${child}/`));
  };

  const pageTitle = (() => {
    const parts = location.split("/").filter(Boolean);
    if (parts.length === 0) return "Home";
    const last = parts[parts.length - 1];
    if (/^[0-9a-f-]{20,}$/i.test(last)) return parts[parts.length - 2]?.replace(/-/g, " ") || "Details";
    return last.replace(/-/g, " ");
  })();

  const isClient = role === "client";

  /* ─── Client Sidebar Content ─── */
  const clientSidebarContent = (
    <div className="flex flex-col h-full" style={{ background: "#1A202C" }}>
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", minHeight: 68 }}>
        {logoUrl ? (
          <img src={logoUrl} alt={siteName} className="brand-logo-img" style={{ maxHeight: 40, width: "auto", maxWidth: "100%", filter: "brightness(0) invert(1)" }} referrerPolicy="no-referrer" />
        ) : (
          <>
            <div
              className="brand-logo-container w-9 h-9 rounded-xl font-black text-white text-base flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #5B5FEF, #7A6BFF)", boxShadow: "0 4px 14px rgba(91,95,239,0.4)" }}
            >
              {siteName?.[0] ?? "N"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-display font-extrabold text-lg text-white tracking-tight leading-none">{siteName}</span>
              <span className="text-[10px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: "#6366F1" }}>Client Portal</span>
            </div>
          </>
        )}
      </div>

      {/* Order Now CTA */}
      <div className="px-4 pt-5 pb-3">
        <Link href="/client/orders/new">
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer font-bold text-sm text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #5B5FEF 0%, #7A6BFF 100%)", boxShadow: "0 4px 16px rgba(91,95,239,0.35)" }}
          >
            <Plus size={15} />
            New Order
          </div>
        </Link>
      </div>

      {/* Main Nav */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
        {/* Primary nav items */}
        <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.28)" }}>Main</p>
        {clientLinksTop.map(link => {
          const active = isActive(link.href);
          const Icon = link.icon;
          return (
            <Link key={link.name} href={link.href}>
              <div
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer group"
                style={{
                  background: active ? "rgba(99,102,241,0.22)" : "transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.55)",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)"; }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; } }}
              >
                <Icon
                  size={17}
                  style={{ color: active ? "#818CF8" : "inherit", flexShrink: 0 }}
                />
                <span className="text-sm font-medium">{link.name}</span>
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#6366F1" }} />}
              </div>
            </Link>
          );
        })}

        {/* ── Services sub-menu ── */}
        <div className="mt-1">
          <button
            onClick={() => setServicesOpen(s => !s)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer"
            style={{ color: "rgba(255,255,255,0.28)" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.28)"}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest flex-1 text-left">Services</span>
            <motion.span animate={{ rotate: servicesOpen ? 0 : -90 }} transition={{ duration: 0.18 }} style={{ display: "inline-flex" }}>
              <ChevronDown size={11} />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {servicesOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="space-y-0.5 mt-0.5">
                  {clientLinksServices.map(link => {
                    const active = isActive(link.href);
                    const Icon = link.icon;
                    return (
                      <Link key={link.name} href={link.href}>
                        <div
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer"
                          style={{
                            background: active ? "rgba(99,102,241,0.22)" : "transparent",
                            color: active ? "#fff" : "rgba(255,255,255,0.55)",
                          }}
                          onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)"; } }}
                          onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; } }}
                        >
                          <Icon size={17} style={{ color: active ? "#818CF8" : "inherit", flexShrink: 0 }} />
                          <span className="text-sm font-medium">{link.name}</span>
                          {active && <div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#6366F1" }} />}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="px-3 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.28)" }}>Account</p>
        {clientLinksBottom.map(link => {
          const active = isActive(link.href);
          const Icon = link.icon;
          return (
            <Link key={link.name} href={link.href}>
              <div
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer"
                style={{
                  background: active ? "rgba(99,102,241,0.22)" : "transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.55)",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)"; }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; } }}
              >
                <Icon size={17} style={{ color: active ? "#818CF8" : "inherit", flexShrink: 0 }} />
                <span className="text-sm font-medium">{link.name}</span>
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#6366F1" }} />}
              </div>
            </Link>
          );
        })}
      </div>

      {/* User Footer */}
      <div className="p-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Currency */}
        <div className="flex items-center gap-2 px-1 mb-3">
          <span className="text-[11px] font-medium shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>Currency</span>
          <select
            value={currency.code}
            onChange={e => {
              const found = allCurrencies.find(c => c.code === e.target.value);
              if (found) setCurrency(found);
            }}
            className="flex-1 text-xs rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-1"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.75)",
              focusRingColor: "#6366F1",
            }}
          >
            {allCurrencies.map(c => (
              <option key={c.code} value={c.code} style={{ background: "#1A202C" }}>{c.code} ({c.symbol})</option>
            ))}
          </select>
        </div>

        {/* User card */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
            style={{ background: "linear-gradient(135deg,#5B5FEF,#7A6BFF)", color: "#fff" }}
          >
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{user?.email}</p>
          </div>
          <Link href="/client/account">
            <Settings size={14} style={{ color: "rgba(255,255,255,0.35)" }} className="hover:opacity-80 cursor-pointer" />
          </Link>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ color: "rgba(255,255,255,0.4)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.12)"; (e.currentTarget as HTMLElement).style.color = "rgba(252,165,165,0.9)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; }}
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </div>
  );

  /* ─── Admin Sidebar Content (unchanged) ─── */
  const adminSidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 flex items-center gap-3 border-b border-border/50" style={{ minHeight: 64 }}>
        {logoUrl ? (
          <div className="flex items-center min-w-0 max-w-full">
            <img src={logoUrl} alt={siteName} className="brand-logo-img" style={{ maxHeight: 44, width: "auto", maxWidth: "100%" }} referrerPolicy="no-referrer" />
          </div>
        ) : (
          <>
            <div
              className="brand-logo-container w-10 h-10 rounded-xl font-bold text-white text-base shadow-lg shrink-0 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #5B5FEF, #7A6BFF)", boxShadow: "0 0 14px rgba(91,95,239,0.35)" }}
            >
              {siteName?.[0] ?? "N"}
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <h1 className="font-display font-bold text-xl tracking-tight leading-none" style={{ background: "linear-gradient(135deg,#5B5FEF,#7A6BFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{siteName}</h1>
              <p className="text-[10px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: "#5B5FEF" }}>NoePanel</p>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {adminNavGroups.map(group => {
          const isCollapsed = collapsedGroups[group.label];
          const groupHasActive = group.items.some(item => isActive(item.href));
          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${
                  groupHasActive ? "text-primary" : "text-muted-foreground/60 hover:text-muted-foreground"
                }`}
              >
                <span>{group.label}</span>
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5 mt-0.5">
                      {group.items.map(item => {
                        const active = isActive(item.href);
                        const Icon = item.icon;
                        return (
                          <Link key={item.name} href={item.href}>
                            <div
                              onClick={() => setMobileMenuOpen(false)}
                              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer group ${
                                active
                                  ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent"
                              }`}
                            >
                              {Icon && <Icon size={16} className={active ? "text-primary shrink-0" : "text-muted-foreground group-hover:text-foreground shrink-0 transition-colors"} />}
                              <span className="text-sm truncate">{item.name}</span>
                              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-border/50">
        <div className="flex items-center gap-3 px-3 py-2.5 bg-secondary/40 rounded-xl mb-2 border border-border/40">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm border border-primary/30 shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-1 mb-1">
          <span className="text-[11px] text-muted-foreground shrink-0">Currency:</span>
          <select
            value={currency.code}
            onChange={e => {
              const found = allCurrencies.find(c => c.code === e.target.value);
              if (found) setCurrency(found);
            }}
            className="flex-1 bg-secondary/50 border border-border/50 text-foreground text-xs rounded-lg px-2 py-1 cursor-pointer hover:border-primary/40 transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {allCurrencies.map(c => (
              <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
            ))}
          </select>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-sm h-9 rounded-xl"
          onClick={logout}
        >
          <LogOut size={15} />
          Sign Out
        </Button>
      </div>
    </div>
  );

  const sidebarContent = isClient ? clientSidebarContent : adminSidebarContent;

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans" style={{ background: isClient ? C.pageBg : undefined }}>

      {/* ── Mobile Header ── */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-50 shadow-sm"
        style={{
          background: isClient ? "#1A202C" : undefined,
          borderColor: isClient ? "rgba(255,255,255,0.08)" : undefined,
        }}
      >
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="brand-logo-img" style={{ maxHeight: 38, width: "auto", maxWidth: 180, ...(isClient ? { filter: "brightness(0) invert(1)" } : {}) }} referrerPolicy="no-referrer" />
          ) : (
            <>
              <div
                className="brand-logo-container w-9 h-9 rounded-lg font-bold text-white text-sm shadow flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #5B5FEF, #7A6BFF)" }}
              >
                {siteName?.[0] ?? "N"}
              </div>
              <span className="font-display font-bold text-lg tracking-tight text-white">{siteName}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isClient && (
            <Link href="/client/orders/new">
              <button
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold text-white shadow mr-1"
                style={{ background: "linear-gradient(135deg, #5B5FEF, #7A6BFF)" }}
              >
                <Plus size={13} />
                Order
              </button>
            </Link>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl transition-colors"
            style={{ color: isClient ? "rgba(255,255,255,0.8)" : undefined }}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden md:flex flex-col w-60 sticky top-0 h-screen overflow-hidden"
        style={{
          background: isClient ? "#1A202C" : undefined,
          borderRight: isClient ? "1px solid rgba(255,255,255,0.06)" : undefined,
          boxShadow: isClient ? "4px 0 24px rgba(0,0,0,0.12)" : undefined,
        }}
      >
        {!isClient && <div className="h-full bg-card border-r border-border">{sidebarContent}</div>}
        {isClient && sidebarContent}
      </aside>

      {/* ── Mobile Slide-out ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: -290, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -290, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed top-0 left-0 h-screen w-72 z-50 md:hidden shadow-2xl overflow-hidden"
              style={{ background: isClient ? "#1A202C" : undefined }}
            >
              {!isClient && <div className="h-full bg-card border-r border-border">{sidebarContent}</div>}
              {isClient && sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Desktop top-bar header */}
        <header
          className="hidden md:flex h-16 items-center justify-between px-8 sticky top-0 z-30"
          style={{
            background: isClient ? C.headerBg : "rgba(var(--background)/0.8)",
            borderBottom: isClient ? `1px solid ${C.headerBorder}` : "1px solid hsl(var(--border)/0.5)",
            backdropFilter: isClient ? "none" : "blur(20px)",
            boxShadow: isClient ? C.headerShadow : "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <h2 className="text-base font-display font-bold capitalize" style={{ color: isClient ? C.titleColor : undefined }}>
            {pageTitle}
          </h2>
          <div className="flex items-center gap-3">
            {role === "admin" && (
              <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 flex items-center gap-2 text-xs text-primary font-semibold">
                <ShieldAlert size={14} /> Admin Access
              </div>
            )}
            {isClient && (
              <>
                <Link href="/client/orders/new">
                  <button
                    className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-white shadow transition-opacity hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #5B5FEF, #7A6BFF)", boxShadow: "0 4px 14px rgba(91,95,239,0.25)" }}
                  >
                    <Plus size={15} /> New Order
                  </button>
                </Link>
                <NotificationBell />
                <button
                  onClick={() => setHelpOpen(s => !s)}
                  title="Help & Guides"
                  className="relative p-2 rounded-xl transition-colors"
                  style={{ color: helpOpen ? "#4F46E5" : "#94A3B8", background: helpOpen ? "#EEF2FF" : "transparent" }}
                  onMouseEnter={e => { if (!helpOpen) (e.currentTarget as HTMLElement).style.color = "#1A202C"; }}
                  onMouseLeave={e => { if (!helpOpen) (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
                >
                  <HelpCircle size={18} />
                </button>
              </>
            )}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
              style={isClient
                ? { background: "#EEF2FF", color: "#4F46E5", border: "2px solid #C7D2FE" }
                : { background: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary)/0.2)" }
              }
            >
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          </div>
        </header>

        {/* Admin low-balance alert */}
        {showLowBalanceAlert && (
          <div className="mx-4 mt-3 md:mx-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 text-[13px] font-medium">
            <AlertTriangle size={16} className="shrink-0 text-red-400" />
            <span>
              <span className="font-bold text-red-300">Spaceship Balance Low:</span>{" "}
              ${priceGuardData?.balance?.toFixed(2)} remaining — below the $5 safety threshold.{" "}
              Top up your Spaceship wallet before activating domains.
            </span>
          </div>
        )}

        {/* Page content */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ background: isClient ? C.pageBg : undefined }}
        >
          <div className={isClient ? "p-6 md:p-8" : "p-4 md:p-8"}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={isClient ? "max-w-6xl mx-auto" : "max-w-7xl mx-auto space-y-6"}
            >
              {children}
            </motion.div>
          </div>
        </div>

        {/* ── Dashboard Footer ── */}
        {isClient && (
          <footer
            className="hidden md:flex items-center justify-between px-8 py-3 shrink-0"
            style={{ borderTop: `1px solid ${C.footerBorder}`, background: C.footerBg }}
          >
            <div className="flex items-center gap-2 text-xs" style={{ color: "#94A3B8" }}>
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ background: "#34D399" }}
                />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#10B981" }} />
              </span>
              System Status: All systems operational
            </div>
            <p className="text-[11px]" style={{ color: "#CBD5E1" }}>
              © {new Date().getFullYear()} {siteName}. All rights reserved.
            </p>
          </footer>
        )}
      </main>

      {isClient && <AiChatWidget />}
      {isClient && <FeedbackWidget />}

      {/* ── Contextual Help Drawer ── */}
      <AnimatePresence>
        {helpOpen && isClient && (
          <>
            <motion.div
              key="help-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40"
              onClick={() => setHelpOpen(false)}
            />
            <motion.div
              key="help-drawer"
              initial={{ x: 340, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 340, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed top-0 right-0 h-screen w-80 z-50 flex flex-col shadow-2xl"
              style={{ background: "#ffffff", borderLeft: "1px solid #F0F0F5" }}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #F0F0F5" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#EEF2FF" }}>
                    <BookOpen size={15} style={{ color: "#4F46E5" }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: "#1A202C" }}>{helpContext.title}</h3>
                    <p className="text-[10px]" style={{ color: "#94A3B8" }}>3 quick guides</p>
                  </div>
                </div>
                <button
                  onClick={() => setHelpOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{ color: "#94A3B8" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; (e.currentTarget as HTMLElement).style.color = "#1A202C"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Guide articles */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {helpContext.articles.map((art, i) => (
                  <a
                    key={i}
                    href="#"
                    onClick={e => e.preventDefault()}
                    className="flex items-start gap-3 p-4 rounded-xl border transition-all group cursor-pointer block"
                    style={{ borderColor: "#F0F0F5", background: "#FAFAFA" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#C7D2FE"; (e.currentTarget as HTMLElement).style.background = "#EEF2FF"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#F0F0F5"; (e.currentTarget as HTMLElement).style.background = "#FAFAFA"; }}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                      style={{ background: "#EEF2FF" }}>
                      <BookOpen size={14} style={{ color: "#4F46E5" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug" style={{ color: "#1A202C" }}>{art.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{art.desc}</p>
                    </div>
                    <ExternalLink size={12} style={{ color: "#C7D2FE", flexShrink: 0, marginTop: 4 }} />
                  </a>
                ))}

                {/* Divider */}
                <div className="pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest px-1 pb-2" style={{ color: "#CBD5E1" }}>Still need help?</p>
                  <Link href="/client/tickets" onClick={() => setHelpOpen(false)}>
                    <div
                      className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
                      style={{ background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)" }}
                    >
                      <Server size={14} />
                      Open a Support Ticket
                    </div>
                  </Link>
                </div>
              </div>

              {/* Powered-by footer */}
              <div className="px-5 py-3 text-center" style={{ borderTop: "1px solid #F0F0F5" }}>
                <p className="text-[10px]" style={{ color: "#CBD5E1" }}>Self-service help · {siteName} Support</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Dashboard Footer (rendered inside main content) ── */
export function DashboardFooter({ siteName }: { siteName: string }) {
  return (
    <footer
      className="hidden md:flex items-center justify-between px-8 py-3 mt-auto"
      style={{ borderTop: "1px solid #F0F0F5", background: "#ffffff" }}
    >
      <div className="flex items-center gap-2 text-xs" style={{ color: "#94A3B8" }}>
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "#34D399" }} />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#10B981" }} />
        </span>
        System Status: All systems operational
      </div>
      <p className="text-[11px]" style={{ color: "#CBD5E1" }}>
        © {new Date().getFullYear()} {siteName}. All rights reserved.
      </p>
    </footer>
  );
}
