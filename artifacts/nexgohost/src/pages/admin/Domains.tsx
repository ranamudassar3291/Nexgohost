import { useState } from "react";
import { useGetAllDomains, useRenewDomain, useGetDomainPricing } from "@workspace/api-client-react";
import { Globe, Search, RefreshCw, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  expired: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  transferred: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export default function AdminDomains() {
  const { data: domains = [], isLoading, refetch } = useGetAllDomains();
  const { data: pricing = [] } = useGetDomainPricing();
  const renewDomain = useRenewDomain();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"domains" | "pricing">("domains");

  const filtered = domains.filter(d =>
    (d.name + d.tld).toLowerCase().includes(search.toLowerCase()) ||
    d.clientName?.toLowerCase().includes(search.toLowerCase())
  );

  const handleRenew = (id: string) => {
    renewDomain.mutate({ id }, {
      onSuccess: () => { toast({ title: "Domain renewed" }); refetch(); },
      onError: () => toast({ title: "Failed to renew", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Domain Management</h2>
        <p className="text-muted-foreground mt-1">Manage client domains and pricing</p>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button onClick={() => setTab("domains")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "domains" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          All Domains ({domains.length})
        </button>
        <button onClick={() => setTab("pricing")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "pricing" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          Pricing ({pricing.length} TLDs)
        </button>
      </div>

      {tab === "domains" && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 bg-card border-border max-w-md" placeholder="Search domains..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Domain</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Expiry</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Auto Renew</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(domain => (
                  <tr key={domain.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{domain.name}{domain.tld}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{domain.clientName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${statusColors[domain.status]}`}>{domain.status}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {domain.expiryDate ? format(new Date(domain.expiryDate), "MMM d, yyyy") : "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${domain.autoRenew ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}`}>
                        {domain.autoRenew ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleRenew(domain.id)}>
                        <RefreshCw className="w-3 h-3" /> Renew
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No domains found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "pricing" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">TLD</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Registration</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Renewal</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Transfer</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map(p => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-primary">{p.tld}</td>
                  <td className="px-6 py-4 text-sm text-foreground">${p.registrationPrice.toFixed(2)}/yr</td>
                  <td className="px-6 py-4 text-sm text-foreground">${p.renewalPrice.toFixed(2)}/yr</td>
                  <td className="px-6 py-4 text-sm text-foreground">${(p.transferPrice || 0).toFixed(2)}</td>
                </tr>
              ))}
              {pricing.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No pricing configured</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
