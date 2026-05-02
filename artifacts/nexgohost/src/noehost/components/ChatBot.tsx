import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Loader2, Bot, User, Phone, RotateCcw, ChevronRight } from 'lucide-react';
import Markdown from 'react-markdown';

const QUICK_OPTIONS = [
  { label: '💻 Hosting Plans & Prices', msg: 'What hosting plans do you offer and what are the prices?' },
  { label: '🌐 Domain Registration', msg: 'How do I register a domain and what are the prices?' },
  { label: '🔒 SSL Certificate', msg: 'How do I activate my free SSL certificate?' },
  { label: '📧 Email Setup', msg: 'How do I create email accounts and set up email?' },
  { label: '🔧 WordPress Install', msg: 'How do I install WordPress on my hosting?' },
  { label: '💰 Billing & Payment', msg: 'What payment methods do you accept and how do I pay?' },
];

interface LiveFormData { name: string; email: string; issue: string; }

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLiveForm, setShowLiveForm] = useState(false);
  const [liveForm, setLiveForm] = useState<LiveFormData>({ name: '', email: '', issue: '' });
  const [liveSent, setLiveSent] = useState(false);
  const [liveSending, setLiveSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => { scrollToBottom(); }, [history]);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('openChatbot', handler);
    return () => window.removeEventListener('openChatbot', handler);
  }, []);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 200);
  }, [isOpen]);

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? message).trim();
    if (!text || loading) return;
    setMessage('');

    const userMsg = { role: 'user' as const, content: text };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: history.map(h => ({ role: h.role, content: h.content })) }),
      });
      const data = await res.json();
      setHistory(prev => [...prev, { role: 'assistant', content: data.reply || 'I apologize, please try again.' }]);
    } catch {
      setHistory(prev => [...prev, { role: 'assistant', content: 'Sorry, connection issue. Please contact support@noehost.com.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleLiveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLiveSending(true);
    try {
      const res = await fetch('/api/chat/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(liveForm),
      });
      const data = await res.json();
      setLiveSent(true);
      setHistory(prev => [...prev, { role: 'assistant', content: `✅ ${data.message || 'Our team has been notified! We will contact you shortly on WhatsApp or email.'}` }]);
      setShowLiveForm(false);
    } catch {
      setLiveSent(true);
      setHistory(prev => [...prev, { role: 'assistant', content: '✅ Request sent! Our team will contact you shortly. You can also reach us at support@noehost.com.' }]);
      setShowLiveForm(false);
    } finally {
      setLiveSending(false);
    }
  };

  const reset = () => { setHistory([]); setShowLiveForm(false); setLiveSent(false); };

  return (
    <div className="fixed bottom-8 right-8 z-[200]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 right-0 w-[390px] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
            style={{ height: 580 }}
          >
            {/* Header */}
            <div className="px-5 py-4 bg-primary text-white flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Bot size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-sm">Noe — AI Support</h3>
                <p className="text-[11px] text-white/70 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse inline-block" />
                  Online · Noehost Assistant
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={reset} title="Clear chat" className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white">
                  <RotateCcw size={14} />
                </button>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {history.length === 0 && !showLiveForm && (
                <div className="py-4">
                  <div className="text-center mb-4">
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Bot size={28} className="text-primary" />
                    </div>
                    <p className="font-black text-slate-900 text-sm">Hello! I'm Noe 👋</p>
                    <p className="text-xs text-slate-500 mt-1">How can I help you with Noehost today?</p>
                  </div>
                  <div className="space-y-2">
                    {QUICK_OPTIONS.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(opt.msg)}
                        className="w-full text-left text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-2.5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-between group"
                      >
                        <span>{opt.label}</span>
                        <ChevronRight size={14} className="text-slate-400 group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {history.map((msg, i) => (
                <motion.div
                  initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-2 max-w-[86%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                      {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-tr-sm'
                        : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm'
                    }`}>
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                      <Bot size={14} className="text-slate-600" />
                    </div>
                    <div className="px-4 py-3 bg-white border border-slate-100 rounded-2xl rounded-tl-sm shadow-sm">
                      <Loader2 size={16} className="animate-spin text-primary" />
                    </div>
                  </div>
                </div>
              )}

              {/* Live support form */}
              {showLiveForm && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-primary/20 rounded-2xl p-4 shadow-sm">
                  <h4 className="font-black text-sm text-slate-900 mb-3 flex items-center gap-2">
                    <Phone size={14} className="text-primary" /> Request Live Support
                  </h4>
                  <form onSubmit={handleLiveRequest} className="space-y-2">
                    <input
                      required
                      placeholder="Your Name"
                      value={liveForm.name}
                      onChange={e => setLiveForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
                    />
                    <input
                      required
                      type="email"
                      placeholder="Email Address"
                      value={liveForm.email}
                      onChange={e => setLiveForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
                    />
                    <textarea
                      placeholder="Describe your issue..."
                      value={liveForm.issue}
                      onChange={e => setLiveForm(p => ({ ...p, issue: e.target.value }))}
                      rows={2}
                      className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 resize-none"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowLiveForm(false)} className="flex-1 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl py-2.5 hover:bg-slate-200 transition-colors">
                        Cancel
                      </button>
                      <button type="submit" disabled={liveSending} className="flex-1 text-xs font-bold text-white bg-primary rounded-xl py-2.5 hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5">
                        {liveSending ? <Loader2 size={12} className="animate-spin" /> : <Phone size={12} />}
                        {liveSending ? 'Sending...' : 'Send Request'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Live support button — show after first message */}
            {history.length > 0 && !showLiveForm && !liveSent && (
              <div className="px-4 pb-2 bg-white border-t border-slate-100 pt-2 flex-shrink-0">
                <button
                  onClick={() => setShowLiveForm(true)}
                  className="w-full text-xs font-bold text-primary border border-primary/20 bg-primary/5 hover:bg-primary hover:text-white rounded-xl py-2 transition-all flex items-center justify-center gap-2"
                >
                  <Phone size={12} />
                  Request Live Support via WhatsApp
                </button>
              </div>
            )}

            {/* Input */}
            <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="px-4 py-3 bg-white border-t border-slate-100 flex gap-2 flex-shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm text-slate-800 placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={loading || !message.trim()}
                className="w-10 h-10 bg-primary hover:bg-primary/90 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(o => !o)}
        className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-colors ${isOpen ? 'bg-slate-800' : 'bg-primary'}`}
        title="Chat with Noe AI"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={26} />}
      </motion.button>
    </div>
  );
};

export default ChatBot;
