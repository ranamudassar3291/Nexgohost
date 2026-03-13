import { useState } from "react";
import { useGetAllHostingServices, useGetHostingPlans } from "@workspace/api-client-react";
import { Server, Database, Activity, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AdminHosting() {
  const [activeTab, setActiveTab] = useState<'services' | 'plans'>('services');
  const { data: services, isLoading: isLoadingServices } = useGetAllHostingServices();
  const { data: plans, isLoading: isLoadingPlans } = useGetHostingPlans();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Hosting Manager</h2>
          <p className="text-muted-foreground mt-1">Manage active services and configuration plans.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-1.5 flex gap-1 w-fit shadow-sm">
        <button
          onClick={() => setActiveTab('services')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'services' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:bg-secondary'
          }`}
        >
          <Server size={16} /> Active Services
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'plans' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:bg-secondary'
          }`}
        >
          <Database size={16} /> Hosting Plans
        </button>
      </div>

      {activeTab === 'services' && (
        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border bg-secondary/30 flex justify-between items-center">
            <h3 className="font-semibold font-display">Provisioned Services</h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input placeholder="Search domain..." className="pl-9 h-9 bg-background" />
            </div>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="p-4 font-medium text-muted-foreground">Domain / Server IP</th>
                <th className="p-4 font-medium text-muted-foreground">Client</th>
                <th className="p-4 font-medium text-muted-foreground">Plan</th>
                <th className="p-4 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingServices ? (
                 <tr><td colSpan={4} className="p-8 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></td></tr>
              ) : services?.map(service => (
                <tr key={service.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="p-4">
                    <div className="font-medium text-foreground">{service.domain}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{service.serverIp}</div>
                  </td>
                  <td className="p-4">{service.clientName}</td>
                  <td className="p-4">{service.planName}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      service.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                      {service.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoadingPlans ? (
            <div className="col-span-3 p-12 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
          ) : plans?.map(plan => (
            <div key={plan.id} className="bg-card border border-border rounded-2xl p-6 shadow-lg hover:border-primary/50 transition-colors">
              <h3 className="text-xl font-bold font-display">{plan.name}</h3>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-3xl font-bold">${plan.price}</span>
                <span className="text-muted-foreground mb-1">/{plan.billingCycle}</span>
              </div>
              <ul className="mt-6 space-y-3">
                <li className="flex items-center gap-3 text-sm text-foreground/80">
                  <HardDrive size={16} className="text-primary"/> {plan.diskSpace} Storage
                </li>
                <li className="flex items-center gap-3 text-sm text-foreground/80">
                  <Activity size={16} className="text-primary"/> {plan.bandwidth} Bandwidth
                </li>
                <li className="flex items-center gap-3 text-sm text-foreground/80">
                  <Database size={16} className="text-primary"/> {plan.databases} MySQL DBs
                </li>
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Ensure HardDrive is imported
import { HardDrive } from "lucide-react";
