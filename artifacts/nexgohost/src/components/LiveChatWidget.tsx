/**
 * LiveChatWidget — Hostinger-style AI support chat
 * Props:
 *   autoPopup?: boolean  — auto-open after 3s (for public website pages)
 *   source?:   string    — "website" | "dashboard" (default "website")
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, X, Send, Bot, User, Loader2,
  Minimize2, RefreshCw, UserCheck, ChevronDown,
  Paperclip, Sparkles, CheckCheck,
} from "lucide-react";

interface Msg {
  id?: string;
  role: "user" | "assistant" | "admin";
  content: string;
  createdAt?: string;
}

interface Props {
  autoPopup?: boolean;
  source?: "website" | "dashboard";
}

const SESSION_KEY = "noe_live_chat_session";
const CONTACT_KEY = "noe_live_chat_contact";

function genSessionId(source: string) {
  return `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const QUICK_CHIPS = [
  "What hosting plans do you offer?",
  "How do I register a domain?",
  "How do I set up email?",
  "I need help with my billing",
  "How do I install WordPress?",
];

const WELCOME_MSG: Msg = {
  role: "assistant",
  content: "👋 Hi! I'm **NoeBot** — your AI support assistant at Noehost.\n\nMain mein aapki hosting, domain, email, aur billing ke bare mein help kar sakta hoon. Kya puchna chahte hain?",
};

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mt-1">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="block w-2 h-2 rounded-full bg-indigo-400"
              style={{
                animation: "noe-bounce 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MsgBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  const isAdmin = msg.role === "admin";
  const lines = msg.content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");

  if (isUser) {
    return (
      <div className="flex justify-end mt-2">
        <div className="max-w-[80%]">
          <div
            className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed shadow-md"
            dangerouslySetInnerHTML={{ __html: lines }}
          />
          <div className="flex justify-end mt-0.5">
            <CheckCheck className="w-3 h-3 text-slate-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 mt-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow ${
        isAdmin
          ? "bg-gradient-to-br from-emerald-500 to-teal-600"
          : "bg-gradient-to-br from-indigo-500 to-purple-600"
      }`}>
        {isAdmin ? <UserCheck className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>
      <div className="max-w-[80%]">
        {isAdmin && (
          <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5 ml-1">
            Support Agent
          </div>
        )}
        <div
          className={`rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm border ${
            isAdmin
              ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100"
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
          }`}
          dangerouslySetInnerHTML={{ __html: lines }}
        />
      </div>
    </div>
  );
}

export default function LiveChatWidget({ autoPopup = false, source = "website" }: Props) {
  const [open, setOpen]         = useState(false);
  const [minimized, setMin]     = useState(false);
  const [msgs, setMsgs]         = useState<Msg[]>([WELCOME_MSG]);
  const [input, setInput]       = useState("");
  const [typing, setTyping]     = useState(false);
  const [sessionId, setSession] = useState<string>(() => {
    const stored = localStorage.getItem(`${SESSION_KEY}_${source}`);
    return stored || genSessionId(source);
  });
  const [sessionStatus, setStatus] = useState<"ai"|"handover"|"human"|"closed">("ai");
  const [unread, setUnread]     = useState(0);
  const [contact, setContact]   = useState<{ name: string; email: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem(CONTACT_KEY) || "null"); } catch { return null; }
  });
  const [contactForm, setContactForm] = useState({ name: "", email: "" });
  const [showContact, setShowContact] = useState(false);
  const [hasHandover, setHasHandover] = useState(false);
  const [popupBubble, setPopupBubble] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-popup for website
  useEffect(() => {
    if (!autoPopup) return;
    const t1 = setTimeout(() => setPopupBubble(true), 3000);
    const t2 = setTimeout(() => {
      setPopupBubble(false);
      setOpen(true);
    }, 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [autoPopup]);

  // Persist sessionId
  useEffect(() => {
    localStorage.setItem(`${SESSION_KEY}_${source}`, sessionId);
  }, [sessionId, source]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing]);

  // Poll for admin messages when human/handover
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (sessionStatus === "human" || sessionStatus === "handover") {
      pollRef.current = setInterval(pollMessages, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [sessionStatus, sessionId]);

  // Unread badge when closed
  const addMsg = useCallback((msg: Msg) => {
    setMsgs(prev => [...prev, msg]);
    if (!open) setUnread(n => n + 1);
  }, [open]);

  const pollMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/session/${sessionId}/messages`);
      if (!res.ok) return;
      const { messages, session } = await res.json();
      if (session?.status) setStatus(session.status as any);
      if (messages?.length > 0) {
        const last = messages[messages.length - 1];
        const myLast = msgs[msgs.length - 1];
        if (last.id !== myLast?.id || last.created_at !== myLast?.createdAt) {
          // Rebuild from server
          const rebuilt: Msg[] = messages.map((m: any) => ({
            id: String(m.id),
            role: m.role,
            content: m.content,
            createdAt: m.created_at,
          }));
          setMsgs([WELCOME_MSG, ...rebuilt]);
        }
      }
    } catch { /* non-fatal */ }
  }, [sessionId, msgs]);

  const handleOpen = () => {
    setOpen(true);
    setPopupBubble(false);
    setUnread(0);
    // If guest and no contact info, show contact form
    if (!contact && source === "website" && msgs.length <= 1) {
      setShowContact(true);
    }
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.trim()) return;
    const info = { name: contactForm.name.trim(), email: contactForm.email.trim() };
    setContact(info);
    localStorage.setItem(CONTACT_KEY, JSON.stringify(info));
    setShowContact(false);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || typing || sessionStatus === "closed") return;
    setInput("");
    const userMsg: Msg = { role: "user", content: text };
    addMsg(userMsg);
    setTyping(true);

    // Show handover button after 2nd user message
    const userCount = msgs.filter(m => m.role === "user").length;
    if (userCount >= 2) setHasHandover(true);

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: text,
          clientName: contact?.name,
          clientEmail: contact?.email,
          source,
        }),
      });
      const data = await res.json();
      setStatus(data.status || "ai");
      if (data.reply) {
        addMsg({ role: "assistant", content: data.reply });
      } else if (data.awaitingAgent) {
        addMsg({ role: "assistant", content: "Your message has been sent. Our support agent will reply soon." });
      }
    } catch {
      addMsg({ role: "assistant", content: FALLBACK_MSG });
    } finally {
      setTyping(false);
    }
  };

  const handleHandover = async () => {
    try {
      await fetch(`/api/chat/handover/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: contact?.name, clientEmail: contact?.email }),
      });
      setStatus("handover");
      addMsg({
        role: "assistant",
        content: "✅ Your request has been received. A support agent will join shortly. You can continue chatting below.",
      });
    } catch {
      addMsg({ role: "assistant", content: "Could not connect to agent right now. Please try again." });
    }
  };

  const handleReset = () => {
    const newId = genSessionId(source);
    setSession(newId);
    setMsgs([WELCOME_MSG]);
    setStatus("ai");
    setHasHandover(false);
    setUnread(0);
  };

  const FALLBACK_MSG = "Our agents are currently processing multiple requests. Please try again in a few moments.";

  const statusLabel = {
    ai: "NoeBot · Online",
    handover: "Connecting to Agent...",
    human: "Support Agent · Active",
    closed: "Session Closed",
  }[sessionStatus];

  const statusDot = {
    ai: "bg-green-400",
    handover: "bg-amber-400 animate-pulse",
    human: "bg-emerald-400",
    closed: "bg-slate-400",
  }[sessionStatus];

  return (
    <>
      {/* CSS for bounce animation */}
      <style>{`
        @keyframes noe-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>

      {/* Popup greeting bubble */}
      <AnimatePresence>
        {popupBubble && !open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed bottom-24 right-6 z-[9998] max-w-[240px]"
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl rounded-br-sm shadow-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 cursor-pointer text-sm text-slate-700 dark:text-slate-200"
              onClick={handleOpen}
            >
              <div className="font-semibold text-indigo-600 dark:text-indigo-400 mb-0.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> NoeBot
              </div>
              Hi! 👋 Koi help chahiye? I'm here!
            </div>
            <div className="w-3 h-3 bg-white dark:bg-slate-900 border-r border-b border-slate-200 dark:border-slate-700 rotate-45 absolute -bottom-1.5 right-8" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        onClick={handleOpen}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl flex items-center justify-center text-white hover:shadow-indigo-400/40 transition-shadow"
        aria-label="Open chat"
      >
        <MessageCircle className="w-6 h-6" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </motion.button>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="fixed bottom-24 right-6 z-[9999] w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ height: minimized ? "64px" : "560px", transition: "height 0.2s ease" }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center gap-3 flex-shrink-0">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center shadow-inner">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-indigo-600 ${statusDot}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm leading-tight">Noehost Support</div>
                <div className="text-indigo-200 text-[11px] truncate">{statusLabel}</div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMin(!minimized)}
                  className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Minimize"
                >
                  {minimized ? <ChevronDown className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleReset}
                  className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="New chat"
                  title="Start new chat"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* Contact form overlay */}
                {showContact && (
                  <div className="flex-1 bg-white dark:bg-slate-900 flex flex-col items-center justify-center p-6">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg">
                      <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1 text-center">
                      Before we start
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-5">
                      Please share your name and email so we can follow up if needed.
                    </p>
                    <form onSubmit={handleContactSubmit} className="w-full space-y-3">
                      <input
                        type="text"
                        placeholder="Your name"
                        value={contactForm.name}
                        onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                        required
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <input
                        type="email"
                        placeholder="Your email"
                        value={contactForm.email}
                        onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                        required
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity shadow-md"
                      >
                        Start Chat →
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowContact(false)}
                        className="w-full text-slate-400 dark:text-slate-500 text-xs hover:text-slate-600 dark:hover:text-slate-300 py-1 transition-colors"
                      >
                        Skip for now
                      </button>
                    </form>
                  </div>
                )}

                {/* Messages area */}
                {!showContact && (
                  <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 px-4 py-4 space-y-1">
                    {msgs.map((m, i) => <MsgBubble key={m.id ?? i} msg={m} />)}
                    {typing && <TypingIndicator />}

                    {/* Quick chips — show after welcome only */}
                    {msgs.length === 1 && !typing && (
                      <div className="pt-3 flex flex-wrap gap-2">
                        {QUICK_CHIPS.map(chip => (
                          <button
                            key={chip}
                            onClick={() => { setInput(chip); setTimeout(handleSend, 50); }}
                            className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 rounded-full px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors shadow-sm"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}

                {/* Status banners */}
                {!showContact && sessionStatus === "handover" && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-700 px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Connecting you to a support agent...
                    </div>
                  </div>
                )}
                {!showContact && sessionStatus === "closed" && (
                  <div className="bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-2 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Session closed.</p>
                    <button onClick={handleReset} className="text-xs text-indigo-500 hover:underline mt-0.5">Start new chat</button>
                  </div>
                )}

                {/* Input area */}
                {!showContact && sessionStatus !== "closed" && (
                  <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-3 py-3 flex-shrink-0">
                    {/* Handover button */}
                    {hasHandover && sessionStatus === "ai" && (
                      <button
                        onClick={handleHandover}
                        className="w-full flex items-center justify-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700 rounded-xl px-3 py-2 mb-2.5 transition-colors font-medium"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Talk to a Human Agent
                      </button>
                    )}
                    <div className="flex items-end gap-2">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder="Type your message…"
                        rows={1}
                        disabled={typing}
                        className="flex-1 resize-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 max-h-28 overflow-y-auto"
                        style={{ lineHeight: "1.4" }}
                      />
                      <button
                        onClick={handleSend}
                        disabled={!input.trim() || typing}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"
                        aria-label="Send"
                      >
                        {typing
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Send className="w-4 h-4" />
                        }
                      </button>
                    </div>
                    <div className="mt-1.5 text-center">
                      <span className="text-[10px] text-slate-400 dark:text-slate-600">
                        Powered by NoeBot · Noehost.com
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
