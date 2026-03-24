import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Server, Globe, Calendar, Settings, Cpu, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface HostingService {
  id: string;
  planName: string;
  domain: string | null;
  status: string;
  nextDueDate: string | null;
  cancelRequested: boolean;
}

async function apiFetch(url: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const statusColors: Record<string, string> = {
  active:    "bg-green-500/10 text-green-400 border-green-500/20",
  suspended: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  terminated:"bg-red-500/10 text-red-400 border-red-500/20",
  pending:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

function isVpsService(planName: string) {
  return /^vps/i.test(planName) || /virtual\s*private/i.test(planName);
}

export default function ClientHosting() {
  const [, setLocation] = useLocation();

  const { data: services = [], isLoading } = useQuery<HostingService[]>({
    queryKey: ["client-hosting"],
    queryFn: () => apiFetch("/api/client/hosting"),
  });

  if (isLoading) return (
    <div className="flex justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  const vpsServices     = services.filter(s => isVpsService(s.planName));
  const hostingServices = services.filter(s => !isVpsService(s.planName));

  function ServiceCard({ service }: { service: HostingService }) {
    const isVps = isVpsService(service.planName);
    return (
      <motion.div
        key={service.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/30 transition-colors"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: isVps ? "linear-gradient(135deg, #701AFE20 0%, #9B59FE20 100%)" : "rgba(112,26,254,0.08)" }}>
            {isVps ? <Cpu size={18} className="text-primary" /> : <Server size={18} className="text-primary" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{service.planName}</span>
              {isVps && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                  <Zap size={9}/> VPS
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${statusColors[service.status] || "bg-secondary border-border text-muted-foreground"}`}>
                {service.status}
              </span>
              {service.cancelRequested && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                  Cancel Pending
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground">
              {service.domain && (
                <span className="flex items-center gap-1 text-primary/80">
                  <Globe size={12} /> {service.domain}
                </span>
              )}
              {service.nextDueDate && (
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  Due {format(new Date(service.nextDueDate), "MMM d, yyyy")}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          onClick={() => setLocation(isVps ? `/client/vps/${service.id}` : `/client/hosting/${service.id}`)}
          className="gap-2 shrink-0 bg-primary hover:bg-primary/90"
        >
          {isVps ? <Cpu size={15} /> : <Settings size={15} />}
          {isVps ? "Manage VPS" : "Manage Service"}
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">My Services</h2>
        <p className="text-muted-foreground mt-1">Manage your active hosting services and VPS servers.</p>
      </div>

      {services.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-3xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
            <Server className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground">No Services Yet</h3>
          <p className="text-muted-foreground mt-2 max-w-md">You don't have any hosting plans or VPS servers yet. Browse our plans to get started.</p>
          <div className="flex gap-3 mt-6">
            <Button className="bg-primary" onClick={() => setLocation("/client/orders/new")}>Order Hosting</Button>
            <Button variant="outline" onClick={() => setLocation("/vps")}>View VPS Plans</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* VPS Services Section */}
          {vpsServices.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Cpu size={16} className="text-primary"/>
                <h3 className="text-[15px] font-bold text-foreground">VPS Servers</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                  {vpsServices.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {vpsServices.map(s => <ServiceCard key={s.id} service={s}/>)}
              </div>
            </section>
          )}

          {/* Web Hosting Services Section */}
          {hostingServices.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Server size={16} className="text-primary"/>
                <h3 className="text-[15px] font-bold text-foreground">Web Hosting</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                  {hostingServices.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {hostingServices.map(s => <ServiceCard key={s.id} service={s}/>)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
