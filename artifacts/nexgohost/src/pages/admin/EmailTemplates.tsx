import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Plus, Pencil, X, ToggleLeft, ToggleRight, Loader2, Eye, Save, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface EmailTemplate {
  id: string; name: string; slug: string; subject: string;
  body: string; variables: string[]; isActive: boolean; createdAt: string;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

function insertVar(body: string, setBody: (b: string) => void, variable: string) {
  setBody(body + variable);
}

function previewBody(body: string): string {
  const samples: Record<string, string> = {
    "{client_name}": "John Smith", "{invoice_id}": "INV-2024-001", "{amount}": "$9.99",
    "{due_date}": "Jan 31, 2025", "{payment_date}": "Jan 15, 2025", "{company_name}": "Nexgohost",
    "{domain}": "example.com", "{username}": "jsmith001", "{password}": "••••••••",
    "{cpanel_url}": "https://server.nexgohost.com:2083", "{ns1}": "ns1.nexgohost.com",
    "{ns2}": "ns2.nexgohost.com", "{webmail_url}": "https://server.nexgohost.com/webmail",
    "{service_name}": "Starter Plan", "{order_id}": "ORD-12345", "{reset_link}": "https://nexgohost.com/reset/...",
    "{ticket_number}": "TKT-001", "{ticket_subject}": "Help with DNS", "{department}": "Technical",
    "{reply_body}": "Thank you for contacting us...", "{ticket_url}": "https://nexgohost.com/tickets/001",
    "{client_area_url}": "https://nexgohost.com/client", "{reason}": "Overdue invoice",
    "{cancel_date}": "Jan 31, 2025",
  };
  return body.replace(/\{[a-z_]+\}/g, match => samples[match] || match);
}

const EMPTY = { name: "", slug: "", subject: "", body: "", variables: [] as string[] };

function slugify(s: string) { return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""); }

export default function EmailTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["admin-email-templates"],
    queryFn: () => apiFetch("/api/admin/email-templates"),
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm(f => ({
      ...f,
      [field]: value,
      ...(field === "name" && !editing ? { slug: slugify(value) } : {}),
    }));
  };

  const openEdit = (t: EmailTemplate) => {
    setEditing(t);
    setForm({ name: t.name, slug: t.slug, subject: t.subject, body: t.body, variables: t.variables });
    setShowForm(true);
    setPreview(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
    setPreview(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.subject || !form.body) {
      toast({ title: "Error", description: "Name, subject, and body required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      // Extract variables from body
      const vars = Array.from(new Set(form.body.match(/\{[a-z_]+\}/g) || []));
      const payload = { ...form, variables: vars };
      if (editing) {
        await apiFetch(`/api/admin/email-templates/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
        toast({ title: "Template updated" });
      } else {
        await apiFetch("/api/admin/email-templates", { method: "POST", body: JSON.stringify(payload) });
        toast({ title: "Template created" });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] });
      setShowForm(false); setEditing(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleToggle = async (t: EmailTemplate) => {
    try {
      await apiFetch(`/api/admin/email-templates/${t.id}`, { method: "PUT", body: JSON.stringify({ isActive: !t.isActive }) });
      queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Email Templates</h1>
          <p className="text-muted-foreground text-sm">System emails sent to clients automatically</p>
        </div>
        <Button onClick={openNew} className="bg-primary hover:bg-primary/90">
          <Plus size={16} className="mr-2" /> New Template
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">{editing ? `Edit: ${editing.name}` : "New Email Template"}</h2>
                <p className="text-xs text-muted-foreground">Variables auto-extracted from body</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPreview(p => !p)}>
                <Eye size={14} className="mr-1.5" /> {preview ? "Edit" : "Preview"}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { setShowForm(false); setEditing(null); }}>
                <X size={18} />
              </Button>
            </div>
          </div>
          <form onSubmit={handleSave} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Template Name *</label>
                <Input value={form.name} onChange={set("name")} placeholder="Invoice Created" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Slug</label>
                <Input value={form.slug} onChange={set("slug")} placeholder="invoice-created" disabled={!!editing} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Subject *</label>
              <Input value={form.subject} onChange={set("subject")} placeholder="Invoice #{invoice_id} for {client_name}" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Body *</label>
              {preview ? (
                <div className="w-full rounded-xl border border-input bg-background p-4 text-sm min-h-48 whitespace-pre-wrap font-mono leading-relaxed">
                  {previewBody(form.body)}
                </div>
              ) : (
                <textarea
                  value={form.body}
                  onChange={set("body")}
                  rows={12}
                  placeholder="Email body... use {variable_name} for dynamic content"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y font-mono"
                />
              )}
            </div>
            {/* Variables detected */}
            {form.body && (
              <div className="flex flex-wrap gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5 mr-1"><Tag size={12} /> Variables detected:</span>
                {(Array.from(new Set(form.body.match(/\{[a-z_]+\}/g) || []))).map(v => (
                  <span key={v} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-mono">{v}</span>
                ))}
                {!(form.body.match(/\{[a-z_]+\}/g)) && <span className="text-xs text-muted-foreground">None — add variables using {"{variable_name}"} syntax</span>}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
                {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                {saving ? "Saving..." : (editing ? "Save Changes" : "Create Template")}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-secondary/50 border-b border-border">
              <th className="p-4 text-sm font-medium text-muted-foreground">Template</th>
              <th className="p-4 text-sm font-medium text-muted-foreground">Subject</th>
              <th className="p-4 text-sm font-medium text-muted-foreground">Variables</th>
              <th className="p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="p-4 text-sm font-medium text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" /></td></tr>
            ) : templates.map(t => (
              <tr key={t.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                <td className="p-4">
                  <div className="font-medium text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{t.slug}</div>
                </td>
                <td className="p-4 text-sm text-muted-foreground max-w-xs truncate">{t.subject}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {t.variables.slice(0, 3).map(v => (
                      <span key={v} className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-md font-mono">{v}</span>
                    ))}
                    {t.variables.length > 3 && <span className="text-xs text-muted-foreground">+{t.variables.length - 3}</span>}
                  </div>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${t.isActive ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-secondary text-muted-foreground border-border"}`}>
                    {t.isActive ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleToggle(t)}>
                      {t.isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} className="text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(t)}>
                      <Pencil size={15} className="text-muted-foreground" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
