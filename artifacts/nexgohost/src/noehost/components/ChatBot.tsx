import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageCircle, X, Send, Loader2, Bot, User, Phone,
  RotateCcw, ChevronRight, Paperclip, Plus, Shield,
  Server, CreditCard, Globe, HelpCircle, Download,
} from 'lucide-react';
import Markdown from 'react-markdown';

interface Message {
  id?: number;
  role: 'user' | 'assistant' | 'admin';
  content: string;
  metadata?: Record<string, any>;
}

const QUICK_OPTIONS = [
  { icon: Server, label: '🚀 Hosting Plans & Prices', msg: 'What hosting plans do you offer and what are the prices?' },
  { icon: Globe, label: '🌐 Domain Registration', msg: 'How do I register a domain and what are the prices?' },
  { icon: Shield, label: '🔒 SSL Certificate', msg: 'How do I activate my free SSL certificate?' },
  { icon: HelpCircle, label: '📧 Email Setup', msg: 'How do I create email accounts and set up email?' },
  { icon: CreditCard, label: '💰 Billing & Payment', msg: 'What payment methods do you accept and how do I pay?' },
  { icon: Phone, label: '🔧 Technical Support', msg: 'I need help with a technical issue on my hosting.' },
];

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  issue: string;
}

function genSessionId() {
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const STORAGE_KEY = 'noe_website_session_id';
const CONTACT_KEY = 'noe_contact_info';

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen]           = useState(false);
  const [message, setMessage]         = useState('');
  const [messages, setMessages]       = useState<Message[]>([]);
  const [loading, setLoading]         = useState(false);
  const [sessionId, setSessionId]     = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'ai' | 'handover' | 'human' | 'closed'>('ai');
  const [handoverSent, setHandoverSent]   = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState<ContactForm>({ name: '', email: '', phone: '', issue: '' });
  const [contactSaved, setContactSaved] = useState(false);
  const [attachLoading, setAttachLoading] = useState(false);
  const [unread, setUnread]           = useState(0);
  const [polling, setPolling]         = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const pollTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('openChatbot', handler);
    return () => window.removeEventListener('openChatbot', handler);
  }, []);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 200);
  }, [isOpen]);

  // Init session when opened
  useEffect(() => {
    if (isOpen && !sessionId) {
      initSession();
    }
  }, [isOpen]);

  // Poll when human agent is handling
  useEffect(() => {
    if (sessionStatus === 'human' || sessionStatus === 'handover') {
      if (!polling) {
        setPolling(true);
        pollTimerRef.current = setInterval(() => pollMessages(), 5000);
      }
    } else {
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; setPolling(false); }
    }
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [sessionStatus]);

  const initSession = async () => {
    try {
      let sid = localStorage.getItem(STORAGE_KEY);
      if (!sid) {
        sid = genSessionId();
        localStorage.setItem(STORAGE_KEY, sid);
      }

      // Restore saved contact info
      const saved = localStorage.getItem(CONTACT_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setContactForm(parsed);
          setContactSaved(true);
        } catch { /* skip */ }
      }

      const body: any = { sessionId: sid, source: 'website' };
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          body.clientName = parsed.name;
          body.clientEmail = parsed.email;
          body.clientPhone = parsed.phone;
        } catch { /* skip */ }
      }

      const res = await fetch('/api/ai/support/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      setSessionId(sid);
      setSessionStatus(data.status ?? 'ai');

      if (data.existing) {
        await loadHistory(sid);
      } else {
        setMessages([{
          role: 'assistant',
          content: "Hello! I'm **Noe** 👋 — Noehost AI Support Agent.\n\nI can help you with hosting plans, domain registration, billing, SSL, and technical issues. How can I assist you today?",
        }]);
      }
    } catch {
      const sid = genSessionId();
      setSessionId(sid);
      setMessages([{
        role: 'assistant',
        content: "Hello! I'm **Noe** 👋 — your Noehost assistant. How can I help you today?",
      }]);
    }
  };

  const loadHistory = async (sid: string) => {
    try {
      const res = await fetch(`/api/ai/support/session/${sid}/messages`);
      const data = await res.json();
      if (data.messages?.length) {
        setMessages(data.messages.map((m: any) => ({
          id: m.id, role: m.role, content: m.content, metadata: m.metadata_json,
        })));
        setSessionStatus(data.status ?? 'ai');
      } else {
        setMessages([{
          role: 'assistant',
          content: "Hello! I'm **Noe** 👋 — your Noehost assistant. Welcome back! How can I help you today?",
        }]);
      }
    } catch { /* silent */ }
  };

  const pollMessages = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/ai/support/session/${sessionId}/messages`);
      const data = await res.json();
      if (data.messages?.length) {
        setMessages(prev => {
          const maxId = Math.max(...prev.filter(m => m.id).map(m => m.id!), 0);
          const loaded = data.messages.map((m: any) => ({
            id: m.id, role: m.role, content: m.content, metadata: m.metadata_json,
          }));
          const newMsgs = loaded.filter((m: any) => m.id && m.id > maxId);
          if (newMsgs.length) {
            if (!isOpen) setUnread(n => n + newMsgs.length);
            return loaded;
          }
          return prev;
        });
        setSessionStatus(data.status ?? 'ai');
      }
    } catch { /* silent */ }
  }, [sessionId, isOpen]);

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? message).trim();
    if (!text || loading || !sessionId) return;
    setMessage('');

    // If no contact info yet, ask for it first
    if (!contactSaved && !showContactForm) {
      setMessages(prev => [...prev, { role: 'user', content: text }]);
      setShowContactForm(true);
      setContactForm(prev => ({ ...prev, issue: text }));
      return;
    }

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/support/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const data = await res.json();

      const reply = data.reply ?? "I'm sorry, please try again.";
      setMessages(prev => [...prev, { role: data.status === 'human' ? 'admin' : 'assistant', content: reply }]);
      if (!isOpen) setUnread(n => n + 1);

      if (data.status) setSessionStatus(data.status);
      if (data.autoHandover) setHandoverSent(true);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, connection issue. Please contact support@noehost.com or try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const submitContactForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;

    localStorage.setItem(CONTACT_KEY, JSON.stringify(contactForm));
    setContactSaved(true);
    setShowContactForm(false);

    // Update session with contact info
    try {
      await fetch('/api/ai/support/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          clientName: contactForm.name,
          clientEmail: contactForm.email,
          clientPhone: contactForm.phone,
          source: 'website',
        }),
      });
    } catch { /* non-fatal */ }

    // Now actually send the message
    if (contactForm.issue) {
      const text = contactForm.issue;
      setLoading(true);
      try {
        const res = await fetch('/api/ai/support/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: text }),
        });
        const data = await res.json();
        const reply = data.reply ?? "I'm sorry, please try again.";
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        if (data.status) setSessionStatus(data.status);
      } catch {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, please try again.' }]);
      } finally {
        setLoading(false);
      }
    }
  };

  const requestHandover = async () => {
    if (!sessionId || handoverSent) return;
    setHandoverSent(true);

    try {
      await fetch(`/api/ai/support/handover/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '🙋 **Human agent requested.** Our support team has been notified and will join shortly. Average response: 2–5 minutes during business hours.',
      }]);
      setSessionStatus('handover');
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '✅ Request sent! Our team will be with you shortly. You can also reach us at support@noehost.com.',
      }]);
    }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;
    setAttachLoading(true);

    try {
      const fileUrl = URL.createObjectURL(file);

      await fetch(`/api/ai/support/attachment/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileUrl,
          mimeType: file.type,
          fileSize: file.size,
          uploadedBy: contactForm.name || 'guest',
        }),
      });

      setMessages(prev => [...prev, {
        role: 'user',
        content: `📎 Attached: **${file.name}** (${(file.size / 1024).toFixed(1)} KB)`,
        metadata: { attachment: true, fileUrl },
      }]);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I've received your file **${file.name}**. A human agent can review it. Is there anything specific you'd like me to note about this attachment?`,
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'File could not be attached. Please try again.' }]);
    } finally {
      setAttachLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startNew = () => {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([]);
    setSessionId(null);
    setSessionStatus('ai');
    setHandoverSent(false);
    setShowContactForm(false);
    setTimeout(() => initSession(), 100);
  };

  const isHumanMode = sessionStatus === 'human' || sessionStatus === 'handover';

  return (
    <div className="fixed bottom-8 right-8 z-[200]">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileAttach}
        accept="image/*,.pdf,.doc,.docx,.txt,.log" />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            className="absolute bottom-20 right-0 w-[400px] max-w-[calc(100vw-2rem)] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
            style={{ height: 600 }}
          >
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-primary to-indigo-600 text-white flex items-center gap-3 flex-shrink-0">
              <div className="relative">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Bot size={22} />
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                  isHumanMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-sm">
                  {isHumanMode ? 'Noehost Support' : 'Noe — AI Support'}
                </h3>
                <p className="text-[11px] text-white/70">
                  {sessionStatus === 'human' ? '✅ Human Agent Active'
                    : sessionStatus === 'handover' ? '⏳ Connecting to agent…'
                    : '🤖 AI • Powered by Knowledge Base'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={startNew} title="New conversation" className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white">
                  <Plus size={14} />
                </button>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {/* Quick options */}
              {messages.length <= 1 && !showContactForm && (
                <div className="space-y-2 pb-1">
                  {QUICK_OPTIONS.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(opt.msg)}
                      className="w-full flex items-center gap-3 text-left text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all group"
                    >
                      <span className="flex-1">{opt.label}</span>
                      <ChevronRight size={13} className="text-slate-300 group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: msg.role === 'user' ? 16 : -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-2 max-w-[87%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      msg.role === 'user'
                        ? 'bg-primary text-white'
                        : msg.role === 'admin'
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}>
                      {msg.role === 'user' ? <User size={13} />
                        : msg.role === 'admin' ? <Shield size={13} />
                        : <Bot size={13} />}
                    </div>
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-tr-sm'
                        : msg.role === 'admin'
                        ? 'bg-emerald-50 border border-emerald-200 text-slate-800 rounded-tl-sm shadow-sm'
                        : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm'
                    }`}>
                      {msg.role === 'admin' && (
                        <div className="text-[10px] font-bold text-emerald-600 mb-1 uppercase tracking-wide">Support Agent</div>
                      )}
                      <div className="prose prose-sm max-w-none prose-p:my-0.5 prose-ul:my-1 prose-strong:text-inherit">
                        {msg.role === 'user' ? msg.content : <Markdown>{msg.content}</Markdown>}
                      </div>
                      {msg.metadata?.attachment && msg.metadata?.fileUrl && (
                        <a href={msg.metadata.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="mt-1.5 flex items-center gap-1.5 text-[11px] opacity-60 hover:opacity-100 transition-opacity">
                          <Download size={11} /><span>View file</span>
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                      <Bot size={13} className="text-slate-600" />
                    </div>
                    <div className="px-4 py-3 bg-white border border-slate-100 rounded-2xl rounded-tl-sm shadow-sm flex gap-1.5 items-center">
                      <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Contact form overlay */}
              {showContactForm && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-primary/20 rounded-2xl p-4 shadow-sm">
                  <h4 className="font-black text-sm text-slate-900 mb-1">Quick intro 👋</h4>
                  <p className="text-xs text-slate-500 mb-3">So I can personalize your support experience:</p>
                  <form onSubmit={submitContactForm} className="space-y-2">
                    <input required placeholder="Your name" value={contactForm.name}
                      onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400" />
                    <input required type="email" placeholder="Email address" value={contactForm.email}
                      onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400" />
                    <input placeholder="Phone / WhatsApp (optional)" value={contactForm.phone}
                      onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400" />
                    <button type="submit" className="w-full text-xs font-bold text-white bg-primary rounded-xl py-2.5 hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5">
                      <Send size={12} /> Start Chatting
                    </button>
                  </form>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Human Handover CTA */}
            {!handoverSent && messages.length > 1 && sessionStatus === 'ai' && (
              <div className="px-4 pt-2 bg-white border-t border-slate-100 flex-shrink-0">
                <button onClick={requestHandover}
                  className="w-full text-xs font-bold text-slate-600 border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 rounded-xl py-2 transition-all flex items-center justify-center gap-2">
                  <Phone size={12} /> Talk to Human Agent via WhatsApp
                </button>
              </div>
            )}

            {isHumanMode && (
              <div className="px-4 pt-2 bg-white border-t border-slate-100 flex-shrink-0">
                <div className="w-full text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-xl py-2 flex items-center justify-center gap-2">
                  <Shield size={12} />
                  {sessionStatus === 'handover' ? 'Agent joining soon…' : 'Human Agent is active'}
                </div>
              </div>
            )}

            {/* Input */}
            <form onSubmit={e => { e.preventDefault(); sendMessage(); }}
              className="px-4 py-3 bg-white border-t border-slate-100 flex gap-2 flex-shrink-0">
              <button type="button" onClick={() => fileInputRef.current?.click()}
                disabled={attachLoading || !sessionId}
                className="w-9 h-9 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl flex items-center justify-center transition-all flex-shrink-0 disabled:opacity-40"
                title="Attach file">
                {attachLoading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
              </button>
              <input ref={inputRef} type="text" value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Ask me anything…"
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm text-slate-800 placeholder:text-slate-400" />
              <button type="submit" disabled={loading || !message.trim() || !sessionId}
                className="w-10 h-10 bg-primary hover:bg-primary/90 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex-shrink-0">
                <Send size={15} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { setIsOpen(o => !o); setUnread(0); }}
        className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-colors relative ${isOpen ? 'bg-slate-800' : 'bg-primary'}`}
        title="Chat with Noe AI"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={26} />}
        {unread > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </motion.button>
    </div>
  );
};

export default ChatBot;
