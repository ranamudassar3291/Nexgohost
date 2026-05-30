import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryFunctions";
import {
  Zap, Plus, Trash2, Edit2, ToggleLeft, ToggleRight,
  ShoppingCart, TrendingUp, XCircle, RefreshCw, Eye,
  Timer, DollarSign, Globe, CheckCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FlashSale {
  id: string; title: string; slug: string; headline: string; subheadline: string;
  badge_text: string; cta_text: string; cta_url: string;
  original_price: string | null; sale_price: string | null; currency: string;
  ends_at: string | null; bg_color: string; accent_color: string;
  is_active: boolean; created_at: string;
}
interface RecoveryLog {
  id: string; user_id: string | null; email: string | null;
  plan_name: string | null; cart_value: string | null;
  discount_code: string | null; status: string; created_at: string;
  converted_at: string | null;
}
interface RecoveryStats {
  triggered: string; converted: string; dismissed: string;
  conversion_rate: string; recovered_revenue: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const token = () => localStorage.getItem("token") || "";
const apiFetch = (url: string, opts: RequestInit = {}) =>
  fetch(`/api${url}`, { headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, ...opts });

const EMPTY_SALE: Partial<FlashSale> = {
  title: "", slug: "", headline: "", subheadline: "",
  badge_text: "Flash Sale", cta_text: "Grab the Deal", cta_url: "",
  original_price: "", sale_price: "", currency: "USD",
  ends_at: "", bg_color: "#0F172A", accent_color: "#7C5DE2", is_active: true,
};

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    triggered:  { bg: "#FEF3C7", text: "#92400E", label: "Triggered" },
    converted:  { bg: "#D1FAE5", text: "#065F46", label: "Converted" },
    dismissed:  { bg: "#FEE2E2", text: "#991B1B", label: "Dismissed" },
  };
  const s = map[status] || { bg: "#F3F4F6", text: "#374151", label: status };
  return (
    <span style={{ background: s.bg, color: s.text, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

function timeAgo(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SalesFunnel() {
  const [tab, setTab] = useState<"flash" | "recovery">("flash");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FlashSale | null>(null);
  const [form, setForm] = useState<Partial<FlashSale>>(EMPTY_SALE);
  const [filterStatus, setFilterStatus] = useState("all");
  const qc = useQueryClient();

  // ── Queries ──
  const { data: flashData, isLoading: flashLoading } = useQuery({
    queryKey: ["admin-flash-sales"],
    queryFn: () => apiFetch("/admin/flash-sales").then(r => r.json()),
  });
  const { data: recoveryData, isLoading: recoveryLoading } = useQuery({
    queryKey: ["admin-cart-recovery", filterStatus],
    queryFn: () => apiFetch(`/admin/cart-recovery?status=${filterStatus === "all" ? "" : filterStatus}&limit=100`).then(r => r.json()),
    enabled: tab === "recovery",
  });
  const { data: statsData } = useQuery<RecoveryStats>({
    queryKey: ["admin-cart-recovery-stats"],
    queryFn: () => apiFetch("/admin/cart-recovery/stats").then(r => r.json()),
    enabled: tab === "recovery",
  });

  // ── Mutations ──
  const saveSale = useMutation({
    mutationFn: async (data: Partial<FlashSale>) => {
      const url = editing ? `/admin/flash-sales/${editing.id}` : "/admin/flash-sales";
      const method = editing ? "PUT" : "POST";
      return apiFetch(url, { method, body: JSON.stringify(data) }).then(r => r.json());
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-flash-sales"] }); setShowForm(false); setEditing(null); setForm(EMPTY_SALE); },
  });
  const deleteSale = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/flash-sales/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-flash-sales"] }),
  });
  const toggleSale = useMutation({
    mutationFn: (sale: FlashSale) => apiFetch(`/admin/flash-sales/${sale.id}`, { method: "PUT", body: JSON.stringify({ is_active: !sale.is_active }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-flash-sales"] }),
  });

  const openCreate = () => { setEditing(null); setForm(EMPTY_SALE); setShowForm(true); };
  const openEdit = (s: FlashSale) => { setEditing(s); setForm({ ...s, ends_at: s.ends_at ? s.ends_at.slice(0, 16) : "" }); setShowForm(true); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); saveSale.mutate(form); };

  const flashSales: FlashSale[] = flashData?.flashSales || [];
  const logs: RecoveryLog[] = recoveryData?.logs || [];
  const stats: RecoveryStats = statsData || { triggered: "0", converted: "0", dismissed: "0", conversion_rate: "0", recovered_revenue: "0" };

  const TABS = [
    { id: "flash",    label: "Flash Sales",      icon: <Zap size={15} /> },
    { id: "recovery", label: "Cart Recovery",    icon: <ShoppingCart size={15} /> },
  ] as const;

  return (
    <div style={{ padding: "32px 28px", minHeight: "100vh", background: "#F8FAFC" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>Sales Funnel</h1>
          <p style={{ color: "#6B7280", fontSize: 14, marginTop: 4 }}>Flash sales, abandoned cart recovery & social proof</p>
        </div>
        {tab === "flash" && (
          <button onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 8, background: "#6B46C1", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
            <Plus size={16} /> New Flash Sale
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 12, padding: 4, width: "fit-content", marginBottom: 28 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, transition: "all .15s",
              background: tab === t.id ? "#fff" : "transparent",
              color: tab === t.id ? "#6B46C1" : "#6B7280",
              boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,.1)" : "none",
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Flash Sales Tab ── */}
      {tab === "flash" && (
        <div>
          {flashLoading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>Loading flash sales…</div>
          ) : flashSales.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, background: "#fff", borderRadius: 16, border: "1px dashed #E5E7EB" }}>
              <Zap size={40} style={{ color: "#E5E7EB", margin: "0 auto 12px" }} />
              <div style={{ fontWeight: 600, color: "#374151" }}>No flash sales yet</div>
              <div style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>Create a flash sale to launch a high-urgency landing page with a countdown timer.</div>
              <button onClick={openCreate} style={{ marginTop: 16, background: "#6B46C1", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: 600 }}>
                Create Flash Sale
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {flashSales.map(sale => {
                const expired = sale.ends_at && new Date(sale.ends_at) < new Date();
                return (
                  <div key={sale.id} style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 20 }}>
                    {/* Colour swatch */}
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: sale.bg_color || "#0F172A", flexShrink: 0, border: `3px solid ${sale.accent_color || "#7C5DE2"}` }} />
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, color: "#111827", fontSize: 16 }}>{sale.title}</span>
                        <span style={{ background: sale.is_active && !expired ? "#D1FAE5" : "#FEE2E2", color: sale.is_active && !expired ? "#065F46" : "#991B1B", fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
                          {expired ? "EXPIRED" : sale.is_active ? "LIVE" : "PAUSED"}
                        </span>
                        <span style={{ background: "#EEF2FF", color: "#6B46C1", fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>/{sale.slug}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>{sale.headline}</div>
                      <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
                        {sale.original_price && (
                          <span style={{ fontSize: 13, color: "#9CA3AF" }}>
                            Was: <s>${sale.original_price}</s> → <strong style={{ color: "#10B981" }}>${sale.sale_price}</strong>
                          </span>
                        )}
                        {sale.ends_at && (
                          <span style={{ fontSize: 13, color: "#F59E0B", display: "flex", alignItems: "center", gap: 4 }}>
                            <Timer size={13} /> Ends: {new Date(sale.ends_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <a href={`/sale/${sale.slug}`} target="_blank" rel="noreferrer"
                        style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
                        <Eye size={14} /> Preview
                      </a>
                      <button onClick={() => toggleSale.mutate(sale)}
                        style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500 }}>
                        {sale.is_active ? <ToggleRight size={16} color="#10B981" /> : <ToggleLeft size={16} color="#9CA3AF" />}
                        {sale.is_active ? "Active" : "Paused"}
                      </button>
                      <button onClick={() => openEdit(sale)}
                        style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", color: "#6B46C1", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500 }}>
                        <Edit2 size={14} /> Edit
                      </button>
                      <button onClick={() => { if (confirm("Delete this flash sale?")) deleteSale.mutate(sale.id); }}
                        style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #FEE2E2", background: "#FFF5F5", cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Form modal */}
          {showForm && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <form onSubmit={handleSubmit}
                style={{ background: "#fff", borderRadius: 20, padding: 32, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>{editing ? "Edit Flash Sale" : "New Flash Sale"}</h2>
                  <button type="button" onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><XCircle size={22} /></button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {([ ["title","Title *","text"], ["slug","URL Slug *","text"], ["headline","Headline","text"], ["subheadline","Sub-headline","text"],
                      ["badge_text","Badge Text","text"], ["cta_text","Button Text","text"], ["cta_url","Button URL","url"],
                      ["original_price","Original Price","number"], ["sale_price","Sale Price","number"], ["currency","Currency","text"],
                      ["ends_at","Ends At","datetime-local"],
                  ] as [keyof FlashSale, string, string][]).map(([k, label, type]) => (
                    <div key={k} style={{ gridColumn: ["headline","subheadline","cta_url"].includes(k) ? "1 / -1" : "auto" }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{label}</label>
                      <input type={type} value={(form[k] as string) || ""}
                        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                        required={["title","slug"].includes(k)}
                        style={{ width: "100%", padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 14, color: "#111827", boxSizing: "border-box" }} />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Background Colour</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="color" value={form.bg_color || "#0F172A"} onChange={e => setForm(f => ({ ...f, bg_color: e.target.value }))}
                        style={{ width: 40, height: 36, border: "none", cursor: "pointer", borderRadius: 6 }} />
                      <input type="text" value={form.bg_color || ""} onChange={e => setForm(f => ({ ...f, bg_color: e.target.value }))}
                        style={{ flex: 1, padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 14 }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Accent Colour</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="color" value={form.accent_color || "#7C5DE2"} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))}
                        style={{ width: 40, height: 36, border: "none", cursor: "pointer", borderRadius: 6 }} />
                      <input type="text" value={form.accent_color || ""} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))}
                        style={{ flex: 1, padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 14 }} />
                    </div>
                  </div>
                  <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="checkbox" id="is_active" checked={form.is_active !== false}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: 16, height: 16, cursor: "pointer" }} />
                    <label htmlFor="is_active" style={{ fontSize: 14, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Active (visible on site)</label>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setShowForm(false)}
                    style={{ padding: "10px 22px", borderRadius: 10, border: "1px solid #E5E7EB", background: "#fff", cursor: "pointer", fontWeight: 600, color: "#374151" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saveSale.isPending}
                    style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: "#6B46C1", color: "#fff", cursor: "pointer", fontWeight: 600, opacity: saveSale.isPending ? .7 : 1 }}>
                    {saveSale.isPending ? "Saving…" : editing ? "Save Changes" : "Create Flash Sale"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ── Cart Recovery Tab ── */}
      {tab === "recovery" && (
        <div>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
            {[
              { label: "Triggers", value: stats.triggered, icon: <ShoppingCart size={18} />, color: "#6B46C1" },
              { label: "Converted", value: stats.converted, icon: <CheckCircle size={18} />, color: "#10B981" },
              { label: "Dismissed", value: stats.dismissed, icon: <XCircle size={18} />, color: "#EF4444" },
              { label: "Conv. Rate", value: `${stats.conversion_rate || 0}%`, icon: <TrendingUp size={18} />, color: "#F59E0B" },
              { label: "Recovered Revenue", value: `$${Number(stats.recovered_revenue || 0).toFixed(2)}`, icon: <DollarSign size={18} />, color: "#06B6D4" },
            ].map(s => (
              <div key={s.label} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid #E5E7EB" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600 }}>{s.label}</span>
                  <span style={{ color: s.color }}>{s.icon}</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#111827", marginTop: 8 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filter + table */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: "#111827", fontSize: 15 }}>Recovery Log</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {["all", "triggered", "converted", "dismissed"].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    style={{ padding: "5px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: filterStatus === s ? "#6B46C1" : "#F3F4F6", color: filterStatus === s ? "#fff" : "#374151" }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {recoveryLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>Loading recovery logs…</div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <ShoppingCart size={36} style={{ color: "#E5E7EB", margin: "0 auto 12px" }} />
                <div style={{ fontWeight: 600, color: "#374151" }}>No cart recovery events yet</div>
                <div style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>When visitors exit checkout, their data will appear here.</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB" }}>
                      {["Email / User", "Plan", "Cart Value", "Discount Code", "Status", "Triggered", "Converted"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => (
                      <tr key={log.id} style={{ borderTop: "1px solid #F3F4F6", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>{log.email || log.user_id || <span style={{ color: "#9CA3AF" }}>—</span>}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>{log.plan_name || "—"}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>{log.cart_value ? `$${Number(log.cart_value).toFixed(2)}` : "—"}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13 }}>
                          {log.discount_code ? <code style={{ background: "#EEF2FF", color: "#6B46C1", padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>{log.discount_code}</code> : "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>{statusBadge(log.status)}</td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#9CA3AF", whiteSpace: "nowrap" }}>{timeAgo(log.created_at)}</td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#9CA3AF", whiteSpace: "nowrap" }}>{log.converted_at ? timeAgo(log.converted_at) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
