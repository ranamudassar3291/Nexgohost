import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  MessageCircle, User, Bot, UserCheck, Search, RefreshCw,
  Clock, CheckCircle, AlertTriangle, XCircle, Send,
  Loader2, Inbox,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Bot }> = {
  ai:       { label: "AI Active",     color: "bg-blue-500/15 text-blue-500 border-blue-500/30",   icon: Bot       },
  handover: { label: "Needs Agent",   color: "bg-amber-500/15 text-amber-500 border-amber-500/30", icon: AlertTriangle },
  human:    { label: "Agent Active",  color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: UserCheck },
  closed:   { label: "Closed",        color: "bg-slate-500/15 text-slate-500 border-slate-500/30", icon: XCircle   },
};

interface Session {
  session_id: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  source?: string;
  status: "ai" | "handover" | "human" | "closed";
  last_message?: string;
  message_count?: number;
  created_at: string;
  updated_at: string;
}

interface Msg {
  id: number;
  role: "user" | "assistant" | "admin";
  content: string;
  created_at: string;
}

interface Stats {
  open: number;
  handover: number;
  human: number;
  total: number;
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.closed;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${meta.color}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function MsgBubble({ msg }: { msg: Msg }) {
  const isUser  = msg.role === "user";
  const isAdmin = msg.role === "admin";
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"} mb-2`}>
      {!isUser && (
        <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${
          isAdmin ? "bg-emerald-500" : "bg-indigo-500"
        }`}>
          {isAdmin ? <UserCheck className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
        </div>
      )}
      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
        isUser
          ? "bg-indigo-500 text-white rounded-br-sm"
          : isAdmin
          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100 rounded-bl-sm border border-emerald-200 dark:border-emerald-700"
          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-sm border border-slate-200 dark:border-slate-700"
      }`}>
        <div className="leading-relaxed whitespace-pre-wrap">{msg.content}</div>
        <div className={`text-[10px] mt-1 ${isUser ? "text-indigo-200" : "text-slate-400"}`}>
          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
        </div>
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full flex-shrink-0 bg-slate-300 dark:bg-slate-600 flex items-center justify-center">
          <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        </div>
      )}
    </div>
  );
}

export default function AdminLiveChat() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  // Sessions list
  const { data, isLoading, refetch, isFetching } = useQuery<{ sessions: Session[]; stats: Stats }>({
    queryKey: ["admin-live-chat", search, statusFilter],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (search) p.set("search", search);
      const res = await fetch(`/api/admin/live-chat/sessions?${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 10_000,
  });

  // Selected session detail
  const { data: detail, refetch: refetchDetail } = useQuery<{ session: Session; messages: Msg[] }>({
    queryKey: ["admin-live-chat-detail", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/live-chat/sessions/${selectedId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedId,
    refetchInterval: 5_000,
  });

  // Reply mutation
  const replyMut = useMutation({
    mutationFn: async (msg: string) => {
      const res = await fetch(`/api/admin/live-chat/sessions/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      setReply("");
      refetchDetail();
      qc.invalidateQueries({ queryKey: ["admin-live-chat"] });
    },
  });

  // Status change mutation
  const statusMut = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/admin/live-chat/sessions/${selectedId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      refetchDetail();
      qc.invalidateQueries({ queryKey: ["admin-live-chat"] });
    },
  });

  const sessions = data?.sessions ?? [];
  const stats    = data?.stats ?? { open: 0, handover: 0, human: 0, total: 0 };
  const selected = detail?.session;
  const msgs     = detail?.messages ?? [];

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
        {[
          { label: "Open Sessions",  value: stats.open,     icon: MessageCircle, color: "text-blue-500"   },
          { label: "Needs Agent",    value: stats.handover, icon: AlertTriangle, color: "text-amber-500",  highlight: stats.handover > 0 },
          { label: "Agent Active",   value: stats.human,    icon: UserCheck,     color: "text-emerald-500" },
          { label: "Total Sessions", value: stats.total,    icon: Inbox,         color: "text-slate-500"   },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 flex items-center gap-3 ${
            s.highlight ? "border-amber-400/60 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-400/40" : "border-border/50 bg-card"
          }`}>
            <s.icon className={`h-5 w-5 flex-shrink-0 ${s.color}`} />
            <div>
              <p className="text-xl font-bold leading-none">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 min-h-0">
        {/* Sessions list */}
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex gap-2 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ai">AI Active</SelectItem>
                <SelectItem value="handover">Needs Agent</SelectItem>
                <SelectItem value="human">Agent Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/50 p-3 animate-pulse">
                <div className="h-3 bg-muted/50 rounded w-1/2 mb-2" />
                <div className="h-3 bg-muted/50 rounded w-3/4" />
              </div>
            ))}
            {!isLoading && sessions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Inbox className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No sessions found
              </div>
            )}
            {sessions.map(s => (
              <button
                key={s.session_id}
                onClick={() => setSelectedId(s.session_id)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  selectedId === s.session_id
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-400/40"
                    : "border-border/50 bg-card hover:border-border hover:bg-muted/20"
                } ${s.status === "handover" ? "ring-1 ring-amber-400/50" : ""}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-medium text-sm truncate">{s.client_name || "Guest"}</span>
                  <StatusBadge status={s.status} />
                </div>
                {s.client_email && (
                  <p className="text-xs text-muted-foreground truncate mb-1">{s.client_email}</p>
                )}
                {s.last_message && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{s.last_message}</p>
                )}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}
                  </span>
                  {s.message_count && (
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {s.message_count}
                    </span>
                  )}
                  {s.source && <span className="uppercase opacity-60">{s.source}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Conversation panel */}
        <div className="rounded-xl border border-border/50 bg-card flex flex-col min-h-0">
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageCircle className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">Select a session to view the conversation</p>
            </div>
          ) : (
            <>
              {/* Convo header */}
              <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="font-semibold text-sm">{selected?.client_name || "Guest"}</h3>
                  <p className="text-xs text-muted-foreground">{selected?.client_email || selected?.session_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={selected?.status || "ai"}
                    onValueChange={v => statusMut.mutate(v)}
                    disabled={statusMut.isPending}
                  >
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ai">AI Mode</SelectItem>
                      <SelectItem value="handover">Needs Agent</SelectItem>
                      <SelectItem value="human">Take Over</SelectItem>
                      <SelectItem value="closed">Close Session</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50 dark:bg-slate-950/50">
                {msgs.map(m => <MsgBubble key={m.id} msg={m} />)}
                {msgs.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No messages yet</p>
                )}
              </div>

              {/* Reply box */}
              {selected?.status !== "closed" && (
                <div className="px-4 py-3 border-t border-border/50 flex-shrink-0">
                  <div className="flex gap-2">
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (reply.trim()) replyMut.mutate(reply.trim());
                        }
                      }}
                      placeholder="Type your reply… (Enter to send)"
                      rows={2}
                      disabled={replyMut.isPending}
                      className="flex-1 resize-none rounded-xl border border-border/70 bg-background text-sm px-3 py-2.5 placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                    />
                    <Button
                      onClick={() => { if (reply.trim()) replyMut.mutate(reply.trim()); }}
                      disabled={!reply.trim() || replyMut.isPending}
                      className="h-auto self-stretch px-4 bg-indigo-600 hover:bg-indigo-700"
                    >
                      {replyMut.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Send className="h-4 w-4" />
                      }
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
