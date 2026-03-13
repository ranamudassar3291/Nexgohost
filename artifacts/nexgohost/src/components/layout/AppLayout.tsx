import { ReactNode, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, Users, Server, Globe, ShoppingCart, 
  FileText, Ticket, Send, Settings, LogOut, Menu, X,
  User as UserIcon, ShieldAlert, Cpu, ArrowRightLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: ReactNode;
  role: "admin" | "client";
}

export function AppLayout({ children, role }: LayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const adminLinks = [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Clients", href: "/admin/clients", icon: Users },
    { name: "Hosting", href: "/admin/hosting", icon: Server },
    { name: "Domains", href: "/admin/domains", icon: Globe },
    { name: "Orders", href: "/admin/orders", icon: ShoppingCart },
    { name: "Invoices", href: "/admin/invoices", icon: FileText },
    { name: "Tickets", href: "/admin/tickets", icon: Ticket },
    { name: "Migrations", href: "/admin/migrations", icon: Send },
  ];

  const clientLinks = [
    { name: "Dashboard", href: "/client/dashboard", icon: LayoutDashboard },
    { name: "My Hosting", href: "/client/hosting", icon: Server },
    { name: "My Domains", href: "/client/domains", icon: Globe },
    { name: "Invoices", href: "/client/invoices", icon: FileText },
    { name: "Support", href: "/client/tickets", icon: Ticket },
    { name: "Migrations", href: "/client/migrations", icon: ArrowRightLeft },
    { name: "Account", href: "/client/account", icon: UserIcon },
  ];

  const links = role === "admin" ? adminLinks : clientLinks;

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}images/logo-icon.png`} alt="Logo" className="w-8 h-8" />
          <span className="font-display font-bold text-xl text-foreground">Nexgohost</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-foreground p-2">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {(mobileMenuOpen || window.innerWidth >= 768) && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed md:sticky top-0 left-0 h-screen w-72 bg-card border-r border-border flex flex-col z-40"
          >
            <div className="p-6 flex items-center gap-3 border-b border-border/50">
              <img src={`${import.meta.env.BASE_URL}images/logo-icon.png`} alt="Logo" className="w-10 h-10 drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]" />
              <div>
                <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">Nexgohost</h1>
                <p className="text-xs text-primary font-medium tracking-wider uppercase">
                  {role === "admin" ? "Admin Portal" : "Client Portal"}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
              {links.map((link) => {
                const isActive = location === link.href || location.startsWith(`${link.href}/`);
                return (
                  <Link key={link.name} href={link.href}>
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer group ${
                      isActive 
                        ? "bg-primary/10 text-primary font-medium border border-primary/20 glow-primary" 
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
                    }`}>
                      <link.icon size={20} className={isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground transition-colors"} />
                      <span>{link.name}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="p-4 border-t border-border/50">
              <div className="flex items-center gap-3 px-4 py-3 bg-secondary/50 rounded-xl mb-4 border border-border/50">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold border border-primary/30">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
              <Button 
                variant="destructive" 
                className="w-full justify-start gap-2 border border-destructive/20 hover:bg-destructive/20 hover:text-destructive bg-transparent text-muted-foreground shadow-none"
                onClick={logout}
              >
                <LogOut size={18} />
                Sign Out
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <header className="hidden md:flex h-20 items-center justify-between px-8 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-30">
          <h2 className="text-xl font-display font-semibold text-foreground capitalize">
            {location.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
          </h2>
          <div className="flex items-center gap-4">
            {role === "admin" && (
              <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 flex items-center gap-2 text-sm text-primary font-medium">
                <ShieldAlert size={16} /> Admin Privileges Active
              </div>
            )}
            <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              <Cpu size={20} />
            </div>
          </div>
        </header>
        
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="max-w-7xl mx-auto space-y-6"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
