import {
  LayoutDashboard,
  Users,
  Server,
  Globe,
  Globe2,
  ShoppingCart,
  FileText,
  Ticket,
  Send,
  Settings,
  UserIcon,
  ArrowRightLeft,
  Package,
  CreditCard,
  Tag,
  UserPlus,
  DollarSign,
  Puzzle,
  Layers,
  Mail,
  BarChart3,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Receipt,
  Share2,
  RefreshCw,
  Wallet,
  ShieldCheck,
  BookOpen,
  HelpCircle,
  MessageCircle,
  KeyRound,
  Search,
  LifeBuoy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Route Definition ─────────────────────────────────────────────────────────
// To add a new route: add an entry to adminRoutes or clientRoutes.
// The sidebar, ProtectedRoute, and route logger all derive from this config.
export interface RouteDefinition {
  path: string;
  label: string;
  icon: LucideIcon;
  // Whether to show in the sidebar nav (some routes are sub-pages)
  inNav: boolean;
}

// ─── Admin Routes ─────────────────────────────────────────────────────────────
export const adminRoutes: RouteDefinition[] = [
  { path: "/admin/dashboard",    label: "Dashboard",   icon: LayoutDashboard, inNav: true  },
  { path: "/admin/clients",      label: "Clients",     icon: Users,           inNav: true  },
  // Master pages
  { path: "/admin/domains",      label: "Domains",     icon: Globe,           inNav: true  },
  { path: "/admin/hosting",      label: "Hosting",     icon: Globe2,          inNav: true  },
  { path: "/admin/orders",       label: "Orders",      icon: ShoppingCart,    inNav: true  },
  { path: "/admin/support",      label: "Support",     icon: LifeBuoy,        inNav: true  },
  { path: "/admin/finance",      label: "Finance",     icon: DollarSign,      inNav: true  },
  { path: "/admin/servers",      label: "Servers",     icon: Server,          inNav: true  },
  { path: "/admin/analytics",    label: "Analytics",   icon: BarChart3,       inNav: true  },
  { path: "/admin/system",       label: "System",      icon: Settings,        inNav: true  },
  { path: "/admin/ip-unblocker", label: "IP Unblocker", icon: ShieldCheck,    inNav: true  },
  // Sub-page forms (not in nav)
  { path: "/admin/clients/add",            label: "Add Client",     icon: UserPlus,     inNav: false },
  { path: "/admin/clients/:id/edit",       label: "Edit Client",    icon: Users,        inNav: false },
  { path: "/admin/clients/:id",            label: "Client",         icon: Users,        inNav: false },
  { path: "/admin/packages/add",           label: "Add Package",    icon: Package,      inNav: false },
  { path: "/admin/packages/:id/edit",      label: "Edit Package",   icon: Package,      inNav: false },
  { path: "/admin/orders/add",             label: "Create Order",   icon: ShoppingCart, inNav: false },
  { path: "/admin/invoices/add",           label: "Create Invoice", icon: FileText,     inNav: false },
  { path: "/admin/tickets/:id",            label: "Ticket",         icon: Ticket,       inNav: false },
  { path: "/admin/knowledge-base/new",     label: "New Article",    icon: BookOpen,     inNav: false },
  { path: "/admin/knowledge-base/edit/:id", label: "Edit Article",  icon: BookOpen,     inNav: false },
  { path: "/admin/vps/add",                label: "Add VPS Plan",   icon: Server,       inNav: false },
  { path: "/admin/vps/:id/edit",           label: "Edit VPS Plan",  icon: Server,       inNav: false },
  { path: "/admin/vps/os-templates",       label: "OS Templates",   icon: Server,       inNav: false },
];

// ─── Client Routes ────────────────────────────────────────────────────────────
export const clientRoutes: RouteDefinition[] = [
  { path: "/client/dashboard",   label: "Dashboard",   icon: LayoutDashboard, inNav: true  },
  { path: "/client/hosting",     label: "My Hosting",  icon: Server,          inNav: true  },
  { path: "/client/domains",       label: "My Domains",    icon: Globe,    inNav: true  },
  { path: "/client/domain-search", label: "Domain Search", icon: Search,   inNav: true  },
  { path: "/client/billing",      label: "Billing",     icon: Receipt,         inNav: true  },
  { path: "/client/invoices/:id", label: "Invoice",   icon: FileText,        inNav: false },
  { path: "/client/orders",      label: "Orders",      icon: ShoppingCart,    inNav: true  },
  { path: "/client/tickets",     label: "Support",     icon: Ticket,          inNav: true  },
  { path: "/client/tickets/:id", label: "Ticket",      icon: Ticket,          inNav: false },
  { path: "/client/migrations",  label: "Migrations",  icon: ArrowRightLeft,  inNav: true  },
  { path: "/client/orders/new",  label: "New Order",   icon: ShoppingCart,    inNav: false },
  { path: "/client/checkout",    label: "Checkout",    icon: CreditCard,      inNav: false },
  { path: "/client/account",           label: "Account",         icon: UserIcon,        inNav: true  },
  { path: "/client/affiliate",          label: "Affiliate",       icon: Share2,          inNav: false },
  { path: "/client/credits",            label: "Credits",         icon: Wallet,          inNav: false },
  { path: "/client/security",            label: "Security",        icon: ShieldCheck,     inNav: true  },
  { path: "/client/domains/transfer",   label: "Transfer Domain", icon: RefreshCw,       inNav: false },
  { path: "/help",                       label: "Help Center",     icon: HelpCircle,      inNav: true  },
];

// ─── Role → Route Map ─────────────────────────────────────────────────────────
export const routesByRole: Record<"admin" | "client", RouteDefinition[]> = {
  admin: adminRoutes,
  client: clientRoutes,
};

// Default landing per role (used by guards and root redirect)
export const dashboardByRole: Record<"admin" | "client", string> = {
  admin: "/admin/dashboard",
  client: "/client/dashboard",
};
