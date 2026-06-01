import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity, Search, ChevronLeft, ChevronRight, RefreshCw,
  LogIn, LogOut, ShoppingCart, Globe, User, Key, Shield,
  Ticket, AlertTriangle, CheckCircle, XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("noehost_token") || "" : null;

const ACTION_META: Record<string, { label: string; color: string; icon: typeof LogIn }> = {
  login_success:          { label: "Login",           color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: LogIn      },
  login_failed:           { label: "Login Failed",    color: "bg-red-500/15 text-red-400 border-red-500/30",            icon: XCircle    },
  login_2fa:              { label: "2FA Login",       color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: Shield     },
  logout:                 { label: "Logout",          color: "bg-slate-500/15 text-slate-400 border-slate-500/30",      icon: LogOut     },
  account_registered:     { label: "Registered",      color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",         icon: User       },
  order_placed:           { label: "Order",           color: "bg-blue-500/15 text-blue-400 border-blue-500/30",         icon: ShoppingCart },
  domain_registered:      { label: "Domain Reg.",     color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",   icon: Globe      },
  domain_transferred:     { label: "Domain Transfer", color: "bg-purple-500/15 text-purple-400 border-purple-500/30",  icon: Globe      },
  domain_renewed:         { label: "Domain Renewal",  color: "bg-purple-500/15 text-purple-400 border-purple-500/30",  icon: Globe      },
  invoice_paid:           { label: "Invoice Paid",    color: "bg-green-500/15 text-green-400 border-green-500/30",      icon: CheckCircle },
  ticket_opened:          { label: "Ticket",          color: "bg-amber-500/15 text-amber-400 border-amber-500/30",      icon: Ticket     },
  support_ticket_created: { label: "Ticket",          color: "bg-amber-500/15 text-amber-400 border-amber-500/30",      icon: Ticket     },
  profile_update:         { label: "Profile Update",  color: "bg-violet-500/15 text-violet-400 border-violet-500/30",  icon: User       },
  password_change:        { label: "Password Change", color: "bg-orange-500/15 text-orange-400 border-orange-500/30",  icon: Key        },
  password_reset_requested: { label: "Password Reset", color: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: Key       },
  "2fa_enabled":          { label: "2FA Enabled",     color: "bg-green-500/15 text-green-400 border-green-500/30",     icon: Shield     },
  "2fa_disabled":         { label: "2FA Disabled",    color: "bg-red-500/15 text-red-400 border-red-500/30",           icon: Shield     },
};

function ActionBadge({ action, status }: { action: string; status: string }) {
  const meta = ACTION_META[action] ?? { label: action, color: "bg-slate-500/15 text-slate-400 border-slate-500/30", icon: Activity };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${meta.color}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

const ACTION_OPTIONS = [
  { value: "login_success",           label: "Login Success" },
  { value: "login_failed",            label: "Login Failed" },
  { value: "logout",                  label: "Logout" },
  { value: "account_registered",      label: "Registration" },
  { value: "order_placed",            label: "Order Placed" },
  { value: "domain_registered",       label: "Domain Registered" },
  { value: "domain_transferred",      label: "Domain Transferred" },
  { value: "domain_renewed",          label: "Domain Renewed" },
  { value: "invoice_paid",            label: "Invoice Paid" },
  { value: "ticket_opened",           label: "Ticket Opened" },
  { value: "profile_update",          label: "Profile Update" },
  { value: "password_change",         label: "Password Changed" },
  { value: "password_reset_requested", label: "Password Reset" },
  { value: "2fa_enabled",             label: "2FA Enabled" },
  { value: "2fa_disabled",            label: "2FA Disabled" },
];

interface LogEntry {
  id: string;
  userId: string;
  userEmail?: string | null;
  action: string;
  description?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  status: "success" | "failed";
  note?: string | null;
  createdAt: string;
}

interface LogsResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ActivityLogs() {
  const [search, setSearch]   = useState("");
  const [action, setAction]   = useState("all");
  const [status, setStatus]   = useState("all");
  const [page, setPage]       = useState(1);
  const limit = 50;

  const queryKey = ["admin-activity-logs", page, search, action, status];

  const { data, isLoading, refetch, isFetching } = useQuery<LogsResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      if (action !== "all") params.set("action", action);
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/admin/activity-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const reset = useCallback(() => {
    setSearch("");
    setAction("all");
    setStatus("all");
    setPage(1);
  }, []);

  const logs       = data?.logs ?? [];
  const total      = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const loginSuccess = logs.filter(l => l.action === "login_success").length;
  const loginFailed  = logs.filter(l => l.action === "login_failed").length;
  const orders       = logs.filter(l => l.action === "order_placed").length;
  const domains      = logs.filter(l => l.action === "domain_registered").length;

  return (
    <AppLayout role="admin">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Activity Logs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time audit trail of all client actions across the platform
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total (this page)", value: logs.length, icon: Activity,      color: "text-blue-500"   },
            { label: "Successful Logins", value: loginSuccess,  icon: CheckCircle, color: "text-emerald-500" },
            { label: "Failed Logins",     value: loginFailed,   icon: XCircle,     color: "text-red-500"    },
            { label: "Orders / Domains",  value: orders + domains, icon: ShoppingCart, color: "text-indigo-500" },
          ].map(s => (
            <Card key={s.label} className="border-border/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search email, description, IP…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>
              <Select value={action} onValueChange={v => { setAction(v); setPage(1); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {ACTION_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={reset}>Reset</Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {isLoading ? "Loading…" : `${total.toLocaleString()} records`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-[160px]">Timestamp</TableHead>
                    <TableHead>Client Email</TableHead>
                    <TableHead className="w-[160px]">Action</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[130px]">IP Address</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-muted/50 rounded animate-pulse w-full max-w-[120px]" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                  {!isLoading && logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        No activity logs found
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && logs.map(log => (
                    <TableRow key={log.id} className="hover:bg-muted/20">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <div className="font-medium text-foreground">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-[11px]">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </div>
                        <div className="text-[10px] opacity-60">
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-sm">
                          {log.userEmail ?? <span className="text-muted-foreground italic text-xs">—</span>}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ActionBadge action={log.action} status={log.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[280px]">
                        <span className="line-clamp-2">
                          {log.description || log.note || <span className="italic text-xs opacity-50">—</span>}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {log.ip ?? "—"}
                      </TableCell>
                      <TableCell>
                        {log.status === "success" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                            <CheckCircle className="h-3 w-3" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-500">
                            <AlertTriangle className="h-3 w-3" /> Fail
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/50">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({total.toLocaleString()} total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                  return (
                    <Button
                      key={pg}
                      variant={pg === page ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setPage(pg)}
                    >
                      {pg}
                    </Button>
                  );
                })}
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
