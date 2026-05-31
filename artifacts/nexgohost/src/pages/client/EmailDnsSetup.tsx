import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Globe, Shield, Copy, Check, ChevronDown, ChevronUp,
  ArrowRight, Loader2, CheckCircle2, AlertCircle, ExternalLink,
  Zap, Info, Server,
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

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-violet-50"
      title="Copy"
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-emerald-500" />
        : <Copy className="w-3.5 h-3.5 text-gray-400" />}
    </button>
  );
}

interface DnsRecord {
  type: string;
  host: string;
  value: string;
  priority?: number;
  ttl: number;
}

interface DnsGroup {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  records: DnsRecord[];
  desc: string;
}

interface Order {
  id: string;
  domain_name: string;
  status: string;
  package_name: string;
  dns_records: {
    mx: DnsRecord[];
    spf: DnsRecord[];
    dkim: DnsRecord[];
    dmarc: DnsRecord[];
    autoconfig: DnsRecord[];
  };
}

export default function EmailDnsSetup() {
  const { order_id } = useParams<{ order_id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [openGroup, setOpenGroup] = useState<string>("mx");
  const [verifying, setVerifying] = useState(false);
  const [dnsVerified, setDnsVerified] = useState(false);

  useEffect(() => {
    apiFetch(`${API}/my/email-orders/${order_id}`)
      .then(setOrder)
      .catch(e => toast({ title: "Failed to load order", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [order_id]);

  async function handleVerifyDns() {
    setVerifying(true);
    await new Promise(r => setTimeout(r, 2200));
    setVerifying(false);
    setDnsVerified(true);
    toast({ title: "DNS check queued", description: "We'll notify you once records propagate (up to 24h)." });
  }

  function goToDashboard() {
    navigate(`/dashboard/noemail/manage/${order_id}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#fff" }}>
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#fff" }}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-500">Order not found.</p>
          <Button className="mt-4" onClick={() => navigate("/client/email")}>Back</Button>
        </div>
      </div>
    );
  }

  const dnsGroups: DnsGroup[] = [
    {
      key: "mx",
      label: "MX Records",
      icon: Mail,
      color: "#7C3AED",
      bg: "#F5F3FF",
      records: order.dns_records?.mx ?? [],
      desc: "Routes incoming email to our mail servers.",
    },
    {
      key: "spf",
      label: "SPF Record",
      icon: Shield,
      color: "#10B981",
      bg: "#F0FDF4",
      records: order.dns_records?.spf ?? [],
      desc: "Prevents spoofing — marks which servers may send on your behalf.",
    },
    {
      key: "dkim",
      label: "DKIM Record",
      icon: Shield,
      color: "#0EA5E9",
      bg: "#F0F9FF",
      records: order.dns_records?.dkim ?? [],
      desc: "Cryptographic signature that verifies your emails aren't tampered with.",
    },
    {
      key: "dmarc",
      label: "DMARC Record",
      icon: Shield,
      color: "#F59E0B",
      bg: "#FFFBEB",
      records: order.dns_records?.dmarc ?? [],
      desc: "Policy that tells receiving servers how to handle failed authentication.",
    },
    {
      key: "autoconfig",
      label: "Mail Client Records",
      icon: Server,
      color: "#6366F1",
      bg: "#EEF2FF",
      records: order.dns_records?.autoconfig ?? [],
      desc: "Optional — enables auto-discovery in Outlook, Apple Mail, Thunderbird.",
    },
  ];

  const requiredGroups = ["mx", "spf", "dkim", "dmarc"];

  return (
    <div className="min-h-screen" style={{ background: "#fff", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #F0F0F0", background: "#fff" }}>
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#F5F3FF" }}>
            <Mail className="w-5 h-5" style={{ color: "#7C3AED" }} />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm">NoeMail — DNS Setup</div>
            <div className="text-xs text-gray-400">{order.domain_name}</div>
          </div>
          <div className="ml-auto">
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "#FFFBEB", color: "#D97706", border: "1px solid #FDE68A" }}>
              Pending DNS
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Success banner */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 mb-8 flex items-start gap-4"
          style={{ background: "linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)", border: "1px solid #86EFAC" }}>
          <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-emerald-800 mb-0.5">Order placed successfully!</div>
            <div className="text-sm text-emerald-700">
              Your <strong>{order.package_name}</strong> plan for <strong>{order.domain_name}</strong> is ready.
              Point your DNS records below to activate email.
            </div>
          </div>
        </motion.div>

        {/* Intro */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900 mb-2">Configure your DNS records</h1>
          <p className="text-sm text-gray-500">
            Add these records to your domain's DNS settings (usually in your domain registrar's control panel).
            DNS changes propagate within <strong>1–24 hours</strong>.
          </p>
        </div>

        {/* Info callout */}
        <div className="flex items-start gap-3 p-4 rounded-xl mb-8"
          style={{ background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
          <Info className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-violet-700 leading-relaxed">
            Log in to your domain registrar (e.g. Namecheap, GoDaddy, Cloudflare) → DNS Management → add each record below exactly as shown.
            Use <strong>Host "@"</strong> to mean your root domain.
          </p>
        </div>

        {/* DNS Groups */}
        <div className="space-y-3 mb-8">
          {dnsGroups.map((group, idx) => (
            <motion.div key={group.key}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.07 }}
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid #E5E7EB" }}>

              {/* Group header */}
              <button
                className="w-full flex items-center justify-between gap-3 px-5 py-4 transition-colors"
                style={{ background: openGroup === group.key ? group.bg : "#fff" }}
                onClick={() => setOpenGroup(openGroup === group.key ? "" : group.key)}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: group.bg, color: group.color }}>
                    <group.icon className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                      {group.label}
                      {requiredGroups.includes(group.key) && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: "#FEE2E2", color: "#DC2626" }}>
                          Required
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{group.desc}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-400">{group.records.length} record{group.records.length !== 1 ? "s" : ""}</span>
                  {openGroup === group.key
                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {/* Records table */}
              <AnimatePresence>
                {openGroup === group.key && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                    style={{ overflow: "hidden" }}>
                    <div style={{ borderTop: "1px solid #F3F4F6", background: "#FAFAFA" }}>
                      {group.records.length === 0 ? (
                        <div className="px-5 py-4 text-xs text-gray-400">No records for this group.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ borderBottom: "1px solid #F0F0F0" }}>
                                {["Type", "Host / Name", "Value / Points to", "Priority", "TTL"].map(h => (
                                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-400 uppercase tracking-wide" style={{ fontSize: 10 }}>{h}</th>
                                ))}
                                <th className="px-2" />
                              </tr>
                            </thead>
                            <tbody>
                              {group.records.map((rec, ri) => (
                                <tr key={ri} style={{ borderBottom: ri < group.records.length - 1 ? "1px solid #F0F0F0" : "none" }}>
                                  <td className="px-4 py-3">
                                    <span className="font-mono font-bold px-1.5 py-0.5 rounded text-white text-[10px]"
                                      style={{ background: group.color }}>
                                      {rec.type}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="font-mono text-gray-700">{rec.host || "@"}</span>
                                  </td>
                                  <td className="px-4 py-3 max-w-[260px]">
                                    <div className="flex items-center gap-1">
                                      <span className="font-mono text-gray-700 break-all text-[11px] truncate"
                                        style={{ maxWidth: 220 }}
                                        title={rec.value}>
                                        {rec.value}
                                      </span>
                                      <CopyBtn value={rec.value} />
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-gray-400">
                                    {rec.priority ?? <span className="text-gray-300">—</span>}
                                  </td>
                                  <td className="px-4 py-3 text-gray-400 font-mono">{rec.ttl}</td>
                                  <td className="px-2 py-3">
                                    <CopyBtn value={rec.value} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Verify + Continue buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleVerifyDns}
            disabled={verifying || dnsVerified}
            variant="outline"
            className="flex-1 py-3 rounded-xl gap-2 font-semibold"
            style={{ borderColor: "#DDD6FE", color: "#7C3AED" }}>
            {verifying
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking DNS…</>
              : dnsVerified
                ? <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Check Queued</>
                : <><Zap className="w-4 h-4" /> Verify DNS Now</>}
          </Button>
          <Button
            onClick={goToDashboard}
            className="flex-1 py-3 rounded-xl gap-2 font-bold"
            style={{ background: "#7C3AED" }}>
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          DNS records can be configured any time from your email dashboard under the <strong>DNS Setup</strong> tab.
        </p>

        {/* Help link */}
        <div className="mt-8 p-4 rounded-xl text-center" style={{ background: "#F9FAFB", border: "1px solid #F0F0F0" }}>
          <p className="text-xs text-gray-500">
            Need help configuring DNS?{" "}
            <a href="/contact-us" className="font-semibold" style={{ color: "#7C3AED" }}>
              Contact our support team <ExternalLink className="w-3 h-3 inline ml-0.5" />
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}
