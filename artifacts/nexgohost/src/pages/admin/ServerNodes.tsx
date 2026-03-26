import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Server, Plus, Pencil, Trash2, Wifi, Globe } from "lucide-react";

interface ServerNode {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  checkType: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  hosting: Server, vps: Server, network: Wifi, dns: Globe,
};

const empty = { name: "", type: "hosting", host: "", port: 80, checkType: "http", isActive: true, sortOrder: 0 };

export default function ServerNodes() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServerNode | null>(null);
  const [form, setForm] = useState(empty);

  const { data, isLoading } = useQuery<{ nodes: ServerNode[] }>({
    queryKey: ["admin-server-nodes"],
    queryFn: () => apiFetch("/api/admin/server-nodes"),
  });

  const save = useMutation({
    mutationFn: (body: typeof form) => editing
      ? apiFetch(`/api/admin/server-nodes/${editing.id}`, { method: "PUT", body: JSON.stringify(body) })
      : apiFetch("/api/admin/server-nodes", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-server-nodes"] });
      toast({ title: editing ? "Node updated" : "Node added" });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/server-nodes/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-server-nodes"] }); toast({ title: "Node removed" }); },
  });

  const openEdit = (n: ServerNode) => {
    setEditing(n);
    setForm({ name: n.name, type: n.type, host: n.host, port: n.port, checkType: n.checkType, isActive: n.isActive, sortOrder: n.sortOrder });
    setOpen(true);
  };

  const nodes = data?.nodes ?? [];

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Server size={22} className="text-primary" /> Server Nodes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Configure nodes shown on the public status page.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open("/status", "_blank")} className="gap-1.5">
            <Globe size={14} /> View Status Page
          </Button>
          <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }} className="gap-2">
            <Plus size={16} /> Add Node
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : nodes.length === 0 ? (
            <div className="p-12 text-center">
              <Server size={36} className="text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No nodes yet. Add your first server node to appear on the status page.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {nodes.map(n => {
                const Icon = TYPE_ICONS[n.type] ?? Server;
                return (
                  <div key={n.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Icon size={14} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{n.name}</span>
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground px-1.5 py-0.5 rounded border border-border/50 bg-muted/50">{n.type}</span>
                        {!n.isActive && <span className="text-[10px] text-muted-foreground">(hidden)</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.host}:{n.port} — {n.checkType.toUpperCase()} check</p>
                    </div>
                    <Switch checked={n.isActive} onCheckedChange={() => save.mutate({ ...{ name: n.name, type: n.type, host: n.host, port: n.port, checkType: n.checkType, sortOrder: n.sortOrder }, isActive: !n.isActive })} />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(n)}><Pencil size={14} /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove.mutate(n.id)}><Trash2 size={14} /></Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={o => { if (!o) { setOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Node" : "Add Server Node"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Node Name</Label>
                <Input placeholder="Main Hosting Node PK-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hosting">Hosting</SelectItem>
                    <SelectItem value="vps">VPS</SelectItem>
                    <SelectItem value="network">Network</SelectItem>
                    <SelectItem value="dns">DNS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Check Type</Label>
                <Select value={form.checkType} onValueChange={v => setForm(f => ({ ...f, checkType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="https">HTTPS</SelectItem>
                    <SelectItem value="tcp">TCP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Host / IP</Label>
                <Input placeholder="192.168.1.1 or example.com" value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Port</Label>
                <Input type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Sort Order</Label>
                <Input type="number" min={0} value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <Label>Active (show on status page)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.name || !form.host}>
              {save.isPending ? "Saving…" : editing ? "Save Changes" : "Add Node"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
