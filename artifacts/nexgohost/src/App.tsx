import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";

// Auth pages
import Login from "@/pages/auth/Login";
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

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: "admin" | "client" }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (role && user.role !== role) {
    return <Redirect to={user.role === "admin" ? "/admin/dashboard" : "/client/dashboard"} />;
  }

  return <>{children}</>;
}

function AdminRoutes() {
  return (
    <AppLayout role="admin">
      <Switch>
        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route path="/admin/clients/:id" component={AdminClientDetail} />
        <Route path="/admin/clients" component={AdminClients} />
        <Route path="/admin/hosting" component={AdminHosting} />
        <Route path="/admin/domains" component={AdminDomains} />
        <Route path="/admin/orders" component={AdminOrders} />
        <Route path="/admin/invoices" component={AdminInvoices} />
        <Route path="/admin/tickets/:id" component={AdminTicketDetail} />
        <Route path="/admin/tickets" component={AdminTickets} />
        <Route path="/admin/migrations" component={AdminMigrations} />
        <Route path="/admin/settings" component={AdminSettings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function ClientRoutes() {
  return (
    <AppLayout role="client">
      <Switch>
        <Route path="/client/dashboard" component={ClientDashboard} />
        <Route path="/client/hosting" component={ClientHosting} />
        <Route path="/client/domains" component={ClientDomains} />
        <Route path="/client/invoices" component={ClientInvoices} />
        <Route path="/client/tickets/:id" component={ClientTicketDetail} />
        <Route path="/client/tickets" component={ClientTickets} />
        <Route path="/client/migrations" component={ClientMigrations} />
        <Route path="/client/account" component={ClientAccount} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function RouterRoot() {
  const { user, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
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
      <Route path="/">
        {!isLoading && user ? (
          <Redirect to={user.role === "admin" ? "/admin/dashboard" : "/client/dashboard"} />
        ) : !isLoading ? (
          <Redirect to="/login" />
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
