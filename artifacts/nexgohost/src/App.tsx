import { Switch, Route, Router as WouterRouter, useLocation, useParams, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthProvider";
import { CurrencyProvider } from "@/context/CurrencyProvider";
import { CartProvider } from "@/context/CartContext";
import { useAuth } from "@/hooks/use-auth";
import { useRouteLogger } from "@/hooks/use-route-logger";
import { AppLayout } from "@/components/layout/AppLayout";
import { CheckoutLayout } from "@/components/layout/CheckoutLayout";
import NotFound from "@/pages/not-found";
import Forbidden from "@/pages/errors/Forbidden";

// Auth pages
import AdminLogin from "@/pages/auth/AdminLogin";
import ClientLogin from "@/pages/auth/ClientLogin";
import Register from "@/pages/auth/Register";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";

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
import WhmcsImport from "@/pages/admin/WhmcsImport";
import AdminSettings from "@/pages/admin/Settings";
import EmailConfiguration from "@/pages/admin/EmailConfiguration";
import GoogleOAuth from "@/pages/admin/GoogleOAuth";
import AdminPromoCodes from "@/pages/admin/PromoCodes";
import AdminPaymentMethods from "@/pages/admin/PaymentMethods";
import DomainExtensions from "@/pages/admin/DomainExtensions";
import Currencies from "@/pages/admin/Currencies";
import Servers from "@/pages/admin/Servers";
import Modules from "@/pages/admin/Modules";
import DomainRegistrars from "@/pages/admin/DomainRegistrars";
import WhatsAppSettings from "@/pages/admin/WhatsAppSettings";
import AdminReports from "@/pages/admin/Reports";
import AdminTransactions from "@/pages/admin/Transactions";
import CancellationRequests from "@/pages/admin/CancellationRequests";
import ProductGroups from "@/pages/admin/ProductGroups";
import EmailTemplates from "@/pages/admin/EmailTemplates";
import FraudLogs from "@/pages/admin/FraudLogs";
import AutomationSettings from "@/pages/admin/AutomationSettings";
import SecuritySettings from "@/pages/admin/SecuritySettings";
import AdminBackups from "@/pages/admin/Backups";
import Firewall from "@/pages/admin/Firewall";
import ServerLogs from "@/pages/admin/ServerLogs";
import AdminAffiliates from "@/pages/admin/Affiliates";
import AdminDomainTransfers from "@/pages/admin/DomainTransfers";
import AdminCredits from "@/pages/admin/Credits";
import EmailMarketing from "@/pages/admin/EmailMarketing";
import VpsPlans from "@/pages/admin/VpsPlans";
import VpsServices from "@/pages/admin/VpsServices";
import AddVpsPlan from "@/pages/admin/AddVpsPlan";
import VpsOsTemplates from "@/pages/admin/VpsOsTemplates";
import VpsLocations from "@/pages/admin/VpsLocations";
import AdminUsers from "@/pages/admin/AdminUsers";
import KnowledgeBase from "@/pages/admin/KnowledgeBase";
import KbArticleEditor from "@/pages/admin/KbArticleEditor";
import ApiSettings from "@/pages/admin/ApiSettings";
import ApiDocs from "@/pages/admin/ApiDocs";
import Announcements from "@/pages/admin/Announcements";
import ServerNodes from "@/pages/admin/ServerNodes";
import Status from "@/pages/public/Status";

// Client pages
import ClientDashboard from "@/pages/client/Dashboard";
import ClientHosting from "@/pages/client/Hosting";
import ClientServiceDetail from "@/pages/client/ServiceDetail";
import ClientDomains from "@/pages/client/Domains";
import DomainManage from "@/pages/client/DomainManage";
import ClientInvoices from "@/pages/client/Invoices";
import ClientTickets from "@/pages/client/Tickets";
import ClientTicketDetail from "@/pages/client/TicketDetail";
import ClientMigrations from "@/pages/client/Migrations";
import ClientAccount from "@/pages/client/Account";
import NewOrder from "@/pages/client/NewOrder";
import Checkout from "@/pages/client/Checkout";
import Cart from "@/pages/client/Cart";
import InvoiceDetail from "@/pages/client/InvoiceDetail";
import SafepayReturn from "@/pages/client/SafepayReturn";
import ClientOrders from "@/pages/client/Orders";
import Affiliate from "@/pages/client/Affiliate";
import Credits from "@/pages/client/Credits";
import Security from "@/pages/client/Security";
import DomainTransfer from "@/pages/client/DomainTransfer";
import DomainDns from "@/pages/client/DomainDns";
import DomainSearch from "@/pages/client/DomainSearch";
import VpsManage from "@/pages/client/VpsManage";
import HelpCenter from "@/pages/client/HelpCenter";
import HelpCenterArticle from "@/pages/client/HelpCenterArticle";
import VpsHosting from "@/pages/public/VpsHosting";
import OrderFlow from "@/pages/public/OrderFlow";
import TermsOfService from "@/pages/public/TermsOfService";
import PrivacyPolicy from "@/pages/public/PrivacyPolicy";
import RefundPolicy from "@/pages/public/RefundPolicy";
import Contact from "@/pages/public/Contact";
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

// Public Help Center — visible to everyone; logged-in clients get full sidebar layout
function HelpPage({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  if (user?.role === "client") return <AppLayout role="client">{children}</AppLayout>;
  // Guest or admin: render with a minimal public header
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/client/login" className="flex items-center gap-2 font-bold text-primary text-lg">Noehost</a>
          <div className="flex gap-3">
            <a href="/client/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign In</a>
            <a href="/order" className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">Get Hosting</a>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

// ─── Direct Order-Link wrappers ───────────────────────────────────────────────
// /order/group/:groupId  — shows only plans in that group (like WHMCS ?gid=1)
// /order/add/:packageId  — auto-selects plan + skips to domain step (?pid=5)
// /order/config/index.php?pid=ID — WHMCS-style clean link (reads ?pid query param)
// All are publicly accessible (allowGuest=true) — auth only required at submit.
function OrderByGroup() {
  const { groupId } = useParams<{ groupId: string }>();
  return <CheckoutLayout allowGuest><NewOrder initialGroupId={groupId}/></CheckoutLayout>;
}

function OrderByPackage() {
  const { packageId } = useParams<{ packageId: string }>();
  return <CheckoutLayout allowGuest><NewOrder initialPackageId={packageId}/></CheckoutLayout>;
}

// WHMCS-style: /order/config/index.php?pid=UUID
function OrderByPid() {
  const pid = new URLSearchParams(window.location.search).get("pid") ?? "";
  return <CheckoutLayout allowGuest><NewOrder initialPackageId={pid}/></CheckoutLayout>;
}

// VPS direct-link: /order/vps/:planId — pre-select a VPS plan
function OrderByVpsPlan() {
  const { planId } = useParams<{ planId: string }>();
  return <CheckoutLayout allowGuest><NewOrder initialVpsPlanId={planId}/></CheckoutLayout>;
}

// WHMCS-style VPS: /order/config/index.php?vps_id=UUID
function OrderByVpsId() {
  const vpsId = new URLSearchParams(window.location.search).get("vps_id") ?? "";
  return <CheckoutLayout allowGuest><NewOrder initialVpsPlanId={vpsId}/></CheckoutLayout>;
}

// WHMCS-style cart URL: /cart?a=add&pid=UUID  — direct order link
// Also handles ?gid=UUID for group-based ordering
function WhmcsCartRedirect() {
  const params = new URLSearchParams(window.location.search);
  const pid    = params.get("pid")  ?? "";
  const gid    = params.get("gid")  ?? "";
  const action = params.get("a")    ?? "";

  if (action === "add" && pid) {
    return <CheckoutLayout allowGuest><NewOrder initialPackageId={pid}/></CheckoutLayout>;
  }
  if (gid) {
    return <CheckoutLayout allowGuest><NewOrder initialGroupId={gid}/></CheckoutLayout>;
  }
  // Fallback: go to the public order wizard
  window.location.replace("/order");
  return null;
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
      <Route path="/admin/login"      component={AdminLogin}      />
      <Route path="/client/login"     component={ClientLogin}     />
      <Route path="/register"         component={Register}        />
      <Route path="/forgot-password"  component={ForgotPassword}  />
      <Route path="/reset-password"   component={ResetPassword}   />
      <Route path="/vps"              component={VpsHosting}      />
      <Route path="/order"            component={OrderFlow}       />

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
      <Route path="/admin/whmcs-import">
        <AdminPage><WhmcsImport /></AdminPage>
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
      <Route path="/admin/domain-registrars">
        <AdminPage><DomainRegistrars /></AdminPage>
      </Route>
      <Route path="/admin/whatsapp">
        <AdminPage><WhatsAppSettings /></AdminPage>
      </Route>
      <Route path="/admin/vps/add">
        <AdminPage><AddVpsPlan /></AdminPage>
      </Route>
      <Route path="/admin/vps/:id/edit">
        <AdminPage><AddVpsPlan /></AdminPage>
      </Route>
      <Route path="/admin/vps/services">
        <AdminPage><VpsServices /></AdminPage>
      </Route>
      <Route path="/admin/vps/os-templates">
        <AdminPage><VpsOsTemplates /></AdminPage>
      </Route>
      <Route path="/admin/vps/locations">
        <AdminPage><VpsLocations /></AdminPage>
      </Route>
      <Route path="/admin/vps">
        <AdminPage><VpsPlans /></AdminPage>
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
        <AdminPage><AutomationSettings /></AdminPage>
      </Route>
      <Route path="/admin/security">
        <AdminPage><SecuritySettings /></AdminPage>
      </Route>
      <Route path="/admin/backups">
        <AdminPage><AdminBackups /></AdminPage>
      </Route>
      <Route path="/admin/firewall">
        <AdminPage><Firewall /></AdminPage>
      </Route>
      <Route path="/admin/settings/email">
        <AdminPage><EmailConfiguration /></AdminPage>
      </Route>
      <Route path="/admin/settings/google">
        <AdminPage><GoogleOAuth /></AdminPage>
      </Route>
      <Route path="/admin/api-settings">
        <AdminPage><ApiSettings /></AdminPage>
      </Route>
      <Route path="/admin/api-docs">
        <AdminPage><ApiDocs /></AdminPage>
      </Route>
      <Route path="/admin/settings">
        <AdminPage><AdminSettings /></AdminPage>
      </Route>

      {/* ── Client routes (each individually guarded) ── */}
      <Route path="/client/dashboard">
        <ClientPage><ClientDashboard /></ClientPage>
      </Route>
      <Route path="/client/vps/:id">
        <ClientPage><VpsManage /></ClientPage>
      </Route>
      <Route path="/client/hosting/:id">
        <ClientPage><ClientServiceDetail /></ClientPage>
      </Route>
      <Route path="/client/hosting">
        <ClientPage><ClientHosting /></ClientPage>
      </Route>
      <Route path="/client/domains/manage/:id">
        <ClientPage><DomainManage /></ClientPage>
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
      <Route path="/client/payment/return">
        <ClientPage><SafepayReturn /></ClientPage>
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
      {/* Direct order-link routes — like WHMCS ?gid=1 / ?pid=5 */}
      <Route path="/order/group/:groupId" component={OrderByGroup}/>
      <Route path="/order/add/:packageId" component={OrderByPackage}/>
      {/* WHMCS-style clean URL: /order/config/index.php?pid=UUID */}
      <Route path="/order/config/index.php" component={OrderByPid}/>
      {/* VPS direct links: /order/vps/:planId and ?vps_id=UUID */}
      <Route path="/order/vps/:planId" component={OrderByVpsPlan}/>
      <Route path="/order/vps" component={OrderByVpsId}/>
      {/* WHMCS cart-style URL: /cart?a=add&pid=UUID or /cart?gid=UUID */}
      <Route path="/cart" component={WhmcsCartRedirect}/>

      <Route path="/client/orders/new">
        <CheckoutLayout><NewOrder /></CheckoutLayout>
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
      <Route path="/client/affiliate">
        <ClientPage><Affiliate /></ClientPage>
      </Route>
      <Route path="/client/credits">
        <ClientPage><Credits /></ClientPage>
      </Route>
      <Route path="/client/security">
        <ClientPage><Security /></ClientPage>
      </Route>
      <Route path="/client/domain-search">
        <ClientPage><DomainSearch /></ClientPage>
      </Route>
      <Route path="/client/domains/transfer">
        <ClientPage><DomainTransfer /></ClientPage>
      </Route>
      <Route path="/client/dns/:id">
        <ClientPage><DomainDns /></ClientPage>
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
      <Route path="/admin/affiliates">
        <AdminPage><AdminAffiliates /></AdminPage>
      </Route>
      <Route path="/admin/domain-transfers">
        <AdminPage><AdminDomainTransfers /></AdminPage>
      </Route>
      <Route path="/admin/credits">
        <AdminPage><AdminCredits /></AdminPage>
      </Route>
      <Route path="/admin/admin-users">
        <AdminPage><AdminUsers /></AdminPage>
      </Route>
      <Route path="/admin/knowledge-base/new">
        <AdminPage><KbArticleEditor /></AdminPage>
      </Route>
      <Route path="/admin/knowledge-base/:id/edit">
        <AdminPage><KbArticleEditor /></AdminPage>
      </Route>
      <Route path="/admin/knowledge-base">
        <AdminPage><KnowledgeBase /></AdminPage>
      </Route>
      <Route path="/admin/announcements">
        <AdminPage><Announcements /></AdminPage>
      </Route>
      <Route path="/admin/server-nodes">
        <AdminPage><ServerNodes /></AdminPage>
      </Route>
      <Route path="/admin/email-marketing">
        <AdminPage><EmailMarketing /></AdminPage>
      </Route>
      {/* ── Legal pages — public (canonical + short aliases) ── */}
      <Route path="/legal/terms"       component={TermsOfService} />
      <Route path="/legal/privacy"     component={PrivacyPolicy}  />
      <Route path="/legal/refund"      component={RefundPolicy}   />
      <Route path="/terms-of-service"  component={TermsOfService} />
      <Route path="/tos"               component={TermsOfService} />
      <Route path="/privacy-policy"    component={PrivacyPolicy}  />
      <Route path="/refund-policy"     component={RefundPolicy}   />
      <Route path="/contact"           component={Contact}        />

      <Route path="/status" component={Status} />
      <Route path="/help/:slug">
        <HelpPage><HelpCenterArticle /></HelpPage>
      </Route>
      <Route path="/help">
        <HelpPage><HelpCenter /></HelpPage>
      </Route>

      {/* ── OAuth callback — public ── */}
      <Route path="/google-callback" component={GoogleCallback} />

      {/* Root: redirect guests to client login, logged-in users to their dashboard */}
      <Route path="/">
        {isLoading ? (
          <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : user ? (
          <Redirect to={user.role === "admin" ? "/admin/dashboard" : "/client/dashboard"} />
        ) : (
          <Redirect to="/client/login" />
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
