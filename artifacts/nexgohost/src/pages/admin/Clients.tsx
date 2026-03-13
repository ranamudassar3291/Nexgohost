import { useState } from "react";
import { useGetClients } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Search, Eye, MoreHorizontal, UserCheck, UserX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function AdminClients() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useGetClients({ search });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Clients</h2>
          <p className="text-muted-foreground mt-1">Manage all registered users</p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            placeholder="Search clients..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border/50 h-11 rounded-xl"
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-secondary/50 border-b border-border">
                <th className="p-4 font-medium text-sm text-muted-foreground">Client</th>
                <th className="p-4 font-medium text-sm text-muted-foreground">Company</th>
                <th className="p-4 font-medium text-sm text-muted-foreground">Status</th>
                <th className="p-4 font-medium text-sm text-muted-foreground">Registered</th>
                <th className="p-4 font-medium text-sm text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></td>
                </tr>
              ) : data?.clients.map((client) => (
                <tr key={client.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {client.firstName[0]}{client.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{client.firstName} {client.lastName}</p>
                        <p className="text-xs text-muted-foreground">{client.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-foreground/80">{client.company || '-'}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      client.status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>
                      {client.status === 'active' ? <UserCheck size={12}/> : <UserX size={12}/>}
                      {client.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{format(new Date(client.createdAt), 'MMM d, yyyy')}</td>
                  <td className="p-4 text-right">
                    <Link href={`/admin/clients/${client.id}`} className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                      <Eye size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
              {data?.clients.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">No clients found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
