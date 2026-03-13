import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Ticket as TicketIcon, Plus, MessageSquare, Loader2, Paperclip, X, Upload,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf", "application/zip"];
const MAX_SIZE_MB = 5;

interface Attachment { name: string; type: string; size: number; data: string; }

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  answered: "bg-green-500/10 text-green-400 border-green-500/20",
  customer_reply: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  closed: "bg-secondary text-muted-foreground border-border",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground", medium: "text-blue-400", high: "text-orange-400", urgent: "text-red-400",
};

export default function ClientTickets() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ subject: "", message: "", priority: "medium", department: "Technical Support" });
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const { data: tickets = [], isLoading } = useQuery<any[]>({
    queryKey: ["client-tickets"],
    queryFn: () => apiFetch("/api/tickets"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/api/tickets", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Ticket Created", description: "Our team will respond shortly." });
      setShowForm(false);
      setFormData({ subject: "", message: "", priority: "medium", department: "Technical Support" });
      setAttachments([]);
      qc.invalidateQueries({ queryKey: ["client-tickets"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const valid: Attachment[] = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({ title: "Invalid file type", description: `${file.name} — only JPG, PNG, PDF, ZIP allowed`, variant: "destructive" }); continue;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds ${MAX_SIZE_MB}MB`, variant: "destructive" }); continue;
      }
      const data = await fileToBase64(file);
      valid.push({ name: file.name, type: file.type, size: file.size, data });
    }
    setAttachments(prev => [...prev, ...valid]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ ...formData, attachments });
  };

  const openCount = tickets.filter(t => t.status === "open" || t.status === "customer_reply").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Support Tickets</h2>
          <p className="text-muted-foreground mt-1">
            {openCount > 0 ? `${openCount} open ticket${openCount > 1 ? "s" : ""}` : "Get help from our expert team."}
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90 gap-2 shadow-lg shadow-primary/20">
          <Plus size={16} /> Open New Ticket
        </Button>
      </div>

      {/* New ticket form */}
      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l-2xl" />
          <h3 className="text-lg font-bold mb-5">New Support Ticket</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Department</label>
                <select className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  value={formData.department} onChange={e => setFormData(d => ({ ...d, department: e.target.value }))}>
                  <option>Technical Support</option>
                  <option>Billing</option>
                  <option>Sales</option>
                  <option>Abuse</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Priority</label>
                <select className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  value={formData.priority} onChange={e => setFormData(d => ({ ...d, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Subject</label>
                <Input required className="bg-background h-10" value={formData.subject} onChange={e => setFormData(d => ({ ...d, subject: e.target.value }))} placeholder="Brief description..." />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message</label>
              <Textarea required rows={5} className="bg-background resize-none" value={formData.message} onChange={e => setFormData(d => ({ ...d, message: e.target.value }))} placeholder="Describe your issue in detail..." />
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Attachments</label>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-2 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-xs">
                    <Paperclip size={12} className="text-muted-foreground" />
                    <span className="max-w-[120px] truncate">{att.name}</span>
                    <span className="text-muted-foreground">({(att.size / 1024).toFixed(0)}KB)</span>
                    <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground border border-dashed border-border rounded-lg hover:border-primary/50 hover:text-primary transition-colors">
                  <Upload size={12} /> Add file
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Allowed: JPG, PNG, PDF, ZIP · Max {MAX_SIZE_MB}MB each</p>
              <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf,.zip" multiple onChange={handleFileChange} />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setAttachments([]); }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-primary gap-2">
                {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <TicketIcon size={16} />}
                Submit Ticket
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Ticket list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : tickets.length === 0 && !showForm ? (
        <div className="bg-card border border-dashed border-border rounded-3xl p-12 text-center">
          <TicketIcon className="w-12 h-12 mx-auto text-muted-foreground opacity-30 mb-3" />
          <h3 className="font-semibold text-foreground">No tickets yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-5">Our team is here when you need help.</p>
          <Button onClick={() => setShowForm(true)} className="bg-primary gap-2"><Plus size={15} /> Open Ticket</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {tickets.map(ticket => (
            <div key={ticket.id} onClick={() => setLocation(`/client/tickets/${ticket.id}`)}
              className="bg-card border border-border/50 hover:border-primary/30 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                    <TicketIcon size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{ticket.subject}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="font-mono">#{ticket.ticketNumber}</span>
                      <span>·</span>
                      <span>{ticket.department}</span>
                      <span>·</span>
                      <span className={`font-medium ${PRIORITY_COLORS[ticket.priority] || ""}`}>{ticket.priority}</span>
                      <span>·</span>
                      <span>{format(new Date(ticket.lastReply || ticket.createdAt), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 ml-14 sm:ml-0 shrink-0">
                  {ticket.attachments?.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Paperclip size={12} /> {ticket.attachments.length}
                    </span>
                  )}
                  <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md text-xs text-muted-foreground">
                    <MessageSquare size={12} /> {ticket.messagesCount || 1}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLORS[ticket.status] || STATUS_COLORS.closed}`}>
                    {ticket.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
