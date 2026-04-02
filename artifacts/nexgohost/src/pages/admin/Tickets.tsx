import { useState } from "react";
import { useGetAllTickets, useCloseTicket, useReplyToTicket, useGetTicket } from "@workspace/api-client-react";
import { Ticket, Search, X, MessageSquare, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";

const priorityColors: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  medium: "bg-[rgba(251,191,36,0.10)] text-[#FBB824] border-[rgba(251,191,36,0.28)]",
  high: "bg-[rgba(251,191,36,0.10)] text-[#FBB824] border-[rgba(251,191,36,0.28)]",
  urgent: "bg-[rgba(255,82,82,0.10)] text-[#FF6B6B] border-[rgba(255,82,82,0.30)]",
};

const statusColors: Record<string, string> = {
  open: "bg-green-500/10 text-green-400 border-green-500/20",
  pending: "bg-[rgba(251,191,36,0.10)] text-[#FBB824] border-[rgba(251,191,36,0.28)]",
  answered: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  closed: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export default function AdminTickets() {
  const { data: tickets = [], isLoading, refetch } = useGetAllTickets();
  const closeTicket = useCloseTicket();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = tickets.filter(t => {
    const matchSearch = t.subject.toLowerCase().includes(search.toLowerCase()) || t.clientName?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || t.status === filter;
    return matchSearch && matchFilter;
  });

  const handleClose = (id: string) => {
    closeTicket.mutate({ id }, {
      onSuccess: () => { toast({ title: "Ticket closed" }); refetch(); },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Support Tickets</h2>
        <p className="text-muted-foreground mt-1">Manage client support requests</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 bg-card border-border" placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "open", "pending", "answered", "closed"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 text-sm rounded-lg border capitalize transition-all ${filter === f ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map(ticket => (
          <div key={ticket.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-mono text-primary">{ticket.ticketNumber}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${statusColors[ticket.status]}`}>{ticket.status}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${priorityColors[ticket.priority]}`}>{ticket.priority}</span>
                </div>
                <h3 className="font-semibold text-foreground">{ticket.subject}</h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>From: <span className="text-foreground/70">{ticket.clientName}</span></span>
                  <span>Dept: {ticket.department}</span>
                  <span>{ticket.messagesCount} messages</span>
                  <span>{format(new Date(ticket.createdAt), "MMM d, yyyy")}</span>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                  <Link href={`/admin/tickets/${ticket.id}`}><MessageSquare className="w-3 h-3 mr-1" /> Reply</Link>
                </Button>
                {ticket.status !== "closed" && (
                  <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => handleClose(ticket.id)}>
                    <X className="w-3 h-3 mr-1" /> Close
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No tickets found</div>
        )}
      </div>
    </div>
  );
}
