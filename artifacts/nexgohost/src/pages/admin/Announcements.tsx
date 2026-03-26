import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Megaphone, Plus, Pencil, Trash2, AlertTriangle, Info, CheckCircle2, Zap } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  info:    { label: "Info",    icon: Info,         color: "text-blue-600",   bg: "bg-blue-500/10 border-blue-500/20" },
  success: { label: "Success", icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-500/10 border-green-500/20" },
  warning: { label: "Warning", icon: AlertTriangle,color: "text-yellow-600", bg: "bg-yellow-500/10 border-yellow-500/20" },
  urgent:  { label: "Urgent",  icon: Zap,          color: "text-red-600",    bg: "bg-red-500/10 border-red-500/20" },
};

const empty = { title: "", message: "", type: "info", isActive: true, priority: 0 };

export default function Announcements() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(empty);

  const { data, isLoading } = useQuery<{ announcements: Announcement[] }>({
    queryKey: ["admin-announcements"],
    queryFn: () => apiFetch("/api/admin/announcements"),
  });

  const save = useMutation({
    mutationFn: (body: typeof form) => editing
      ? apiFetch(`/api/admin/announcements/${editing.id}`, { method: "PUT", body: JSON.stringify(body) })
      : apiFetch("/api/admin/announcements", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: editing ? "Announcement updated" : "Announcement created" });
      setEditing(null); setCreating(false); setForm(empty);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Announcement deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, current }: { id: string; current: Announcement }) =>
      apiFetch(`/api/admin/announcements/${id}`, { method: "PUT", body: JSON.stringify({ ...current, isActive: !current.isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-announcements"] }),
  });

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({ title: a.title, message: a.message, type: a.type, isActive: a.isActive, priority: a.priority });
    setCreating(true);
  };

  const announcements = data?.announcements ?? [];

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Megaphone size={22} className="text-primary" /> Announcements
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage the scrolling marquee shown on the client dashboard.</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(empty); setCreating(true); }} className="gap-2">
          <Plus size={16} /> New Announcement
        </Button>
      </div>

      {/* Live preview */}
      {announcements.filter(a => a.isActive).length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-primary/70 uppercase tracking-wider">Live Preview</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="overflow-hidden rounded-lg border border-primary/20 bg-background py-2 px-3">
              <div className="flex animate-none">
                <span className="text-sm text-foreground whitespace-nowrap">
                  {announcements.filter(a => a.isActive).map(a => `📢 ${a.title}: ${a.message}`).join("   •   ")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : announcements.length === 0 ? (
            <div className="p-12 text-center">
              <Megaphone size={36} className="text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No announcements yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {announcements.map(a => {
                const cfg = TYPE_CONFIG[a.type] ?? TYPE_CONFIG.info;
                const Icon = cfg.icon;
                return (
                  <div key={a.id} className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors">
                    <div className={`mt-0.5 p-1.5 rounded-lg border ${cfg.bg}`}>
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{a.title}</span>
                        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        {!a.isActive && <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border bg-muted text-muted-foreground">Inactive</span>}
                        {a.priority > 0 && <span className="text-[10px] text-muted-foreground">Priority {a.priority}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.message}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={a.isActive}
                        onCheckedChange={() => toggleActive.mutate({ id: a.id, current: a })}
                        aria-label="Toggle active"
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(a)}>
                        <Pencil size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove.mutate(a.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={creating} onOpenChange={open => { if (!open) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Announcement" : "New Announcement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="e.g. Ramadan Sale — 30% Off All Plans" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea placeholder="e.g. Use code RAMADAN30 at checkout. Offer valid until March 31." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority (higher = first)</Label>
                <Input type="number" min={0} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <Label>Active (shows in marquee)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.title || !form.message}>
              {save.isPending ? "Saving…" : editing ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
