/**
 * LiveChatWidget — Hostinger-style clean AI support chat
 * Props:
 *   autoPopup?: boolean  — auto-open after 5s (website pages)
 *   source?:   string    — "website" | "dashboard"
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Send, Bot, UserCheck, ChevronDown,
  RefreshCw, Loader2, MessageSquare, ArrowRight,
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

const SESSION_KEY = "noe_chat_session";
const CONTACT_KEY = "noe_chat_contact";

function genSessionId(source: string) {
  return `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const QUICK_CHIPS = [
  "Hosting plans & prices",
  "Register a domain",
  "Set up business email",
  "Install WordPress",
  "Billing & invoices",
  "cPanel help",
];

const WELCOME_MSG: Msg = {
  role: "assistant",
  content: "👋 Hi! I'm **NoeBot**, your AI support assistant.\n\nMain aapki hosting, domain, email, aur billing mein help karta hoon.\n\nKya puchna chahte hain?",
};

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code style='background:#f1f1f1;padding:1px 4px;border-radius:3px;font-size:0.85em'>$1</code>")
    .replace(/\n/g, "<br/>");
}

function TypingDots() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-7 h-7 rounded-full bg-[#6940e0] flex items-center justify-center flex-shrink-0">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-3">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="block w-1.5 h-1.5 rounded-full bg-gray-400"
              style={{ animation: "nchat-dot 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }}
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

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div
          className="max-w-[78%] bg-[#6940e0] text-white rounded-2xl rounded-br-none px-4 py-2.5 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 mb-3">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isAdmin ? "bg-emerald-500" : "bg-[#6940e0]"}`}>
        {isAdmin
          ? <UserCheck className="w-3.5 h-3.5 text-white" />
          : <Bot className="w-3.5 h-3.5 text-white" />
        }
      </div>
      <div className="max-w-[78%]">
        {isAdmin && (
          <div className="text-[10px] font-semibold text-emerald-600 mb-0.5 ml-1">Support Agent</div>
        )}
        <div
          className={`rounded-2xl rounded-bl-none px-4 py-2.5 text-sm leading-relaxed border shadow-sm ${
            isAdmin
              ? "bg-emerald-50 border-emerald-100 text-emerald-900"
              : "bg-white border-gray-200 text-gray-800"
          }`}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
        />
      </div>
    </div>
  );
}

export default function LiveChatWidget({ autoPopup = false, source = "website" }: Props) {
  const [open, setOpen]           = useState(false);
  const [minimized, setMin]       = useState(false);
  const [msgs, setMsgs]           = useState<Msg[]>([WELCOME_MSG]);
  const [input, setInput]         = useState("");
  const [typing, setTyping]       = useState(false);
  const [sessionId, setSession]   = useState<string>(() =>
    localStorage.getItem(`${SESSION_KEY}_${source}`) || genSessionId(source)
  );
  const [sessionStatus, setStatus] = useState<"ai"|"handover"|"human"|"closed">("ai");
  const [unread, setUnread]       = useState(0);
  const [contact, setContact]     = useState<{ name: string; email: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem(CONTACT_KEY) || "null"); } catch { return null; }
  });
  const [contactForm, setContactForm] = useState({ name: "", email: "" });
  const [showContact, setShowContact] = useState(false);
  const [hasHandover, setHasHandover] = useState(false);
  const [popupBubble, setPopupBubble] = useState(false);
  const [showChips, setShowChips] = useState(true);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!autoPopup) return;
    const t1 = setTimeout(() => setPopupBubble(true), 4000);
    const t2 = setTimeout(() => { setPopupBubble(false); setOpen(true); }, 10000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [autoPopup]);

  useEffect(() => {
    localStorage.setItem(`${SESSION_KEY}_${source}`, sessionId);
  }, [sessionId, source]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (sessionStatus === "human" || sessionStatus === "handover") {
      pollRef.current = setInterval(pollMessages, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [sessionStatus, sessionId]);

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
        const rebuilt: Msg[] = messages.map((m: any) => ({
          id: String(m.id), role: m.role, content: m.content, createdAt: m.created_at,
        }));
        setMsgs([WELCOME_MSG, ...rebuilt]);
      }
    } catch { /* non-fatal */ }
  }, [sessionId]);

  const handleOpen = () => {
    setOpen(true); setPopupBubble(false); setUnread(0);
    if (!contact && source === "website" && msgs.length <= 1) setShowContact(true);
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.trim()) return;
    const info = { name: contactForm.name.trim(), email: contactForm.email.trim() };
    setContact(info);
    localStorage.setItem(CONTACT_KEY, JSON.stringify(info));
    setShowContact(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || typing || sessionStatus === "closed") return;
    setInput("");
    setShowChips(false);
    addMsg({ role: "user", content: text });
    setTyping(true);
    const userCount = msgs.filter(m => m.role === "user").length;
    if (userCount >= 2) setHasHandover(true);
    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId, message: text,
          clientName: contact?.name, clientEmail: contact?.email, source,
        }),
      });
      const data = await res.json();
      setStatus(data.status || "ai");
      if (data.reply) addMsg({ role: "assistant", content: data.reply });
      else if (data.awaitingAgent) addMsg({ role: "assistant", content: "✅ Message mil gaya. Support agent jald reply karega." });
    } catch {
      addMsg({ role: "assistant", content: "Network issue. Thodi der baad try karein." });
    } finally {
      setTyping(false);
    }
  };

  const handleSend = () => sendMessage(input);

  const handleChip = (chip: string) => sendMessage(chip);

  const handleHandover = async () => {
    try {
      await fetch(`/api/chat/handover/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: contact?.name, clientEmail: contact?.email }),
      });
      setStatus("handover");
      addMsg({ role: "assistant", content: "✅ Aapka request receive ho gaya. Support agent jald connect hoga." });
    } catch {
      addMsg({ role: "assistant", content: "Connection issue. Please try again." });
    }
  };

  const handleReset = () => {
    setSession(genSessionId(source));
    setMsgs([WELCOME_MSG]);
    setStatus("ai");
    setHasHandover(false);
    setUnread(0);
    setShowChips(true);
  };

  const statusLabel = {
    ai: "Online — typically replies instantly",
    handover: "Connecting to agent...",
    human: "Agent connected",
    closed: "Session closed",
  }[sessionStatus];

  return (
    <>
      <style>{`
        @keyframes nchat-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>

      {/* Popup greeting */}
      <AnimatePresence>
        {popupBubble && !open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-[88px] right-6 z-[9998] max-w-[220px] cursor-pointer"
            onClick={handleOpen}
          >
            <div className="bg-white rounded-2xl rounded-br-sm shadow-xl border border-gray-100 px-4 py-3 text-sm text-gray-700">
              <div className="font-semibold text-[#6940e0] text-xs mb-1">NoeBot · AI Support</div>
              Hi! 👋 Koi help chahiye? Yahan hoon!
            </div>
            <div className="w-2.5 h-2.5 bg-white border-r border-b border-gray-100 rotate-45 absolute -bottom-1 right-7" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB button */}
      <motion.button
        onClick={handleOpen}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full bg-[#6940e0] shadow-lg shadow-[#6940e0]/30 flex items-center justify-center text-white hover:bg-[#5930cc] transition-colors"
        aria-label="Open chat"
      >
        {open
          ? <ChevronDown className="w-6 h-6" />
          : <MessageSquare className="w-6 h-6" />
        }
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </motion.button>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed bottom-[88px] right-6 z-[9999] w-[360px] max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl shadow-black/15 overflow-hidden flex flex-col border border-gray-100"
            style={{ height: minimized ? "60px" : "540px", transition: "height 0.2s ease" }}
          >
            {/* ── Header ── */}
            <div className="bg-[#6940e0] px-4 py-3 flex items-center gap-3 flex-shrink-0">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#6940e0] ${
                  sessionStatus === "ai" ? "bg-green-400" :
                  sessionStatus === "handover" ? "bg-yellow-400 animate-pulse" :
                  sessionStatus === "human" ? "bg-emerald-400" : "bg-gray-400"
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm">Noehost Support</div>
                <div className="text-white/70 text-[11px] truncate">{statusLabel}</div>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setMin(m => !m)}
                  className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${minimized ? "rotate-180" : ""}`} />
                </button>
                <button
                  onClick={handleReset}
                  className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title="New conversation"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* ── Contact Form ── */}
                {showContact ? (
                  <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center p-6">
                    <div className="w-12 h-12 rounded-full bg-[#6940e0] flex items-center justify-center mb-4">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-base font-bold text-gray-800 mb-1 text-center">Before we start</h3>
                    <p className="text-xs text-gray-500 text-center mb-5 leading-relaxed">
                      Apna naam aur email share karein taake hum follow-up kar sakein.
                    </p>
                    <form onSubmit={handleContactSubmit} className="w-full space-y-2.5">
                      <input
                        type="text"
                        placeholder="Aapka naam"
                        value={contactForm.name}
                        onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                        required
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#6940e0]/30 focus:border-[#6940e0]"
                      />
                      <input
                        type="email"
                        placeholder="Aapka email"
                        value={contactForm.email}
                        onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                        required
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#6940e0]/30 focus:border-[#6940e0]"
                      />
                      <button
                        type="submit"
                        className="w-full bg-[#6940e0] hover:bg-[#5930cc] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        Start Chat <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowContact(false)}
                        className="w-full text-gray-400 text-xs hover:text-gray-600 py-1 transition-colors"
                      >
                        Skip
                      </button>
                    </form>
                  </div>
                ) : (
                  <>
                    {/* ── Messages ── */}
                    <div className="flex-1 overflow-y-auto bg-gray-50 px-4 pt-4 pb-2">
                      {msgs.map((m, i) => <MsgBubble key={m.id ?? i} msg={m} />)}
                      {typing && <TypingDots />}

                      {/* Quick chips — only on welcome screen */}
                      {showChips && msgs.length === 1 && !typing && (
                        <div className="flex flex-wrap gap-1.5 pt-1 pb-2">
                          {QUICK_CHIPS.map(chip => (
                            <button
                              key={chip}
                              onClick={() => handleChip(chip)}
                              className="text-xs bg-white border border-gray-200 text-[#6940e0] rounded-full px-3 py-1.5 hover:bg-[#6940e0] hover:text-white hover:border-[#6940e0] transition-all shadow-sm font-medium"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      )}
                      <div ref={bottomRef} />
                    </div>

                    {/* ── Status banners ── */}
                    {sessionStatus === "handover" && (
                      <div className="bg-amber-50 border-t border-amber-100 px-4 py-2 flex items-center justify-center gap-2 text-xs text-amber-700">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Agent se connect ho raha hai...
                      </div>
                    )}
                    {sessionStatus === "closed" && (
                      <div className="bg-gray-50 border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-500">
                        Session closed.{" "}
                        <button onClick={handleReset} className="text-[#6940e0] hover:underline">New chat start karein</button>
                      </div>
                    )}

                    {/* ── Input area ── */}
                    {sessionStatus !== "closed" && (
                      <div className="bg-white border-t border-gray-100 px-3 py-3 flex-shrink-0">
                        {hasHandover && sessionStatus === "ai" && (
                          <button
                            onClick={handleHandover}
                            className="w-full flex items-center justify-center gap-1.5 text-xs text-[#6940e0] bg-[#6940e0]/5 hover:bg-[#6940e0]/10 border border-[#6940e0]/20 rounded-xl px-3 py-2 mb-2.5 transition-colors font-medium"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Talk to Human Agent
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
                            placeholder="Message karein..."
                            rows={1}
                            disabled={typing}
                            className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6940e0]/20 focus:border-[#6940e0] disabled:opacity-50 max-h-24 overflow-y-auto"
                            style={{ lineHeight: "1.45" }}
                          />
                          <button
                            onClick={handleSend}
                            disabled={!input.trim() || typing}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#6940e0] hover:bg-[#5930cc] text-white disabled:opacity-30 transition-colors flex-shrink-0"
                            aria-label="Send"
                          >
                            {typing
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Send className="w-4 h-4" />
                            }
                          </button>
                        </div>
                        <div className="mt-1.5 text-center">
                          <span className="text-[10px] text-gray-300">Powered by Noehost AI · noehost.com</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
