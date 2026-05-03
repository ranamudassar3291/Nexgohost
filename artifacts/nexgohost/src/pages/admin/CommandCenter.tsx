import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles, Brain, Search, Users, Shield, TrendingUp, Activity, Lock,
  ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Loader2,
  CheckCircle2, XCircle, Zap, Radio, RefreshCw, User,
  Sliders, Megaphone, SlidersHorizontal, Clock, AlertTriangle,
  Filter, Circle, Globe, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MasterPage } from "@/components/layout/MasterPage";
import { formatDistanceToNow } from "date-fns";

function apiFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token") || "";
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts.headers },
  }).then(async r => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Request failed");
    return d;
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Feature { key: string; label: string; description: string; category: string; }
interface FeatureFlag { feature_key: string; user_id: string | null; enabled: boolean; updated_by: string; updated_at: string; }
interface ConfigRow { key: string; value: string; updated_by: string; updated_at: string; }
interface ActivityEvent { id: number; user_id: string; user_email: string; user_name: string; action: string; meta: any; created_at: string; }
interface Client { id: string; firstName: string; lastName: string; email: string; }

// ─── Category colours ─────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  AI:         { bg: "rgba(139,92,246,0.12)", text: "#A78BFA", border: "rgba(139,92,246,0.25)" },
  Tools:      { bg: "rgba(14,165,233,0.12)", text: "#38BDF8", border: "rgba(14,165,233,0.25)" },
  Security:   { bg: "rgba(239,68,68,0.10)",  text: "#FCA5A5", border: "rgba(239,68,68,0.22)" },
  Growth:     { bg: "rgba(16,185,129,0.12)", text: "#6EE7B7", border: "rgba(16,185,129,0.25)" },
  Monitoring: { bg: "rgba(245,158,11,0.12)", text: "#FCD34D", border: "rgba(245,158,11,0.25)" },
};

const FEATURE_ICONS: Record<string, typeof Sparkles> = {
  ai_insights: Sparkles, ai_ticket_suggest: Brain, seo_toolkit: Search,
  team_access: Users, ip_unblocker: Shield, growth_suite: TrendingUp,
  health_meter: Activity, security_dashboard: Lock,
};

const ACTION_COLORS: Record<string, string> = {
  "IP Unblocker": "#FCA5A5", "AI KB Suggest": "#A78BFA",
  "Ticket": "#60A5FA", "Feature": "#6EE7B7", "Config": "#FCD34D", "Admin": "#94A3B8",
};

function getActionCategory(action: string) {
  if (/unblocker|unblock/i.test(action)) return "IP Unblocker";
  if (/suggest|kb|knowledge/i.test(action)) return "AI KB Suggest";
  if (/ticket/i.test(action)) return "Ticket";
  if (/feature/i.test(action)) return "Feature";
  if (/config/i.test(action)) return "Config";
  return "Admin";
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Feature Toggles
// ═══════════════════════════════════════════════════════════════════════════════
function FeatureTogglesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");

  const { data, isLoading } = useQuery<{ catalogue: Feature[]; flags: FeatureFlag[] }>({
    queryKey: ["cc-features"],
    queryFn: () => apiFetch("/api/admin/command-center/features"),
  });

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ["cc-clients"],
    queryFn: () => apiFetch("/api/admin/clients?limit=200"),
  });

  const toggleMutation = useMutation({
    mutationFn: (body: { feature_key: string; user_id?: string | null; enabled: boolean }) =>
      apiFetch("/api/admin/command-center/features", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cc-features"] }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getGlobalFlag = (key: string) =>
    data?.flags.find(f => f.feature_key === key && f.user_id === null);

  const getClientFlag = (key: string, clientId: string) =>
    data?.flags.find(f => f.feature_key === key && f.user_id === clientId);

  const isGlobalEnabled = (key: string) => {
    const flag = getGlobalFlag(key);
    return flag ? flag.enabled : true; // default on
  };

  const filteredClients = (clientsData?.clients ?? []).filter(c =>
    !clientSearch || `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(clientSearch.toLowerCase())
  );

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  const catalogue = data?.catalogue ?? [];

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {["AI", "Tools", "Security", "Growth"].map(cat => {
          const catFeatures = catalogue.filter(f => f.category === cat);
          const enabledCount = catFeatures.filter(f => isGlobalEnabled(f.key)).length;
          const c = CAT_COLORS[cat] ?? CAT_COLORS["AI"];
          return (
            <div key={cat} className="rounded-2xl border p-4 flex flex-col gap-1"
              style={{ background: c.bg, borderColor: c.border }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: c.text }}>{cat}</p>
              <p className="text-2xl font-black text-foreground">{enabledCount}<span className="text-base font-normal text-muted-foreground">/{catFeatures.length}</span></p>
              <p className="text-[11px] text-muted-foreground">features on</p>
            </div>
          );
        })}
      </div>

      {/* Feature cards */}
      <div className="space-y-3">
        {catalogue.map(feature => {
          const Icon = FEATURE_ICONS[feature.key] ?? Zap;
          const globalOn = isGlobalEnabled(feature.key);
          const c = CAT_COLORS[feature.category] ?? CAT_COLORS["AI"];
          const isExpanded = expandedKey === feature.key;
          const overrideCount = data?.flags.filter(f => f.feature_key === feature.key && f.user_id !== null).length ?? 0;

          return (
            <div key={feature.key} className="bg-card border border-border rounded-2xl overflow-hidden transition-shadow hover:shadow-md">
              {/* Feature row */}
              <div className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.bg }}>
                  <Icon size={18} style={{ color: c.text }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground text-sm">{feature.label}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                      {feature.category}
                    </span>
                    {overrideCount > 0 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        {overrideCount} override{overrideCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{feature.description}</p>
                </div>
                {/* Global toggle */}
                <button
                  onClick={() => toggleMutation.mutate({ feature_key: feature.key, user_id: null, enabled: !globalOn })}
                  disabled={toggleMutation.isPending}
                  className="flex items-center gap-2 shrink-0 transition-colors"
                  title={globalOn ? "Globally enabled — click to disable" : "Globally disabled — click to enable"}
                >
                  {toggleMutation.isPending
                    ? <Loader2 size={22} className="animate-spin text-muted-foreground" />
                    : globalOn
                      ? <ToggleRight size={32} style={{ color: "#22C55E" }} />
                      : <ToggleLeft size={32} className="text-muted-foreground/40" />
                  }
                </button>
                {/* Per-client expander */}
                <button
                  onClick={() => setExpandedKey(isExpanded ? null : feature.key)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-1 shrink-0"
                >
                  <Users size={13} />
                  <span className="hidden sm:inline">Per-client</span>
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              </div>

              {/* Per-client overrides panel */}
              {isExpanded && (
                <div className="border-t border-border/60 p-4 bg-secondary/20">
                  <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Users size={12} /> Per-Client Overrides
                    <span className="text-muted-foreground font-normal">— overrides the global setting for specific clients</span>
                  </p>
                  <Input
                    placeholder="Search clients by name or email…"
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    className="mb-3 h-8 text-xs"
                  />
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {filteredClients.slice(0, 30).map(client => {
                      const flag = getClientFlag(feature.key, client.id);
                      const clientOn = flag ? flag.enabled : globalOn;
                      const hasOverride = !!flag;
                      return (
                        <div key={client.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
                            style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}>
                            {client.firstName?.[0]}{client.lastName?.[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{client.firstName} {client.lastName}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{client.email}</p>
                          </div>
                          {hasOverride && (
                            <span className="text-[10px] text-primary font-semibold px-1.5 py-0.5 rounded bg-primary/10">override</span>
                          )}
                          <button
                            onClick={() => toggleMutation.mutate({ feature_key: feature.key, user_id: client.id, enabled: !clientOn })}
                            className="shrink-0"
                          >
                            {clientOn
                              ? <ToggleRight size={24} style={{ color: "#22C55E" }} />
                              : <ToggleLeft size={24} className="text-muted-foreground/40" />
                            }
                          </button>
                          {hasOverride && (
                            <button
                              onClick={async () => {
                                await apiFetch("/api/admin/command-center/features", {
                                  method: "PUT",
                                  body: JSON.stringify({ feature_key: feature.key, user_id: client.id, enabled: globalOn }),
                                });
                                qc.invalidateQueries({ queryKey: ["cc-features"] });
                              }}
                              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors shrink-0"
                              title="Reset to global default"
                            >
                              reset
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {filteredClients.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No clients found</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Dynamic Configuration
// ═══════════════════════════════════════════════════════════════════════════════
function DynamicConfigTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedSection, setSavedSection] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ config: ConfigRow[]; defaults: Record<string, string> }>({
    queryKey: ["cc-config"],
    queryFn: () => apiFetch("/api/admin/command-center/config"),
  });

  useEffect(() => {
    if (!data) return;
    const map: Record<string, string> = { ...data.defaults };
    for (const row of data.config) map[row.key] = row.value;
    setLocalConfig(map);
  }, [data]);

  const set = (key: string, val: string) => setLocalConfig(prev => ({ ...prev, [key]: val }));

  const saveSection = async (prefix: string) => {
    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      for (const [k, v] of Object.entries(localConfig)) {
        if (k.startsWith(prefix)) updates[k] = v;
      }
      await apiFetch("/api/admin/command-center/config-bulk", {
        method: "PUT",
        body: JSON.stringify({ updates }),
      });
      qc.invalidateQueries({ queryKey: ["cc-config"] });
      setSavedSection(prefix);
      setTimeout(() => setSavedSection(null), 2000);
      toast({ title: "Saved", description: "Configuration updated and persisted to PostgreSQL." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  const thresholdFields = [
    { key: "health.cpu_warning",   label: "CPU Warning",    unit: "%", desc: "Show amber warning when CPU exceeds this" },
    { key: "health.cpu_critical",  label: "CPU Critical",   unit: "%", desc: "Show red alert when CPU exceeds this" },
    { key: "health.ram_warning",   label: "RAM Warning",    unit: "%", desc: "Show amber warning when RAM exceeds this" },
    { key: "health.ram_critical",  label: "RAM Critical",   unit: "%", desc: "Show red alert when RAM exceeds this" },
    { key: "health.disk_warning",  label: "Disk Warning",   unit: "%", desc: "Show amber warning when disk exceeds this" },
    { key: "health.disk_critical", label: "Disk Critical",  unit: "%", desc: "Show red alert when disk exceeds this" },
    { key: "health.speed_warning", label: "Speed Min",      unit: "score", desc: "Speed score below this is flagged as slow" },
  ];

  const upsellFields = [
    { key: "upsell.banner_disk",    label: "Disk Upsell Banner",    desc: "Shown when disk usage > warning threshold" },
    { key: "upsell.banner_cpu",     label: "CPU Upsell Banner",     desc: "Shown when CPU usage > warning threshold" },
    { key: "upsell.banner_ram",     label: "RAM Upsell Banner",     desc: "Shown when RAM usage > warning threshold" },
    { key: "upsell.banner_speed",   label: "Speed Upsell Banner",   desc: "Shown when speed score < minimum threshold" },
    { key: "upsell.banner_default", label: "Default Upsell Banner", desc: "Shown when all metrics are within healthy range" },
  ];

  return (
    <div className="space-y-8">
      {/* Health Meter Thresholds */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3"
          style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.06),transparent)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.12)" }}>
              <SlidersHorizontal size={16} style={{ color: "#FCD34D" }} />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">Health Meter Thresholds</h3>
              <p className="text-xs text-muted-foreground">Numeric thresholds that drive the warning/critical states on the client Health Meter</p>
            </div>
          </div>
          <Button size="sm" onClick={() => saveSection("health.")} disabled={saving}
            className={`gap-2 shrink-0 ${savedSection === "health." ? "bg-emerald-600 hover:bg-emerald-700" : "bg-primary"}`}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : savedSection === "health." ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {savedSection === "health." ? "Saved!" : "Save Thresholds"}
          </Button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {thresholdFields.map(f => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-2">
                {f.label}
                <span className="text-muted-foreground font-normal text-[10px]">({f.unit})</span>
              </label>
              <p className="text-[11px] text-muted-foreground leading-snug">{f.desc}</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0} max={f.unit === "%" ? 100 : 150}
                  value={localConfig[f.key] ?? ""}
                  onChange={e => set(f.key, e.target.value)}
                  className="h-8 text-sm w-full"
                />
                <span className="text-xs text-muted-foreground shrink-0">{f.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upsell Banners */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3"
          style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.06),transparent)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.12)" }}>
              <Megaphone size={16} style={{ color: "#6EE7B7" }} />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">Upselling Banner Text</h3>
              <p className="text-xs text-muted-foreground">The recommendation text shown to clients based on their resource usage — no code changes required</p>
            </div>
          </div>
          <Button size="sm" onClick={() => saveSection("upsell.")} disabled={saving}
            className={`gap-2 shrink-0 ${savedSection === "upsell." ? "bg-emerald-600 hover:bg-emerald-700" : "bg-primary"}`}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : savedSection === "upsell." ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {savedSection === "upsell." ? "Saved!" : "Save Banners"}
          </Button>
        </div>
        <div className="p-5 space-y-4">
          {upsellFields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">{f.label}</label>
              <p className="text-[11px] text-muted-foreground">{f.desc}</p>
              <Textarea
                value={localConfig[f.key] ?? ""}
                onChange={e => set(f.key, e.target.value)}
                rows={2}
                className="text-sm resize-none"
                placeholder="Enter upsell banner text…"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Live Activity Feed
// ═══════════════════════════════════════════════════════════════════════════════
function LiveActivityTab() {
  const [filter, setFilter] = useState<string>("All");
  const [isLive, setIsLive] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const prevIdRef = useRef<number>(0);

  const { data, refetch, isLoading, isFetching } = useQuery<{ events: ActivityEvent[] }>({
    queryKey: ["cc-activity"],
    queryFn: () => apiFetch("/api/admin/command-center/activity?limit=80"),
    refetchInterval: isLive ? 3000 : false,
  });

  const events = data?.events ?? [];

  useEffect(() => {
    if (!events.length) return;
    const latestId = events[0]?.id ?? 0;
    if (prevIdRef.current && latestId > prevIdRef.current) {
      setNewCount(c => c + (latestId - prevIdRef.current));
    }
    prevIdRef.current = latestId;
  }, [events]);

  const FILTER_OPTIONS = ["All", "IP Unblocker", "AI KB Suggest", "Ticket", "Feature", "Config"];

  const filtered = events.filter(e => filter === "All" || getActionCategory(e.action) === filter);

  return (
    <div>
      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <button
            onClick={() => { setIsLive(v => !v); setNewCount(0); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
            style={isLive
              ? { background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.3)", color: "#4ADE80" }
              : { background: "transparent", borderColor: "rgba(255,255,255,0.15)", color: "var(--muted-foreground)" }
            }
          >
            <span className={`w-2 h-2 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`} />
            {isLive ? "LIVE" : "PAUSED"}
            {newCount > 0 && isLive && (
              <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-black">{newCount}</span>
            )}
          </button>
          <button
            onClick={() => { refetch(); setNewCount(0); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <Filter size={12} className="text-muted-foreground self-center" />
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all"
              style={filter === opt
                ? { background: "rgba(99,102,241,0.18)", borderColor: "rgba(99,102,241,0.4)", color: "#818CF8" }
                : { background: "transparent", borderColor: "rgba(255,255,255,0.1)", color: "var(--muted-foreground)" }
              }
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <Radio size={32} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-semibold text-foreground">No activity yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Actions like IP unblocks, AI suggestions, and ticket submissions will appear here in real-time.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="px-4 py-2.5 border-b border-border/60 bg-secondary/30 grid grid-cols-12 gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <div className="col-span-1" />
            <div className="col-span-4">Client</div>
            <div className="col-span-5">Action</div>
            <div className="col-span-2 text-right">When</div>
          </div>
          <div className="divide-y divide-border/50 max-h-[520px] overflow-y-auto">
            {filtered.map((event, i) => {
              const cat = getActionCategory(event.action);
              const dotColor = ACTION_COLORS[cat] ?? "#94A3B8";
              const isNew = i === 0 && newCount > 0 && isLive;
              return (
                <div key={event.id}
                  className="px-4 py-3 grid grid-cols-12 gap-3 items-center hover:bg-secondary/20 transition-colors"
                  style={isNew ? { background: "rgba(99,102,241,0.05)" } : {}}>
                  {/* Dot */}
                  <div className="col-span-1 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor, boxShadow: isNew ? `0 0 6px ${dotColor}` : "none" }} />
                  </div>
                  {/* Client */}
                  <div className="col-span-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
                        style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)", flexShrink: 0 }}>
                        {event.user_name ? event.user_name[0]?.toUpperCase() : <User size={10} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {event.user_name || event.user_email || event.user_id.slice(0, 8) + "…"}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{event.user_email}</p>
                      </div>
                    </div>
                  </div>
                  {/* Action */}
                  <div className="col-span-5 min-w-0">
                    <p className="text-xs text-foreground/90 truncate leading-snug">{event.action}</p>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 inline-block"
                      style={{ background: `${dotColor}18`, color: dotColor }}>
                      {cat}
                    </span>
                  </div>
                  {/* Time */}
                  <div className="col-span-2 text-right">
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border/60 bg-secondary/20 flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              Showing {filtered.length} event{filtered.length !== 1 ? "s" : ""} · Persisted in PostgreSQL
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Circle size={7} className="fill-emerald-500 text-emerald-500 animate-pulse" />
              Updates every 3s
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main export — wires 3 tabs into MasterPage
// ═══════════════════════════════════════════════════════════════════════════════
export default function CommandCenter() {
  return (
    <MasterPage
      title="Central Command Center"
      description="Master control for feature flags, dynamic configuration, and live client activity monitoring."
      icon={Zap}
      defaultTab="features"
      tabs={[
        {
          id: "features",
          label: "Feature Management",
          icon: ToggleRight,
          desc: "Master toggles — enable or disable features globally or per client",
          component: FeatureTogglesTab,
        },
        {
          id: "config",
          label: "Dynamic Config",
          icon: Sliders,
          desc: "Edit health thresholds and upsell banners without touching code",
          component: DynamicConfigTab,
        },
        {
          id: "activity",
          label: "Live Activity",
          icon: Radio,
          desc: "Real-time stream of advanced tool usage across all clients",
          component: LiveActivityTab,
        },
      ]}
    />
  );
}
