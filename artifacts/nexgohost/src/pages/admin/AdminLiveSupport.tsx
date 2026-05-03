import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageCircle, Bot, User, Shield, Send, RefreshCw, Search,
  Clock, CheckCircle, AlertCircle, X, BookOpen,
  Plus, Trash2, FileText, Loader2, Globe, Activity,
} from "lucide-react";
import Markdown from "react-markdown";
import { apiFetchAdmin } from "@/lib/api";

interface ChatSession {
  id: number;
  session_id: string;
  user_id: string | null;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  source: "website" | "dashboard";
  status: "ai" | "handover" | "human" | "closed";
  failed_attempts: number;
  message_count: number;
  last_message: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "admin";
  content: string;
  metadata_json: Record<string, any>;
  created_at: string;
}

interface TrainingDoc {
  id: number;
  title: string;
  content: string;
  doc_type: string;
  is_active: boolean;
  created_at: string;
}

interface WebSearchLog {
  id: number;
  session_id: string;
  query_text: string;
  search_type: string;
  source_url: string;
  result_snippet: string;
  results_count: number;
  created_at: string;
  client_name?: string;
  client_email?: string;
}

const STATUS_CONFIG = {
  ai:       { label: "AI Active",      icon: Bot,          color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  handover: { label: "Needs Agent",    icon: AlertCircle,  color: "text-amber-600 bg-amber-50 border-amber-200" },
  human:    { label: "Agent Active",   icon: Shield,       color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  closed:   { label: "Closed",         icon: CheckCircle,  color: "text-slate-500 bg-slate-50 border-slate-200" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminLiveSupport() {
  const [tab, setTab] = useState<"sessions" | "knowledge" | "searchlogs">("sessions");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [docs, setDocs] = useState<TrainingDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: "", content: "", doc_type: "faq" });
  const [addingDoc, setAddingDoc] = useState(false);
  const [searchLogs, setSearchLogs] = useState<WebSearchLog[]>([]);
  const [searchLogsLoading, setSearchLogsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    loadSessions();
    pollTimerRef.current = setInterval(loadSessions, 10000);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [statusFilter]);

  useEffect(() => {
    if (tab === "knowledge") loadDocs();
    if (tab === "searchlogs") loadSearchLogs();
  }, [tab]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const url = statusFilter
        ? `/admin/ai/support/sessions?status=${statusFilter}`
        : "/admin/ai/support/sessions";
      const data = await apiFetchAdmin(url);
      setSessions(data.sessions ?? []);
    } catch { /* silent */ } finally {
      setSessionsLoading(false);
    }
  }, [statusFilter]);

  const loadSession = async (sessionId: string) => {
    setSelectedId(sessionId);
    setLoading(true);
    try {
      const data = await apiFetchAdmin(`/admin/ai/support/sessions/${sessionId}`);
      setMessages(data.messages ?? []);
      setSelectedSession(data.session ?? null);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  const refreshMessages = async () => {
    if (!selectedId) return;
    try {
      const data = await apiFetchAdmin(`/admin/ai/support/sessions/${selectedId}`);
      setMessages(data.messages ?? []);
      setSelectedSession(data.session ?? null);
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (!selectedId) return;
    const t = setInterval(refreshMessages, 8000);
    return () => clearInterval(t);
  }, [selectedId]);

  const sendReply = async () => {
    if (!reply.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      await apiFetchAdmin(`/admin/ai/support/sessions/${selectedId}/reply`, {
        method: "POST",
        body: JSON.stringify({ message: reply.trim() }),
      });
      setReply("");
      await refreshMessages();
      await loadSessions();
    } catch { /* silent */ } finally {
      setSending(false);
    }
  };

  const changeStatus = async (sessionId: string, status: string) => {
    try {
      await apiFetchAdmin(`/admin/ai/support/sessions/${sessionId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      await loadSessions();
      if (selectedId === sessionId) await refreshMessages();
    } catch { /* silent */ }
  };

  const loadDocs = async () => {
    setDocsLoading(true);
    try {
      const data = await apiFetchAdmin("/admin/ai/support/knowledge");
      setDocs(data.docs ?? []);
    } catch { /* silent */ } finally {
      setDocsLoading(false);
    }
  };

  const addDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.title.trim() || !newDoc.content.trim()) return;
    setAddingDoc(true);
    try {
      await apiFetchAdmin("/admin/ai/support/knowledge", {
        method: "POST",
        body: JSON.stringify(newDoc),
      });
      setNewDoc({ title: "", content: "", doc_type: "faq" });
      setShowAddDoc(false);
      await loadDocs();
    } catch { /* silent */ } finally {
      setAddingDoc(false);
    }
  };

  const loadSearchLogs = async () => {
    setSearchLogsLoading(true);
    try {
      const data = await apiFetchAdmin("/admin/ai/support/search-logs");
      setSearchLogs(data.logs ?? []);
    } catch { /* silent */ } finally {
      setSearchLogsLoading(false);
    }
  };

  const deleteDoc = async (id: number) => {
    try {
      await apiFetchAdmin(`/admin/ai/support/knowledge/${id}`, { method: "DELETE" });
      await loadDocs();
    } catch { /* silent */ }
  };

  const filtered = sessions.filter(s =>
    !search || s.client_name.toLowerCase().includes(search.toLowerCase()) ||
    s.client_email.toLowerCase().includes(search.toLowerCase()) ||
    s.session_id.toLowerCase().includes(search.toLowerCase())
  );

  const handoverCount = sessions.filter(s => s.status === "handover").length;
  const humanCount    = sessions.filter(s => s.status === "human").length;
  const totalOpen     = sessions.filter(s => s.status !== "closed").length;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        {[
          { label: "Open Sessions",  value: totalOpen,     color: "text-indigo-600", bg: "bg-indigo-50", icon: MessageCircle },
          { label: "Needs Agent",    value: handoverCount, color: "text-amber-600",  bg: "bg-amber-50",  icon: AlertCircle },
          { label: "Human Active",   value: humanCount,    color: "text-emerald-600",bg: "bg-emerald-50",icon: Shield },
          { label: "Total Sessions", value: sessions.length, color: "text-slate-600", bg: "bg-slate-50", icon: Clock },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={`${bg} rounded-2xl p-4 flex items-center gap-3`}>
            <div className={`w-10 h-10 rounded-xl ${bg} border border-current/10 flex items-center justify-center`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <div className={`text-2xl font-black ${color}`}>{value}</div>
              <div className="text-xs font-semibold text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={() => setTab("sessions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === "sessions" ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white border border-slate-200 text-slate-600 hover:border-primary/30"}`}>
          <MessageCircle size={14} /> Live Sessions
        </button>
        <button onClick={() => setTab("knowledge")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === "knowledge" ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white border border-slate-200 text-slate-600 hover:border-primary/30"}`}>
          <BookOpen size={14} /> AI Knowledge Base
        </button>
        <button onClick={() => setTab("searchlogs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === "searchlogs" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
          <Globe size={14} /> Web Search Audit
        </button>
      </div>

      {tab === "sessions" && (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Sessions list */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-700" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none text-slate-700">
                <option value="">All</option>
                <option value="handover">Needs Agent</option>
                <option value="human">Human</option>
                <option value="ai">AI</option>
                <option value="closed">Closed</option>
              </select>
              <button onClick={loadSessions} className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:border-primary/30 transition-colors">
                <RefreshCw size={13} className={`text-slate-500 ${sessionsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <MessageCircle size={28} className="mx-auto mb-2 opacity-40" />
                  <div className="text-xs font-semibold">No sessions found</div>
                </div>
              ) : (
                filtered.map(s => {
                  const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.ai;
                  const Icon = cfg.icon;
                  const isSelected = selectedId === s.session_id;
                  return (
                    <button key={s.session_id} onClick={() => loadSession(s.session_id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all ${isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-slate-200 bg-white hover:border-primary/30 hover:bg-slate-50"
                      } ${s.status === "handover" ? "ring-2 ring-amber-200" : ""}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-black text-primary">{s.client_name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black text-slate-800 truncate">{s.client_name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{s.client_email}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                          <Icon size={9} /> {cfg.label}
                        </span>
                        <span className="text-[10px] text-slate-400">{timeAgo(s.updated_at)}</span>
                      </div>
                      {s.last_message && (
                        <div className="mt-1.5 text-[10px] text-slate-400 truncate leading-relaxed">{s.last_message.slice(0, 60)}…</div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat panel */}
          <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {!selectedId ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-slate-400">
                  <MessageCircle size={40} className="mx-auto mb-3 opacity-30" />
                  <div className="text-sm font-semibold">Select a conversation</div>
                  <div className="text-xs mt-1">Click any session from the list to view and reply</div>
                </div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                {selectedSession && (
                  <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-indigo-100 flex items-center justify-center">
                      <span className="text-sm font-black text-primary">{selectedSession.client_name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black text-slate-800">{selectedSession.client_name}</div>
                      <div className="text-xs text-slate-400">{selectedSession.client_email}
                        {selectedSession.client_phone && ` · ${selectedSession.client_phone}`}
                        {" · "}{selectedSession.source}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Status changer */}
                      <select
                        value={selectedSession.status}
                        onChange={e => changeStatus(selectedSession.session_id, e.target.value)}
                        className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none text-slate-700 font-semibold">
                        <option value="ai">AI Mode</option>
                        <option value="handover">Handover</option>
                        <option value="human">Take Over</option>
                        <option value="closed">Close</option>
                      </select>
                      <button onClick={refreshMessages}
                        className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-xl hover:border-primary/30 transition-colors">
                        <RefreshCw size={13} className="text-slate-500" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 size={24} className="animate-spin text-primary" />
                    </div>
                  ) : (
                    messages.map((msg, i) => (
                      <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-black ${
                          msg.role === "user"
                            ? "bg-slate-200 text-slate-600"
                            : msg.role === "admin"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-primary/10 text-primary"
                        }`}>
                          {msg.role === "user" ? <User size={12} />
                            : msg.role === "admin" ? <Shield size={12} />
                            : <Bot size={12} />}
                        </div>
                        <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-white border border-slate-200 text-slate-800 rounded-tr-sm"
                            : msg.role === "admin"
                            ? "bg-emerald-600 text-white rounded-tl-sm shadow-sm"
                            : "bg-white border border-slate-100 text-slate-700 rounded-tl-sm shadow-sm"
                        }`}>
                          {msg.role === "admin" && (
                            <div className="text-[10px] font-bold text-emerald-200 mb-1 uppercase tracking-wide">You (Admin)</div>
                          )}
                          <div className="prose prose-sm max-w-none prose-p:my-0.5 prose-invert:text-white">
                            {msg.role === "user" ? msg.content : <Markdown>{msg.content}</Markdown>}
                          </div>
                          <div className={`text-[10px] mt-1 ${msg.role === "admin" ? "text-emerald-200" : "text-slate-400"}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Admin reply input */}
                <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 bg-white flex-shrink-0">
                  <input
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                    placeholder="Type reply as Support Agent…"
                    disabled={selectedSession?.status === "closed"}
                    className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 text-slate-800 placeholder:text-slate-400 disabled:opacity-60"
                  />
                  <button onClick={sendReply} disabled={!reply.trim() || sending || selectedSession?.status === "closed"}
                    className="w-10 h-10 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-lg shadow-emerald-600/20">
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "knowledge" && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-black text-slate-800">AI Training Documents</div>
              <div className="text-xs text-slate-500 mt-0.5">Upload FAQs and docs — the AI will use them to answer client questions instantly</div>
            </div>
            <button onClick={() => setShowAddDoc(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
              <Plus size={14} /> Add Document
            </button>
          </div>

          {/* Add doc form */}
          {showAddDoc && (
            <div className="bg-white border border-primary/20 rounded-2xl p-5 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-black text-slate-800">Add Training Document</div>
                <button onClick={() => setShowAddDoc(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                  <X size={14} className="text-slate-400" />
                </button>
              </div>
              <form onSubmit={addDoc} className="space-y-3">
                <div className="flex gap-3">
                  <input required value={newDoc.title} onChange={e => setNewDoc(p => ({ ...p, title: e.target.value }))}
                    placeholder="Document title (e.g., How to set up cPanel email)"
                    className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-800 placeholder:text-slate-400" />
                  <select value={newDoc.doc_type} onChange={e => setNewDoc(p => ({ ...p, doc_type: e.target.value }))}
                    className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none text-slate-700">
                    <option value="faq">FAQ</option>
                    <option value="guide">Guide</option>
                    <option value="policy">Policy</option>
                    <option value="pricing">Pricing</option>
                    <option value="technical">Technical</option>
                  </select>
                </div>
                <textarea required value={newDoc.content} onChange={e => setNewDoc(p => ({ ...p, content: e.target.value }))}
                  placeholder="Paste the content, FAQ answer, or document text here. The AI will use this to answer client questions automatically."
                  rows={5}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-800 placeholder:text-slate-400 resize-none" />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowAddDoc(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={addingDoc}
                    className="px-4 py-2 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-60">
                    {addingDoc ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    Add to Knowledge Base
                  </button>
                </div>
              </form>
            </div>
          )}

          {docsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
              <div className="text-sm font-semibold">No training documents yet</div>
              <div className="text-xs mt-1">Add FAQs and guides to train the AI and improve response quality</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {docs.map(doc => (
                <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-primary/30 transition-colors group">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileText size={14} className="text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-800 leading-tight">{doc.title}</div>
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{doc.doc_type.toUpperCase()}</span>
                      </div>
                    </div>
                    <button onClick={() => deleteDoc(doc.id)}
                      className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all text-slate-400">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{doc.content}</p>
                  <div className="text-[10px] text-slate-400 mt-2">
                    Added {new Date(doc.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "searchlogs" && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Globe size={16} className="text-indigo-500" /> Web Search Audit Log
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Every Google search and noehost.com crawl performed by Noe AI — logged automatically
              </div>
            </div>
            <button onClick={loadSearchLogs}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:border-indigo-300 transition-colors text-slate-600">
              <RefreshCw size={12} className={searchLogsLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              {
                label: "Total Searches",
                value: searchLogs.length,
                color: "text-indigo-600", bg: "bg-indigo-50",
                icon: Activity,
              },
              {
                label: "Web Searches",
                value: searchLogs.filter(l => l.search_type === "web_search" || l.search_type === "duckduckgo").length,
                color: "text-emerald-600", bg: "bg-emerald-50",
                icon: Search,
              },
              {
                label: "Site Crawls",
                value: searchLogs.filter(l => l.search_type === "website_crawl").length,
                color: "text-amber-600", bg: "bg-amber-50",
                icon: Globe,
              },
            ].map(({ label, value, color, bg, icon: Icon }) => (
              <div key={label} className={`${bg} rounded-2xl p-4 flex items-center gap-3`}>
                <Icon size={18} className={color} />
                <div>
                  <div className={`text-2xl font-black ${color}`}>{value}</div>
                  <div className="text-xs font-semibold text-slate-500">{label}</div>
                </div>
              </div>
            ))}
          </div>

          {searchLogsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
            </div>
          ) : searchLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Globe size={40} className="mx-auto mb-3 opacity-30" />
              <div className="text-sm font-semibold">No search logs yet</div>
              <div className="text-xs mt-1">Searches are logged as clients chat with Noe AI</div>
            </div>
          ) : (
            <div className="space-y-2">
              {searchLogs.map(log => {
                const isWebSearch = log.search_type === "web_search";
                const isDDG = log.search_type === "duckduckgo";
                const isCrawl = log.search_type === "website_crawl";
                const badge = isCrawl
                  ? { label: "Site Crawl", color: "bg-amber-100 text-amber-700 border-amber-200" }
                  : isWebSearch
                  ? { label: "Google Search", color: "bg-emerald-100 text-emerald-700 border-emerald-200" }
                  : { label: "DuckDuckGo", color: "bg-indigo-100 text-indigo-700 border-indigo-200" };
                return (
                  <div key={log.id} className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-indigo-200 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isCrawl ? "bg-amber-100" : "bg-indigo-100"}`}>
                        {isCrawl ? <Globe size={14} className="text-amber-600" /> : <Search size={14} className="text-indigo-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                            {badge.label}
                          </span>
                          {log.client_name && (
                            <span className="text-[10px] font-semibold text-slate-500">
                              {log.client_name} · {log.client_email}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 ml-auto">{timeAgo(log.created_at)}</span>
                        </div>
                        <div className="text-sm font-semibold text-slate-800 mb-1 truncate">
                          "{log.query_text}"
                        </div>
                        {log.result_snippet && (
                          <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-1">
                            {log.result_snippet}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                          {log.source_url && (
                            <a href={log.source_url} target="_blank" rel="noopener noreferrer"
                              className="truncate max-w-[200px] hover:text-indigo-500 transition-colors">
                              {log.source_url}
                            </a>
                          )}
                          <span>{log.results_count} results</span>
                          <span>Session: {log.session_id.slice(0, 20)}…</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
