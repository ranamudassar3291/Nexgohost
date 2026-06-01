import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageCircle, X, Send, Loader2, Bot, User, Phone,
  ChevronRight, Paperclip, Plus, Shield, Download,
  Search, Globe, Sparkles,
} from 'lucide-react';
import Markdown from 'react-markdown';

interface Message {
  id?: number;
  role: 'user' | 'assistant' | 'admin';
  content: string;
  metadata?: Record<string, any>;
}

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

const FALLBACK_SUGGESTIONS = [
  '🚀 Hosting Plans & Prices',
  '🌐 Domain Registration',
  '🔒 SSL Certificate',
  '📧 Email Setup',
  '💰 Billing & Payment',
  '🔧 Technical Support',
];

const SUGGESTION_MSGS: Record<string, string> = {
  '🚀 Hosting Plans & Prices': 'What hosting plans do you offer and what are the prices?',
  '🌐 Domain Registration': 'How do I register a domain and what are the prices?',
  '🔒 SSL Certificate': 'How do I activate my free SSL certificate?',
  '📧 Email Setup': 'How do I create email accounts and set up email?',
  '💰 Billing & Payment': 'What payment methods do you accept and how do I pay?',
  '🔧 Technical Support': 'I need help with a technical issue on my hosting.',
};

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
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_SUGGESTIONS);
  const [lastWebSearch, setLastWebSearch] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const pollTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('openChatbot', handler);
    return () => window.removeEventListener('openChatbot', handler);
  }, []);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 200);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !sessionId) initSession();
  }, [isOpen]);

  // Load dynamic suggestions from crawled site
  useEffect(() => {
    if (isOpen) {
      fetch('/api/ai/support/suggestions')
        .then(r => r.json())
        .then(d => { if (d.suggestions?.length) setSuggestions(d.suggestions); })
        .catch(() => {});
    }
  }, [isOpen]);

  // Poll — fast (5s) when human/handover, slow (30s) when ai to catch admin close
  useEffect(() => {
    if (!sessionId) return;
    const interval = (sessionStatus === 'human' || sessionStatus === 'handover') ? 5000 : 30000;
    pollTimerRef.current = setInterval(() => pollMessages(), interval);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [sessionStatus, sessionId]);

  const initSession = async () => {
    try {
      let sid = localStorage.getItem(STORAGE_KEY);
      if (!sid) { sid = genSessionId(); localStorage.setItem(STORAGE_KEY, sid); }

      const saved = localStorage.getItem(CONTACT_KEY);
      if (saved) {
        try { const p = JSON.parse(saved); setContactForm(p); setContactSaved(true); } catch { /* skip */ }
      }

      const body: any = { sessionId: sid, source: 'website' };
      if (saved) {
        try { const p = JSON.parse(saved); body.clientName = p.name; body.clientEmail = p.email; body.clientPhone = p.phone; } catch { /* skip */ }
      }

      const res = await fetch('/api/ai/support/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setSessionId(sid);
      setSessionStatus(data.status ?? 'ai');

      if (data.existing) {
        await loadHistory(sid);
      } else {
        setMessages([{ role: 'assistant', content: "Hello! I'm **Noe** 👋 — Noehost Autonomous AI Support.\n\nI crawl our website and search the web in real-time to give you accurate, up-to-date answers. How can I help you today?" }]);
      }
    } catch {
      const sid = genSessionId();
      setSessionId(sid);
      setMessages([{ role: 'assistant', content: "Hello! I'm **Noe** 👋 — your Noehost AI assistant. How can I help you today?" }]);
    }
  };

  const loadHistory = async (sid: string) => {
    try {
      const res = await fetch(`/api/ai/support/session/${sid}/messages`);
      const data = await res.json();
      if (data.messages?.length) {
        setMessages(data.messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content, metadata: m.metadata_json })));
        setSessionStatus(data.status ?? 'ai');
      } else {
        setMessages([{ role: 'assistant', content: "Welcome back! I'm **Noe** — your autonomous Noehost AI. How can I help you today?" }]);
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
          const loaded = data.messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content, metadata: m.metadata_json }));
          const newMsgs = loaded.filter((m: any) => m.id && m.id > maxId);
          if (newMsgs.length) { if (!isOpen) setUnread(n => n + newMsgs.length); return loaded; }
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
    setLastWebSearch(null);

    if (!contactSaved && !showContactForm) {
      setMessages(prev => [...prev, { role: 'user', content: text }]);
      setShowContactForm(true);
      setContactForm(prev => ({ ...prev, issue: text }));
      return;
    }

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/support/message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const data = await res.json();
      const reply = data.reply ?? "I'm sorry, please try again.";
      setMessages(prev => [...prev, {
        role: data.status === 'human' ? 'admin' : 'assistant',
        content: reply,
        metadata: { webSearched: data.webSearched, searchedFor: data.searchedFor },
      }]);
      if (data.webSearched && data.searchedFor) setLastWebSearch(data.searchedFor);
      if (!isOpen) setUnread(n => n + 1);
      if (data.status) setSessionStatus(data.status);
      if (data.autoHandover) setHandoverSent(true);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, connection issue. Please contact support@noehost.com.' }]);
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

    try {
      await fetch('/api/ai/support/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, clientName: contactForm.name, clientEmail: contactForm.email, clientPhone: contactForm.phone, source: 'website' }),
      });
    } catch { /* non-fatal */ }

    if (contactForm.issue) {
      const text = contactForm.issue;
      setLoading(true);
      try {
        const res = await fetch('/api/ai/support/message', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: text }),
        });
        const data = await res.json();
        setMessages(prev => [...prev, {
          role: 'assistant', content: data.reply ?? "I'm sorry, please try again.",
          metadata: { webSearched: data.webSearched, searchedFor: data.searchedFor },
        }]);
        if (data.webSearched && data.searchedFor) setLastWebSearch(data.searchedFor);
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
      await fetch(`/api/ai/support/handover/${sessionId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      setMessages(prev => [...prev, { role: 'assistant', content: '🙋 **Human agent requested.** Our support team has been notified and will join shortly.' }]);
      setSessionStatus('handover');
    } catch { /* silent */ }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;
    setAttachLoading(true);
    try {
      const fileUrl = URL.createObjectURL(file);
      await fetch(`/api/ai/support/attachment/${sessionId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileUrl, mimeType: file.type, fileSize: file.size, uploadedBy: contactForm.name || 'guest' }),
      });
      setMessages(prev => [...prev, {
        role: 'user', content: `📎 Attached: **${file.name}** (${(file.size / 1024).toFixed(1)} KB)`, metadata: { attachment: true, fileUrl },
      }]);
      setMessages(prev => [...prev, { role: 'assistant', content: `I've received your file **${file.name}**. A human agent can review it. Is there anything specific about this attachment you'd like to highlight?` }]);
    } catch { /* silent */ } finally {
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
    setLastWebSearch(null);
    setTimeout(() => initSession(), 100);
  };

  const getSuggestionMsg = (label: string) => SUGGESTION_MSGS[label] ?? label;
  const isHumanMode = sessionStatus === 'human' || sessionStatus === 'handover';
  const showQuick = messages.length <= 1 && !showContactForm;

  return (
    <div className="fixed bottom-8 right-8 z-[200]">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileAttach} accept="image/*,.pdf,.doc,.docx,.txt,.log" />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            className="absolute bottom-20 right-0 w-[410px] max-w-[calc(100vw-2rem)] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
            style={{ height: 620 }}
          >
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-primary to-indigo-600 text-white flex items-center gap-3 flex-shrink-0">
              <div className="relative">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><Bot size={22} /></div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isHumanMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-sm flex items-center gap-1.5">
                  {isHumanMode ? 'Noehost Support' : 'Noe — Autonomous AI'}
                  {!isHumanMode && <Sparkles size={12} className="text-yellow-300" />}
                </h3>
                <p className="text-[11px] text-white/70 flex items-center gap-1">
                  {!isHumanMode && <Globe size={9} className="text-white/50" />}
                  {sessionStatus === 'human' ? '✅ Human Agent Active'
                    : sessionStatus === 'handover' ? '⏳ Connecting to agent…'
                    : 'Live web crawl + Google search enabled'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={startNew} title="New conversation" className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white"><Plus size={14} /></button>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white"><X size={16} /></button>
              </div>
            </div>

            {/* Web search indicator */}
            {lastWebSearch && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 flex items-center gap-2 text-[11px] text-indigo-600 font-semibold flex-shrink-0">
                <Search size={11} />
                <span>Searched the web for: <em className="font-bold">"{lastWebSearch.slice(0, 50)}"</em></span>
              </motion.div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {showQuick && (
                <div className="space-y-2 pb-1">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => sendMessage(getSuggestionMsg(s))}
                      className="w-full flex items-center gap-3 text-left text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all group">
                      <span className="flex-1">{s}</span>
                      <ChevronRight size={13} className="text-slate-300 group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: msg.role === 'user' ? 16 : -16 }} animate={{ opacity: 1, x: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-2 max-w-[87%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      msg.role === 'user' ? 'bg-primary text-white'
                      : msg.role === 'admin' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-white border border-slate-200 text-slate-600'
                    }`}>
                      {msg.role === 'user' ? <User size={13} /> : msg.role === 'admin' ? <Shield size={13} /> : <Bot size={13} />}
                    </div>
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user' ? 'bg-primary text-white rounded-tr-sm'
                      : msg.role === 'admin' ? 'bg-emerald-50 border border-emerald-200 text-slate-800 rounded-tl-sm shadow-sm'
                      : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm'
                    }`}>
                      {msg.role === 'admin' && (
                        <div className="text-[10px] font-bold text-emerald-600 mb-1 uppercase tracking-wide">Support Agent</div>
                      )}
                      <div className="prose prose-sm max-w-none prose-p:my-0.5 prose-ul:my-1 prose-strong:text-inherit">
                        {msg.role === 'user' ? msg.content : <Markdown>{msg.content}</Markdown>}
                      </div>
                      {msg.role === 'assistant' && msg.metadata?.webSearched && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-indigo-500 font-semibold">
                          <Search size={9} /> Searched web · "{String(msg.metadata?.searchedFor ?? '').slice(0, 40)}"
                        </div>
                      )}
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
                    <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center"><Bot size={13} className="text-slate-600" /></div>
                    <div className="px-4 py-3 bg-white border border-slate-100 rounded-2xl rounded-tl-sm shadow-sm flex flex-col gap-1">
                      <div className="flex gap-1.5 items-center">
                        <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Globe size={9} className="animate-spin" style={{ animationDuration: '2s' }} />
                        Crawling noehost.com + searching web…
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Contact form */}
              {showContactForm && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-primary/20 rounded-2xl p-4 shadow-sm">
                  <h4 className="font-black text-sm text-slate-900 mb-1">Quick intro 👋</h4>
                  <p className="text-xs text-slate-500 mb-3">So I can personalize your support experience:</p>
                  <form onSubmit={submitContactForm} className="space-y-2">
                    <input required placeholder="Your name" value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400" />
                    <input required type="email" placeholder="Email address" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400" />
                    <input placeholder="Phone / WhatsApp (optional)" value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400" />
                    <button type="submit" className="w-full text-xs font-bold text-white bg-primary rounded-xl py-2.5 hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5">
                      <Send size={12} /> Start Chatting
                    </button>
                  </form>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Handover CTA */}
            {!handoverSent && messages.length > 4 && sessionStatus === 'ai' && (
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
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={attachLoading || !sessionId}
                className="w-9 h-9 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl flex items-center justify-center transition-all flex-shrink-0 disabled:opacity-40" title="Attach file">
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
      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
        onClick={() => { setIsOpen(o => !o); setUnread(0); }}
        className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-colors relative ${isOpen ? 'bg-slate-800' : 'bg-primary'}`}>
        {isOpen ? <X size={24} /> : <MessageCircle size={26} />}
        {unread > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">{unread}</span>
        )}
      </motion.button>
    </div>
  );
};

export default ChatBot;
