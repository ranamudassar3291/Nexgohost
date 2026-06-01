/**
 * LiveChatWidget — compact AI support chat
 * - Smaller: 320 × 460px
 * - File / Image attach support
 * - autoPopup: shows bubble at 2s, opens at 5s
 * - source: "website" | "dashboard"
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Send, Bot, UserCheck, ChevronDown,
  RefreshCw, Loader2, MessageSquare, ArrowRight,
  Paperclip, Image as ImageIcon, FileText, XCircle,
} from "lucide-react";

interface Msg {
  id?: string;
  role: "user" | "assistant" | "admin";
  content: string;
  attachment?: { name: string; type: string; url?: string };
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
  "Setup email",
  "Install WordPress",
  "Billing help",
  "cPanel access",
];

const WELCOME_MSG: Msg = {
  role: "assistant",
  content: "👋 Hi! I'm **Noe**, your AI support assistant.\n\nHosting, domain, email, ya billing — koi bhi sawaal poochein!",
};

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code style='background:#f1f1f1;padding:1px 4px;border-radius:3px;font-size:0.82em'>$1</code>")
    .replace(/\n/g, "<br/>");
}

function TypingDots() {
  return (
    <div className="flex items-end gap-1.5 mb-2">
      <div className="w-6 h-6 rounded-full bg-[#6940e0] flex items-center justify-center flex-shrink-0">
        <Bot className="w-3 h-3 text-white" />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-3 py-2 shadow-sm">
        <div className="flex gap-1 items-center h-2.5">
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

function AttachmentPreview({ att }: { att: Msg["attachment"] }) {
  if (!att) return null;
  const isImage = att.type.startsWith("image/");
  return (
    <div className="mt-1">
      {isImage && att.url ? (
        <img src={att.url} alt={att.name} className="max-w-[160px] rounded-xl border border-white/20 cursor-pointer" onClick={() => window.open(att.url)} />
      ) : (
        <div className="flex items-center gap-1.5 bg-white/20 rounded-xl px-2.5 py-1.5 text-xs">
          <FileText className="w-3 h-3 flex-shrink-0" />
          <span className="truncate max-w-[120px]">{att.name}</span>
        </div>
      )}
    </div>
  );
}

function MsgBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  const isAdmin = msg.role === "admin";

  if (isUser) {
    return (
      <div className="flex justify-end mb-2">
        <div className="max-w-[80%] bg-[#6940e0] text-white rounded-2xl rounded-br-none px-3 py-2 text-[13px] leading-relaxed">
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
          {msg.attachment && <AttachmentPreview att={msg.attachment} />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1.5 mb-2">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isAdmin ? "bg-emerald-500" : "bg-[#6940e0]"}`}>
        {isAdmin
          ? <UserCheck className="w-3 h-3 text-white" />
          : <Bot className="w-3 h-3 text-white" />
        }
      </div>
      <div className="max-w-[80%]">
        {isAdmin && (
          <div className="text-[9px] font-bold text-emerald-600 mb-0.5 ml-1">Support Agent</div>
        )}
        <div
          className={`rounded-2xl rounded-bl-none px-3 py-2 text-[13px] leading-relaxed border shadow-sm ${
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
  const [pendingFile, setPendingFile] = useState<{ file: File; previewUrl?: string } | null>(null);
  const [uploading, setUploading]  = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Auto-popup timer ── */
  useEffect(() => {
    if (!autoPopup) return;
    const t1 = setTimeout(() => setPopupBubble(true), 2000);
    const t2 = setTimeout(() => { setPopupBubble(false); setOpen(true); }, 5000);
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

  /* ── File picker ── */
  const handleFileClick = () => fileRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be under 10 MB");
      return;
    }
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    setPendingFile({ file, previewUrl });
    e.target.value = "";
  };

  const cancelFile = () => {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  };

  /* ── Send message (with optional file) ── */
  const sendMessage = async (text: string, fileOverride?: { file: File; previewUrl?: string }) => {
    const fileToSend = fileOverride ?? pendingFile;
    if (!text.trim() && !fileToSend) return;
    if (typing || sessionStatus === "closed") return;

    const displayText = text.trim() || (fileToSend ? `📎 ${fileToSend.file.name}` : "");
    setInput("");
    setPendingFile(null);
    setShowChips(false);

    const userMsg: Msg = {
      role: "user",
      content: displayText,
      attachment: fileToSend ? { name: fileToSend.file.name, type: fileToSend.file.type, url: fileToSend.previewUrl } : undefined,
    };
    addMsg(userMsg);
    setTyping(true);

    const userCount = msgs.filter(m => m.role === "user").length;
    if (userCount >= 2) setHasHandover(true);

    try {
      let attachmentNote = "";
      if (fileToSend) {
        setUploading(true);
        try {
          const form = new FormData();
          form.append("file", fileToSend.file);
          form.append("sessionId", sessionId);
          const upRes = await fetch("/api/chat/upload", { method: "POST", body: form });
          if (upRes.ok) {
            const upData = await upRes.json();
            attachmentNote = upData.url ? ` [file: ${upData.url}]` : "";
          }
        } catch { /* non-blocking */ } finally {
          setUploading(false);
        }
      }

      const msgToSend = text.trim() ? text.trim() + attachmentNote : `Attached file: ${fileToSend?.file.name}${attachmentNote}`;

      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId, message: msgToSend,
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

  const handleSend = () => {
    if (input.trim() || pendingFile) sendMessage(input);
  };

  const handleChip = (chip: string) => sendMessage(chip);

  const handleHandover = async () => {
    try {
      await fetch(`/api/chat/handover/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: contact?.name, clientEmail: contact?.email }),
      });
      setStatus("handover");
      addMsg({ role: "assistant", content: "✅ Request receive ho gaya. Support agent jald connect hoga." });
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
    setPendingFile(null);
  };

  const statusLabel = {
    ai: "Online — instant replies",
    handover: "Connecting to agent...",
    human: "Agent connected ✓",
    closed: "Session closed",
  }[sessionStatus];

  const statusDot = {
    ai: "bg-green-400",
    handover: "bg-yellow-400 animate-pulse",
    human: "bg-emerald-400",
    closed: "bg-gray-400",
  }[sessionStatus];

  return (
    <>
      <style>{`
        @keyframes nchat-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,.doc,.docx,.txt,.zip"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Popup greeting bubble */}
      <AnimatePresence>
        {popupBubble && !open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            className="fixed bottom-[82px] right-5 z-[9998] max-w-[200px] cursor-pointer"
            onClick={handleOpen}
          >
            <div className="bg-white rounded-2xl rounded-br-sm shadow-xl border border-gray-100 px-3 py-2.5 text-xs text-gray-700">
              <div className="font-bold text-[#6940e0] text-[10px] mb-0.5">Noe AI · Support</div>
              Hi! 👋 Koi help chahiye?
            </div>
            <div className="w-2 h-2 bg-white border-r border-b border-gray-100 rotate-45 absolute -bottom-1 right-6" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB toggle button */}
      <motion.button
        onClick={open ? () => setOpen(false) : handleOpen}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-5 right-5 z-[9999] w-12 h-12 rounded-full bg-[#6940e0] shadow-lg shadow-[#6940e0]/30 flex items-center justify-center text-white hover:bg-[#5930cc] transition-colors"
        aria-label="Toggle chat"
      >
        {open
          ? <ChevronDown className="w-5 h-5" />
          : <MessageSquare className="w-5 h-5" />
        }
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </motion.button>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed bottom-[72px] right-5 z-[9999] w-[320px] max-w-[calc(100vw-1.25rem)] bg-white rounded-2xl shadow-2xl shadow-black/15 overflow-hidden flex flex-col border border-gray-100"
            style={{ height: minimized ? "52px" : "460px", transition: "height 0.2s ease" }}
          >
            {/* ── Header ── */}
            <div className="bg-[#6940e0] px-3 py-2.5 flex items-center gap-2.5 flex-shrink-0">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-[#6940e0] ${statusDot}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-[13px]">Noehost Support</div>
                <div className="text-white/70 text-[10px] truncate">{statusLabel}</div>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setMin(m => !m)}
                  className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${minimized ? "rotate-180" : ""}`} />
                </button>
                <button
                  onClick={handleReset}
                  className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                  title="New chat"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* ── Contact Form (website guests) ── */}
                {showContact ? (
                  <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center p-5">
                    <div className="w-10 h-10 rounded-full bg-[#6940e0] flex items-center justify-center mb-3">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800 mb-0.5 text-center">Quick intro</h3>
                    <p className="text-[11px] text-gray-500 text-center mb-4 leading-relaxed">
                      Naam aur email dein — better support ke liye.
                    </p>
                    <form onSubmit={handleContactSubmit} className="w-full space-y-2">
                      <input
                        type="text"
                        placeholder="Aapka naam"
                        value={contactForm.name}
                        onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                        required
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#6940e0]/30 focus:border-[#6940e0]"
                      />
                      <input
                        type="email"
                        placeholder="Aapka email"
                        value={contactForm.email}
                        onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                        required
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#6940e0]/30 focus:border-[#6940e0]"
                      />
                      <button
                        type="submit"
                        className="w-full bg-[#6940e0] hover:bg-[#5930cc] text-white font-semibold py-2 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        Start Chat <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowContact(false)}
                        className="w-full text-gray-400 text-[11px] hover:text-gray-600 py-1 transition-colors"
                      >
                        Skip
                      </button>
                    </form>
                  </div>
                ) : (
                  <>
                    {/* ── Messages ── */}
                    <div className="flex-1 overflow-y-auto bg-gray-50 px-3 pt-3 pb-2">
                      {msgs.map((m, i) => <MsgBubble key={m.id ?? i} msg={m} />)}
                      {typing && <TypingDots />}

                      {/* Quick chips */}
                      {showChips && msgs.length === 1 && !typing && (
                        <div className="flex flex-wrap gap-1 pt-1 pb-1">
                          {QUICK_CHIPS.map(chip => (
                            <button
                              key={chip}
                              onClick={() => handleChip(chip)}
                              className="text-[11px] bg-white border border-gray-200 text-[#6940e0] rounded-full px-2.5 py-1 hover:bg-[#6940e0] hover:text-white hover:border-[#6940e0] transition-all shadow-sm font-medium"
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
                      <div className="bg-amber-50 border-t border-amber-100 px-3 py-1.5 flex items-center justify-center gap-1.5 text-[11px] text-amber-700">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Agent se connect ho raha hai...
                      </div>
                    )}
                    {sessionStatus === "closed" && (
                      <div className="bg-gray-50 border-t border-gray-100 px-3 py-1.5 text-center text-[11px] text-gray-500">
                        Session closed.{" "}
                        <button onClick={handleReset} className="text-[#6940e0] hover:underline">New chat</button>
                      </div>
                    )}

                    {/* ── Pending file preview ── */}
                    {pendingFile && (
                      <div className="bg-[#6940e0]/5 border-t border-[#6940e0]/10 px-3 py-1.5 flex items-center gap-2">
                        {pendingFile.previewUrl ? (
                          <img src={pendingFile.previewUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-[#6940e0]/20" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-[#6940e0]/10 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-[#6940e0]" />
                          </div>
                        )}
                        <span className="flex-1 text-[11px] text-gray-700 truncate">{pendingFile.file.name}</span>
                        <button onClick={cancelFile} className="text-gray-400 hover:text-red-500 transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* ── Input area ── */}
                    {sessionStatus !== "closed" && (
                      <div className="bg-white border-t border-gray-100 px-2.5 py-2 flex-shrink-0">
                        {hasHandover && sessionStatus === "ai" && (
                          <button
                            onClick={handleHandover}
                            className="w-full flex items-center justify-center gap-1 text-[11px] text-[#6940e0] bg-[#6940e0]/5 hover:bg-[#6940e0]/10 border border-[#6940e0]/20 rounded-xl px-2 py-1.5 mb-2 transition-colors font-semibold"
                          >
                            <UserCheck className="w-3 h-3" />
                            Talk to Human Agent
                          </button>
                        )}
                        <div className="flex items-end gap-1.5">
                          {/* Attach button */}
                          <button
                            onClick={handleFileClick}
                            disabled={typing || uploading}
                            title="Attach file or image"
                            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-[#6940e0] hover:bg-[#6940e0]/8 transition-colors disabled:opacity-30 flex-shrink-0"
                          >
                            {pendingFile?.previewUrl
                              ? <ImageIcon className="w-4 h-4 text-[#6940e0]" />
                              : <Paperclip className="w-4 h-4" />
                            }
                          </button>

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
                            placeholder={pendingFile ? "Add a message... (optional)" : "Message karein..."}
                            rows={1}
                            disabled={typing}
                            className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-[13px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6940e0]/20 focus:border-[#6940e0] disabled:opacity-50 max-h-20 overflow-y-auto"
                            style={{ lineHeight: "1.4" }}
                          />

                          <button
                            onClick={handleSend}
                            disabled={(!input.trim() && !pendingFile) || typing}
                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#6940e0] hover:bg-[#5930cc] text-white disabled:opacity-30 transition-colors flex-shrink-0"
                            aria-label="Send"
                          >
                            {typing || uploading
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Send className="w-3.5 h-3.5" />
                            }
                          </button>
                        </div>
                        <div className="mt-1 text-center">
                          <span className="text-[9px] text-gray-300">Powered by Noehost AI</span>
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
