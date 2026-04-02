import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrency } from "@/context/CurrencyProvider";
import {
  ArrowLeft, User, Mail, Building, Phone, Calendar, Server, Globe, FileText,
  MessageSquare, ShoppingCart, Loader2, Edit2, Trash2, PauseCircle, PlayCircle,
  Send, Zap, XCircle, Shield, TrendingUp, TrendingDown, Key, CheckCircle,
  CreditCard, Plus, ExternalLink, AlertTriangle, Wallet, LogIn, X, Save, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Tab = "services" | "domains" | "invoices" | "tickets" | "orders";

interface ClientFull {
  id: string; firstName: string; lastName: string; email: string; phone?: string;
  company?: string; country?: string; currency?: string; status: string; createdAt: string;
  hosting: any[]; domains: any[]; invoices: any[]; tickets: any[]; orders: any[];
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  suspended: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  terminated: "bg-red-50 text-red-600 border-red-200",
  paid: "bg-green-500/10 text-green-400 border-green-500/20",
  unpaid: "bg-amber-50 text-amber-700 border-amber-200",
  overdue: "bg-red-50 text-red-600 border-red-200",
  cancelled: "bg-secondary text-muted-foreground border-border",
  open: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  answered: "bg-green-500/10 text-green-400 border-green-500/20",
  closed: "bg-secondary text-muted-foreground border-border",
  expired: "bg-red-50 text-red-600 border-red-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_BADGE[status] || "bg-secondary text-muted-foreground border-border"}`}>
      {status}
    </span>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "MMM d, yyyy"); } catch { return "—"; }
}

function toInputDate(d: string | null | undefined) {
  if (!d) return "";
  try { return format(new Date(d), "yyyy-MM-dd"); } catch { return ""; }
}

// ─── Modal Shell ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`bg-card border border-border rounded-2xl shadow-xl ${wide ? "w-full max-w-2xl" : "w-full max-w-md"} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="font-bold text-lg text-foreground">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Sel({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full h-9 px-2.5 text-sm rounded-lg bg-background border border-border text-foreground">
      {children}
    </select>
  );
}

// ─── Edit Service Modal ───────────────────────────────────────────────────────
function EditServiceModal({ svc, onClose, onSave }: { svc: any; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [d, setD] = useState({
    status: svc.status || "active",
    billingCycle: svc.billingCycle || "monthly",
    nextDueDate: toInputDate(svc.nextDueDate),
    startDate: toInputDate(svc.startDate),
    amount: svc.amount ?? "",
    freeDomainAvailable: svc.freeDomainAvailable ?? false,
  });
  const set = (k: string, v: any) => setD(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        status: d.status,
        billingCycle: d.billingCycle,
        nextDueDate: d.nextDueDate || null,
        startDate: d.startDate || null,
        amount: d.amount !== "" ? d.amount : undefined,
        freeDomainAvailable: d.freeDomainAvailable,
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Edit Service — ${svc.planName}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="p-3 bg-secondary/30 rounded-xl text-xs font-mono text-muted-foreground">{svc.domain || "No domain"}</div>
        <Field label="Status">
          <Sel value={d.status} onChange={v => set("status", v)}>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
            <option value="pending">Pending</option>
          </Sel>
        </Field>
        <Field label="Billing Cycle">
          <Sel value={d.billingCycle} onChange={v => set("billingCycle", v)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="semiannual">Semi-Annual</option>
            <option value="yearly">Yearly</option>
          </Sel>
        </Field>
        <Field label="Next Due Date">
          <Input type="date" value={d.nextDueDate} onChange={e => set("nextDueDate", e.target.value)} className="h-9" />
        </Field>
        <Field label="Start / Registration Date">
          <Input type="date" value={d.startDate} onChange={e => set("startDate", e.target.value)} className="h-9" />
        </Field>
        <Field label="Price / Amount (PKR)">
          <Input type="number" placeholder="e.g. 3045" value={d.amount} onChange={e => set("amount", e.target.value)} className="h-9" />
        </Field>
        <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-xl">
          <input type="checkbox" id="fda" checked={d.freeDomainAvailable} onChange={e => set("freeDomainAvailable", e.target.checked)} className="w-4 h-4 rounded" />
          <label htmlFor="fda" className="text-sm font-medium text-foreground">Free Domain Available (client has unused free domain slot)</label>
        </div>
        <div className="flex gap-2 pt-2">
          <Button className="flex-1 gap-1.5" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Changes
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Edit Domain Modal ────────────────────────────────────────────────────────
function EditDomainModal({ domain, onClose, onSave }: { domain: any; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [d, setD] = useState({
    status: domain.status || "active",
    registrar: domain.registrar || "",
    registrationDate: toInputDate(domain.registrationDate),
    expiryDate: toInputDate(domain.expiryDate),
    nextDueDate: toInputDate(domain.nextDueDate),
    autoRenew: domain.autoRenew ?? true,
    isFreeDomain: domain.isFreeDomain ?? false,
  });
  const set = (k: string, v: any) => setD(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        status: d.status,
        registrar: d.registrar,
        registrationDate: d.registrationDate || null,
        expiryDate: d.expiryDate || null,
        nextDueDate: d.nextDueDate || null,
        autoRenew: d.autoRenew,
        isFreeDomain: d.isFreeDomain,
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Edit Domain — ${domain.name}${domain.tld}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Status">
          <Sel value={d.status} onChange={v => set("status", v)}>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
            <option value="transferred">Transferred</option>
            <option value="cancelled">Cancelled</option>
          </Sel>
        </Field>
        <Field label="Registrar">
          <Input value={d.registrar} onChange={e => set("registrar", e.target.value)} placeholder="e.g. ResellerClub" className="h-9" />
        </Field>
        <Field label="Registration Date">
          <Input type="date" value={d.registrationDate} onChange={e => set("registrationDate", e.target.value)} className="h-9" />
        </Field>
        <Field label="Expiry Date">
          <Input type="date" value={d.expiryDate} onChange={e => set("expiryDate", e.target.value)} className="h-9" />
        </Field>
        <Field label="Next Due Date">
          <Input type="date" value={d.nextDueDate} onChange={e => set("nextDueDate", e.target.value)} className="h-9" />
        </Field>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="ar" checked={d.autoRenew} onChange={e => set("autoRenew", e.target.checked)} className="w-4 h-4 rounded" />
            <label htmlFor="ar" className="text-sm font-medium">Auto Renew</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="ifd" checked={d.isFreeDomain} onChange={e => set("isFreeDomain", e.target.checked)} className="w-4 h-4 rounded" />
            <label htmlFor="ifd" className="text-sm font-medium">Free Domain (was included with hosting)</label>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button className="flex-1 gap-1.5" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Changes
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Domain Modal ─────────────────────────────────────────────────────────
function AddDomainModal({ clientId, onClose, onSave }: { clientId: string; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [d, setD] = useState({ name: "", tld: ".com", registrar: "", registrationDate: "", expiryDate: "", status: "active", autoRenew: true, isFreeDomain: false });
  const set = (k: string, v: any) => setD(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!d.name.trim()) return;
    setSaving(true);
    try {
      await onSave({ clientId, name: d.name.toLowerCase().trim(), tld: d.tld, registrar: d.registrar, registrationDate: d.registrationDate || null, expiryDate: d.expiryDate || null, status: d.status, autoRenew: d.autoRenew, isFreeDomain: d.isFreeDomain });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Add New Domain" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <Field label="Domain Name">
            <Input value={d.name} onChange={e => set("name", e.target.value)} placeholder="example" className="h-9" />
          </Field>
          <Field label="TLD">
            <Sel value={d.tld} onChange={v => set("tld", v)}>
              {[".com",".net",".org",".pk",".co",".io",".info",".biz",".net.pk",".org.pk",".co.uk",".com.pk"].map(t => <option key={t}>{t}</option>)}
            </Sel>
          </Field>
        </div>
        <Field label="Registrar">
          <Input value={d.registrar} onChange={e => set("registrar", e.target.value)} placeholder="e.g. ResellerClub" className="h-9" />
        </Field>
        <Field label="Registration Date">
          <Input type="date" value={d.registrationDate} onChange={e => set("registrationDate", e.target.value)} className="h-9" />
        </Field>
        <Field label="Expiry Date">
          <Input type="date" value={d.expiryDate} onChange={e => set("expiryDate", e.target.value)} className="h-9" />
        </Field>
        <Field label="Status">
          <Sel value={d.status} onChange={v => set("status", v)}>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="expired">Expired</option>
          </Sel>
        </Field>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="nar" checked={d.autoRenew} onChange={e => set("autoRenew", e.target.checked)} className="w-4 h-4 rounded" />
            <label htmlFor="nar" className="text-sm">Auto Renew</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="nifd" checked={d.isFreeDomain} onChange={e => set("isFreeDomain", e.target.checked)} className="w-4 h-4 rounded" />
            <label htmlFor="nifd" className="text-sm">Free Domain</label>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button className="flex-1 gap-1.5" onClick={save} disabled={saving || !d.name.trim()}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add Domain
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Edit Invoice Modal ───────────────────────────────────────────────────────
function EditInvoiceModal({ inv, onClose, onSave }: { inv: any; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [d, setD] = useState({
    status: inv.status || "unpaid",
    dueDate: toInputDate(inv.dueDate),
    paidDate: toInputDate(inv.paidDate),
    amount: inv.amount ?? "",
    total: inv.total ?? "",
    paymentRef: inv.paymentRef ?? "",
    paymentNotes: inv.paymentNotes ?? "",
  });
  const set = (k: string, v: any) => setD(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        status: d.status,
        dueDate: d.dueDate || null,
        paidDate: d.paidDate || null,
        amount: d.amount !== "" ? parseFloat(d.amount) : undefined,
        total: d.total !== "" ? parseFloat(d.total) : undefined,
        paymentRef: d.paymentRef || null,
        paymentNotes: d.paymentNotes || null,
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Edit Invoice — ${inv.invoiceNumber}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Status">
          <Sel value={d.status} onChange={v => set("status", v)}>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </Sel>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (PKR)">
            <Input type="number" value={d.amount} onChange={e => set("amount", e.target.value)} className="h-9" />
          </Field>
          <Field label="Total (PKR)">
            <Input type="number" value={d.total} onChange={e => set("total", e.target.value)} className="h-9" />
          </Field>
          <Field label="Due Date">
            <Input type="date" value={d.dueDate} onChange={e => set("dueDate", e.target.value)} className="h-9" />
          </Field>
          <Field label="Paid Date">
            <Input type="date" value={d.paidDate} onChange={e => set("paidDate", e.target.value)} className="h-9" />
          </Field>
        </div>
        <Field label="Payment Reference">
          <Input value={d.paymentRef} onChange={e => set("paymentRef", e.target.value)} placeholder="Bank ref / TID" className="h-9" />
        </Field>
        <Field label="Notes">
          <textarea value={d.paymentNotes} onChange={e => set("paymentNotes", e.target.value)} rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground resize-none" placeholder="Admin notes..." />
        </Field>
        <div className="flex gap-2 pt-2">
          <Button className="flex-1 gap-1.5" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Changes
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Create Invoice Modal ─────────────────────────────────────────────────────
function CreateInvoiceModal({ clientId, clientName, onClose, onSave }: { clientId: string; clientName: string; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");
  const nextWeek = format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd");
  const [d, setD] = useState({ dueDate: nextWeek, tax: "0", items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }] });
  const set = (k: string, v: any) => setD(p => ({ ...p, [k]: v }));

  const updateItem = (i: number, k: string, v: any) => {
    setD(p => {
      const items = [...p.items];
      items[i] = { ...items[i], [k]: v };
      if (k === "quantity" || k === "unitPrice") {
        items[i].total = parseFloat(String(items[i].quantity || 0)) * parseFloat(String(items[i].unitPrice || 0));
      }
      if (k === "total") items[i].total = parseFloat(v) || 0;
      return { ...p, items };
    });
  };

  const subtotal = d.items.reduce((s, it) => s + (it.total || 0), 0);
  const taxAmt = (subtotal * parseFloat(d.tax || "0")) / 100;
  const total = subtotal + taxAmt;

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ clientId, items: d.items, dueDate: d.dueDate, tax: parseFloat(d.tax) || 0 });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`New Invoice for ${clientName}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client"><Input value={clientName} disabled className="h-9 opacity-60" /></Field>
          <Field label="Due Date"><Input type="date" value={d.dueDate} onChange={e => set("dueDate", e.target.value)} className="h-9" /></Field>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-muted-foreground">Invoice Items</label>
            <button onClick={() => set("items", [...d.items, { description: "", quantity: 1, unitPrice: 0, total: 0 }])}
              className="text-xs text-primary hover:underline">+ Add Item</button>
          </div>
          <div className="space-y-2">
            {d.items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} placeholder="Description" className="h-8 text-xs" />
                </div>
                <div className="col-span-2">
                  <Input type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 1)} placeholder="Qty" className="h-8 text-xs" />
                </div>
                <div className="col-span-2">
                  <Input type="number" value={item.unitPrice} onChange={e => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)} placeholder="Price" className="h-8 text-xs" />
                </div>
                <div className="col-span-2 text-sm font-semibold text-right pr-1">
                  Rs. {item.total.toFixed(0)}
                </div>
                <div className="col-span-1 flex justify-center">
                  {d.items.length > 1 && (
                    <button onClick={() => set("items", d.items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 items-end">
          <Field label="Tax (%)">
            <Input type="number" value={d.tax} onChange={e => set("tax", e.target.value)} placeholder="0" className="h-9" />
          </Field>
          <div className="text-right space-y-1 text-sm">
            <div className="text-muted-foreground">Subtotal: <span className="text-foreground font-medium">Rs. {subtotal.toFixed(0)}</span></div>
            {taxAmt > 0 && <div className="text-muted-foreground">Tax: <span className="text-foreground">Rs. {taxAmt.toFixed(0)}</span></div>}
            <div className="text-base font-bold">Total: Rs. {total.toFixed(0)}</div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button className="flex-1 gap-1.5" onClick={save} disabled={saving || d.items.some(it => !it.description.trim())}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create Invoice
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Service Modal ────────────────────────────────────────────────────────
function AddServiceModal({ clientId, onClose, onSave }: { clientId: string; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [d, setD] = useState({ domain: "", billingCycle: "yearly", startDate: format(new Date(), "yyyy-MM-dd"), nextDueDate: "", status: "active", amount: "" });
  const set = (k: string, v: any) => setD(p => ({ ...p, [k]: v }));

  const { data: plansData } = useQuery<any[]>({
    queryKey: ["hosting-plans-list"],
    queryFn: () => apiFetch("/api/hosting/plans"),
  });
  const plans: any[] = Array.isArray(plansData) ? plansData : (plansData as any)?.plans ?? [];

  const pickPlan = (plan: any) => {
    setSelectedPlan(plan);
    const priceMap: Record<string, number> = { monthly: plan.priceMonthly, quarterly: plan.priceQuarterly, semiannual: plan.priceSemiannual, yearly: plan.priceYearly };
    const price = priceMap[d.billingCycle] ?? plan.priceMonthly;
    set("amount", price ? String(price) : "");
    const months: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };
    const due = new Date(); due.setMonth(due.getMonth() + (months[d.billingCycle] ?? 1));
    set("nextDueDate", format(due, "yyyy-MM-dd"));
  };

  const onCycleChange = (cycle: string) => {
    set("billingCycle", cycle);
    if (selectedPlan) {
      const priceMap: Record<string, number> = { monthly: selectedPlan.priceMonthly, quarterly: selectedPlan.priceQuarterly, semiannual: selectedPlan.priceSemiannual, yearly: selectedPlan.priceYearly };
      const price = priceMap[cycle] ?? selectedPlan.priceMonthly;
      set("amount", price ? String(price) : "");
      const months: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };
      const due = new Date(); due.setMonth(due.getMonth() + (months[cycle] ?? 1));
      set("nextDueDate", format(due, "yyyy-MM-dd"));
    }
  };

  const save = async () => {
    if (!selectedPlan) return;
    setSaving(true);
    try {
      await onSave({
        clientId,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        domain: d.domain || null,
        billingCycle: d.billingCycle,
        startDate: d.startDate || null,
        nextDueDate: d.nextDueDate || null,
        status: d.status,
        amount: d.amount ? parseFloat(d.amount) : null,
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Add Hosting Service" onClose={onClose} wide>
      <div className="space-y-4">
        {/* Plan picker */}
        <Field label="Select Hosting Plan">
          {plans.length === 0 ? (
            <div className="text-sm text-muted-foreground p-3 bg-secondary/30 rounded-lg">Loading plans…</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {plans.map(plan => (
                <button key={plan.id} onClick={() => pickPlan(plan)}
                  className={`text-left p-3 rounded-xl border text-sm transition-all ${selectedPlan?.id === plan.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/20 hover:border-primary/40"}`}>
                  <div className="font-semibold">{plan.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Rs. {plan.priceYearly ? `${plan.priceYearly}/yr` : plan.priceMonthly ? `${plan.priceMonthly}/mo` : "—"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Field>

        {selectedPlan && (
          <>
            <Field label="Domain (optional)">
              <Input value={d.domain} onChange={e => set("domain", e.target.value)} placeholder="e.g. example.com" className="h-9" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Billing Cycle">
                <Sel value={d.billingCycle} onChange={onCycleChange}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="semiannual">Semi-Annual</option>
                  <option value="yearly">Yearly</option>
                </Sel>
              </Field>
              <Field label="Status">
                <Sel value={d.status} onChange={v => set("status", v)}>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                </Sel>
              </Field>
              <Field label="Start Date">
                <Input type="date" value={d.startDate} onChange={e => set("startDate", e.target.value)} className="h-9" />
              </Field>
              <Field label="Next Due Date">
                <Input type="date" value={d.nextDueDate} onChange={e => set("nextDueDate", e.target.value)} className="h-9" />
              </Field>
            </div>
            <Field label="Price / Amount (PKR)">
              <Input type="number" value={d.amount} onChange={e => set("amount", e.target.value)} placeholder="Auto-filled from plan" className="h-9" />
            </Field>
          </>
        )}

        <div className="flex gap-2 pt-2">
          <Button className="flex-1 gap-1.5" onClick={save} disabled={saving || !selectedPlan}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add Service
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Invoice View Modal ───────────────────────────────────────────────────────
function InvoiceViewModal({ inv, onClose }: { inv: any; onClose: () => void }) {
  const { formatPrice } = useCurrency();
  const items: any[] = Array.isArray(inv.items) ? inv.items : [];

  return (
    <Modal title="Invoice" onClose={onClose} wide>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            <span className="font-bold text-lg font-mono text-foreground">{inv.invoiceNumber}</span>
            <StatusBadge status={inv.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Created {fmtDate(inv.createdAt)}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Dates & type */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: "Invoice Type", value: inv.invoiceType || "hosting" },
            { label: "Due Date", value: fmtDate(inv.dueDate) },
            { label: "Paid Date", value: inv.paidDate ? fmtDate(inv.paidDate) : "Not paid yet" },
            { label: "Payment Ref", value: inv.paymentRef || "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-secondary/40 rounded-xl p-3">
              <p className="text-muted-foreground text-xs mb-1">{label}</p>
              <p className="font-medium text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="bg-secondary/20 border border-border/50 rounded-xl p-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatPrice(Number(inv.amount))}</span>
          </div>
          {Number(inv.tax) > 0 && (
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatPrice(Number(inv.tax))}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t border-border/50 mt-2 pt-2">
            <span>Total</span>
            <span className="text-primary text-lg">{formatPrice(Number(inv.total || inv.amount))}</span>
          </div>
        </div>

        {/* Line items */}
        {items.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Items</p>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/30">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground">Description</th>
                    <th className="text-right px-3 py-2 text-xs text-muted-foreground">Qty</th>
                    <th className="text-right px-3 py-2 text-xs text-muted-foreground">Unit</th>
                    <th className="text-right px-3 py-2 text-xs text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="px-3 py-2.5 text-foreground">{item.description}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{item.quantity ?? 1}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{formatPrice(Number(item.unitPrice ?? item.amount ?? item.total ?? 0))}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{formatPrice(Number(item.total ?? item.amount ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notes */}
        {inv.paymentNotes && (
          <div className="bg-secondary/40 rounded-xl p-3 text-sm">
            <p className="text-muted-foreground text-xs mb-1">Notes</p>
            <p className="text-foreground">{inv.paymentNotes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("services");
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const [walletAmt, setWalletAmt] = useState("");
  const [walletType, setWalletType] = useState<"admin_add" | "admin_deduct" | "refund">("admin_add");
  const [walletDesc, setWalletDesc] = useState("");

  const [editService, setEditService] = useState<any | null>(null);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [editDomain, setEditDomain] = useState<any | null>(null);
  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<any | null>(null);
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

  const { data: client, isLoading } = useQuery<ClientFull>({
    queryKey: ["admin-client", id],
    queryFn: () => apiFetch(`/api/admin/clients/${id}`),
  });

  const { data: creditData, refetch: refetchCredits } = useQuery<{ creditBalance: string; transactions: any[] }>({
    queryKey: ["admin-client-credits", id],
    queryFn: () => apiFetch(`/api/admin/users/${id}/credits`),
    enabled: !!id,
  });

  const walletMutation = useMutation({
    mutationFn: () => apiFetch(`/api/admin/users/${id}/credits`, {
      method: "POST",
      body: JSON.stringify({ amount: parseFloat(walletAmt), type: walletType, description: walletDesc || undefined }),
    }),
    onSuccess: (res: any) => {
      refetchCredits();
      setWalletAmt(""); setWalletDesc("");
      toast({ title: "Balance updated", description: `New balance: Rs. ${parseFloat(res.creditBalance).toFixed(2)}` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const action = async (url: string, method = "POST", body?: any) => {
    try {
      const result = await apiFetch(url, { method, body: body ? JSON.stringify(body) : undefined });
      qc.invalidateQueries({ queryKey: ["admin-client", id] });
      qc.invalidateQueries({ queryKey: ["admin-hosting"] });
      toast({ title: "Done", description: result.message || "Action completed." });
      return result;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const saveEdit = async () => {
    await action(`/api/admin/clients/${id}`, "PUT", editData);
    setEditing(false);
  };

  const handleImpersonate = async () => {
    setImpersonating(true);
    try {
      const result = await apiFetch(`/api/auth/impersonate/${id}`, { method: "POST" });
      const previousToken = localStorage.getItem("token");
      localStorage.setItem("admin_token_backup", previousToken || "");
      localStorage.setItem("token", result.token);
      window.open("/", "_blank");
      toast({ title: "Viewing as client", description: `You are now viewing the portal as ${result.user.firstName} ${result.user.lastName}. Close the tab to return.` });
    } catch (err: any) {
      toast({ title: "Impersonation failed", description: err.message, variant: "destructive" });
    } finally {
      setImpersonating(false);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!client) return <div className="p-8 text-center text-muted-foreground">Client not found.</div>;

  const fullName = `${client.firstName} ${client.lastName}`;
  const initials = `${client.firstName[0] ?? ""}${client.lastName[0] ?? ""}`;
  const orders = client.orders ?? [];

  const tabs: { id: Tab; icon: React.ElementType; label: string; count: number }[] = [
    { id: "services", icon: Server,        label: "Services",  count: client.hosting.length },
    { id: "domains",  icon: Globe,         label: "Domains",   count: client.domains.length },
    { id: "invoices", icon: FileText,      label: "Invoices",  count: client.invoices.length },
    { id: "tickets",  icon: MessageSquare, label: "Tickets",   count: client.tickets.length },
    { id: "orders",   icon: ShoppingCart,  label: "Orders",    count: orders.length },
  ];

  return (
    <div className="space-y-6">
      {/* Modals */}
      {editService && (
        <EditServiceModal svc={editService} onClose={() => setEditService(null)}
          onSave={async (data) => { await action(`/api/admin/hosting/${editService.id}`, "PUT", data); setEditService(null); }} />
      )}
      {addServiceOpen && (
        <AddServiceModal clientId={id!} onClose={() => setAddServiceOpen(false)}
          onSave={async (data) => { await action("/api/admin/hosting", "POST", data); setAddServiceOpen(false); }} />
      )}
      {viewInvoice && (
        <InvoiceViewModal inv={viewInvoice} onClose={() => setViewInvoice(null)} />
      )}
      {editDomain && (
        <EditDomainModal domain={editDomain} onClose={() => setEditDomain(null)}
          onSave={async (data) => { await action(`/api/admin/domains/${editDomain.id}`, "PUT", data); setEditDomain(null); }} />
      )}
      {addDomainOpen && (
        <AddDomainModal clientId={id!} onClose={() => setAddDomainOpen(false)}
          onSave={async (data) => { await action("/api/admin/domains", "POST", data); setAddDomainOpen(false); }} />
      )}
      {editInvoice && (
        <EditInvoiceModal inv={editInvoice} onClose={() => setEditInvoice(null)}
          onSave={async (data) => { await action(`/api/admin/invoices/${editInvoice.id}`, "PUT", data); setEditInvoice(null); }} />
      )}
      {createInvoiceOpen && (
        <CreateInvoiceModal clientId={id!} clientName={fullName} onClose={() => setCreateInvoiceOpen(false)}
          onSave={async (data) => { await action("/api/admin/invoices", "POST", data); setCreateInvoiceOpen(false); }} />
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => setLocation("/admin/clients")} className="p-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-display font-bold text-foreground">Client Profile</h2>
          <p className="text-muted-foreground text-sm">{fullName} · {client.email}</p>
        </div>
        <Button
          onClick={handleImpersonate}
          disabled={impersonating}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20">
          {impersonating ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
          Login as Client
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Client Info Card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-[60px] pointer-events-none" />

            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white text-2xl font-bold shadow-sm">
                {initials}
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">{fullName}</h3>
                <StatusBadge status={client.status} />
              </div>
            </div>

            {editing ? (
              <div className="space-y-3">
                {[["firstName", "First Name"], ["lastName", "Last Name"], ["email", "Email"], ["phone", "Phone"], ["company", "Company"]].map(([k, label]) => (
                  <div key={k}>
                    <label className="text-xs text-muted-foreground">{label}</label>
                    <Input className="mt-1 h-8 text-sm bg-background" value={editData[k] ?? (client as any)[k] ?? ""} onChange={e => setEditData((d: any) => ({ ...d, [k]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select className="w-full mt-1 h-8 px-2 text-sm rounded-md bg-background border border-border" value={editData.status ?? client.status} onChange={e => setEditData((d: any) => ({ ...d, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1 bg-primary" onClick={saveEdit}>Save</Button>
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => { setEditing(false); setEditData({}); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                {[
                  { icon: Mail,       value: client.email },
                  { icon: Phone,      value: client.phone },
                  { icon: Building,   value: client.company },
                  { icon: Calendar,   value: `Joined ${fmtDate(client.createdAt)}` },
                ].filter(r => r.value).map(({ icon: Icon, value }, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-foreground/80">
                    <Icon size={15} className="text-muted-foreground shrink-0" />
                    <span className="truncate">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-5 pt-4 border-t border-border flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setEditing(true); setEditData({ firstName: client.firstName, lastName: client.lastName, email: client.email, phone: client.phone, company: client.company, status: client.status }); }}>
                <Edit2 size={13} /> Edit
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                onClick={() => action(`/api/admin/clients/${id}/send-email`, "POST", { subject: "Message from Noehost", message: "Hello!" })}>
                <Send size={13} /> Email
              </Button>
              {client.status !== "suspended" ? (
                <Button size="sm" variant="outline" className="gap-1.5 text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                  onClick={() => action(`/api/admin/clients/${id}/suspend`, "POST")}>
                  <PauseCircle size={13} /> Suspend
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5 text-green-400 border-green-500/30 hover:bg-green-500/10"
                  onClick={() => action(`/api/admin/clients/${id}/activate`, "POST")}>
                  <PlayCircle size={13} /> Activate
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => { if (confirm(`Delete ${fullName}? This cannot be undone.`)) action(`/api/admin/clients/${id}`, "DELETE").then(() => setLocation("/admin/clients")); }}>
                <Trash2 size={13} /> Delete
              </Button>
            </div>
          </div>

          {/* Wallet Card */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-2"><Wallet size={15} className="text-primary" /> Wallet Balance</h4>
              <span className="text-lg font-bold text-primary">Rs. {parseFloat(creditData?.creditBalance ?? "0").toFixed(2)}</span>
            </div>
            <div className="flex gap-1.5 mb-3">
              {(["admin_add", "admin_deduct", "refund"] as const).map(t => (
                <button key={t} onClick={() => setWalletType(t)}
                  className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${walletType === t ? "bg-primary text-white border-primary" : "bg-secondary border-border text-muted-foreground"}`}>
                  {t === "admin_add" ? "Add" : t === "admin_deduct" ? "Deduct" : "Refund"}
                </button>
              ))}
            </div>
            <Input className="mb-2 h-8 text-sm" type="number" placeholder="Amount (PKR)" value={walletAmt} onChange={e => setWalletAmt(e.target.value)} />
            <Input className="mb-3 h-8 text-sm" placeholder="Note (optional)" value={walletDesc} onChange={e => setWalletDesc(e.target.value)} />
            <Button size="sm" className="w-full bg-primary text-white text-xs"
              onClick={() => walletMutation.mutate()}
              disabled={walletMutation.isPending || !walletAmt || parseFloat(walletAmt) < 1}>
              {walletMutation.isPending ? <><Loader2 size={12} className="animate-spin mr-1" /> Processing…</> : "Apply Adjustment"}
            </Button>
            {(creditData?.transactions ?? []).length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Recent</p>
                {(creditData?.transactions ?? []).slice(0, 4).map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[140px]">{tx.description || tx.type}</span>
                    <span className={tx.type === "admin_deduct" ? "text-red-400 font-medium" : "text-green-400 font-medium"}>
                      {tx.type === "admin_deduct" ? "−" : "+"} {formatPrice(Math.abs(parseFloat(String(tx.amount || 0))))}  
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Tabs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab nav */}
          <div className="flex gap-1 bg-secondary/50 rounded-xl p-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedService(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${activeTab === tab.id ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icon size={13} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.id ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>{tab.count}</span>}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="bg-card border border-border rounded-2xl p-6 min-h-[400px]">

            {/* === SERVICES === */}
            {activeTab === "services" && !selectedService && (
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-foreground">Hosting Services</h3>
                  <Button size="sm" className="bg-primary gap-1.5 h-8" onClick={() => setAddServiceOpen(true)}>
                    <Plus size={13} /> Add Service
                  </Button>
                </div>
                {client.hosting.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">No hosting services assigned.</div>
                ) : client.hosting.map(svc => (
                  <div key={svc.id} className="p-4 rounded-xl border border-border/50 bg-secondary/20 hover:border-primary/30 transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => setSelectedService(svc)}>
                        <div className="w-9 h-9 bg-secondary rounded-lg flex items-center justify-center shrink-0"><Server size={16} className="text-muted-foreground" /></div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground text-sm">{svc.planName}</div>
                          <div className="text-xs text-primary font-mono truncate">{svc.domain || "No domain"}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={svc.status} />
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                          onClick={() => setEditService(svc)}>
                          <Edit2 size={11} /> Edit
                        </Button>
                        {svc.status !== "terminated" && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                            onClick={() => { if (confirm("Terminate this service? This cannot be undone.")) action(`/api/admin/hosting/${svc.id}/terminate`, "POST"); }}>
                            <XCircle size={11} /> Terminate
                          </Button>
                        )}
                        {svc.status === "terminated" && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                            onClick={() => { if (confirm("Delete this service record permanently?")) action(`/api/admin/hosting/${svc.id}`, "DELETE"); }}>
                            <Trash2 size={11} /> Delete
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <span>Cycle: <span className="text-foreground">{svc.billingCycle || "monthly"}</span></span>
                      <span>Due: <span className="text-foreground">{fmtDate(svc.nextDueDate)}</span></span>
                      {(svc.amount !== null && svc.amount !== undefined) && <span>Price: <span className="text-foreground font-semibold">{formatPrice(Number(svc.amount) || 0)}</span></span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* === SERVICE MANAGEMENT PANEL === */}
            {activeTab === "services" && selectedService && (
              <ServicePanel svc={selectedService} clientId={id!} onBack={() => setSelectedService(null)} onAction={action} onEdit={() => setEditService(selectedService)} />
            )}

            {/* === DOMAINS === */}
            {activeTab === "domains" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-foreground">Domains</h3>
                  <Button size="sm" className="bg-primary gap-1.5 h-8" onClick={() => setAddDomainOpen(true)}>
                    <Plus size={13} /> Add Domain
                  </Button>
                </div>
                {client.domains.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">No domains registered.</div>
                ) : (
                  <div className="space-y-2">
                    {client.domains.map(d => (
                      <div key={d.id} className="flex items-center justify-between p-3.5 rounded-xl border border-border/50 bg-secondary/20 hover:border-border transition-colors">
                        <div className="min-w-0">
                          <div className="font-mono text-sm font-medium">{d.name}{d.tld}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Expires: {fmtDate(d.expiryDate)}
                            {d.registrar && ` · ${d.registrar}`}
                            {d.isFreeDomain && <span className="ml-2 text-green-400 font-medium">Free Domain</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={d.status} />
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                            onClick={() => setEditDomain(d)}>
                            <Edit2 size={11} /> Edit
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                            onClick={() => { if (confirm(`Delete domain ${d.name}${d.tld}? This cannot be undone.`)) action(`/api/admin/domains/${d.id}`, "DELETE"); }}>
                            <Trash2 size={11} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* === INVOICES === */}
            {activeTab === "invoices" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-foreground">Invoices</h3>
                  <Button size="sm" className="bg-primary gap-1.5 h-8" onClick={() => setCreateInvoiceOpen(true)}>
                    <Plus size={13} /> Create Invoice
                  </Button>
                </div>
                {client.invoices.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">No invoices found.</div>
                ) : client.invoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-secondary/20 hover:border-border transition-colors">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-primary">{inv.invoiceNumber}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Due {fmtDate(inv.dueDate)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold text-sm">{formatPrice(Number(inv.total || inv.amount))}</span>
                      <StatusBadge status={inv.status} />
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                        onClick={() => setViewInvoice(inv)}>
                        <Eye size={11} /> View
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                        onClick={() => setEditInvoice(inv)}>
                        <Edit2 size={11} /> Edit
                      </Button>
                      {(inv.status === "unpaid" || inv.status === "overdue") && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 text-green-400 border-green-500/30 hover:bg-green-500/10"
                          onClick={() => action(`/api/admin/invoices/${inv.id}/pay`, "POST")}>
                          <CheckCircle size={11} /> Mark Paid
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                        onClick={() => { if (confirm("Delete this invoice?")) action(`/api/admin/invoices/${inv.id}`, "DELETE"); }}>
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* === TICKETS === */}
            {activeTab === "tickets" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground mb-4">Support Tickets</h3>
                {client.tickets.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">No support tickets.</div>
                ) : client.tickets.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-secondary/20 hover:border-border cursor-pointer transition-colors"
                    onClick={() => setLocation(`/admin/tickets/${t.id}`)}>
                    <div>
                      <div className="font-medium text-foreground">{t.subject}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">#{t.ticketNumber} · {t.department} · {fmtDate(t.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={t.status} />
                      <ExternalLink size={14} className="text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* === ORDERS === */}
            {activeTab === "orders" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-foreground">Orders</h3>
                </div>
                {orders.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">No orders found.</div>
                ) : orders.map(o => (
                  <div key={o.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-secondary/20 hover:border-border transition-colors">
                    <div>
                      <div className="font-medium text-foreground">{o.itemName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-mono">#{o.id.slice(0, 8).toUpperCase()} · {fmtDate(o.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{formatPrice(Number(o.amount))}</span>
                      <StatusBadge status={o.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Service Management Panel ─────────────────────────────────────────────────
function ServicePanel({ svc, clientId, onBack, onAction, onEdit }: {
  svc: any; clientId: string; onBack: () => void;
  onAction: (url: string, method?: string, body?: any) => Promise<any>;
  onEdit: () => void;
}) {
  const { toast } = useToast();
  const [ssoLoading, setSsoLoading] = useState<"cpanel" | "webmail" | null>(null);

  const handleSsoLogin = async (type: "cpanel" | "webmail") => {
    setSsoLoading(type);
    try {
      const endpoint = type === "cpanel"
        ? `/api/admin/hosting/${svc.id}/cpanel-login`
        : `/api/admin/hosting/${svc.id}/webmail-login`;
      const result = await apiFetch(endpoint, { method: "POST" });
      if (result.url) window.open(result.url, "_blank");
    } catch (err: any) {
      toast({ title: `${type === "cpanel" ? "cPanel" : "Webmail"} login failed`, description: err.message, variant: "destructive" });
    } finally { setSsoLoading(null); }
  };

  const btn = (label: string, icon: React.ElementType, colorCls: string, onClick: () => void, disabled = false) => {
    const Icon = icon;
    return (
      <button key={label} onClick={onClick} disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${colorCls}`}>
        <Icon size={15} /> {label}
      </button>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={15} /> Back to services
        </button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
          <Edit2 size={13} /> Edit Service
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6 p-4 bg-secondary/30 rounded-xl border border-border/50">
        <div>
          <h3 className="font-bold text-lg text-foreground">{svc.planName}</h3>
          <div className="text-primary font-mono text-sm mt-0.5">{svc.domain || "No domain"}</div>
        </div>
        <StatusBadge status={svc.status} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Billing Cycle", value: svc.billingCycle || "monthly" },
          { label: "Next Due", value: fmtDate(svc.nextDueDate) },
          { label: "Start Date", value: fmtDate(svc.startDate) },
          { label: "Price", value: svc.amount ? `Rs. ${parseFloat(svc.amount).toFixed(0)}` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-background rounded-xl p-3 border border-border/50">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="font-medium text-sm mt-1 truncate">{value}</div>
          </div>
        ))}
      </div>

      {svc.cancelRequested && (
        <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle size={16} /> Cancellation requested: {svc.cancelReason || "No reason given"}
        </div>
      )}

      <div className="mb-4">
        <div className="text-xs font-medium text-muted-foreground mb-2">cPanel / Hosting</div>
        <div className="flex flex-wrap gap-2">
          {btn(ssoLoading === "cpanel" ? "Connecting..." : "Login to cPanel", ExternalLink,
            svc.status === "active" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-secondary text-muted-foreground border-border opacity-50",
            () => { if (svc.status === "active" && !ssoLoading) handleSsoLogin("cpanel"); })}
          {btn(ssoLoading === "webmail" ? "Connecting..." : "Login to Webmail", Mail,
            svc.status === "active" ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-secondary text-muted-foreground border-border opacity-50",
            () => { if (svc.status === "active" && !ssoLoading) handleSsoLogin("webmail"); })}
          {btn("Change Password", Key, "bg-secondary text-foreground border-border", () => {
            const pw = prompt("New password:"); if (pw) onAction(`/api/admin/hosting/${svc.id}/change-password`, "POST", { password: pw });
          })}
          {btn("Activate SSL", Shield, "bg-green-500/10 text-green-400 border-green-500/20", () => onAction(`/api/admin/hosting/${svc.id}/activate-ssl`, "POST"))}
          {svc.status === "active" && btn("Resend Welcome Email", Send, "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", () => onAction(`/api/admin/hosting/${svc.id}/resend-welcome`, "POST"))}
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs font-medium text-muted-foreground mb-2">Account Management</div>
        <div className="flex flex-wrap gap-2">
          {svc.status === "pending" && btn("Create Account", Zap, "bg-blue-500/10 text-blue-400 border-blue-500/20", () => onAction(`/api/admin/hosting/${svc.id}/provision`, "POST"))}
          {btn("Resend Verification Email", Mail, "bg-teal-500/10 text-teal-400 border-teal-500/20", () => onAction(`/api/admin/clients/${clientId}/resend-verification`, "POST"))}
          {svc.status !== "suspended" && svc.status !== "terminated" && btn("Suspend", PauseCircle, "bg-amber-50 text-amber-700 border-amber-200", () => { if (confirm("Suspend this account?")) onAction(`/api/admin/hosting/${svc.id}/suspend`, "POST"); })}
          {svc.status === "suspended" && btn("Unsuspend", PlayCircle, "bg-green-500/10 text-green-400 border-green-500/20", () => onAction(`/api/admin/hosting/${svc.id}/unsuspend`, "POST"))}
          {svc.status !== "terminated" && btn("Terminate", XCircle, "bg-red-50 text-red-600 border-red-200", () => { if (confirm("Terminate this account? Irreversible.")) onAction(`/api/admin/hosting/${svc.id}/terminate`, "POST"); })}
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2">Plan</div>
        <div className="flex flex-wrap gap-2">
          {btn("Upgrade Plan", TrendingUp, "bg-secondary text-foreground border-border", () => toast({ title: "Upgrade", description: "Go to Packages to change the plan." }))}
          {btn("Downgrade Plan", TrendingDown, "bg-secondary text-foreground border-border", () => toast({ title: "Downgrade", description: "Go to Packages to change the plan." }))}
          {svc.cancelRequested && btn("Approve Cancel", CheckCircle, "bg-red-50 text-red-600 border-red-200", () => { if (confirm("Approve cancellation?")) onAction(`/api/admin/hosting/${svc.id}/cancel`, "POST"); })}
        </div>
      </div>
    </div>
  );
}
