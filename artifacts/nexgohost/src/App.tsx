import { Switch, Route, Router as WouterRouter, useLocation, useParams, Redirect } from "wouter";
import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthProvider";
import { CurrencyProvider } from "@/context/CurrencyProvider";
import { ContentProvider } from "@/context/ContentContext";
import { CartProvider } from "@/context/CartContext";
import { UnifiedCartProvider } from "@/context/UnifiedCartContext";
import UnifiedCart from "@/pages/client/UnifiedCart";
import UnifiedCartAdd from "@/pages/client/UnifiedCartAdd";
import CartHosting from "@/pages/cart/CartHosting";
import CartDomainRegister from "@/pages/cart/CartDomainRegister";
import CartDomainTransfer from "@/pages/cart/CartDomainTransfer";
import CartVps from "@/pages/cart/CartVps";
import CartEmail from "@/pages/cart/CartEmail";
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
import VpsIpPool from "@/pages/admin/VpsIpPool";
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
import ActivityLogs from "@/pages/admin/ActivityLogs";
import SeoEngine from "@/pages/admin/SeoEngine";
import SalesFunnel from "@/pages/admin/SalesFunnel";
import AbuseDashboard from "@/pages/admin/AbuseDashboard";
import ResellerAdmin from "@/pages/admin/ResellerAdmin";
import NoeMail from "@/pages/admin/NoeMail";
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
import Checkout from "@/pages/client/Checkout";
import Cart from "@/pages/client/Cart";
import InvoiceDetail from "@/pages/client/InvoiceDetail";
import SafepayReturn from "@/pages/client/SafepayReturn";
import RapidGatewayReturn from "@/pages/client/RapidGatewayReturn";
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
import VpsManagePage from "@/pages/client/VpsManagePage";
import NoEmailManage from "@/pages/client/NoEmailManage";
import EmailHostingCheckout from "@/pages/client/EmailHostingCheckout";
import DomainOrder from "@/pages/client/DomainOrder";
import DomainCartCheckout from "@/pages/client/DomainCartCheckout";
import EmailDnsSetup from "@/pages/client/EmailDnsSetup";
import ClientEmailOrders from "@/pages/client/ClientEmailOrders";
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
import NoeKbCategory from "@/noehost/components/pages/KbCategory";
import NoeKbArticle from "@/noehost/components/pages/KbArticle";

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
  if (!user) return <Redirect to="/login" />;
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
          <a href="/login" className="flex items-center gap-2 font-bold text-primary text-lg">Noehost</a>
          <div className="flex gap-3">
            <a href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign In</a>
            <a href="/" className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">Get Hosting</a>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

// ─── Legacy order-link wrappers — all redirect to unified /cart ───────────────
// /order/group/:groupId → browse plans page
function OrderByGroup() {
  return <Redirect to="/#plans" />;
}

// /buy/:planId or /order/:slug → resolve plan UUID then redirect to /cart/hosting?planId=
function OrderBySlug() {
  const params = useParams<{ slug?: string; planId?: string }>();
  const raw = params.slug ?? params.planId ?? "";
  const [planId, setPlanId] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!raw) { setErr("No plan specified"); return; }
    fetch(`/api/packages/resolve/${encodeURIComponent(raw)}`)
      .then(r => r.json())
      .then(d => { if (d.id) setPlanId(d.id); else setErr(d.error ?? "Plan not found"); })
      .catch(() => setErr("Could not connect to server"));
  }, [raw]);

  if (err) return <Redirect to="/cart/hosting" />;
  if (!planId) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
    </div>
  );
  return <Redirect to={`/cart/hosting?planId=${planId}`} />;
}

// VPS direct-link → dedicated VPS cart page
function OrderByVpsPlan() {
  const { planId } = useParams<{ planId: string }>();
  return <Redirect to={`/cart/vps?planId=${planId}`} />;
}

// /dashboard/orders/new and WHMCS-style links → dedicated cart pages
function ClientOrdersNewRedirect() {
  const params = new URLSearchParams(window.location.search);
  const pid   = params.get("pid")    ?? params.get("plan_id") ?? "";
  const vpsId = params.get("vps_id") ?? "";
  if (vpsId) return <Redirect to={`/cart/vps?planId=${vpsId}`} />;
  if (pid)   return <Redirect to={`/cart/hosting?planId=${pid}`} />;
  return <Redirect to="/cart/hosting" />;
}

// /cart (WHMCS-style with query params) → dedicated cart pages
function CartRedirect() {
  const params = new URLSearchParams(window.location.search);
  const pid    = params.get("pid") ?? "";
  const action = params.get("a")   ?? "";
  if (action === "add" && pid) return <Redirect to={`/cart/hosting?planId=${pid}`} />;
  return <Redirect to="/cart/hosting" />;
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
      <Route path="/login"        component={ClientLogin}     />
      <Route path="/client/login" component={ClientLogin}     />
      <Route path="/register"         component={Register}        />
      <Route path="/forgot-password"  component={ForgotPassword}  />
      <Route path="/forget-password"  component={ForgotPassword}  />
      <Route path="/reset-password"   component={ResetPassword}   />
      <Route path="/vps"              component={VpsHosting}      />
      {/* /order root → hosting cart (marketing & backward-compat link) */}
      <Route path="/order"><Redirect to="/cart/hosting" /></Route>

      <Route path="/login">
        {!isLoading && user ? (
          <Redirect to={user.role === "admin" ? "/admin/dashboard" : "/dashboard"} />
        ) : (
          <Redirect to="/login" />
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

      {/* VPS IP Pool Manager */}
      <Route path="/admin/vps/ip-pool">
        <AdminPage><VpsIpPool /></AdminPage>
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
      <Route path="/admin/activity-logs">
        <AdminPage><ActivityLogs /></AdminPage>
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
      <Route path="/admin/noemail">
        <AdminPage><NoeMail /></AdminPage>
      </Route>

      {/* ── Client routes (each individually guarded) ── */}
      <Route path="/dashboard">
        <ClientPage><ClientDashboard /></ClientPage>
      </Route>
      <Route path="/dashboard/vps/:id">
        <ClientPage><VpsManage /></ClientPage>
      </Route>
      <Route path="/vps-manage/:orderId">
        <VpsManagePage />
      </Route>
      <Route path="/dashboard/noemail/manage/:order_id">
        <ClientPage><NoEmailManage /></ClientPage>
      </Route>
      <Route path="/checkout/email-hosting/dns/:order_id">
        <ClientPage><EmailDnsSetup /></ClientPage>
      </Route>
      {/* Legacy order/checkout pages → dedicated cart pages */}
      <Route path="/order/domain"><Redirect to="/cart/domain/register" /></Route>
      <Route path="/checkout/domains"><Redirect to="/cart/domain/register" /></Route>
      <Route path="/checkout/email-hosting"><Redirect to="/cart/email" /></Route>
      <Route path="/dashboard/email">
        <ClientPage><ClientEmailOrders /></ClientPage>
      </Route>
      <Route path="/dashboard/hosting/:id/webmail">
        <ClientPage><ClientWebmail /></ClientPage>
      </Route>
      <Route path="/dashboard/hosting/:id">
        <ClientPage><ClientServiceDetail /></ClientPage>
      </Route>
      <Route path="/dashboard/hosting">
        <ClientPage><ClientHosting /></ClientPage>
      </Route>
      <Route path="/dashboard/domains/manage/:id">
        <ClientPage><DomainManage /></ClientPage>
      </Route>
      <Route path="/dashboard/domains">
        <ClientPage><ClientDomains /></ClientPage>
      </Route>
      <Route path="/dashboard/invoices/:id">
        <ClientPage><InvoiceDetail /></ClientPage>
      </Route>
      <Route path="/dashboard/billing">
        <ClientPage><ClientInvoices /></ClientPage>
      </Route>
      <Route path="/dashboard/invoices">
        <Redirect to="/dashboard/billing" />
      </Route>
      <Route path="/dashboard/payment/return">
        <ClientPage><SafepayReturn /></ClientPage>
      </Route>
      <Route path="/client/payment/rg-return">
        <ClientPage><RapidGatewayReturn /></ClientPage>
      </Route>
      <Route path="/dashboard/tickets/:id">
        <ClientPage><ClientTicketDetail /></ClientPage>
      </Route>
      <Route path="/dashboard/tickets">
        <ClientPage><ClientTickets /></ClientPage>
      </Route>
      <Route path="/dashboard/migrations">
        <ClientPage><ClientMigrations /></ClientPage>
      </Route>
      {/* ── Unified short-link & direct-order routes ── */}
      {/* /buy/:planId — clean sharable link by UUID or slug */}
      <Route path="/buy/:planId" component={OrderBySlug}/>
      {/* /order/group/:groupId → unified cart; /order/add/:packageId → /cart/add/:packageId */}
      <Route path="/order/group/:groupId" component={OrderByGroup}/>
      <Route path="/order/add/:packageId">
        {() => { const { packageId } = useParams<{ packageId: string }>(); window.location.replace(`/cart/add/${packageId}`); return null; }}
      </Route>
      {/* WHMCS-style clean URL: /order/config/index.php?pid=UUID */}
      <Route path="/order/config/index.php">
        {() => {
          const pid = new URLSearchParams(window.location.search).get("pid") ?? "";
          const vpsId = new URLSearchParams(window.location.search).get("vps_id") ?? "";
          if (pid) return <Redirect to={`/cart/add/${pid}`} />;
          if (vpsId) return <Redirect to={`/cart/add/${vpsId}?type=vps`} />;
          return <Redirect to="/" />;
        }}
      </Route>
      {/* VPS direct links → unified cart */}
      <Route path="/order/vps/:planId" component={OrderByVpsPlan}/>
      <Route path="/order/vps">
        {() => {
          const vpsId = new URLSearchParams(window.location.search).get("vps_id") ?? "";
          return vpsId ? <Redirect to={`/cart/add/${vpsId}?type=vps`} /> : <Redirect to="/" />;
        }}
      </Route>
      {/* /order/:slug — slug-based clean short link (AFTER specific /order/* routes) */}
      <Route path="/order/:slug" component={OrderBySlug}/>
      {/* /cart — Dedicated cart pages (Hostinger-style, per service type) */}
      <Route path="/cart/hosting"><CartHosting /></Route>
      <Route path="/cart/domain/register"><CartDomainRegister /></Route>
      <Route path="/cart/domain/transfer"><CartDomainTransfer /></Route>
      <Route path="/cart/vps"><CartVps /></Route>
      <Route path="/cart/email"><CartEmail /></Route>
      {/* /cart — Unified cart & checkout (legacy) */}
      <Route path="/cart/add/:packageId"><UnifiedCartAdd /></Route>
      <Route path="/cart"><UnifiedCart /></Route>

      <Route path="/dashboard/orders/new"><Redirect to="/" /></Route>
      <Route path="/dashboard/orders">
        <ClientPage><ClientOrders /></ClientPage>
      </Route>
      <Route path="/dashboard/cart">
        <Redirect to="/cart" />
      </Route>
      <Route path="/dashboard/checkout">
        <CheckoutLayout allowGuest><Checkout /></CheckoutLayout>
      </Route>
      <Route path="/dashboard/account">
        <ClientPage><ClientAccount /></ClientPage>
      </Route>
      <Route path="/dashboard/affiliate">
        <Redirect to="/dashboard/billing?tab=affiliate" />
      </Route>
      <Route path="/dashboard/credits">
        <Redirect to="/dashboard/billing?tab=credits" />
      </Route>
      <Route path="/dashboard/security">
        <ClientPage><Security /></ClientPage>
      </Route>
      <Route path="/dashboard/team">
        <ClientPage><TeamAccess /></ClientPage>
      </Route>
      <Route path="/dashboard/growth">
        <ClientPage><GrowthSuite /></ClientPage>
      </Route>
      <Route path="/dashboard/reseller">
        <ClientPage><ResellerDashboard /></ClientPage>
      </Route>
      <Route path="/dashboard/domain-search">
        <ClientPage><DomainSearch /></ClientPage>
      </Route>
      <Route path="/register-domain">
        <ClientPage><DomainSearch /></ClientPage>
      </Route>
      <Route path="/dashboard/domains/transfer">
        <ClientPage><DomainTransfer /></ClientPage>
      </Route>
      <Route path="/dashboard/dns/:id">
        <ClientPage><DomainDns /></ClientPage>
      </Route>
      {/* ── Route aliases ── */}
      <Route path="/dashboard/services">
        <ClientPage><ClientHosting /></ClientPage>
      </Route>
      <Route path="/dashboard/profile">
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
      <Route path="/knowledge-base/:categorySlug/:articleSlug">
        <NoeHostLayout><NoeKbArticle /></NoeHostLayout>
      </Route>
      <Route path="/knowledge-base/:categorySlug">
        <NoeHostLayout><NoeKbCategory /></NoeHostLayout>
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

      {/* Root: always show public homepage — authenticated users can still browse it */}
      <Route path="/">
        <Homepage />
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
                      <UnifiedCartProvider>
                        <RouterRoot />
                      </UnifiedCartProvider>
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
