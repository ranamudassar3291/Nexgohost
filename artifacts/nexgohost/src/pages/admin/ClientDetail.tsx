import { useState } from "react";
import { useGetClient, useSuspendClient, useActivateClient } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, User, Mail, Building, Phone, Calendar, Server, Globe, FileText, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function AdminClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: client, isLoading } = useGetClient(id!);
  const suspendMutation = useSuspendClient();
  const activateMutation = useActivateClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'services' | 'domains' | 'invoices' | 'tickets'>('services');

  if (isLoading) return <div className="p-8 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!client) return <div>Client not found</div>;

  const handleStatusToggle = () => {
    const action = client.status === 'active' ? suspendMutation : activateMutation;
    action.mutate({ id: client.id }, {
      onSuccess: () => {
        toast({ title: `Client ${client.status === 'active' ? 'suspended' : 'activated'} successfully` });
        queryClient.invalidateQueries({ queryKey: [`/api/admin/clients/${id}`] });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/admin/clients" className="p-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-2xl font-display font-bold text-foreground">Client Profile</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg shadow-black/5 lg:col-span-1 h-fit relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] -z-10" />
          
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-600 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-primary/20">
              {client.firstName[0]}{client.lastName[0]}
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">{client.firstName} {client.lastName}</h3>
              <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                client.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
              }`}>
                {client.status}
              </span>
            </div>
          </div>

          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground/80">{client.email}</span>
            </div>
            {client.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground/80">{client.phone}</span>
              </div>
            )}
            {client.company && (
              <div className="flex items-center gap-3 text-sm">
                <Building className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground/80">{client.company}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground/80">Joined {format(new Date(client.createdAt), 'MMMM d, yyyy')}</span>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-border flex gap-3 relative z-10">
            <Button className="flex-1 bg-secondary text-foreground hover:bg-secondary/80">Edit</Button>
            <Button 
              variant={client.status === 'active' ? "destructive" : "default"} 
              className="flex-1"
              onClick={handleStatusToggle}
              disabled={suspendMutation.isPending || activateMutation.isPending}
            >
              {client.status === 'active' ? 'Suspend' : 'Activate'}
            </Button>
          </div>
        </div>

        {/* Tabs & Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-1.5 flex gap-1 overflow-x-auto custom-scrollbar shadow-sm">
            {[
              { id: 'services', icon: Server, label: `Hosting (${client.hosting?.length || 0})` },
              { id: 'domains', icon: Globe, label: `Domains (${client.domains?.length || 0})` },
              { id: 'invoices', icon: FileText, label: `Invoices (${client.invoices?.length || 0})` },
              { id: 'tickets', icon: Ticket, label: `Tickets (${client.tickets?.length || 0})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-primary text-white shadow-md shadow-primary/20' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-lg shadow-black/5">
            {activeTab === 'services' && (
              <div className="space-y-4">
                {client.hosting?.map(service => (
                  <div key={service.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-secondary/20 hover:border-border transition-colors">
                    <div>
                      <h4 className="font-bold text-foreground">{service.planName}</h4>
                      <p className="text-sm text-primary">{service.domain}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium border border-border bg-background">
                      {service.status}
                    </span>
                  </div>
                )) || <p className="text-muted-foreground text-center py-4">No hosting services.</p>}
              </div>
            )}
            
            {activeTab === 'domains' && (
              <div className="space-y-4">
                {client.domains?.map(domain => (
                  <div key={domain.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-secondary/20 hover:border-border transition-colors">
                    <div>
                      <h4 className="font-bold text-foreground">{domain.name}</h4>
                      <p className="text-xs text-muted-foreground">Expires: {domain.expiryDate ? format(new Date(domain.expiryDate), 'MMM d, yyyy') : 'N/A'}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium border border-border bg-background">
                      {domain.status}
                    </span>
                  </div>
                )) || <p className="text-muted-foreground text-center py-4">No domains.</p>}
              </div>
            )}

            {activeTab === 'invoices' && (
              <div className="space-y-4">
                {client.invoices?.map(invoice => (
                  <div key={invoice.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-secondary/20 hover:border-border transition-colors">
                    <div>
                      <h4 className="font-bold text-foreground">{invoice.invoiceNumber}</h4>
                      <p className="text-xs text-muted-foreground">{format(new Date(invoice.createdAt), 'MMM d, yyyy')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold">${invoice.total.toFixed(2)}</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        invoice.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                      }`}>
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                )) || <p className="text-muted-foreground text-center py-4">No invoices.</p>}
              </div>
            )}
            
            {activeTab === 'tickets' && (
              <div className="space-y-4">
                {client.tickets?.map(ticket => (
                  <div key={ticket.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-secondary/20 hover:border-border transition-colors">
                    <div>
                      <h4 className="font-bold text-foreground">{ticket.subject}</h4>
                      <p className="text-xs text-muted-foreground">#{ticket.ticketNumber} • {format(new Date(ticket.createdAt), 'MMM d, yyyy')}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium border border-border bg-background">
                      {ticket.status}
                    </span>
                  </div>
                )) || <p className="text-muted-foreground text-center py-4">No support tickets.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
