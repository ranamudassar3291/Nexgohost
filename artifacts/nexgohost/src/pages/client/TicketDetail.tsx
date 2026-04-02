import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, User, ShieldAlert, Send, Loader2, Paperclip, Upload, X,
  CheckCircle, Clock, MessageSquare, Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf", "application/zip"];
const MAX_SIZE_MB = 5;

interface Attachment { name: string; type: string; size: number; data: string; }
interface Message { id: string; senderId?: string; senderName: string; senderRole: string; message: string; createdAt: string; attachments?: Attachment[]; }
interface Ticket {
  id: string; ticketNumber: string; subject: string; department: string;
  priority: string; status: string; createdAt: string; updatedAt: string;
  messages: Message[];
}

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

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  answered: "bg-green-500/10 text-green-400 border-green-500/20",
  customer_reply: "bg-[rgba(251,191,36,0.10)] text-[#FBB824] border-[rgba(251,191,36,0.28)]",
  closed: "bg-secondary text-muted-foreground border-border",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground", medium: "text-blue-400", high: "text-orange-400", urgent: "text-red-400",
};

function AttachmentDisplay({ att }: { att: Attachment }) {
  const isImage = att.type.startsWith("image/");
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = att.data;
    a.download = att.name;
    a.click();
  };
  return (
    <div className="flex items-center gap-2 mt-2">
      {isImage ? (
        <img src={att.data} alt={att.name} className="max-w-xs max-h-48 rounded-lg border border-border cursor-pointer" onClick={handleDownload} />
      ) : (
        <button onClick={handleDownload} className="flex items-center gap-2 bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs hover:bg-secondary transition-colors">
          <Paperclip size={12} className="text-muted-foreground" />
          <span>{att.name}</span>
          <span className="text-muted-foreground">({(att.size / 1024).toFixed(0)}KB)</span>
        </button>
      )}
    </div>
  );
}

export default function ClientTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const { data: ticket, isLoading } = useQuery<Ticket>({
    queryKey: ["ticket", id],
    queryFn: () => apiFetch(`/api/tickets/${id}`),
    refetchInterval: 30000,
  });

  const replyMutation = useMutation({
    mutationFn: (data: any) => apiFetch(`/api/tickets/${id}/reply`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      setMessage("");
      setAttachments([]);
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["client-tickets"] });
      toast({ title: "Reply sent" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const valid: Attachment[] = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) { toast({ title: "Invalid file type", description: `${file.name} not allowed`, variant: "destructive" }); continue; }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) { toast({ title: "File too large", description: `${file.name} exceeds ${MAX_SIZE_MB}MB`, variant: "destructive" }); continue; }
      const data = await fileToBase64(file);
      valid.push({ name: file.name, type: file.type, size: file.size, data });
    }
    setAttachments(prev => [...prev, ...valid]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && attachments.length === 0) return;
    replyMutation.mutate({ message, attachments });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!ticket) return <div className="p-8 text-center text-muted-foreground">Ticket not found.</div>;

  const isClosed = ticket.status === "closed";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => setLocation("/client/tickets")} className="p-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground transition-colors mt-1">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-start gap-3 flex-wrap">
            <h2 className="text-2xl font-display font-bold text-foreground">{ticket.subject}</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border mt-1 ${STATUS_STYLES[ticket.status] || STATUS_STYLES.closed}`}>
              {ticket.status.replace("_", " ")}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="font-mono">#{ticket.ticketNumber}</span>
            <span>·</span>
            <span>{ticket.department}</span>
            <span>·</span>
            <span className={`font-medium ${PRIORITY_COLORS[ticket.priority] || ""}`}>{ticket.priority} priority</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {ticket.messages?.map((msg, idx) => {
          const isAI = msg.senderName === "AI Support" || msg.senderId === "ai-support";
          const isStaff = isAI || msg.senderRole === "admin" || msg.senderRole === "staff";
          return (
            <div key={msg.id || idx} className={`flex gap-3 ${isStaff ? "" : "flex-row-reverse"}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isAI ? "bg-violet-600 text-white" : isStaff ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}>
                {isAI ? <Sparkles size={16} /> : isStaff ? <ShieldAlert size={16} /> : <User size={16} />}
              </div>
              <div className={`flex-1 max-w-2xl ${isStaff ? "" : "flex flex-col items-end"}`}>
                <div className={`rounded-2xl p-4 ${isAI ? "bg-violet-500/10 border border-violet-500/30 rounded-tl-sm" : isStaff ? "bg-card border border-border rounded-tl-sm" : "bg-primary/10 border border-primary/20 rounded-tr-sm"}`}>
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <span className={`text-xs font-semibold flex items-center gap-1.5 ${isAI ? "text-violet-400" : isStaff ? "text-primary" : "text-foreground"}`}>
                      {isStaff
                        ? (msg.senderName ? msg.senderName.replace(/nexgohost/gi, "Noehost") : "Noehost Support")
                        : (msg.senderName || "Client")}
                      {isAI && (
                        <span className="inline-flex items-center gap-0.5 bg-violet-500/20 text-violet-300 text-[9px] px-1.5 py-0.5 rounded-full font-medium">
                          <Sparkles size={8} /> AI
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock size={10} /> {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                  {msg.attachments?.length ? (
                    <div className="mt-2 space-y-1">
                      {msg.attachments.map((att, i) => <AttachmentDisplay key={i} att={att} />)}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply box */}
      {isClosed ? (
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <CheckCircle size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">This ticket is closed. Open a new ticket if you need further help.</p>
          <Button onClick={() => setLocation("/client/tickets")} variant="outline" className="mt-4 gap-2">
            <MessageSquare size={15} /> View All Tickets
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold text-foreground mb-4">Add Reply</h3>
          <form onSubmit={handleReply} className="space-y-4">
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={4}
              className="bg-background resize-none"
            />

            {/* Attachment preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-secondary/50 border border-border rounded-lg px-2.5 py-1 text-xs">
                    <Paperclip size={11} className="text-muted-foreground" />
                    <span className="max-w-[100px] truncate">{att.name}</span>
                    <button type="button" onClick={() => setAttachments(p => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary/50 px-3 py-1.5 rounded-lg transition-colors">
                <Upload size={14} /> Attach File
              </button>
              <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf,.zip" multiple onChange={handleFileChange} />
              <Button type="submit" disabled={replyMutation.isPending || (!message.trim() && attachments.length === 0)} className="bg-primary gap-2">
                {replyMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Send Reply
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
