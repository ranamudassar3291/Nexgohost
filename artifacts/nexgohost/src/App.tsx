import { Switch, Route, Router as WouterRouter, useLocation, useParams, Redirect } from "wouter";
import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthProvider";
import { CurrencyProvider } from "@/context/CurrencyProvider";
import { ContentProvider } from "@/context/ContentContext";
import { CartProvider } from "@/context/CartContext";
import { ThemeProvider } from "@/context/ThemeProvider";
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

// Admin core pages (detail/add/edit flows kept standalone)
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminClients from "@/pages/admin/Clients";
import AdminClientDetail from "@/pages/admin/ClientDetail";
import AddClient from "@/pages/admin/AddClient";
import EditClient from "@/pages/admin/EditClient";
import AddPackage from "@/pages/admin/AddPackage";
import EditPackage from "@/pages/admin/EditPackage";
import AddOrder from "@/pages/admin/AddOrder";
import AddInvoice from "@/pages/admin/AddInvoice";
import AdminTicketDetail from "@/pages/admin/TicketDetail";
import AddVpsPlan from "@/pages/admin/AddVpsPlan";
import VpsOsTemplates from "@/pages/admin/VpsOsTemplates";
import KbArticleEditor from "@/pages/admin/KbArticleEditor";
// Master pages — each groups related features into tabs
import DomainsMaster from "@/pages/admin/DomainsMaster";
import HostingMaster from "@/pages/admin/HostingMaster";
import OrdersMaster from "@/pages/admin/OrdersMaster";
import SupportMaster from "@/pages/admin/SupportMaster";
import FinanceMaster from "@/pages/admin/FinanceMaster";
import ServersMaster from "@/pages/admin/ServersMaster";
import AnalyticsMaster from "@/pages/admin/AnalyticsMaster";
import SystemMaster from "@/pages/admin/SystemMaster";
import IpUnblocker from "@/pages/admin/IpUnblocker";
import WebsiteMaster from "@/pages/admin/WebsiteMaster";
import CommandCenter from "@/pages/admin/CommandCenter";
import SeoEngine from "@/pages/admin/SeoEngine";
import SalesFunnel from "@/pages/admin/SalesFunnel";
import AbuseDashboard from "@/pages/admin/AbuseDashboard";
import ResellerAdmin from "@/pages/admin/ResellerAdmin";
import ResellerDashboard from "@/pages/client/ResellerDashboard";
import DomainReseller from "@/pages/public/DomainReseller";
import Status from "@/pages/public/Status";
import NoeBlog from "@/noehost/components/pages/Blog";
import NoeBlogPost from "@/noehost/components/pages/BlogPost";
import NoeFlashSale from "@/noehost/components/pages/FlashSale";

// Client pages
import ClientDashboard from "@/pages/client/Dashboard";
import ClientHosting from "@/pages/client/Hosting";
import ClientServiceDetail from "@/pages/client/ServiceDetail";
import ClientWebmail from "@/pages/client/Webmail";
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
import TeamAccess from "@/pages/client/TeamAccess";
import GrowthSuite from "@/pages/client/GrowthSuite";
import DomainTransfer from "@/pages/client/DomainTransfer";
import DomainDns from "@/pages/client/DomainDns";
import DomainSearch from "@/pages/client/DomainSearch";
import RegisterDomain from "@/pages/client/RegisterDomain";
import VpsManage from "@/pages/client/VpsManage";
import HelpCenter from "@/pages/client/HelpCenter";
import HelpCenterArticle from "@/pages/client/HelpCenterArticle";
import Homepage from "@/pages/public/Homepage";
import VpsHosting from "@/pages/public/VpsHosting";
import OrderFlow from "@/pages/public/OrderFlow";
import TermsOfService from "@/pages/public/TermsOfService";
import PrivacyPolicy from "@/pages/public/PrivacyPolicy";
import RefundPolicy from "@/pages/public/RefundPolicy";
import GoogleCallback from "@/pages/auth/GoogleCallback";

// ── Noehost marketing pages ──
import CustomPage from "@/noehost/pages/CustomPage";
import NoeHostLayout from "@/pages/public/NoeHostLayout";
import NoeSharedHosting from "@/noehost/components/pages/SharedHosting";
import NoeWordPressHosting from "@/noehost/components/pages/WordPressHosting";
import NoeResellerHosting from "@/noehost/components/pages/ResellerHosting";
import NoeVPSHosting from "@/noehost/components/pages/VPSHosting";
import NoeDomains from "@/noehost/components/pages/Domains";
import NoeAboutUs from "@/noehost/components/pages/AboutUs";
import NoeContactUs from "@/noehost/components/pages/ContactUs";
import NoeServerStatus from "@/noehost/components/pages/ServerStatus";
import NoeN8nHosting from "@/noehost/components/pages/N8nHosting";
import NoeBusinessEmail from "@/noehost/components/pages/BusinessEmail";
import NoeKnowledgeBase from "@/noehost/components/pages/KnowledgeBase";

import { queryClient } from "@/lib/query-client";
import { useApiHealth } from "@/hooks/use-api-health";
import MaintenancePage from "@/pages/errors/MaintenancePage";

// ─── Auth Guard Helpers ───────────────────────────────────────────────────────
// Used inline per-route to avoid nested Switch context issues in Wouter v3.
// Each route wraps its page component directly in AdminPage or ClientPage.

function AdminPage({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  if (!user) return <Redirect to="/admin/noe" />;
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
            <a href="/client/orders/new" className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">Get Hosting</a>
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

// /buy/:planId  — clean short link: UUID or slug → resolves to NewOrder
// /order/:slug  — clean short link: plan name slug → resolves to NewOrder
// Both try the /api/packages/resolve/:slugOrId endpoint for real-time DB lookup.
function OrderBySlug() {
  const params = useParams<{ slug?: string; planId?: string }>();
  const raw = params.slug ?? params.planId ?? "";
  const [planId, setPlanId] = useState<string | null>(null);
  const [err, setErr]       = useState("");

  useEffect(() => {
    if (!raw) { setErr("No plan specified"); return; }
    fetch(`/api/packages/resolve/${encodeURIComponent(raw)}`)
      .then(r => r.json())
      .then(d => {
        if (d.id) setPlanId(d.id);
        else { setErr(d.error ?? "Plan not found"); }
      })
      .catch(() => setErr("Could not connect to server"));
  }, [raw]);

  if (err) return (
    <CheckoutLayout allowGuest>
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-400 text-2xl">✕</div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Plan Not Found</h2>
          <p className="text-gray-500 text-sm max-w-sm">{err}. Please browse our available plans and choose one to get started.</p>
        </div>
        <a href="/client/orders/new" className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors shadow">
          Browse All Plans →
        </a>
      </div>
    </CheckoutLayout>
  );

  if (!planId) return (
    <CheckoutLayout allowGuest>
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading plan details…</p>
        </div>
      </div>
    </CheckoutLayout>
  );

  return <CheckoutLayout allowGuest><NewOrder initialPackageId={planId} /></CheckoutLayout>;
}

function ClientOrdersNewRedirect() {
  const params = new URLSearchParams(window.location.search);
  const pid   = params.get("pid")    ?? params.get("plan_id") ?? "";
  const gid   = params.get("gid")    ?? "";
  const vpsId = params.get("vps_id") ?? "";

  if (pid)   return <CheckoutLayout allowGuest><NewOrder initialPackageId={pid}/></CheckoutLayout>;
  if (gid)   return <CheckoutLayout allowGuest><NewOrder initialGroupId={gid}/></CheckoutLayout>;
  if (vpsId) return <CheckoutLayout allowGuest><NewOrder initialVpsPlanId={vpsId}/></CheckoutLayout>;
  // No params — render the full order wizard (no redirect loop)
  return <CheckoutLayout allowGuest><NewOrder /></CheckoutLayout>;
}

// /cart — redirect to unified checkout
function CartRedirect() {
  const params = new URLSearchParams(window.location.search);
  const pid    = params.get("pid")  ?? "";
  const gid    = params.get("gid")  ?? "";
  const action = params.get("a")    ?? "";

  // Keep backward-compat WHMCS-style links working
  if (action === "add" && pid) {
    return <CheckoutLayout allowGuest><NewOrder initialPackageId={pid}/></CheckoutLayout>;
  }
  if (gid) {
    return <CheckoutLayout allowGuest><NewOrder initialGroupId={gid}/></CheckoutLayout>;
  }
  return <Redirect to="/client/orders/new" />;
}

// ─── API Health Wrapper ────────────────────────────────────────────────────────
// Monitors backend availability and shows a maintenance page if the API
// fails to respond after 2 consecutive checks (every 20 seconds).
function ApiHealthWrapper({ children }: { children: React.ReactNode }) {
  const { isDown, retry } = useApiHealth();
  if (isDown) return <MaintenancePage onRetry={retry} />;
  return <>{children}</>;
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
      <Route path="/admin/noe"        component={AdminLogin}      />
      <Route path="/admin/login"><Redirect to="/admin/noe" /></Route>
      <Route path="/client/login"     component={ClientLogin}     />
      <Route path="/client/register"><Redirect to="/register" /></Route>
      <Route path="/register"         component={Register}        />
      <Route path="/forgot-password"  component={ForgotPassword}  />
      <Route path="/reset-password"   component={ResetPassword}   />
      <Route path="/vps"              component={VpsHosting}      />
      {/* /order root → unified checkout */}
      <Route path="/order"><Redirect to="/client/orders/new" /></Route>

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

      {/* Clients — standalone (has own detail/add/edit flows) */}
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

      {/* Packages add/edit — standalone forms */}
      <Route path="/admin/packages/add">
        <AdminPage><AddPackage /></AdminPage>
      </Route>
      <Route path="/admin/packages/:id/edit">
        <AdminPage><EditPackage /></AdminPage>
      </Route>

      {/* Orders add/invoice add — standalone forms */}
      <Route path="/admin/orders/add">
        <AdminPage><AddOrder /></AdminPage>
      </Route>
      <Route path="/admin/invoices/add">
        <AdminPage><AddInvoice /></AdminPage>
      </Route>

      {/* Ticket detail — standalone */}
      <Route path="/admin/tickets/:id">
        <AdminPage><AdminTicketDetail /></AdminPage>
      </Route>

      {/* KB article editor — standalone */}
      <Route path="/admin/knowledge-base/edit/:id">
        <AdminPage><KbArticleEditor /></AdminPage>
      </Route>
      <Route path="/admin/knowledge-base/new">
        <AdminPage><KbArticleEditor /></AdminPage>
      </Route>

      {/* VPS add/edit/os-templates — standalone forms */}
      <Route path="/admin/vps/add">
        <AdminPage><AddVpsPlan /></AdminPage>
      </Route>
      <Route path="/admin/vps/:id/edit">
        <AdminPage><AddVpsPlan /></AdminPage>
      </Route>
      <Route path="/admin/vps/os-templates">
        <AdminPage><VpsOsTemplates /></AdminPage>
      </Route>

      {/* ── Master pages ── */}
      <Route path="/admin/domains">
        <AdminPage><DomainsMaster /></AdminPage>
      </Route>
      <Route path="/admin/hosting">
        <AdminPage><HostingMaster /></AdminPage>
      </Route>
      <Route path="/admin/orders">
        <AdminPage><OrdersMaster /></AdminPage>
      </Route>
      <Route path="/admin/invoices">
        <Redirect to="/admin/orders?tab=invoices" />
      </Route>
      <Route path="/admin/support">
        <AdminPage><SupportMaster /></AdminPage>
      </Route>
      <Route path="/admin/tickets">
        <AdminPage><SupportMaster /></AdminPage>
      </Route>
      <Route path="/admin/finance">
        <AdminPage><FinanceMaster /></AdminPage>
      </Route>
      <Route path="/admin/servers">
        <AdminPage><ServersMaster /></AdminPage>
      </Route>
      <Route path="/admin/analytics">
        <AdminPage><AnalyticsMaster /></AdminPage>
      </Route>
      <Route path="/admin/system">
        <AdminPage><SystemMaster /></AdminPage>
      </Route>
      <Route path="/admin/settings">
        <AdminPage><SystemMaster /></AdminPage>
      </Route>
      <Route path="/admin/ip-unblocker">
        <AdminPage><IpUnblocker /></AdminPage>
      </Route>
      <Route path="/admin/command-center">
        <AdminPage><CommandCenter /></AdminPage>
      </Route>
      <Route path="/admin/seo-engine">
        <AdminPage><SeoEngine /></AdminPage>
      </Route>
      <Route path="/admin/sales-funnel">
        <AdminPage><SalesFunnel /></AdminPage>
      </Route>
      <Route path="/admin/website">
        <AdminPage><WebsiteMaster /></AdminPage>
      </Route>
      <Route path="/admin/abuse">
        <AdminPage><AbuseDashboard /></AdminPage>
      </Route>

      {/* Legacy routes — redirect to master pages with correct tab */}
      <Route path="/admin/domains/extensions">
        <Redirect to="/admin/domains?tab=extensions" />
      </Route>
      <Route path="/admin/domain-transfers">
        <Redirect to="/admin/domains?tab=transfers" />
      </Route>
      <Route path="/admin/domain-registrars">
        <Redirect to="/admin/domains?tab=registrars" />
      </Route>
      <Route path="/admin/packages">
        <Redirect to="/admin/hosting?tab=packages" />
      </Route>
      <Route path="/admin/pending-activations">
        <Redirect to="/admin/hosting?tab=pending" />
      </Route>
      <Route path="/admin/vps/services">
        <Redirect to="/admin/hosting?tab=vps-services" />
      </Route>
      <Route path="/admin/vps/locations">
        <Redirect to="/admin/hosting?tab=vps-plans" />
      </Route>
      <Route path="/admin/vps">
        <Redirect to="/admin/hosting?tab=vps-plans" />
      </Route>
      <Route path="/admin/transactions">
        <Redirect to="/admin/orders?tab=transactions" />
      </Route>
      <Route path="/admin/migrations">
        <Redirect to="/admin/support?tab=migrations" />
      </Route>
      <Route path="/admin/knowledge-base">
        <Redirect to="/admin/support?tab=knowledge-base" />
      </Route>
      <Route path="/admin/announcements">
        <Redirect to="/admin/support?tab=announcements" />
      </Route>
      <Route path="/admin/cancellation-requests">
        <Redirect to="/admin/support?tab=cancellations" />
      </Route>
      <Route path="/admin/promo-codes">
        <Redirect to="/admin/finance?tab=promo-codes" />
      </Route>
      <Route path="/admin/payment-methods">
        <Redirect to="/admin/finance?tab=payment-methods" />
      </Route>
      <Route path="/admin/currencies">
        <Redirect to="/admin/finance?tab=currencies" />
      </Route>
      <Route path="/admin/product-groups">
        <Redirect to="/admin/finance?tab=product-groups" />
      </Route>
      <Route path="/admin/affiliates">
        <Redirect to="/admin/finance?tab=affiliates" />
      </Route>
      <Route path="/admin/credits">
        <Redirect to="/admin/finance?tab=credits" />
      </Route>
      <Route path="/admin/twenty-i">
        <Redirect to="/admin/servers?tab=twenty-i" />
      </Route>
      <Route path="/admin/modules">
        <Redirect to="/admin/servers?tab=modules" />
      </Route>
      <Route path="/admin/server-nodes">
        <Redirect to="/admin/servers?tab=server-nodes" />
      </Route>
      <Route path="/admin/reports">
        <Redirect to="/admin/analytics?tab=reports" />
      </Route>
      <Route path="/admin/fraud-logs">
        <Redirect to="/admin/analytics?tab=fraud-logs" />
      </Route>
      <Route path="/admin/cron-logs">
        <Redirect to="/admin/analytics?tab=automation" />
      </Route>
      <Route path="/admin/server-logs">
        <Redirect to="/admin/analytics?tab=server-logs" />
      </Route>
      <Route path="/admin/backups">
        <Redirect to="/admin/analytics?tab=backups" />
      </Route>
      <Route path="/admin/email-marketing">
        <Redirect to="/admin/analytics?tab=email-marketing" />
      </Route>
      <Route path="/admin/whatsapp">
        <Redirect to="/admin/analytics?tab=whatsapp" />
      </Route>
      <Route path="/admin/whmcs-import">
        <Redirect to="/admin/analytics?tab=whmcs-import" />
      </Route>
      <Route path="/admin/admin-users">
        <Redirect to="/admin/system?tab=admin-users" />
      </Route>
      <Route path="/admin/email-templates">
        <Redirect to="/admin/system?tab=email-templates" />
      </Route>
      <Route path="/admin/settings/email">
        <Redirect to="/admin/system?tab=email-config" />
      </Route>
      <Route path="/admin/settings/google">
        <Redirect to="/admin/system?tab=google-oauth" />
      </Route>
      <Route path="/admin/api-settings">
        <Redirect to="/admin/system?tab=api-settings" />
      </Route>
      <Route path="/admin/api-docs">
        <Redirect to="/admin/system?tab=api-docs" />
      </Route>
      <Route path="/admin/security">
        <Redirect to="/admin/system?tab=security" />
      </Route>
      <Route path="/admin/firewall">
        <Redirect to="/admin/system?tab=firewall" />
      </Route>
      <Route path="/admin/resellers">
        <AdminPage><ResellerAdmin /></AdminPage>
      </Route>

      {/* ── Client routes (each individually guarded) ── */}
      <Route path="/client/dashboard">
        <ClientPage><ClientDashboard /></ClientPage>
      </Route>
      <Route path="/client/vps/:id">
        <ClientPage><VpsManage /></ClientPage>
      </Route>
      <Route path="/client/hosting/:id/webmail">
        <ClientPage><ClientWebmail /></ClientPage>
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
      <Route path="/client/billing">
        <ClientPage><ClientInvoices /></ClientPage>
      </Route>
      <Route path="/client/invoices">
        <Redirect to="/client/billing" />
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
      {/* ── Unified short-link & direct-order routes ── */}
      {/* /buy/:planId — clean sharable link by UUID or slug */}
      <Route path="/buy/:planId" component={OrderBySlug}/>
      {/* /order/group/:groupId, /order/add/:packageId etc — kept for backward compat */}
      <Route path="/order/group/:groupId" component={OrderByGroup}/>
      <Route path="/order/add/:packageId" component={OrderByPackage}/>
      {/* WHMCS-style clean URL: /order/config/index.php?pid=UUID */}
      <Route path="/order/config/index.php" component={OrderByPid}/>
      {/* VPS direct links: /order/vps/:planId and ?vps_id=UUID */}
      <Route path="/order/vps/:planId" component={OrderByVpsPlan}/>
      <Route path="/order/vps" component={OrderByVpsId}/>
      {/* /order/:slug — slug-based clean short link (AFTER specific /order/* routes) */}
      <Route path="/order/:slug" component={OrderBySlug}/>
      <Route path="/client/orders/new" component={ClientOrdersNewRedirect}/>
      {/* /cart — backward compat, redirects to unified checkout */}
      <Route path="/cart" component={CartRedirect}/>

      <Route path="/client/orders/new">
        {() => {
          const sp     = new URLSearchParams(window.location.search);
          const pid    = sp.get("plan_id") ?? "";
          const vpsId  = sp.get("vps_id")  ?? "";
          const gid    = sp.get("group_id") ?? "";
          if (vpsId)  return <CheckoutLayout allowGuest><NewOrder initialVpsPlanId={vpsId} /></CheckoutLayout>;
          if (gid)    return <CheckoutLayout allowGuest><NewOrder initialGroupId={gid} /></CheckoutLayout>;
          return <CheckoutLayout allowGuest><NewOrder initialPackageId={pid || undefined} /></CheckoutLayout>;
        }}
      </Route>
      <Route path="/client/orders">
        <ClientPage><ClientOrders /></ClientPage>
      </Route>
      <Route path="/client/cart">
        <Redirect to="/client/orders/new" />
      </Route>
      <Route path="/client/checkout">
        <CheckoutLayout allowGuest><Checkout /></CheckoutLayout>
      </Route>
      <Route path="/client/account">
        <ClientPage><ClientAccount /></ClientPage>
      </Route>
      <Route path="/client/affiliate">
        <Redirect to="/client/billing?tab=affiliate" />
      </Route>
      <Route path="/client/credits">
        <Redirect to="/client/billing?tab=credits" />
      </Route>
      <Route path="/client/security">
        <ClientPage><Security /></ClientPage>
      </Route>
      <Route path="/client/team">
        <ClientPage><TeamAccess /></ClientPage>
      </Route>
      <Route path="/client/growth">
        <ClientPage><GrowthSuite /></ClientPage>
      </Route>
      <Route path="/client/reseller">
        <ClientPage><ResellerDashboard /></ClientPage>
      </Route>
      <Route path="/client/domain-search">
        <ClientPage><DomainSearch /></ClientPage>
      </Route>
      <Route path="/client/register-domain">
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
      {/* Legacy admin alias redirects */}
      <Route path="/admin/products">
        <Redirect to="/admin/hosting?tab=packages" />
      </Route>
      <Route path="/admin/payments">
        <Redirect to="/admin/finance?tab=payment-methods" />
      </Route>
      <Route path="/admin/promos">
        <Redirect to="/admin/finance?tab=promo-codes" />
      </Route>
      <Route path="/admin/domain-extensions">
        <Redirect to="/admin/domains?tab=extensions" />
      </Route>
      {/* ── Static checkout bypassed — redirect to the backend-driven order flow ── */}
      <Route path="/checkout">
        <Redirect to="/order" />
      </Route>

      {/* ── Noehost public marketing pages ── */}
      <Route path="/n8n-hosting">
        <NoeHostLayout><NoeN8nHosting /></NoeHostLayout>
      </Route>
      <Route path="/business-email">
        <NoeHostLayout><NoeBusinessEmail /></NoeHostLayout>
      </Route>
      <Route path="/knowledge-base">
        <NoeHostLayout><NoeKnowledgeBase /></NoeHostLayout>
      </Route>
      <Route path="/shared-hosting">
        <NoeHostLayout><NoeSharedHosting /></NoeHostLayout>
      </Route>
      <Route path="/wordpress-hosting">
        <NoeHostLayout><NoeWordPressHosting /></NoeHostLayout>
      </Route>
      <Route path="/reseller-hosting">
        <NoeHostLayout><NoeResellerHosting /></NoeHostLayout>
      </Route>
      <Route path="/vps-hosting">
        <NoeHostLayout><NoeVPSHosting /></NoeHostLayout>
      </Route>
      <Route path="/domains">
        <NoeHostLayout><NoeDomains /></NoeHostLayout>
      </Route>
      <Route path="/about-us">
        <NoeHostLayout><NoeAboutUs /></NoeHostLayout>
      </Route>
      <Route path="/about">
        <NoeHostLayout><NoeAboutUs /></NoeHostLayout>
      </Route>
      <Route path="/contact-us">
        <NoeHostLayout><NoeContactUs /></NoeHostLayout>
      </Route>
      <Route path="/contact">
        <NoeHostLayout><NoeContactUs /></NoeHostLayout>
      </Route>
      <Route path="/server-status">
        <NoeHostLayout><NoeServerStatus /></NoeHostLayout>
      </Route>
      <Route path="/blog/:slug">
        <NoeHostLayout><NoeBlogPost /></NoeHostLayout>
      </Route>
      <Route path="/blog">
        <NoeHostLayout><NoeBlog /></NoeHostLayout>
      </Route>
      <Route path="/sale/:slug">
        <NoeHostLayout><NoeFlashSale /></NoeHostLayout>
      </Route>
      <Route path="/domain-reseller">
        <NoeHostLayout><DomainReseller /></NoeHostLayout>
      </Route>

      {/* ── Legal pages ── */}
      <Route path="/privacy-policy"      component={PrivacyPolicy}  />
      <Route path="/legal/privacy"       component={PrivacyPolicy}  />
      <Route path="/terms-and-conditions" component={TermsOfService} />
      <Route path="/legal/terms"         component={TermsOfService} />
      <Route path="/terms-of-service"    component={TermsOfService} />
      <Route path="/tos"                 component={TermsOfService} />
      <Route path="/refund-policy"       component={RefundPolicy}   />
      <Route path="/legal/refund"        component={RefundPolicy}   />

      <Route path="/status" component={Status} />
      <Route path="/help/:slug">
        <HelpPage><HelpCenterArticle /></HelpPage>
      </Route>
      <Route path="/help">
        <HelpPage><HelpCenter /></HelpPage>
      </Route>

      {/* ── OAuth callback — public ── */}
      <Route path="/google-callback" component={GoogleCallback} />

      {/* Root: show homepage to guests, redirect logged-in users to dashboard */}
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

      {/* Custom pages created from Admin → Page Manager */}
      <Route path="/p/:slug" component={CustomPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ApiHealthWrapper>
              <ContentProvider>
                <AuthProvider>
                  <CurrencyProvider>
                    <CartProvider>
                      <RouterRoot />
                    </CartProvider>
                  </CurrencyProvider>
                </AuthProvider>
              </ContentProvider>
            </ApiHealthWrapper>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
