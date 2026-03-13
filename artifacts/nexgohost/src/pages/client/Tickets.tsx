import { useState } from "react";
import { useGetMyTickets, useCreateTicket } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Ticket as TicketIcon, Plus, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function ClientTickets() {
  const { data: tickets, isLoading } = useGetMyTickets();
  const createMutation = useCreateTicket();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ subject: "", message: "", priority: "medium" as any, department: "Technical Support" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ data: formData }, {
      onSuccess: () => {
        toast({ title: "Ticket Created", description: "Support will respond shortly." });
        setShowForm(false);
        setFormData({ subject: "", message: "", priority: "medium", department: "Technical Support" });
        queryClient.invalidateQueries({ queryKey: [`/api/tickets`] });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Support Tickets</h2>
          <p className="text-muted-foreground mt-1">Get help from our expert team.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-lg shadow-primary/20">
          <Plus size={18} /> Open New Ticket
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <h3 className="text-lg font-bold mb-4">Create Support Ticket</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Department</label>
                <select 
                  className="w-full h-11 px-3 rounded-lg bg-background border border-border text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  value={formData.department}
                  onChange={e => setFormData({...formData, department: e.target.value})}
                >
                  <option>Technical Support</option>
                  <option>Billing</option>
                  <option>Sales</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <select 
                  className="w-full h-11 px-3 rounded-lg bg-background border border-border text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  value={formData.priority}
                  onChange={e => setFormData({...formData, priority: e.target.value as any})}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Input 
                required 
                value={formData.subject}
                onChange={e => setFormData({...formData, subject: e.target.value})}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea 
                required 
                rows={5}
                value={formData.message}
                onChange={e => setFormData({...formData, message: e.target.value})}
                className="bg-background resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-primary text-white">
                Submit Ticket
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="p-12 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
        ) : tickets?.map(ticket => (
          <Link key={ticket.id} href={`/client/tickets/${ticket.id}`}>
            <div className="bg-card border border-border/50 hover:border-primary/50 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                  <TicketIcon size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{ticket.subject}</h4>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span className="font-mono text-xs">#{ticket.ticketNumber}</span>
                    <span>•</span>
                    <span>{ticket.department}</span>
                    <span>•</span>
                    <span>Updated {format(new Date(ticket.updatedAt || ticket.createdAt), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 md:pl-4 md:border-l border-border/50 shrink-0 ml-16 md:ml-0">
                <div className="flex items-center gap-1.5 text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md text-xs">
                  <MessageSquare size={14} /> {ticket.messagesCount || 1}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                  ticket.status === 'open' ? 'bg-primary/10 text-primary border-primary/20' : 
                  ticket.status === 'answered' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                  'bg-secondary text-muted-foreground border-border'
                }`}>
                  {ticket.status}
                </span>
              </div>
            </div>
          </Link>
        ))}
        {tickets?.length === 0 && !showForm && (
           <div className="bg-card border border-border border-dashed rounded-3xl p-12 text-center shadow-sm">
             <TicketIcon className="w-12 h-12 mx-auto text-muted-foreground opacity-30 mb-3" />
             <p className="text-muted-foreground">You don't have any support tickets.</p>
           </div>
        )}
      </div>
    </div>
  );
}
