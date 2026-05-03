/**
 * NoeChat — Universal Noe AI Chat Widget
 * One component, used on both the public website AND the client dashboard.
 * Auto-detects auth token; shows contact form for guests.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, X, Send, Bot, Loader2, User, Shield,
  Paperclip, Phone, Download, Search, Globe, Sparkles,
  RefreshCw, ChevronRight,
} from "lucide-react";
import Markdown from "react-markdown";

interface Msg {
  id?: number;
  role: "user" | "assistant" | "admin";
  content: string;
  metadata?: Record<string, any>;
}

const SESSION_KEY = "noe_session_id";
const CONTACT_KEY = "noe_contact";
const FALLBACK_Q  = [
  "What hosting plans do you offer?",
  "How do I install WordPress?",
  "How do I activate SSL?",
  "How do I set up email?",
  "What is your refund policy?",
  "How do I transfer my domain?",
];
const WELCOME_MSG: Msg = {
  role: "assistant",
  content: "Hi! I'm **Noe** 👋 — your Noehost AI assistant.\n\nI crawl noehost.com in real-time and search the web to give you accurate answers. How can I help you today?",
};

function uid(prefix = "noe") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("noehost_token") ||
    null
  );
}

function authHdrs(): Record<string, string> {
  const t = getToken();
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export default function NoeChat() {
  const [open, setOpen]               = useState(false);
  const [msgs, setMsgs]               = useState<Msg[]>([WELCOME_MSG]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [sessionId, setSessionId]     = useState<string | null>(null);
  const [status, setStatus]           = useState<"ai"|"handover"|"human"|"closed">("ai");
  const [handoverSent, setHandoverSent] = useState(false);
  const [unread, setUnread]           = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_Q);
  const [lastSearch, setLastSearch]   = useState<string | null>(null);
  const [attachBusy, setAttachBusy]   = useState(false);

  // Guest contact form
  const [contact, setContact]         = useState({ name: "", email: "", phone: "" });
  const [contactSaved, setContactSaved] = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [pendingText, setPendingText] = useState("");

  const endRef     = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  /* scroll to bottom */
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  /* focus on open */
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 150);
      if (!sessionId) initSession();
    }
  }, [open]);

  /* fetch suggestions once */
  useEffect(() => {
    fetch("/api/ai/support/suggestions")
      .then(r => r.json())
      .then(d => { if (d.suggestions?.length) setSuggestions(d.suggestions); })
      .catch(() => {});
  }, []);

  /* load saved contact */
  useEffect(() => {
    const saved = localStorage.getItem(CONTACT_KEY);
    if (saved) { try { setContact(JSON.parse(saved)); setContactSaved(true); } catch {} }
  }, []);

  /* poll when human/handover */
  useEffect(() => {
    if (status === "human" || status === "handover") {
      pollRef.current = setInterval(pollMsgs, 5000);
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status, sessionId]);

  const initSession = async () => {
    try {
      let sid = localStorage.getItem(SESSION_KEY);
      if (!sid) { sid = uid(); localStorage.setItem(SESSION_KEY, sid); }

      // determine source from URL
      const src = window.location.pathname.startsWith("/client") ? "dashboard" : "website";

      const body: any = { sessionId: sid, source: src };
      // attach saved contact if available
      const saved = localStorage.getItem(CONTACT_KEY);
      if (saved) { try { const p = JSON.parse(saved); body.clientName = p.name; body.clientEmail = p.email; body.clientPhone = p.phone; } catch {} }

      const res = await fetch("/api/ai/support/session", { method: "POST", headers: authHdrs(), body: JSON.stringify(body) });
      const data = await res.json();
      setSessionId(sid);
      setStatus(data.status ?? "ai");

      if (data.existing) {
        const hRes = await fetch(`/api/ai/support/session/${sid}/messages`, { headers: authHdrs() });
        const hData = await hRes.json();
        if (hData.messages?.length) {
          setMsgs([WELCOME_MSG, ...hData.messages.map((m: any) => ({
            id: m.id, role: m.role, content: m.content, metadata: m.metadata_json,
          }))]);
          setStatus(hData.status ?? "ai");
        }
      }
    } catch {}
  };

  const pollMsgs = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/ai/support/session/${sessionId}/messages`, { headers: authHdrs() });
      const data = await res.json();
      if (!data.messages?.length) return;
      const loaded: Msg[] = data.messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content, metadata: m.metadata_json }));
      setMsgs(prev => {
        const maxId = Math.max(...prev.filter(m => m.id).map(m => m.id!), 0);
        const fresh = loaded.filter(m => m.id && m.id > maxId);
        if (fresh.length) { if (!open) setUnread(n => n + fresh.length); return [WELCOME_MSG, ...loaded]; }
        return prev;
      });
      setStatus(data.status ?? "ai");
    } catch {}
  }, [sessionId, open]);

  const doSend = async (text: string) => {
    if (!text.trim() || loading || !sessionId) return;
    setLastSearch(null);
    setMsgs(prev => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/support/message", {
        method: "POST", headers: authHdrs(),
        body: JSON.stringify({ sessionId, message: text }),
      });
      const data = await res.json();
      setMsgs(prev => [...prev, {
        role: data.status === "human" ? "admin" : "assistant",
        content: data.reply ?? "Sorry, please try again.",
        metadata: { webSearched: data.webSearched, searchedFor: data.searchedFor },
      }]);
      if (data.webSearched && data.searchedFor) setLastSearch(data.searchedFor);
      if (!open) setUnread(n => n + 1);
      if (data.status) setStatus(data.status);
      if (data.autoHandover) setHandoverSent(true);
    } catch {
      setMsgs(prev => [...prev, { role: "assistant", content: "Connection error. Please email support@noehost.com." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text) return;
    if (!contactSaved && !getToken()) {
      // guest: show contact form first
      setPendingText(text);
      setMsgs(prev => [...prev, { role: "user", content: text }]);
      setInput("");
      setShowForm(true);
      return;
    }
    setInput("");
    await doSend(text);
  };

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(CONTACT_KEY, JSON.stringify(contact));
    setContactSaved(true);
    setShowForm(false);

    // Update session with contact info
    if (sessionId) {
      fetch("/api/ai/support/session", {
        method: "POST", headers: authHdrs(),
        body: JSON.stringify({ sessionId, clientName: contact.name, clientEmail: contact.email, clientPhone: contact.phone, source: "website" }),
      }).catch(() => {});
    }

    if (pendingText) {
      await doSend(pendingText);
      setPendingText("");
    }
  };

  const requestHandover = async () => {
    if (!sessionId || handoverSent) return;
    setHandoverSent(true);
    try {
      await fetch(`/api/ai/support/handover/${sessionId}`, { method: "POST", headers: authHdrs() });
      setMsgs(prev => [...prev, { role: "assistant", content: "🙋 **Human agent requested.** Our team has been notified and will join this chat shortly. Average wait: 2–5 minutes during business hours." }]);
      setStatus("handover");
    } catch {}
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;
    setAttachBusy(true);
    try {
      const fileUrl = URL.createObjectURL(file);
      await fetch(`/api/ai/support/attachment/${sessionId}`, {
        method: "POST", headers: authHdrs(),
        body: JSON.stringify({ fileName: file.name, fileUrl, mimeType: file.type, fileSize: file.size }),
      });
      setMsgs(prev => [...prev, {
        role: "user",
        content: `📎 Attached: **${file.name}** (${(file.size / 1024).toFixed(1)} KB)`,
        metadata: { attachment: true, fileUrl },
      }]);
    } catch {} finally {
      setAttachBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const startNew = () => {
    localStorage.removeItem(SESSION_KEY);
    setMsgs([WELCOME_MSG]);
    setSessionId(null);
    setStatus("ai");
    setHandoverSent(false);
    setLastSearch(null);
    setShowForm(false);
    setPendingText("");
    setTimeout(() => initSession(), 50);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const isHuman = status === "human" || status === "handover";
  const showQuick = msgs.length === 1 && !showForm;

  const statusDot = isHuman ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-pulse";
  const statusText = status === "human" ? "Human Agent Active" : status === "handover" ? "Connecting to agent…" : "AI · Live web search enabled";

  return (
    <>
      <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.txt,.log,.zip" onChange={handleFile} />

      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-[9990] w-13 h-13 w-[52px] h-[52px] bg-primary text-white rounded-full shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-110 transition-transform"
          >
            <MessageCircle size={24} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed bottom-6 right-6 z-[9990] w-[360px] max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
            style={{ height: 520 }}
          >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-primary to-indigo-600 px-4 py-3 flex items-center gap-2.5 flex-shrink-0">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <Bot size={18} className="text-white" />
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${statusDot} rounded-full border-2 border-white`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-black text-[13px] flex items-center gap-1">
                  {isHuman ? "Noehost Support" : "Noe AI"}
                  {!isHuman && <Sparkles size={11} className="text-yellow-300 flex-shrink-0" />}
                </div>
                <div className="text-white/65 text-[10px] flex items-center gap-1">
                  {!isHuman && <Globe size={8} className="flex-shrink-0" />}
                  <span className="truncate">{statusText}</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={startNew} title="New chat"
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors">
                  <RefreshCw size={13} />
                </button>
                <button onClick={() => setOpen(false)} title="Close"
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* ── Web-search bar ──────────────────────────────────────────── */}
            {lastSearch && (
              <div className="bg-indigo-50 border-b border-indigo-100 px-3 py-1.5 flex items-center gap-1.5 text-[10px] text-indigo-600 font-semibold flex-shrink-0">
                <Search size={10} />
                Searched: <em className="font-bold not-italic">"{lastSearch.slice(0, 45)}"</em>
              </div>
            )}

            {/* ── Messages ────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/40">
              {/* Quick suggestions */}
              {showQuick && (
                <div className="space-y-1.5 pb-1">
                  {suggestions.slice(0, 5).map((q, i) => (
                    <button key={i} onClick={() => handleSend(q)}
                      className="w-full text-left flex items-center gap-2 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all group">
                      <span className="flex-1 leading-snug">{q}</span>
                      <ChevronRight size={11} className="text-slate-300 group-hover:text-primary flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Messages */}
              {msgs.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-1.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    m.role === "user" ? "bg-slate-200 text-slate-600"
                    : m.role === "admin" ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    : "bg-primary text-white"
                  }`}>
                    {m.role === "user" ? <User size={11} /> : m.role === "admin" ? <Shield size={11} /> : <Bot size={11} />}
                  </div>
                  <div className={`max-w-[84%] rounded-xl text-[12px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-white rounded-tr-sm px-3 py-2"
                      : m.role === "admin"
                      ? "bg-emerald-50 border border-emerald-200 text-slate-800 rounded-tl-sm px-3 py-2 shadow-sm"
                      : "bg-white text-slate-700 border border-slate-100 rounded-tl-sm px-3 py-2 shadow-sm"
                  }`}>
                    {m.role === "admin" && (
                      <div className="text-[9px] font-black text-emerald-600 mb-0.5 uppercase tracking-wider">Support Agent</div>
                    )}
                    <div className="prose prose-xs max-w-none prose-p:my-0 prose-ul:my-0.5 prose-strong:text-inherit">
                      {m.role === "user" ? m.content : <Markdown>{m.content}</Markdown>}
                    </div>
                    {m.role === "assistant" && m.metadata?.webSearched && (
                      <div className="mt-1 flex items-center gap-1 text-[9px] text-indigo-500 font-semibold">
                        <Search size={8} /> Searched web · "{String(m.metadata.searchedFor ?? "").slice(0, 35)}"
                      </div>
                    )}
                    {m.metadata?.attachment && m.metadata?.fileUrl && (
                      <a href={m.metadata.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 text-[10px] opacity-60 hover:opacity-100">
                        <Download size={9} /> View file
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot size={11} className="text-white" />
                  </div>
                  <div className="bg-white border border-slate-100 rounded-xl rounded-tl-sm px-3 py-2.5 shadow-sm">
                    <div className="flex gap-1 items-center mb-0.5">
                      {[0, 150, 300].map(d => (
                        <div key={d} className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1">
                      <Globe size={8} className="animate-spin" style={{ animationDuration: "2s" }} />
                      Crawling noehost.com + searching web…
                    </div>
                  </div>
                </div>
              )}

              {/* Guest contact form */}
              {showForm && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-primary/20 rounded-xl p-3.5 shadow-sm">
                  <div className="text-[12px] font-black text-slate-800 mb-0.5">Quick intro 👋</div>
                  <div className="text-[10px] text-slate-500 mb-3">So I can personalize your support:</div>
                  <form onSubmit={submitContact} className="space-y-2">
                    {[
                      { placeholder: "Your name", key: "name", type: "text", required: true },
                      { placeholder: "Email address", key: "email", type: "email", required: true },
                      { placeholder: "Phone / WhatsApp (optional)", key: "phone", type: "text", required: false },
                    ].map(f => (
                      <input key={f.key} type={f.type} required={f.required} placeholder={f.placeholder}
                        value={contact[f.key as keyof typeof contact]}
                        onChange={e => setContact(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 text-slate-800" />
                    ))}
                    <button type="submit"
                      className="w-full text-[11px] font-bold text-white bg-primary rounded-xl py-2 hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5">
                      <Send size={11} /> Start Chat
                    </button>
                  </form>
                </motion.div>
              )}

              <div ref={endRef} />
            </div>

            {/* ── Handover CTA ─────────────────────────────────────────────── */}
            {!handoverSent && msgs.length > 2 && status === "ai" && (
              <div className="px-3 pt-2 bg-white border-t border-slate-100 flex-shrink-0">
                <button onClick={requestHandover}
                  className="w-full text-[11px] font-bold text-slate-600 border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 rounded-xl py-1.5 transition-all flex items-center justify-center gap-1.5">
                  <Phone size={11} /> Talk to Human Agent
                </button>
              </div>
            )}
            {isHuman && (
              <div className="px-3 pt-2 bg-white border-t border-slate-100 flex-shrink-0">
                <div className="w-full text-[11px] font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-xl py-1.5 flex items-center justify-center gap-1.5">
                  <Shield size={11} />
                  {status === "handover" ? "Connecting to agent…" : "Human Agent is active"}
                </div>
              </div>
            )}

            {/* ── Input bar ───────────────────────────────────────────────── */}
            <div className="flex items-center gap-1.5 px-3 py-2.5 bg-white border-t border-slate-100 flex-shrink-0">
              <button onClick={() => fileRef.current?.click()} disabled={attachBusy || !sessionId}
                className="w-8 h-8 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 flex-shrink-0" title="Attach file">
                {attachBusy ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
              </button>
              <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
                placeholder={status === "closed" ? "Session closed — start new chat" : "Ask anything…"}
                disabled={status === "closed"}
                className="flex-1 text-[12px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 text-slate-800 placeholder:text-slate-400 disabled:opacity-60" />
              <button onClick={() => handleSend()} disabled={!input.trim() || loading || !sessionId}
                className="w-8 h-8 bg-primary hover:bg-primary/90 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all shadow-md shadow-primary/20 flex-shrink-0">
                <Send size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
