import {
  LayoutDashboard,
  Users,
  Server,
  Globe,
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
  { path: "/admin/dashboard",          label: "Dashboard",       icon: LayoutDashboard, inNav: true  },
  { path: "/admin/clients",               label: "Clients",            icon: Users,        inNav: true  },
  { path: "/admin/clients/add",           label: "Add Client",         icon: UserPlus,     inNav: false },
  { path: "/admin/clients/:id/edit",      label: "Edit Client",        icon: Users,        inNav: false },
  { path: "/admin/clients/:id",           label: "Client",             icon: Users,        inNav: false },
  { path: "/admin/hosting",               label: "Hosting",            icon: Server,       inNav: true  },
  { path: "/admin/domains",               label: "Domains",            icon: Globe,        inNav: true  },
  { path: "/admin/domains/extensions",    label: "TLD Management",     icon: Globe,        inNav: true  },
  { path: "/admin/packages",              label: "Packages",           icon: Package,      inNav: true  },
  { path: "/admin/packages/add",          label: "Add Package",        icon: Package,      inNav: false },
  { path: "/admin/packages/:id/edit",     label: "Edit Package",       icon: Package,      inNav: false },
  { path: "/admin/orders",                label: "Orders",             icon: ShoppingCart, inNav: true  },
  { path: "/admin/orders/add",            label: "Create Order",       icon: ShoppingCart, inNav: false },
  { path: "/admin/invoices",              label: "Invoices",           icon: FileText,     inNav: true  },
  { path: "/admin/invoices/add",          label: "Create Invoice",     icon: FileText,     inNav: false },
  { path: "/admin/tickets",               label: "Tickets",            icon: Ticket,       inNav: true  },
  { path: "/admin/tickets/:id",           label: "Ticket",             icon: Ticket,       inNav: false },
  { path: "/admin/migrations",            label: "Migrations",         icon: Send,         inNav: true  },
  { path: "/admin/promo-codes",           label: "Promo Codes",        icon: Tag,          inNav: true  },
  { path: "/admin/payment-methods",       label: "Payment Methods",    icon: CreditCard,   inNav: true  },
  { path: "/admin/currencies",            label: "Currencies",         icon: DollarSign,   inNav: true  },
  { path: "/admin/servers",               label: "Servers",            icon: Server,       inNav: true  },
  { path: "/admin/cancellation-requests",  label: "Cancellations",      icon: AlertTriangle, inNav: true },
  { path: "/admin/modules",               label: "Modules",            icon: Puzzle,       inNav: true  },
  { path: "/admin/reports",               label: "Reports",            icon: BarChart3,    inNav: true  },
  { path: "/admin/product-groups",        label: "Product Groups",     icon: Layers,       inNav: true  },
  { path: "/admin/email-templates",       label: "Email Templates",    icon: Mail,         inNav: true  },
  { path: "/admin/transactions",           label: "Transactions",       icon: Receipt,      inNav: true  },
  { path: "/admin/fraud-logs",             label: "Fraud Logs",         icon: ShieldAlert,  inNav: true  },
  { path: "/admin/server-logs",           label: "Server Logs",        icon: Server,       inNav: true  },
  { path: "/admin/cron-logs",             label: "Automation",         icon: Clock,        inNav: true  },
  { path: "/admin/settings",              label: "Settings",           icon: Settings,     inNav: true  },
  { path: "/admin/settings/email",         label: "Email Configuration", icon: Mail,         inNav: false },
  { path: "/admin/settings/google",        label: "Google OAuth",        icon: ShieldAlert,  inNav: false },
  { path: "/admin/affiliates",             label: "Affiliates",          icon: Share2,       inNav: true  },
  { path: "/admin/domain-transfers",       label: "Domain Transfers",    icon: RefreshCw,    inNav: true  },
];

// ─── Client Routes ────────────────────────────────────────────────────────────
export const clientRoutes: RouteDefinition[] = [
  { path: "/client/dashboard",   label: "Dashboard",   icon: LayoutDashboard, inNav: true  },
  { path: "/client/hosting",     label: "My Hosting",  icon: Server,          inNav: true  },
  { path: "/client/domains",     label: "My Domains",  icon: Globe,           inNav: true  },
  { path: "/client/invoices",    label: "Invoices",    icon: FileText,        inNav: true  },
  { path: "/client/invoices/:id", label: "Invoice",   icon: FileText,        inNav: false },
  { path: "/client/orders",      label: "Orders",      icon: ShoppingCart,    inNav: true  },
  { path: "/client/tickets",     label: "Support",     icon: Ticket,          inNav: true  },
  { path: "/client/tickets/:id", label: "Ticket",      icon: Ticket,          inNav: false },
  { path: "/client/migrations",  label: "Migrations",  icon: ArrowRightLeft,  inNav: true  },
  { path: "/client/orders/new",  label: "New Order",   icon: ShoppingCart,    inNav: false },
  { path: "/client/checkout",    label: "Checkout",    icon: CreditCard,      inNav: false },
  { path: "/client/account",           label: "Account",         icon: UserIcon,        inNav: true  },
  { path: "/client/affiliate",          label: "Affiliate",       icon: Share2,          inNav: true  },
  { path: "/client/credits",            label: "Credits",         icon: Wallet,          inNav: true  },
  { path: "/client/domains/transfer",   label: "Transfer Domain", icon: RefreshCw,       inNav: false },
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
