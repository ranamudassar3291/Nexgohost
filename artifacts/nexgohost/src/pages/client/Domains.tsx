import { useGetMyDomains } from "@workspace/api-client-react";
import { Globe, RefreshCw, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  expired: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  transferred: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export default function ClientDomains() {
  const { data: domains = [], isLoading } = useGetMyDomains();

  if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">My Domains</h2>
        <p className="text-muted-foreground mt-1">Manage your registered domains</p>
      </div>

      {domains.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No domains registered yet</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {domains.map(domain => {
            const expiryDate = domain.expiryDate ? new Date(domain.expiryDate) : null;
            const daysLeft = expiryDate ? Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
            const isExpiringSoon = daysLeft !== null && daysLeft < 30;

            return (
              <div key={domain.id} className="bg-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-foreground">{domain.name}{domain.tld}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${statusColors[domain.status]}`}>{domain.status}</span>
                      {isExpiringSoon && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          <AlertCircle className="w-3 h-3" /> Expiring soon
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Registered</p>
                        <p className="text-sm text-foreground font-medium mt-0.5">
                          {domain.registrationDate ? format(new Date(domain.registrationDate), "MMM d, yyyy") : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Expires</p>
                        <p className={`text-sm font-medium mt-0.5 ${isExpiringSoon ? "text-orange-400" : "text-foreground"}`}>
                          {expiryDate ? format(expiryDate, "MMM d, yyyy") : "N/A"}
                          {daysLeft !== null && <span className="text-xs ml-1 text-muted-foreground">({daysLeft}d)</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Auto Renew</p>
                        <p className={`text-sm font-medium mt-0.5 ${domain.autoRenew ? "text-green-400" : "text-red-400"}`}>
                          {domain.autoRenew ? "Enabled" : "Disabled"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Nameservers</p>
                        <p className="text-sm text-foreground font-medium mt-0.5">{domain.nameservers?.[0] || "ns1.nexgohost.com"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
