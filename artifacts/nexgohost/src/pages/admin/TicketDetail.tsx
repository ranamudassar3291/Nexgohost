import { useState } from "react";
import { useGetTicket, useReplyToTicket, useCloseTicket } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, X } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

export default function AdminTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: ticket, isLoading, refetch } = useGetTicket(id!);
  const replyMutation = useReplyToTicket();
  const closeMutation = useCloseTicket();
  const { toast } = useToast();
  const [reply, setReply] = useState("");

  const handleReply = () => {
    if (!reply.trim()) return;
    replyMutation.mutate({ id: id!, data: { message: reply } }, {
      onSuccess: () => { setReply(""); refetch(); toast({ title: "Reply sent" }); },
      onError: () => toast({ title: "Failed to send reply", variant: "destructive" }),
    });
  };

  const handleClose = () => {
    closeMutation.mutate({ id: id! }, {
      onSuccess: () => { refetch(); toast({ title: "Ticket closed" }); },
    });
  };

  if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!ticket) return <div className="text-center py-12 text-muted-foreground">Ticket not found</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild className="gap-2">
          <Link href="/admin/tickets"><ArrowLeft className="w-4 h-4" /> Back to Tickets</Link>
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-primary">{ticket.ticketNumber}</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20 capitalize">{ticket.status}</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 capitalize">{ticket.priority}</span>
            </div>
            <h2 className="text-xl font-bold text-foreground">{ticket.subject}</h2>
            <p className="text-sm text-muted-foreground mt-1">From: {ticket.clientName} · {ticket.department}</p>
          </div>
          {ticket.status !== "closed" && (
            <Button size="sm" variant="destructive" onClick={handleClose} className="gap-1">
              <X className="w-3 h-3" /> Close Ticket
            </Button>
          )}
        </div>

        <div className="space-y-4 mt-6 border-t border-border pt-6">
          {ticket.messages?.map(msg => (
            <div key={msg.id} className={`flex ${msg.senderRole === "admin" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl p-4 ${msg.senderRole === "admin" ? "bg-primary/10 border border-primary/20" : "bg-secondary border border-border"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-foreground">{msg.senderName}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${msg.senderRole === "admin" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>{msg.senderRole}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(msg.createdAt), "MMM d, h:mm a")}</span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{msg.message}</p>
              </div>
            </div>
          ))}
        </div>

        {ticket.status !== "closed" && (
          <div className="mt-6 space-y-3">
            <Textarea
              placeholder="Type your reply..."
              value={reply}
              onChange={e => setReply(e.target.value)}
              className="min-h-[120px] bg-background border-border"
            />
            <Button onClick={handleReply} disabled={replyMutation.isPending || !reply.trim()} className="gap-2">
              <Send className="w-4 h-4" />
              {replyMutation.isPending ? "Sending..." : "Send Reply"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
