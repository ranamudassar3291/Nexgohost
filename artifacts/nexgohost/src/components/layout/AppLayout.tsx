import { ReactNode, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Menu, X, ShieldAlert, ChevronDown, ChevronRight, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routesByRole } from "@/config/routes";
import type { LucideIcon } from "lucide-react";
import { useCart } from "@/context/CartContext";

interface LayoutProps {
  children: ReactNode;
  role: "admin" | "client";
}

interface NavGroup {
  label: string;
  items: { name: string; href: string; icon: LucideIcon }[];
}

// Admin navigation grouped by category
const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: "/admin/dashboard", icon: (() => null) as any },
    ],
  },
  {
    label: "Management",
    items: [
      { name: "Clients",          href: "/admin/clients",         icon: (() => null) as any },
      { name: "Hosting",          href: "/admin/hosting",             icon: (() => null) as any },
      { name: "Domains",          href: "/admin/domains",             icon: (() => null) as any },
      { name: "TLD Management",   href: "/admin/domains/extensions",  icon: (() => null) as any },
      { name: "Packages",         href: "/admin/packages",            icon: (() => null) as any },
      { name: "Orders",           href: "/admin/orders",          icon: (() => null) as any },
      { name: "Invoices",         href: "/admin/invoices",        icon: (() => null) as any },
    ],
  },
  {
    label: "Support",
    items: [
      { name: "Tickets",          href: "/admin/tickets",                 icon: (() => null) as any },
      { name: "Migrations",       href: "/admin/migrations",              icon: (() => null) as any },
      { name: "Cancellations",    href: "/admin/cancellation-requests",   icon: (() => null) as any },
    ],
  },
  {
    label: "Commerce",
    items: [
      { name: "Promo Codes",      href: "/admin/promo-codes",      icon: (() => null) as any },
      { name: "Payment Methods",  href: "/admin/payment-methods",  icon: (() => null) as any },
      { name: "Currencies",       href: "/admin/currencies",       icon: (() => null) as any },
      { name: "Product Groups",   href: "/admin/product-groups",   icon: (() => null) as any },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { name: "Servers",          href: "/admin/servers",          icon: (() => null) as any },
      { name: "Modules",          href: "/admin/modules",          icon: (() => null) as any },
    ],
  },
  {
    label: "Analytics & Logs",
    items: [
      { name: "Reports",          href: "/admin/reports",          icon: (() => null) as any },
      { name: "Transactions",     href: "/admin/transactions",     icon: (() => null) as any },
      { name: "Fraud Logs",       href: "/admin/fraud-logs",       icon: (() => null) as any },
      { name: "Automation",       href: "/admin/cron-logs",        icon: (() => null) as any },
      { name: "Server Logs",      href: "/admin/server-logs",      icon: (() => null) as any },
    ],
  },
  {
    label: "System",
    items: [
      { name: "Email Templates",  href: "/admin/email-templates",  icon: (() => null) as any },
      { name: "Settings",         href: "/admin/settings",         icon: (() => null) as any },
    ],
  },
];

export function AppLayout({ children, role }: LayoutProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const { count: cartCount } = useCart();

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // For client: flat list from route config
  const clientLinks = routesByRole.client
    .filter(r => r.inNav)
    .map(r => ({ name: r.label, href: r.path, icon: r.icon }));

  // For admin: we use ADMIN_NAV_GROUPS, pull icons from routes config
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

  const isActive = (href: string) =>
    location === href || location.startsWith(`${href}/`);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 flex items-center gap-3 border-b border-border/50">
        <div className="w-9 h-9 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-lg shadow-primary/30">
          N
        </div>
        <div>
          <h1 className="font-display font-bold text-xl text-foreground tracking-tight">Nexgohost</h1>
          <p className="text-[10px] text-primary font-semibold tracking-widest uppercase">
            {role === "admin" ? "Admin Portal" : "Client Portal"}
          </p>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
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
                              <div onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer group ${
                                active
                                  ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent"
                              }`}>
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
          })
        ) : (
          <div className="space-y-0.5">
            {clientLinks.map(link => {
              const active = isActive(link.href);
              const Icon = link.icon;
              return (
                <Link key={link.name} href={link.href}>
                  <div onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-150 cursor-pointer group ${
                    active
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent"
                  }`}>
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
            <p className="text-sm font-medium text-foreground truncate">{user?.firstName} {user?.lastName}</p>
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

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center font-bold text-white text-xs">N</div>
          <span className="font-display font-bold text-lg text-foreground">Nexgohost</span>
        </div>
        <div className="flex items-center gap-1">
          {role === "client" && (
            <button
              onClick={() => { setLocation("/client/cart"); setMobileMenuOpen(false); }}
              className="relative p-2 rounded-xl text-muted-foreground"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          )}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-foreground p-2">
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border sticky top-0 h-screen overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed top-0 left-0 h-screen w-72 bg-card border-r border-border z-50 md:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <header className="hidden md:flex h-16 items-center justify-between px-8 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-30">
          <h2 className="text-lg font-display font-semibold text-foreground capitalize">
            {(() => {
              const parts = location.split("/").filter(Boolean);
              if (parts.length === 0) return "Home";
              const last = parts[parts.length - 1];
              // Don't show UUIDs as page title
              if (/^[0-9a-f-]{20,}$/i.test(last)) return parts[parts.length - 2]?.replace(/-/g, " ") || "Details";
              return last.replace(/-/g, " ");
            })()}
          </h2>
          <div className="flex items-center gap-3">
            {role === "admin" && (
              <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 flex items-center gap-2 text-xs text-primary font-semibold">
                <ShieldAlert size={14} /> Admin Access
              </div>
            )}
            {role === "client" && (
              <button
                onClick={() => setLocation("/client/cart")}
                className="relative p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                title="View Cart"
              >
                <ShoppingCart size={18} />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[10px] font-bold flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="max-w-7xl mx-auto space-y-6"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
