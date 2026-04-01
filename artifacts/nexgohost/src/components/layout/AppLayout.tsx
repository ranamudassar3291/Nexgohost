import { ReactNode, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Menu, X, ShieldAlert, ChevronDown, ChevronRight, ShoppingCart, AlertTriangle, Plus, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routesByRole } from "@/config/routes";
import type { LucideIcon } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { NotificationBell } from "@/components/NotificationBell";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/context/ThemeProvider";

interface LayoutProps {
  children: ReactNode;
  role: "admin" | "client";
}

interface NavGroup {
  label: string;
  items: { name: string; href: string; icon: LucideIcon }[];
}

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
    ],
  },
  {
    label: "Technical",
    items: [
      { name: "Servers",    href: "/admin/servers",    icon: (() => null) as any },
      { name: "Analytics",  href: "/admin/analytics",  icon: (() => null) as any },
      { name: "System",     href: "/admin/system",     icon: (() => null) as any },
    ],
  },
];

export function AppLayout({ children, role }: LayoutProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

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
  const { count: cartCount } = useCart();

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const clientLinks = routesByRole.client
    .filter(r => r.inNav)
    .map(r => ({ name: r.label, href: r.path, icon: r.icon }));

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
    "/admin/system":    ["/admin/settings", "/admin/admin-users", "/admin/email-templates", "/admin/api-settings", "/admin/api-docs", "/admin/security", "/admin/firewall"],
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

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 flex items-center gap-3 border-b border-border/50">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-lg"
          style={{ background: "linear-gradient(135deg, #673ab7, #9c27b0)" }}
        >
          N
        </div>
        <div>
          <h1 className="font-display font-bold text-xl text-foreground tracking-tight">Noehost</h1>
          <p className="text-[10px] text-primary font-semibold tracking-widest uppercase">
            {role === "admin" ? "NoePanel" : "Client Portal"}
          </p>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {role === "admin" ? (
          adminNavGroups.map(group => {
            const isCollapsed = collapsedGroups[group.label];
            const groupHasActive = group.items.some(item => isActive(item.href));

            return (
              <div key={group.label} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    groupHasActive
                      ? "text-primary"
                      : "text-muted-foreground/60 hover:text-muted-foreground"
                  }`}
                >
                  <span>{group.label}</span>
                  {isCollapsed
                    ? <ChevronRight size={12} />
                    : <ChevronDown size={12} />}
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
                                {Icon && (
                                  <Icon
                                    size={16}
                                    className={active ? "text-primary shrink-0" : "text-muted-foreground group-hover:text-foreground shrink-0 transition-colors"}
                                  />
                                )}
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
          })
        ) : (
          <div className="space-y-0.5">
            {/* Order Now CTA — always pinned at top for client */}
            <Link href="/client/orders/new">
              <div
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl mb-3 cursor-pointer text-white font-bold text-sm shadow-md transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #673ab7 0%, #9c27b0 100%)" }}
              >
                <Plus size={16} />
                Order Now
              </div>
            </Link>
            {clientLinks.map(link => {
              const active = isActive(link.href);
              const Icon = link.icon;
              return (
                <Link key={link.name} href={link.href}>
                  <div
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-150 cursor-pointer group ${
                      active
                        ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent"
                    }`}
                  >
                    <Icon size={18} className={active ? "text-primary shrink-0" : "text-muted-foreground group-hover:text-foreground shrink-0 transition-colors"} />
                    <span className="text-sm">{link.name}</span>
                    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* User + Logout */}
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

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans">

      {/* ── Mobile / Tablet Header (hidden on md+ desktop) ── */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow"
            style={{ background: "linear-gradient(135deg, #673ab7, #9c27b0)" }}
          >
            N
          </div>
          <span className="font-display font-bold text-lg text-foreground tracking-tight">Noehost</span>
        </div>

        {/* Right action cluster */}
        <div className="flex items-center gap-1">
          {/* Order Now — always visible for client on mobile */}
          {role === "client" && (
            <Link href="/client/orders/new">
              <button
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold text-white shadow transition-opacity hover:opacity-90 mr-1"
                style={{ background: "linear-gradient(135deg, #673ab7, #9c27b0)" }}
              >
                <Plus size={13} />
                Order
              </button>
            </Link>
          )}

          {/* Cart icon */}
          {role === "client" && (
            <button
              onClick={() => { setLocation("/client/cart"); setMobileMenuOpen(false); }}
              className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Cart"
            >
              <ShoppingCart size={19} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>

          {/* Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-foreground hover:bg-secondary transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* ── Desktop Sidebar (md+ screens, or desktop-mode on mobile) ── */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border sticky top-0 h-screen overflow-hidden shadow-sm">
        {sidebarContent}
      </aside>

      {/* ── Mobile Slide-out Sidebar Overlay ── */}
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
              className="fixed top-0 left-0 h-screen w-72 bg-card border-r border-border z-50 md:hidden shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Desktop top-bar header */}
        <header className="hidden md:flex h-16 items-center justify-between px-8 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-30 shadow-sm">
          <h2 className="text-lg font-display font-semibold text-foreground capitalize">
            {pageTitle}
          </h2>
          <div className="flex items-center gap-3">
            {/* Dark/Light mode toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {role === "admin" && (
              <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 flex items-center gap-2 text-xs text-primary font-semibold">
                <ShieldAlert size={14} /> Admin Access
              </div>
            )}
            {role === "client" && (
              <>
                {/* Order Now CTA in desktop header */}
                <Link href="/client/orders/new">
                  <button
                    className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-white shadow transition-opacity hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #673ab7, #9c27b0)" }}
                  >
                    <Plus size={15} /> Order Now
                  </button>
                </Link>
                <NotificationBell />
                <button
                  onClick={() => setLocation("/client/cart")}
                  className="relative p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                  title="View Cart"
                >
                  <ShoppingCart size={18} />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </button>
              </>
            )}
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          </div>
        </header>

        {/* Spaceship low-balance alert banner */}
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
        <div className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="max-w-7xl mx-auto space-y-6"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
