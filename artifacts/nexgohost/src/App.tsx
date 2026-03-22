import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthProvider";
import { CurrencyProvider } from "@/context/CurrencyProvider";
import { CartProvider } from "@/context/CartContext";
import { useAuth } from "@/hooks/use-auth";
import { useRouteLogger } from "@/hooks/use-route-logger";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";
import Forbidden from "@/pages/errors/Forbidden";

// Auth pages
import AdminLogin from "@/pages/auth/AdminLogin";
import ClientLogin from "@/pages/auth/ClientLogin";
import Register from "@/pages/auth/Register";

// Admin pages
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminClients from "@/pages/admin/Clients";
import AdminClientDetail from "@/pages/admin/ClientDetail";
import AddClient from "@/pages/admin/AddClient";
import EditClient from "@/pages/admin/EditClient";
import AdminHosting from "@/pages/admin/Hosting";
import AdminDomains from "@/pages/admin/Domains";
import AdminPackages from "@/pages/admin/Packages";
import AddPackage from "@/pages/admin/AddPackage";
import EditPackage from "@/pages/admin/EditPackage";
import AdminOrders from "@/pages/admin/Orders";
import AddOrder from "@/pages/admin/AddOrder";
import AdminInvoices from "@/pages/admin/Invoices";
import AddInvoice from "@/pages/admin/AddInvoice";
import AdminTickets from "@/pages/admin/Tickets";
import AdminTicketDetail from "@/pages/admin/TicketDetail";
import AdminMigrations from "@/pages/admin/Migrations";
import AdminSettings from "@/pages/admin/Settings";
import EmailConfiguration from "@/pages/admin/EmailConfiguration";
import GoogleOAuth from "@/pages/admin/GoogleOAuth";
import AdminPromoCodes from "@/pages/admin/PromoCodes";
import AdminPaymentMethods from "@/pages/admin/PaymentMethods";
import DomainExtensions from "@/pages/admin/DomainExtensions";
import Currencies from "@/pages/admin/Currencies";
import Servers from "@/pages/admin/Servers";
import Modules from "@/pages/admin/Modules";
import AdminReports from "@/pages/admin/Reports";
import AdminTransactions from "@/pages/admin/Transactions";
import CancellationRequests from "@/pages/admin/CancellationRequests";
import ProductGroups from "@/pages/admin/ProductGroups";
import EmailTemplates from "@/pages/admin/EmailTemplates";
import FraudLogs from "@/pages/admin/FraudLogs";
import CronLogs from "@/pages/admin/CronLogs";
import ServerLogs from "@/pages/admin/ServerLogs";

// Client pages
import ClientDashboard from "@/pages/client/Dashboard";
import ClientHosting from "@/pages/client/Hosting";
import ClientServiceDetail from "@/pages/client/ServiceDetail";
import ClientDomains from "@/pages/client/Domains";
import ClientInvoices from "@/pages/client/Invoices";
import ClientTickets from "@/pages/client/Tickets";
import ClientTicketDetail from "@/pages/client/TicketDetail";
import ClientMigrations from "@/pages/client/Migrations";
import ClientAccount from "@/pages/client/Account";
import NewOrder from "@/pages/client/NewOrder";
import Checkout from "@/pages/client/Checkout";
import Cart from "@/pages/client/Cart";
import InvoiceDetail from "@/pages/client/InvoiceDetail";
import ClientOrders from "@/pages/client/Orders";
import Homepage from "@/pages/public/Homepage";
import GoogleCallback from "@/pages/auth/GoogleCallback";

import { queryClient } from "@/lib/query-client";

// ─── Auth Guard Helpers ───────────────────────────────────────────────────────
// Used inline per-route to avoid nested Switch context issues in Wouter v3.
// Each route wraps its page component directly in AdminPage or ClientPage.

function AdminPage({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  if (!user) return <Redirect to="/admin/login" />;
  if (user.role !== "admin") return <Forbidden requiredRole="admin" attemptedPath={location} />;
  return <AppLayout role="admin">{children}</AppLayout>;
}

function ClientPage({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  if (!user) return <Redirect to="/client/login" />;
  if (user.role !== "client") return <Forbidden requiredRole="client" attemptedPath={location} />;
  return <AppLayout role="client">{children}</AppLayout>;
}

// ─── Router Root ──────────────────────────────────────────────────────────────
// FLAT route tree — no nested Switch wildcards.
// Wouter v3 strips the matched prefix in nested Switches (wildcard routes),
// causing multi-segment paths like /admin/packages/add to match incorrectly.
// Solution: all routes live in one flat Switch, each guarded inline.
function RouterRoot() {
  const { user, isLoading } = useAuth();
  useRouteLogger();

  return (
    <Switch>
      {/* ── Auth pages ── */}
      <Route path="/admin/login"  component={AdminLogin}  />
      <Route path="/client/login" component={ClientLogin} />
      <Route path="/register"     component={Register}    />

      <Route path="/login">
        {!isLoading && user ? (
          <Redirect to={user.role === "admin" ? "/admin/dashboard" : "/client/dashboard"} />
        ) : (
          <Redirect to="/client/login" />
        )}
      </Route>

      {/* ── Admin routes (each individually guarded) ── */}
      <Route path="/admin/dashboard">
        <AdminPage><AdminDashboard /></AdminPage>
      </Route>
      <Route path="/admin/clients/add">
        <AdminPage><AddClient /></AdminPage>
      </Route>
      <Route path="/admin/clients/:id/edit">
        <AdminPage><EditClient /></AdminPage>
      </Route>
      <Route path="/admin/clients/:id">
        <AdminPage><AdminClientDetail /></AdminPage>
      </Route>
      <Route path="/admin/clients">
        <AdminPage><AdminClients /></AdminPage>
      </Route>
      <Route path="/admin/hosting">
        <AdminPage><AdminHosting /></AdminPage>
      </Route>
      <Route path="/admin/domains">
        <AdminPage><AdminDomains /></AdminPage>
      </Route>
      <Route path="/admin/packages/add">
        <AdminPage><AddPackage /></AdminPage>
      </Route>
      <Route path="/admin/packages/:id/edit">
        <AdminPage><EditPackage /></AdminPage>
      </Route>
      <Route path="/admin/packages">
        <AdminPage><AdminPackages /></AdminPage>
      </Route>
      <Route path="/admin/orders/add">
        <AdminPage><AddOrder /></AdminPage>
      </Route>
      <Route path="/admin/orders">
        <AdminPage><AdminOrders /></AdminPage>
      </Route>
      <Route path="/admin/invoices/add">
        <AdminPage><AddInvoice /></AdminPage>
      </Route>
      <Route path="/admin/invoices">
        <AdminPage><AdminInvoices /></AdminPage>
      </Route>
      <Route path="/admin/tickets/:id">
        <AdminPage><AdminTicketDetail /></AdminPage>
      </Route>
      <Route path="/admin/tickets">
        <AdminPage><AdminTickets /></AdminPage>
      </Route>
      <Route path="/admin/migrations">
        <AdminPage><AdminMigrations /></AdminPage>
      </Route>
      <Route path="/admin/promo-codes">
        <AdminPage><AdminPromoCodes /></AdminPage>
      </Route>
      <Route path="/admin/payment-methods">
        <AdminPage><AdminPaymentMethods /></AdminPage>
      </Route>
      <Route path="/admin/domains/extensions">
        <AdminPage><DomainExtensions /></AdminPage>
      </Route>
      <Route path="/admin/currencies">
        <AdminPage><Currencies /></AdminPage>
      </Route>
      <Route path="/admin/servers">
        <AdminPage><Servers /></AdminPage>
      </Route>
      <Route path="/admin/modules">
        <AdminPage><Modules /></AdminPage>
      </Route>
      <Route path="/admin/reports">
        <AdminPage><AdminReports /></AdminPage>
      </Route>
      <Route path="/admin/transactions">
        <AdminPage><AdminTransactions /></AdminPage>
      </Route>
      <Route path="/admin/cancellation-requests">
        <AdminPage><CancellationRequests /></AdminPage>
      </Route>
      <Route path="/admin/product-groups">
        <AdminPage><ProductGroups /></AdminPage>
      </Route>
      <Route path="/admin/email-templates">
        <AdminPage><EmailTemplates /></AdminPage>
      </Route>
      <Route path="/admin/fraud-logs">
        <AdminPage><FraudLogs /></AdminPage>
      </Route>
      <Route path="/admin/server-logs">
        <AdminPage><ServerLogs /></AdminPage>
      </Route>
      <Route path="/admin/cron-logs">
        <AdminPage><CronLogs /></AdminPage>
      </Route>
      <Route path="/admin/settings/email">
        <AdminPage><EmailConfiguration /></AdminPage>
      </Route>
      <Route path="/admin/settings/google">
        <AdminPage><GoogleOAuth /></AdminPage>
      </Route>
      <Route path="/admin/settings">
        <AdminPage><AdminSettings /></AdminPage>
      </Route>

      {/* ── Client routes (each individually guarded) ── */}
      <Route path="/client/dashboard">
        <ClientPage><ClientDashboard /></ClientPage>
      </Route>
      <Route path="/client/hosting/:id">
        <ClientPage><ClientServiceDetail /></ClientPage>
      </Route>
      <Route path="/client/hosting">
        <ClientPage><ClientHosting /></ClientPage>
      </Route>
      <Route path="/client/domains">
        <ClientPage><ClientDomains /></ClientPage>
      </Route>
      <Route path="/client/invoices/:id">
        <ClientPage><InvoiceDetail /></ClientPage>
      </Route>
      <Route path="/client/invoices">
        <ClientPage><ClientInvoices /></ClientPage>
      </Route>
      <Route path="/client/tickets/:id">
        <ClientPage><ClientTicketDetail /></ClientPage>
      </Route>
      <Route path="/client/tickets">
        <ClientPage><ClientTickets /></ClientPage>
      </Route>
      <Route path="/client/migrations">
        <ClientPage><ClientMigrations /></ClientPage>
      </Route>
      <Route path="/client/orders/new">
        <ClientPage><NewOrder /></ClientPage>
      </Route>
      <Route path="/client/orders">
        <ClientPage><ClientOrders /></ClientPage>
      </Route>
      <Route path="/client/cart">
        <ClientPage><Cart /></ClientPage>
      </Route>
      <Route path="/client/checkout">
        <ClientPage><Checkout /></ClientPage>
      </Route>
      <Route path="/client/account">
        <ClientPage><ClientAccount /></ClientPage>
      </Route>
      {/* ── Route aliases ── */}
      <Route path="/client/services">
        <ClientPage><ClientHosting /></ClientPage>
      </Route>
      <Route path="/client/profile">
        <ClientPage><ClientAccount /></ClientPage>
      </Route>
      <Route path="/admin/products">
        <AdminPage><AdminPackages /></AdminPage>
      </Route>
      <Route path="/admin/payments">
        <AdminPage><AdminPaymentMethods /></AdminPage>
      </Route>
      <Route path="/admin/promos">
        <AdminPage><AdminPromoCodes /></AdminPage>
      </Route>
      <Route path="/admin/domain-extensions">
        <AdminPage><DomainExtensions /></AdminPage>
      </Route>

      {/* ── OAuth callback — public ── */}
      <Route path="/google-callback" component={GoogleCallback} />

      {/* Root: Homepage for guests, dashboard for logged-in users */}
      <Route path="/">
        {isLoading ? (
          <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : user ? (
          <Redirect to={user.role === "admin" ? "/admin/dashboard" : "/client/dashboard"} />
        ) : (
          <Homepage />
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <CurrencyProvider>
              <CartProvider>
                <RouterRoot />
              </CartProvider>
            </CurrencyProvider>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
