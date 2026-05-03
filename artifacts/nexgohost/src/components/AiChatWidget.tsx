import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, X, Send, Bot, Loader2, User, Minimize2,
  RotateCcw, Phone, Paperclip, Plus, Shield, HelpCircle,
  CreditCard, Server, Globe, ChevronRight, Download,
} from "lucide-react";
import Markdown from "react-markdown";

interface Message {
  id?: number;
  role: "user" | "assistant" | "admin";
  content: string;
  createdAt?: string;
  metadata?: Record<string, any>;
}

interface Session {
  sessionId: string;
  status: "ai" | "handover" | "human" | "closed";
}

const QUICK_OPTIONS = [
  { icon: Server, label: "Check Server Status", msg: "What is the current server and network status?" },
  { icon: CreditCard, label: "Billing Issue", msg: "I have a question about my invoice or billing." },
  { icon: Shield, label: "cPanel Help", msg: "I need help with cPanel settings." },
  { icon: Globe, label: "Domain Transfer", msg: "How do I transfer my domain to Noehost?" },
  { icon: HelpCircle, label: "SSL Certificate", msg: "How do I activate my free SSL certificate?" },
];

function genSessionId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const STORAGE_KEY = "noe_chat_session_id";
const WELCOME: Message = {
  role: "assistant",
  content: "Hi! I'm **Noe** 👋 — your Noehost AI Support Agent. I can see your account details and services to give you personalized help.\n\nHow can I help you today?",
};

export function AiChatWidget() {
  const [open, setOpen]           = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages]   = useState<Message[]>([WELCOME]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [unread, setUnread]       = useState(0);
  const [session, setSession]     = useState<Session | null>(null);
  const [handoverSent, setHandoverSent] = useState(false);
  const [showHandoverForm, setShowHandoverForm] = useState(false);
  const [attachLoading, setAttachLoading] = useState(false);
  const [polling, setPolling]     = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const pollTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    if (open && !minimized) {
      scrollToBottom();
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized, messages]);

  // Init session on widget open
  useEffect(() => {
    if (open && !session) {
      initSession();
    }
  }, [open]);

  // Poll for new messages when human agent is handling
  useEffect(() => {
    if (session?.status === "human" || session?.status === "handover") {
      if (!polling) {
        setPolling(true);
        pollTimerRef.current = setInterval(() => {
          pollMessages();
        }, 5000);
      }
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        setPolling(false);
      }
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [session?.status]);

  const getToken = () => localStorage.getItem("token") || localStorage.getItem("noehost_token");

  const authHeaders = () => {
    const token = getToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const initSession = async () => {
    try {
      let sessionId = localStorage.getItem(STORAGE_KEY);
      if (!sessionId) {
        sessionId = genSessionId("dash");
        localStorage.setItem(STORAGE_KEY, sessionId);
      }

      const res = await fetch("/api/ai/support/session", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ sessionId, source: "dashboard" }),
      });
      const data = await res.json();

      const sess: Session = { sessionId, status: data.status ?? "ai" };
      setSession(sess);

      if (data.existing) {
        // Load previous messages
        await loadHistory(sessionId, sess);
      }
    } catch { /* silent */ }
  };

  const loadHistory = async (sessionId: string, sess: Session) => {
    try {
      const res = await fetch(`/api/ai/support/session/${sessionId}/messages`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.messages?.length) {
        const loaded: Message[] = data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.created_at,
          metadata: m.metadata_json,
        }));
        setMessages([WELCOME, ...loaded]);
        setSession(prev => prev ? { ...prev, status: data.status ?? prev.status } : sess);
      }
    } catch { /* silent */ }
  };

  const pollMessages = useCallback(async () => {
    if (!session?.sessionId) return;
    try {
      const res = await fetch(`/api/ai/support/session/${session.sessionId}/messages`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.messages?.length) {
        const loaded: Message[] = data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.created_at,
        }));
        setMessages(prev => {
          const maxExistingId = Math.max(...prev.filter(m => m.id).map(m => m.id!), 0);
          const newMsgs = loaded.filter(m => m.id && m.id > maxExistingId);
          if (newMsgs.length) {
            if (!open || minimized) setUnread(n => n + newMsgs.length);
            return [WELCOME, ...loaded];
          }
          return prev;
        });
        setSession(prev => prev ? { ...prev, status: data.status ?? prev.status } : prev);
      }
    } catch { /* silent */ }
  }, [session?.sessionId, open, minimized]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading || !session) return;
    setInput("");

    const userMsg: Message = { role: "user", content };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/support/message", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ sessionId: session.sessionId, message: content }),
      });
      const data = await res.json();

      const reply = data.reply ?? "I'm sorry, something went wrong. Please try again.";
      const botMsg: Message = { role: data.status === "human" ? "admin" : "assistant", content: reply };
      setMessages(prev => [...prev, botMsg]);
      if (!open || minimized) setUnread(n => n + 1);

      if (data.status) {
        setSession(prev => prev ? { ...prev, status: data.status } : prev);
      }
      if (data.autoHandover) {
        setHandoverSent(true);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'm having trouble connecting. Please contact us at support@noehost.com or request a human agent.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const requestHandover = async () => {
    if (!session || handoverSent) return;
    setHandoverSent(true);
    setShowHandoverForm(false);

    try {
      await fetch(`/api/ai/support/handover/${session.sessionId}`, {
        method: "POST",
        headers: authHeaders(),
      });
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "🙋 **Human agent requested.** Our support team has been notified and will join this chat shortly. Average response time: 2–5 minutes.",
      }]);
      setSession(prev => prev ? { ...prev, status: "handover" } : prev);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "✅ Request sent! Our team will be with you shortly. You can also email support@noehost.com.",
      }]);
    }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    setAttachLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });

      let fileUrl = "";
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        fileUrl = uploadData.url ?? uploadData.fileUrl ?? "";
      } else {
        fileUrl = URL.createObjectURL(file);
      }

      await fetch(`/api/ai/support/attachment/${session.sessionId}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          fileName: file.name,
          fileUrl,
          mimeType: file.type,
          fileSize: file.size,
          uploadedBy: "client",
        }),
      });

      setMessages(prev => [...prev, {
        role: "user",
        content: `📎 Attached: **${file.name}** (${(file.size / 1024).toFixed(1)} KB)`,
        metadata: { attachment: true, fileUrl },
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "File attachment failed. Please try again or share the file URL directly.",
      }]);
    } finally {
      setAttachLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startNewConversation = () => {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([WELCOME]);
    setInput("");
    setSession(null);
    setHandoverSent(false);
    setShowHandoverForm(false);
    initSession();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const statusBadge = () => {
    if (session?.status === "human") return { dot: "bg-emerald-400", text: "Human Agent Active" };
    if (session?.status === "handover") return { dot: "bg-amber-400 animate-pulse", text: "Connecting to Agent…" };
    if (session?.status === "closed") return { dot: "bg-slate-400", text: "Session Closed" };
    return { dot: "bg-emerald-400 animate-pulse", text: "Noe AI • Online" };
  };

  const badge = statusBadge();
  const isHumanMode = session?.status === "human" || session?.status === "handover";

  return (
    <>
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileAttach}
        accept="image/*,.pdf,.doc,.docx,.txt,.log,.zip" />

      {/* Floating Button */}
      <AnimatePresence>
        {(!open || minimized) && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => { setOpen(true); setMinimized(false); setUnread(0); }}
            className="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-primary hover:bg-primary-600 text-white rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center transition-all hover:scale-110 group"
          >
            <MessageCircle size={26} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                {unread}
              </span>
            )}
            <span className="absolute right-full mr-3 whitespace-nowrap bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
              Ask Noe AI
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {open && !minimized && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-6 right-6 z-[9999] w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
            style={{ height: "580px" }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-indigo-600 px-5 py-4 flex items-center gap-3 flex-shrink-0">
              <div className="relative">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Bot size={22} className="text-white" />
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${badge.dot} rounded-full border-2 border-white`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-black text-sm">
                  {isHumanMode ? "Noehost Support Agent" : "Noe — AI Support"}
                </div>
                <div className="text-white/70 text-[11px] font-medium">{badge.text}</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={startNewConversation} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white" title="New conversation">
                  <Plus size={15} />
                </button>
                <button onClick={() => setMinimized(true)} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white" title="Minimize">
                  <Minimize2 size={15} />
                </button>
                <button onClick={() => { setOpen(false); setMinimized(false); }} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white" title="Close">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {/* Quick options when only welcome message */}
              {messages.length === 1 && (
                <div className="space-y-2 pb-1">
                  {QUICK_OPTIONS.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(opt.msg)}
                      className="w-full flex items-center gap-3 text-left text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all group"
                    >
                      <opt.icon size={15} className="text-slate-400 group-hover:text-primary flex-shrink-0 transition-colors" />
                      <span className="flex-1">{opt.label}</span>
                      <ChevronRight size={13} className="text-slate-300 group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    msg.role === "user"
                      ? "bg-slate-200 text-slate-600"
                      : msg.role === "admin"
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                      : "bg-primary text-white"
                  }`}>
                    {msg.role === "user" ? <User size={13} />
                      : msg.role === "admin" ? <Shield size={13} />
                      : <Bot size={13} />}
                  </div>
                  <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-white rounded-tr-sm"
                      : msg.role === "admin"
                      ? "bg-emerald-50 border border-emerald-200 text-slate-800 rounded-tl-sm shadow-sm"
                      : "bg-white text-slate-700 border border-slate-100 rounded-tl-sm shadow-sm"
                  }`}>
                    {msg.role === "admin" && (
                      <div className="text-[10px] font-bold text-emerald-600 mb-1 uppercase tracking-wide">Support Agent</div>
                    )}
                    <div className="prose prose-sm max-w-none prose-p:my-0.5 prose-ul:my-1 prose-strong:text-inherit">
                      {msg.role === "user" ? msg.content : <Markdown>{msg.content}</Markdown>}
                    </div>
                    {msg.metadata?.attachment && msg.metadata?.fileUrl && (
                      <a href={msg.metadata.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="mt-1.5 flex items-center gap-1.5 text-[11px] opacity-70 hover:opacity-100 transition-opacity">
                        <Download size={11} />
                        <span>View attachment</span>
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot size={13} className="text-white" />
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1.5 items-center">
                    <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Human Agent CTA */}
            {!handoverSent && messages.length > 2 && session?.status === "ai" && (
              <div className="px-4 pt-2 pb-0 bg-white border-t border-slate-100 flex-shrink-0">
                <button
                  onClick={requestHandover}
                  className="w-full text-xs font-bold text-slate-600 border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 rounded-xl py-2 transition-all flex items-center justify-center gap-2"
                >
                  <Phone size={12} />
                  Talk to Human Agent
                </button>
              </div>
            )}

            {isHumanMode && (
              <div className="px-4 pt-2 pb-0 bg-white border-t border-slate-100 flex-shrink-0">
                <div className="w-full text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-xl py-2 flex items-center justify-center gap-2">
                  <Shield size={12} />
                  {session?.status === "handover" ? "Waiting for agent to join…" : "Human Agent is active in this chat"}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 bg-white border-t border-slate-100 flex-shrink-0">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={attachLoading || !session}
                className="w-9 h-9 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl flex items-center justify-center transition-all flex-shrink-0 disabled:opacity-40"
                title="Attach file"
              >
                {attachLoading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
              </button>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={session?.status === "closed" ? "Session closed — start new chat" : "Ask me anything…"}
                disabled={session?.status === "closed"}
                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 text-slate-800 placeholder:text-slate-400 disabled:opacity-60"
              />
              {session?.status === "closed" ? (
                <button
                  onClick={startNewConversation}
                  className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-lg shadow-primary/20"
                  title="New chat"
                >
                  <RotateCcw size={15} />
                </button>
              ) : (
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading || !session}
                  className="w-10 h-10 bg-primary hover:bg-primary-600 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-lg shadow-primary/20"
                >
                  <Send size={15} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
