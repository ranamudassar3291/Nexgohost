import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Mail, Plus, Pencil, X, ToggleLeft, ToggleRight, Loader2,
  Eye, Code, Save, Tag, Send, CheckCircle, Info,
} from "lucide-react";
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

/** Sample values for template preview */
const SAMPLES: Record<string, string> = {
  client_name: "John Smith",
  verification_code: "847291",
  invoice_id: "INV-2024-001",
  amount: "$9.99",
  due_date: "Jan 31, 2025",
  payment_date: "Jan 15, 2025",
  company_name: "Noehost",
  domain: "example.com",
  username: "jsmith001",
  password: "MyP@ssw0rd!",
  cpanel_url: "https://server.noehost.com:2083",
  ns1: "ns1.noehost.com",
  ns2: "ns2.noehost.com",
  webmail_url: "https://server.noehost.com/webmail",
  service_name: "Starter Plan",
  order_id: "ORD-12345",
  reset_link: "https://noehost.com/reset/sample-link",
  ticket_number: "TKT-001",
  ticket_subject: "Help with DNS",
  department: "Technical",
  reply_body: "Thank you for contacting us...",
  ticket_url: "https://noehost.com/tickets/001",
  client_area_url: "https://noehost.com/client",
  reason: "Overdue invoice",
  cancel_date: "Jan 31, 2025",
};

function renderPreview(body: string): string {
  return body
    .replace(/\{\{([a-z_]+)\}\}/g, (_, k) => SAMPLES[k] ?? `{{${k}}}`)
    .replace(/\{([a-z_]+)\}/g,     (_, k) => SAMPLES[k] ?? `{${k}}`);
}

/** Extract all variable names from template body */
function extractVars(body: string): string[] {
  const doubleBrace = (body.match(/\{\{([a-z_]+)\}\}/g) || []);
  const singleBrace = (body.match(/\{([a-z_]+)\}/g) || []);
  return Array.from(new Set([...doubleBrace, ...singleBrace]));
}

function slugify(s: string) { return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""); }

const EMPTY = { name: "", slug: "", subject: "", body: "", variables: [] as string[] };

export default function EmailTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [previewMode, setPreviewMode] = useState<"code" | "html">("code");
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
    setPreviewMode("code");
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
    setPreviewMode("code");
  };

  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.subject || !form.body) {
      toast({ title: "Error", description: "Name, subject, and body required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const vars = extractVars(form.body);
      const payload = { ...form, variables: vars };
      if (editing) {
        await apiFetch(`/api/admin/email-templates/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
        toast({ title: "Template updated" });
      } else {
        await apiFetch("/api/admin/email-templates", { method: "POST", body: JSON.stringify(payload) });
        toast({ title: "Template created" });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] });
      closeForm();
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

  const handleSendTest = async () => {
    if (!editing) return;
    if (!testEmail) { toast({ title: "Enter an email address", variant: "destructive" }); return; }
    setSendingTest(true);
    try {
      const data = await apiFetch(`/api/admin/email-templates/${editing.id}/test`, {
        method: "POST",
        body: JSON.stringify({ email: testEmail }),
      });
      if (data.sent) {
        toast({ title: "Test email sent!", description: `Delivered to ${data.sentTo}` });
      } else {
        toast({ title: "Not delivered", description: data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setSendingTest(false); }
  };

  const isHtmlBody = form.body.trimStart().startsWith("<");
  const previewHtml = renderPreview(form.body);
  const detectedVars = extractVars(form.body);

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
          {/* Form header */}
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">{editing ? `Edit: ${editing.name}` : "New Email Template"}</h2>
                <p className="text-xs text-muted-foreground">Use <code className="bg-primary/10 text-primary px-1 rounded">{"{{variable}}"}</code> or <code className="bg-primary/10 text-primary px-1 rounded">{"{variable}"}</code> for dynamic values</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {form.body && (
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("code")}
                    className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${previewMode === "code" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Code size={12} /> Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("html")}
                    className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${previewMode === "html" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Eye size={12} /> Preview
                  </button>
                </div>
              )}
              <Button variant="ghost" size="icon" onClick={closeForm}>
                <X size={18} />
              </Button>
            </div>
          </div>

          <form onSubmit={handleSave} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Template Name *</label>
                <Input value={form.name} onChange={set("name")} placeholder="Email Verification" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Slug (auto-generated)</label>
                <Input value={form.slug} onChange={set("slug")} placeholder="email-verification" disabled={!!editing} className="font-mono text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Subject Line *</label>
              <Input value={form.subject} onChange={set("subject")} placeholder="Verify Your Email Address" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Email Body *</label>

              {previewMode === "html" && form.body ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  {isHtmlBody ? (
                    <iframe
                      ref={iframeRef}
                      srcDoc={previewHtml}
                      className="w-full min-h-[360px] bg-white"
                      sandbox="allow-same-origin"
                      title="Email Preview"
                    />
                  ) : (
                    <div className="bg-white p-6 text-sm text-gray-800 whitespace-pre-wrap font-sans min-h-[200px] leading-relaxed">
                      {previewHtml}
                    </div>
                  )}
                </div>
              ) : (
                <textarea
                  value={form.body}
                  onChange={set("body")}
                  rows={14}
                  placeholder={`Plain text or full HTML.\n\nExamples:\n  {{client_name}}  or  {client_name}\n  {{verification_code}}  or  {verification_code}`}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y font-mono leading-relaxed"
                />
              )}
            </div>

            {/* Detected variables */}
            {detectedVars.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5 mr-1"><Tag size={12} /> Variables detected:</span>
                {detectedVars.map(v => (
                  <span key={v} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-mono">{v}</span>
                ))}
              </div>
            )}

            {/* HTML body tip */}
            {isHtmlBody && (
              <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-400">HTML mode detected. Use the Preview tab to see how this email will look in a client's inbox.</p>
              </div>
            )}

            {/* Send test + Save buttons */}
            <div className="flex flex-col gap-3 pt-1">
              {/* Test send row (only when editing) */}
              {editing && (
                <div className="flex gap-2 p-3 bg-secondary/30 rounded-xl border border-border">
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={e => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                    className="flex-1 h-9 text-sm"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleSendTest} disabled={sendingTest} className="shrink-0">
                    {sendingTest ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Send size={14} className="mr-1.5" />}
                    {sendingTest ? "Sending…" : "Send Test"}
                  </Button>
                </div>
              )}

              <div className="flex gap-3">
                <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
                  {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                  {saving ? "Saving..." : (editing ? "Save Changes" : "Create Template")}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Templates table */}
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
                  <div className="font-medium text-foreground flex items-center gap-2">
                    {t.name}
                    {t.slug === "email-verification" && (
                      <span className="px-1.5 py-0.5 bg-violet-500/10 text-violet-400 text-[10px] rounded-md border border-violet-500/20 font-medium">System</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{t.slug}</div>
                </td>
                <td className="p-4 text-sm text-muted-foreground max-w-xs truncate">{t.subject}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {t.variables.slice(0, 3).map(v => (
                      <span key={v} className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-md font-mono">{v}</span>
                    ))}
                    {t.variables.length > 3 && <span className="text-xs text-muted-foreground">+{t.variables.length - 3}</span>}
                    {t.variables.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${t.isActive ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-secondary text-muted-foreground border-border"}`}>
                    {t.isActive && <CheckCircle size={10} />}
                    {t.isActive ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleToggle(t)} title={t.isActive ? "Disable" : "Enable"}>
                      {t.isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} className="text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(t)} title="Edit">
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
