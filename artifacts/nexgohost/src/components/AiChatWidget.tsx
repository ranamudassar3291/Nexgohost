import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, Loader2, User, Minimize2, RotateCcw } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_QUESTIONS = [
  "How do I set up WordPress?",
  "How to transfer a domain?",
  "View my invoice",
  "Upgrade my hosting plan",
];

const WELCOME_MSG: Message = {
  role: "assistant",
  content: "Hi! I'm Noe 👋 — your Noehost AI assistant. How can I help you today?",
};

export function AiChatWidget() {
  const [open, setOpen]           = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages]   = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [unread, setUnread]       = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized, messages]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: newMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply = data.reply ?? "I'm sorry, something went wrong. Please try again.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      if (!open || minimized) setUnread(n => n + 1);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'm having trouble connecting. Please contact us at support@noehost.com.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const reset = () => {
    setMessages([WELCOME_MSG]);
    setInput("");
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {(!open || minimized) && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => { setOpen(true); setMinimized(false); setUnread(0); }}
            className="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-primary hover:bg-primary-600 text-white rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center transition-all hover:scale-110 group"
            title="Chat with Noe AI"
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
            className="fixed bottom-6 right-6 z-[9999] w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
            style={{ height: "520px" }}
          >
            {/* Header */}
            <div className="bg-primary px-5 py-4 flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                <Bot size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-black text-sm">Noe — AI Support</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-white/70 text-[11px] font-medium">Online · Noehost Assistant</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={reset} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white" title="Clear chat">
                  <RotateCcw size={15} />
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
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    msg.role === "assistant" ? "bg-primary text-white" : "bg-slate-200 text-slate-600"
                  }`}>
                    {msg.role === "assistant" ? <Bot size={14} /> : <User size={14} />}
                  </div>
                  <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-white rounded-tr-sm"
                      : "bg-white text-slate-700 border border-slate-100 rounded-tl-sm shadow-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot size={14} className="text-white" />
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <Loader2 size={16} className="text-primary animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Questions */}
            {messages.length === 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5 bg-white border-t border-slate-100">
                {QUICK_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="text-[11px] font-bold text-primary bg-primary/5 hover:bg-primary hover:text-white border border-primary/20 px-3 py-1.5 rounded-full transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 bg-white border-t border-slate-100 flex-shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask me anything..."
                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 text-slate-800 placeholder:text-slate-400"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-10 h-10 bg-primary hover:bg-primary-600 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-lg shadow-primary/20"
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
