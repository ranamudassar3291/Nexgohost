import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import {
  Search, Eye, UserCheck, UserX, Pencil, Trash2, UserPlus,
  ChevronLeft, ChevronRight, Loader2, Globe, Server,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  status: string;
  phone: string | null;
  country: string | null;
  servicesCount: number;
  domainsCount: number;
  creditBalance: string | number;
  createdAt: string;
}

interface PagedClients {
  clients: Client[];
  total: number;
  page: number;
  limit: number;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const STATUS_TABS = ["all", "active", "suspended"];

export default function AdminClients() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [paged, setPaged] = useState<PagedClients | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const data: PagedClients = await apiFetch(`/api/admin/clients?${params}`);
      setPaged(data);
    } catch (err: any) {
      toast({ title: "Failed to load clients", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete client "${name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/admin/clients/${id}`, { method: "DELETE" });
      toast({ title: "Client deleted", description: `${name} has been removed.` });
      fetchClients();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const clients = paged?.clients ?? [];
  const total = paged?.total ?? 0;
  const totalPages = paged ? Math.ceil(paged.total / 50) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Clients</h2>
          <p className="text-muted-foreground mt-1">
            {paged ? `${total.toLocaleString()} registered clients` : "Manage all registered users"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isLoading && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
          <Button onClick={() => setLocation("/admin/clients/add")} className="bg-primary hover:bg-primary/90 h-11 rounded-xl whitespace-nowrap">
            <UserPlus size={16} className="mr-2" /> Add Client
          </Button>
        </div>
      </div>

      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border/50 h-10 rounded-xl"
          />
        </div>
        <div className="flex gap-1.5">
          {STATUS_TABS.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 text-xs rounded-lg border capitalize transition-all ${statusFilter === s ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-secondary/50 border-b border-border">
                <th className="px-5 py-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="px-5 py-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Company</th>
                <th className="px-5 py-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Services</th>
                <th className="px-5 py-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-5 py-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Registered</th>
                <th className="px-5 py-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <Loader2 size={28} className="animate-spin mx-auto text-primary/50" />
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-muted-foreground text-sm">
                    No clients found.
                  </td>
                </tr>
              ) : clients.map((client) => (
                <tr key={client.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {client.firstName?.[0]}{client.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{client.firstName} {client.lastName}</p>
                        <p className="text-xs text-muted-foreground">{client.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-foreground/80">{client.company || '—'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {client.servicesCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Server size={11} /> {client.servicesCount}
                        </span>
                      )}
                      {client.domainsCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Globe size={11} /> {client.domainsCount}
                        </span>
                      )}
                      {client.servicesCount === 0 && client.domainsCount === 0 && (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      client.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>
                      {client.status === 'active' ? <UserCheck size={11}/> : <UserX size={11}/>}
                      {client.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">
                    {format(new Date(client.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Link href={`/admin/clients/${client.id}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                        <Eye size={15} />
                      </Link>
                      <button
                        onClick={() => setLocation(`/admin/clients/${client.id}/edit`)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(client.id, `${client.firstName} ${client.lastName}`)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total.toLocaleString()} clients
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} className="mr-1" /> Prev
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                    {p}
                  </button>
                );
              })}
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
