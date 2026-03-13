import { useState } from "react";
import { useGetMyMigrations, useRequestMigration } from "@workspace/api-client-react";
import { ArrowRightLeft, Database, Lock, Globe, Server, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function ClientMigrations() {
  const { data: migrations, isLoading } = useGetMyMigrations();
  const requestMutation = useRequestMigration();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ domain: "", oldHostingProvider: "", oldCpanelHost: "", oldCpanelUsername: "", oldCpanelPassword: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestMutation.mutate({ data: formData }, {
      onSuccess: () => {
        toast({ title: "Migration Requested", description: "Our team will begin shortly." });
        setShowForm(false);
        queryClient.invalidateQueries({ queryKey: [`/api/migrations`] });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Website Migrations</h2>
          <p className="text-muted-foreground mt-1">Let our experts move your sites for free.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-lg shadow-primary/20">
          <ArrowRightLeft size={18} /> Request Migration
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-primary/30 rounded-2xl p-6 shadow-2xl shadow-primary/5 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-[60px] pointer-events-none" />
          <h3 className="text-xl font-bold mb-6 font-display">Migration Details</h3>
          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><Globe size={14}/> Domain Name</label>
                <Input required placeholder="example.com" value={formData.domain} onChange={e => setFormData({...formData, domain: e.target.value})} className="bg-background"/>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><Server size={14}/> Current Provider</label>
                <Input placeholder="e.g. GoDaddy, HostGator" value={formData.oldHostingProvider} onChange={e => setFormData({...formData, oldHostingProvider: e.target.value})} className="bg-background"/>
              </div>
            </div>
            
            <div className="p-5 bg-secondary/30 rounded-xl border border-border/50 space-y-5">
              <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-2"><Database size={16}/> cPanel Credentials</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Host / IP</label>
                  <Input required placeholder="192.168.1.1" value={formData.oldCpanelHost} onChange={e => setFormData({...formData, oldCpanelHost: e.target.value})} className="bg-background h-10"/>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Username</label>
                  <Input required placeholder="cpanel_user" value={formData.oldCpanelUsername} onChange={e => setFormData({...formData, oldCpanelUsername: e.target.value})} className="bg-background h-10"/>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium flex items-center gap-1"><Lock size={12}/> Password</label>
                  <Input type="password" required value={formData.oldCpanelPassword} onChange={e => setFormData({...formData, oldCpanelPassword: e.target.value})} className="bg-background h-10"/>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={requestMutation.isPending} className="bg-primary text-white">Submit Request</Button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {isLoading ? (
          <div className="p-12 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
        ) : migrations?.map(migration => (
          <div key={migration.id} className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                {migration.status === 'completed' ? <CheckCircle2 className="text-emerald-500" /> : <Database className="text-primary" />}
              </div>
              <div>
                <h4 className="font-bold text-foreground text-lg">{migration.domain}</h4>
                <p className="text-sm text-muted-foreground mt-0.5 flex gap-2 items-center">
                  <span>From: {migration.oldHostingProvider || 'Unknown'}</span>
                  <span>•</span>
                  <span>Requested: {format(new Date(migration.requestedAt), 'MMM d, yyyy')}</span>
                </p>
              </div>
            </div>
            
            <div className="flex-1 max-w-xs w-full md:ml-auto">
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="uppercase text-muted-foreground">{migration.status.replace('_', ' ')}</span>
                <span className="text-primary">{migration.progress}%</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${
                    migration.status === 'completed' ? 'bg-emerald-500' : 
                    migration.status === 'failed' ? 'bg-red-500' : 'bg-primary'
                  }`} 
                  style={{ width: `${migration.progress}%` }} 
                />
              </div>
            </div>
          </div>
        ))}
        {migrations?.length === 0 && !showForm && (
           <div className="bg-card border border-border border-dashed rounded-3xl p-12 text-center shadow-sm">
             <ArrowRightLeft className="w-12 h-12 mx-auto text-muted-foreground opacity-30 mb-3" />
             <p className="text-muted-foreground">You don't have any active migrations.</p>
           </div>
        )}
      </div>
    </div>
  );
}
