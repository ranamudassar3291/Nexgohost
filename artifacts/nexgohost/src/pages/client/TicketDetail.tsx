import { useState } from "react";
import { useGetTicket, useReplyToTicket } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ArrowLeft, User, ShieldAlert, Send } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";

export default function ClientTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: ticket, isLoading } = useGetTicket(id!);
  const replyMutation = useReplyToTicket();
  const queryClient = useQueryClient();
  
  const [message, setMessage] = useState("");

  if (isLoading) return <div className="p-12 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!ticket) return <div>Ticket not found</div>;

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    replyMutation.mutate({ id: ticket.id, data: { message } }, {
      onSuccess: () => {
        setMessage("");
        queryClient.invalidateQueries({ queryKey: [`/api/tickets/${id}`] });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/client/tickets" className="p-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-display font-bold text-foreground">{ticket.subject}</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  ticket.status === 'open' ? 'bg-primary/10 text-primary border-primary/20' : 
                  ticket.status === 'answered' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                  'bg-secondary text-muted-foreground border-border'
                }`}>
              {ticket.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">#{ticket.ticketNumber} • {ticket.department} • Priority: {ticket.priority}</p>
        </div>
      </div>

      <div className="space-y-6 mt-8">
        {ticket.messages?.map((msg, index) => {
          const isAdmin = msg.senderRole === 'admin';
          return (
            <div key={msg.id} className={`flex gap-4 ${isAdmin ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                isAdmin ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-secondary border-border text-foreground'
              }`}>
                {isAdmin ? <ShieldAlert size={18} /> : <User size={18} />}
              </div>
              
              <div className={`max-w-[80%] rounded-2xl p-5 ${
                isAdmin 
                  ? 'bg-primary/5 border border-primary/20 rounded-tr-sm' 
                  : 'bg-card border border-border shadow-md rounded-tl-sm'
              }`}>
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  <span className="font-bold text-foreground/80">{msg.senderName}</span>
                  <span>•</span>
                  <span>{format(new Date(msg.createdAt), 'MMM d, h:mm a')}</span>
                  {isAdmin && <span className="bg-primary/20 text-primary px-1.5 rounded text-[10px] uppercase font-bold tracking-wider">Staff</span>}
                </div>
                <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {msg.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {ticket.status !== 'closed' && (
        <div className="bg-card border border-border rounded-2xl p-4 shadow-lg mt-8">
          <form onSubmit={handleReply}>
            <Textarea 
              placeholder="Type your reply here..." 
              className="min-h-[120px] bg-background border-border focus:ring-primary/20 resize-none text-base p-4"
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
            <div className="flex justify-end mt-4">
              <Button type="submit" disabled={replyMutation.isPending || !message.trim()} className="bg-primary hover:bg-primary/90 text-white gap-2 px-6">
                <Send size={16} /> Send Reply
              </Button>
            </div>
          </form>
        </div>
      )}
      
      {ticket.status === 'closed' && (
        <div className="bg-secondary/50 border border-border border-dashed rounded-xl p-4 text-center text-muted-foreground text-sm">
          This ticket has been closed. If you need further assistance, please open a new ticket.
        </div>
      )}
    </div>
  );
}
