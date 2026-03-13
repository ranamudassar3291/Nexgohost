import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthProvider";
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
import AdminHosting from "@/pages/admin/Hosting";
import AdminDomains from "@/pages/admin/Domains";
import AdminOrders from "@/pages/admin/Orders";
import AdminInvoices from "@/pages/admin/Invoices";
import AdminTickets from "@/pages/admin/Tickets";
import AdminTicketDetail from "@/pages/admin/TicketDetail";
import AdminMigrations from "@/pages/admin/Migrations";
import AdminSettings from "@/pages/admin/Settings";

// Client pages
import ClientDashboard from "@/pages/client/Dashboard";
import ClientHosting from "@/pages/client/Hosting";
import ClientDomains from "@/pages/client/Domains";
import ClientInvoices from "@/pages/client/Invoices";
import ClientTickets from "@/pages/client/Tickets";
import ClientTicketDetail from "@/pages/client/TicketDetail";
import ClientMigrations from "@/pages/client/Migrations";
import ClientAccount from "@/pages/client/Account";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
// Guards a subtree by authentication and optional role.
//
// Behaviors:
//   • Not logged in + attempting /admin/* → redirect to /admin/login
//   • Not logged in + attempting /client/* → redirect to /client/login
//   • Not logged in + other              → redirect to /client/login (default)
//   • Logged in, wrong role              → show 403 Forbidden page
//   • Logged in, correct role            → render children
function ProtectedRoute({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: "admin" | "client";
}) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    // Send the user to the login page that matches the section they tried to reach
    const loginPath =
      location.startsWith("/admin") ? "/admin/login" : "/client/login";
    return <Redirect to={loginPath} />;
  }

  if (role && user.role !== role) {
    return <Forbidden requiredRole={role} attemptedPath={location} />;
  }

  return <>{children}</>;
}

// ─── Admin Route Tree ─────────────────────────────────────────────────────────
function AdminRoutes() {
  return (
    <AppLayout role="admin">
      <Switch>
        <Route path="/admin/dashboard"    component={AdminDashboard}    />
        <Route path="/admin/clients/:id"  component={AdminClientDetail} />
        <Route path="/admin/clients"      component={AdminClients}      />
        <Route path="/admin/hosting"      component={AdminHosting}      />
        <Route path="/admin/domains"      component={AdminDomains}      />
        <Route path="/admin/orders"       component={AdminOrders}       />
        <Route path="/admin/invoices"     component={AdminInvoices}     />
        <Route path="/admin/tickets/:id"  component={AdminTicketDetail} />
        <Route path="/admin/tickets"      component={AdminTickets}      />
        <Route path="/admin/migrations"   component={AdminMigrations}   />
        <Route path="/admin/settings"     component={AdminSettings}     />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

// ─── Client Route Tree ────────────────────────────────────────────────────────
function ClientRoutes() {
  return (
    <AppLayout role="client">
      <Switch>
        <Route path="/client/dashboard"    component={ClientDashboard}    />
        <Route path="/client/hosting"      component={ClientHosting}      />
        <Route path="/client/domains"      component={ClientDomains}      />
        <Route path="/client/invoices"     component={ClientInvoices}     />
        <Route path="/client/tickets/:id"  component={ClientTicketDetail} />
        <Route path="/client/tickets"      component={ClientTickets}      />
        <Route path="/client/migrations"   component={ClientMigrations}   />
        <Route path="/client/account"      component={ClientAccount}      />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

// ─── Router Root ──────────────────────────────────────────────────────────────
function RouterRoot() {
  const { user, isLoading } = useAuth();
  useRouteLogger();

  return (
    <Switch>
      {/* ── Portal login pages ── */}
      <Route path="/admin/login"  component={AdminLogin}  />
      <Route path="/client/login" component={ClientLogin} />
      <Route path="/register"     component={Register}    />

      {/* Legacy /login → redirect to the appropriate portal */}
      <Route path="/login">
        {!isLoading && user ? (
          <Redirect to={user.role === "admin" ? "/admin/dashboard" : "/client/dashboard"} />
        ) : (
          <Redirect to="/client/login" />
        )}
      </Route>

      {/* ── Protected sections ── */}
      <Route path="/admin/:rest*">
        <ProtectedRoute role="admin">
          <AdminRoutes />
        </ProtectedRoute>
      </Route>

      <Route path="/client/:rest*">
        <ProtectedRoute role="client">
          <ClientRoutes />
        </ProtectedRoute>
      </Route>

      {/* Root redirect → send authenticated users to their dashboard */}
      <Route path="/">
        {!isLoading && user ? (
          <Redirect to={user.role === "admin" ? "/admin/dashboard" : "/client/dashboard"} />
        ) : !isLoading ? (
          <Redirect to="/client/login" />
        ) : (
          <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
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
            <RouterRoot />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
