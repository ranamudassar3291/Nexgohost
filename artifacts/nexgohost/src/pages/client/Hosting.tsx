import { useGetMyHosting } from "@workspace/api-client-react";
import { Server, ExternalLink, HardDrive, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClientHosting() {
  const { data: services, isLoading } = useGetMyHosting();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">My Hosting</h2>
        <p className="text-muted-foreground mt-1">Manage your active hosting services and servers.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : services?.length === 0 ? (
        <div className="bg-card border border-border border-dashed rounded-3xl p-12 text-center flex flex-col items-center justify-center shadow-lg">
          <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
            <Server className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground">No Hosting Services</h3>
          <p className="text-muted-foreground mt-2 max-w-md">You don't have any active hosting plans. Browse our plans to get started.</p>
          <Button className="mt-6 bg-primary text-white">Order Hosting</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {services?.map(service => (
            <div key={service.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/5 hover:border-primary/30 transition-colors group">
              <div className="p-6 border-b border-border/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[30px] group-hover:bg-primary/10 transition-colors" />
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{service.planName}</h3>
                    <p className="text-primary font-medium mt-1">{service.domain}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${
                    service.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                  }`}>
                    {service.status}
                  </span>
                </div>
              </div>
              
              <div className="p-6 bg-secondary/10 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background border border-border/50 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                      <HardDrive size={14} /> Server IP
                    </div>
                    <p className="font-mono text-sm">{service.serverIp || 'Pending setup'}</p>
                  </div>
                  <div className="bg-background border border-border/50 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                      <Activity size={14} /> Usage
                    </div>
                    <p className="text-sm font-medium">{service.diskUsed || '0MB'} / {service.bandwidthUsed || '0GB'}</p>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-white" disabled={!service.cpanelUrl}>
                    <ExternalLink size={16} /> Login to cPanel
                  </Button>
                  <Button variant="outline" className="flex-1 bg-background border-border hover:bg-secondary">
                    Manage
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
