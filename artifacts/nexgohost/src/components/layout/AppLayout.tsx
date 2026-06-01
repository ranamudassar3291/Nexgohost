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
  LayoutDashboard, ShoppingCart, Receipt, TrendingUp,
  ShieldCheck, Users2, Ticket, User, Share2, Wallet,
  BarChart3, Zap, MessageSquare, CreditCard, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { routesByRole } from "@/config/routes";
import type { LucideIcon } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import NoeChat from "@/components/NoeChat";
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
      { name: "Domains",    href: "/admin/domains",    icon: (() => null) as any },
      { name: "Hosting",    href: "/admin/hosting",    icon: (() => null) as any },
      { name: "Orders",     href: "/admin/orders",     icon: (() => null) as any },
      { name: "Resellers",  href: "/admin/resellers",  icon: (() => null) as any },
      { name: "NoeMail",    href: "/admin/noemail",    icon: (() => null) as any },
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

/* ─── Client sidebar nav groups ─── */
const CLIENT_SIDEBAR_GROUPS = [
  {
    label: "Main",
    items: [
      { name: "Dashboard",  href: "/client/dashboard", icon: LayoutDashboard },
      { name: "Orders",     href: "/client/orders",    icon: ShoppingCart    },
      { name: "Billing",    href: "/client/billing",   icon: Receipt         },
    ],
  },
  {
    label: "Services",
    items: [
      { name: "My Hosting",      href: "/client/hosting",   icon: Server },
      { name: "My Domains",      href: "/client/domains",   icon: Globe  },
      { name: "Domain Reseller", href: "/client/reseller",  icon: Globe  },
    ],
  },
  {
    label: "Tools & Growth",
    items: [
      { name: "SEO Toolkit",  href: "/client/growth",    icon: TrendingUp, accent: "#10B981" },
      { name: "Security",     href: "/client/security",  icon: ShieldCheck, accent: "#F59E0B" },
      { name: "Team Access",  href: "/client/team",      icon: Users2      },
      { name: "Support",      href: "/client/tickets",   icon: Ticket      },
      { name: "Help Center",  href: "/help",             icon: BookOpen    },
    ],
  },
  {
    label: "Account",
    items: [
      { name: "My Account", href: "/client/account",   icon: User  },
      { name: "Affiliate",  href: "/client/affiliate", icon: Share2  },
      { name: "Credits",    href: "/client/credits",   icon: Wallet  },
    ],
  },
];

export function AppLayout({ children, role }: LayoutProps) {
  const { user, logout } = useAuth();
  const { logoUrl, faviconUrl, siteName } = useBranding();
  const { currency, setCurrency, allCurrencies } = useCurrency();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [helpOpen, setHelpOpen] = useState(false);
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
    <div className="flex flex-col h-full" style={{ background: "#0F172A" }}>

      {/* ── Logo ── */}
      <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", minHeight: 64 }}>
        {logoUrl ? (
          <img src={logoUrl} alt={siteName} className="brand-logo-img" style={{ maxHeight: 38, width: "auto", maxWidth: "100%", filter: "brightness(0) invert(1)" }} referrerPolicy="no-referrer" />
        ) : (
          <img src="/noehost-logo.png" alt="Noehost" style={{ height: 34, width: "auto", objectFit: "contain" }} />
        )}
      </div>

      {/* ── New Order CTA ── */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <Link href="/client/orders/new">
          <div onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer font-bold text-[13px] text-white select-none"
            style={{ background: "linear-gradient(135deg,#6B46C1,#8B5CF6)", boxShadow: "0 4px 18px rgba(107,70,193,0.4)" }}>
            <Plus size={14} />
            New Order
          </div>
        </Link>
      </div>

      {/* ── Nav Groups ── */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 scrollbar-hide">
        {CLIENT_SIDEBAR_GROUPS.map(group => (
          <div key={group.label} className="pt-3">
            {/* Section label */}
            <p className="px-3 pb-1.5 text-[9.5px] font-black uppercase tracking-[0.12em]"
              style={{ color: "rgba(255,255,255,0.22)", letterSpacing: "0.12em" }}>
              {group.label}
            </p>

            {/* Items */}
            <div className="space-y-0.5">
              {group.items.map(link => {
                const active = isActive(link.href);
                const Icon = link.icon;
                const accentColor = (link as any).accent;
                const iconColor = active ? "#A5B4FC" : accentColor ?? "rgba(255,255,255,0.45)";
                return (
                  <Link key={link.href} href={link.href}>
                    <div
                      onClick={() => setMobileMenuOpen(false)}
                      className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 group"
                      style={{
                        background: active ? "rgba(99,102,241,0.18)" : "transparent",
                        color: active ? "#E0E7FF" : "rgba(255,255,255,0.58)",
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.88)";
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.58)";
                        }
                      }}
                    >
                      {/* Active bar */}
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: "#7C5DE2" }} />
                      )}

                      {/* Icon container */}
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150"
                        style={{
                          background: active
                            ? "rgba(99,102,241,0.28)"
                            : accentColor
                              ? `${accentColor}18`
                              : "rgba(255,255,255,0.06)",
                        }}>
                        <Icon size={14} style={{ color: iconColor, flexShrink: 0 }} />
                      </div>

                      <span className="text-[13px] font-medium flex-1 leading-none">{link.name}</span>

                      {active && (
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#7C5DE2" }} />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── User Footer ── */}
      <div className="flex-shrink-0 p-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Currency selector */}
        <div className="flex items-center gap-2 px-1 mb-3">
          <span className="text-[11px] font-semibold shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>Currency</span>
          <select
            value={currency.code}
            onChange={e => { const found = allCurrencies.find(c => c.code === e.target.value); if (found) setCurrency(found); }}
            className="flex-1 text-xs rounded-lg px-2 py-1.5 cursor-pointer focus:outline-none"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            {allCurrencies.map(c => (
              <option key={c.code} value={c.code} style={{ background: "#0F172A" }}>{c.code} ({c.symbol})</option>
            ))}
          </select>
        </div>

        {/* User card */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl mb-2.5"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 text-white"
            style={{ background: "linear-gradient(135deg,#6B46C1,#8B5CF6)" }}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-white truncate leading-none mb-0.5">{user?.firstName} {user?.lastName}</p>
            <p className="text-[10px] truncate leading-none" style={{ color: "rgba(255,255,255,0.38)" }}>{user?.email}</p>
          </div>
          <Link href="/client/account">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer"
              style={{ background: "rgba(255,255,255,0.06)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.2)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"}>
              <Settings size={12} style={{ color: "rgba(255,255,255,0.45)" }} />
            </div>
          </Link>
        </div>

        {/* Sign out */}
        <button onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all duration-150"
          style={{ color: "rgba(255,255,255,0.35)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)"; (e.currentTarget as HTMLElement).style.color = "#FCA5A5"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}
        >
          <LogOut size={13} />
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
          <div className="flex items-center px-2 py-1.5 rounded-xl" style={{ background: "linear-gradient(135deg,#1e1b4b,#312e81)" }}>
            <img src="/noehost-logo.png" alt="Noehost" style={{ height: 32, width: "auto", objectFit: "contain" }} />
          </div>
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
          ) : isClient ? (
            <img src="/noehost-logo.png" alt="Noehost" style={{ height: 32, width: "auto", objectFit: "contain" }} />
          ) : (
            <div className="flex items-center px-2 py-1 rounded-xl" style={{ background: "linear-gradient(135deg,#1e1b4b,#312e81)" }}>
              <img src="/noehost-logo.png" alt="Noehost" style={{ height: 28, width: "auto", objectFit: "contain" }} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isClient && (
            <Link href="/client/orders/new">
              <button
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold text-white shadow mr-1"
                style={{ background: "linear-gradient(135deg, #6B46C1, #8B5CF6)" }}
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
                    style={{ background: "linear-gradient(135deg, #6B46C1, #8B5CF6)", boxShadow: "0 4px 14px rgba(107,70,193,0.25)" }}
                  >
                    <Plus size={15} /> New Order
                  </button>
                </Link>
                <NotificationBell />
                <button
                  onClick={() => setHelpOpen(s => !s)}
                  title="Help & Guides"
                  className="relative p-2 rounded-xl transition-colors"
                  style={{ color: helpOpen ? "#6B46C1" : "#94A3B8", background: helpOpen ? "#F3F0FF" : "transparent" }}
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
                ? { background: "#F3F0FF", color: "#6B46C1", border: "2px solid #C7B8FE" }
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

      {isClient && <NoeChat />}
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
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#F3F0FF" }}>
                    <BookOpen size={15} style={{ color: "#6B46C1" }} />
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
                      style={{ background: "#F3F0FF" }}>
                      <BookOpen size={14} style={{ color: "#6B46C1" }} />
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
                      style={{ background: "linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%)" }}
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
