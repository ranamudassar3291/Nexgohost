import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Mail, Plus, Loader2, Globe, HardDrive, Users,
  ArrowRight, AlertCircle, ChevronRight,
  CheckCircle2, Clock, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const API = "/api";

function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") || localStorage.getItem("noehost_token");
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts?.headers ?? {}),
    },
  }).then(async (r) => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Request failed");
    return d;
  });
}

interface EmailOrder {
  id: string;
  domain_name: string;
  status: string;
  package_name: string;
  max_storage_gb: number;
  max_mailboxes: number;
  billing_cycle: string;
  amount_paid: number;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  active: {
    label: "Active",
    icon: CheckCircle2,
    color: "#059669",
    bg: "#ECFDF5",
    border: "#6EE7B7",
  },
  pending_payment: {
    label: "Awaiting Payment",
    icon: Clock,
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#DDD6FE",
  },
  pending_dns: {
    label: "Pending DNS",
    icon: Clock,
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
  },
  suspended: {
    label: "Suspended",
    icon: XCircle,
    color: "#DC2626",
    bg: "#FEF2F2",
    border: "#FECACA",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, icon: Clock, color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" };
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

export default function ClientEmailOrders() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [orders, setOrders] = useState<EmailOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`${API}/my/email-orders`)
      .then(setOrders)
      .catch(e => toast({ title: "Failed to load email orders", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "#F5F3FF" }}>
            <Mail className="w-5 h-5" style={{ color: "#7C3AED" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Business Email</h1>
            <p className="text-sm text-muted-foreground">Manage your email hosting subscriptions</p>
          </div>
        </div>
        <Button
          onClick={() => window.location.href = "/checkout/email-hosting"}
          className="gap-2 font-semibold"
          style={{ background: "#7C3AED" }}>
          <Plus className="w-4 h-4" /> New Email Plan
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="text-center py-24 rounded-2xl"
          style={{ border: "2px dashed #E5E7EB", background: "#FAFAFA" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "#F5F3FF" }}>
            <Mail className="w-8 h-8" style={{ color: "#7C3AED" }} />
          </div>
          <h3 className="font-bold text-gray-900 mb-2">No email hosting yet</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Get a professional business email with your own domain — looks more credible than a free address.
          </p>
          <Button
            onClick={() => window.location.href = "/business-email"}
            className="gap-2"
            style={{ background: "#7C3AED" }}>
            <Globe className="w-4 h-4" /> Explore Plans
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {orders.map((order, idx) => {
            const cfg = STATUS_CONFIG[order.status];
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}
                className="group rounded-2xl p-5 flex items-center gap-4 cursor-pointer transition-all hover:shadow-md"
                style={{ background: "#fff", border: "1px solid #E5E7EB" }}
                onClick={() =>
                  order.status === "pending_payment"
                    ? navigate(`/dashboard/billing`)
                    : order.status === "pending_dns"
                      ? navigate(`/checkout/email-hosting/dns/${order.id}`)
                      : navigate(`/dashboard/noemail/manage/${order.id}`)
                }>

                {/* Domain icon */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#F5F3FF" }}>
                  <Mail className="w-6 h-6" style={{ color: "#7C3AED" }} />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-gray-900">{order.domain_name}</span>
                    <StatusBadge status={order.status} />
                    {order.status === "pending_payment" && (
                      <span className="text-xs text-violet-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Payment required
                      </span>
                    )}
                    {order.status === "pending_dns" && (
                      <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Configure DNS to activate
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {order.package_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3.5 h-3.5" /> {order.max_storage_gb} GB
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {order.max_mailboxes >= 999 ? "Unlimited" : order.max_mailboxes} mailboxes
                    </span>
                    <span className="capitalize">{order.billing_cycle}</span>
                  </div>
                </div>

                {/* Price + arrow */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="font-bold text-gray-900">
                      PKR {Number(order.amount_paid).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pending Payment helper */}
      {orders.some(o => o.status === "pending_payment") && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{ background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
          <AlertCircle className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-violet-800">
            <strong>Payment required:</strong> Complete your payment to activate email hosting. Click the order above to go to your invoice.
          </div>
        </motion.div>
      )}

      {/* Pending DNS helper */}
      {orders.some(o => o.status === "pending_dns") && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <strong>DNS setup required:</strong> Click on any "Pending DNS" order above to configure your DNS records and activate your email hosting.
          </div>
        </motion.div>
      )}

      {/* Upsell */}
      {orders.length > 0 && (
        <div className="rounded-2xl p-5 flex items-center justify-between gap-4"
          style={{ background: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)", border: "1px solid #DDD6FE" }}>
          <div>
            <div className="font-bold text-violet-900 mb-0.5">Need more email addresses?</div>
            <div className="text-xs text-violet-700">Upgrade your plan or add a new domain with a separate subscription.</div>
          </div>
          <Button
            onClick={() => window.location.href = "/checkout/email-hosting"}
            size="sm"
            className="flex-shrink-0 gap-1.5 font-semibold"
            style={{ background: "#7C3AED" }}>
            Add Plan <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

    </div>
  );
}
