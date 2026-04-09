import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, MessageCircle, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { useContent } from '@/context/ContentContext';

const CONTACT_DEFAULT: any = {
  hero: {
    badge: 'We Are Here', title: 'Get in Touch', titleHighlight: 'With Our Team.',
    description: 'Our support team is available 24/7 via live chat, email, and phone. We typically respond within minutes.',
    primaryBtn: { text: 'Live Chat', url: '#', show: true },
    secondaryBtn: { text: 'Open Ticket', url: '/client/support', show: true },
    badges: ['< 5 Min Response', '24/7 Available', 'Expert Engineers', 'Multi-Channel Support'],
  },
  channels: [
    { type: 'Live Chat', desc: '24/7 instant support via live chat — get answers in under 5 minutes.', action: 'Start Chat', url: '#' },
    { type: 'Email Support', desc: 'Send us an email and receive a detailed response within 1 hour.', action: 'Email Us', url: 'mailto:support@noehost.com' },
    { type: 'Phone Support', desc: 'Call our support line 24/7 for urgent account or technical issues.', action: 'Call Now', url: 'tel:+923001234567' },
  ],
  offices: [
    { city: 'Karachi', address: '123 Tech Hub, I.T Tower, Karachi, Pakistan', phone: '+92 300 123 4567', email: 'pk@noehost.com' },
    { city: 'London', address: '456 Digital Square, Shoreditch, London, UK', phone: '+44 20 1234 5678', email: 'uk@noehost.com' },
  ],
  faqs: [
    { q: 'How fast is your support response time?', a: 'Live chat: under 5 minutes. Email tickets: under 1 hour. Phone: immediate. We monitor all channels 24/7.' },
    { q: 'Do you offer phone support?', a: 'Yes, phone support is available 24/7 for all customers on our hosted and VPS plans.' },
    { q: 'How do I open a support ticket?', a: 'Log in to your client dashboard and navigate to the Support section to open a ticket.' },
  ],
  faqTitle: 'Frequently Asked Questions',
};

const ContactUs: React.FC = () => {
  const { content } = useContent();
  const pgCms = content?.["pages.contact"] || {};
  const pg = { ...CONTACT_DEFAULT, ...pgCms };

  const hero = pg.hero || {};
  const channels = pg.channels || [];
  const offices = pg.offices || [];
  const faqs = pg.faqs || [];
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [formState, setFormState] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const chanIcons: any = { 'Live Chat': <MessageCircle size={22} />, 'Email Support': <Mail size={22} />, 'Phone Support': <Phone size={22} /> };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-dark">

      {/* HERO */}
      <section className="relative bg-secondary overflow-hidden pt-36 pb-24">
        <div className="tech-grid absolute inset-0 opacity-5" />
        <div className="absolute top-0 left-0 w-[700px] h-[700px] rounded-full blur-[150px]" style={{ background: 'radial-gradient(circle, rgba(103,61,230,0.25) 0%, transparent 70%)' }} />
        <div className="container mx-auto px-6 relative z-10 text-center max-w-3xl mx-auto">
          {hero.badge && (
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-6 uppercase tracking-widest">{hero.badge}</div>
          )}
          <h1 className="text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
            {hero.title || 'Get in'} <span className="text-primary-300">{hero.titleHighlight || 'Touch.'}</span>
          </h1>
          <p className="text-lg text-slate-400 font-medium leading-relaxed">{hero.description || 'Our team is ready to help you.'}</p>
        </div>
      </section>

      {/* CHANNELS */}
      {channels.filter((c: any) => c.show !== false).length > 0 && (
        <section className="py-20 bg-dark">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {channels.filter((c: any) => c.show !== false).map((ch: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="p-6 bg-white/5 rounded-2xl border border-white/10 hover:border-primary/30 transition-all text-center group hover:bg-white/10">
                  <div className="w-12 h-12 bg-primary/10 text-primary-400 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary group-hover:text-white transition-all">
                    {chanIcons[ch.title] || <MessageCircle size={22} />}
                  </div>
                  <h3 className="text-base font-black text-white mb-2">{ch.title}</h3>
                  <p className="text-sm text-slate-400 font-medium leading-relaxed mb-3">{ch.desc}</p>
                  <p className="text-xs text-primary-300 font-black mb-4">{ch.detail}</p>
                  <button
                    className="px-5 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary-300 rounded-xl font-black text-xs transition-all border border-primary/20 hover:border-primary/40"
                    onClick={() => {
                      const isLiveChat = (ch.type || ch.title || '').toLowerCase().includes('chat') || (ch.cta || ch.action || '').toLowerCase().includes('chat');
                      if (isLiveChat) {
                        window.dispatchEvent(new CustomEvent('openChatbot'));
                      } else if (ch.url && ch.url !== '#') {
                        window.open(ch.url, '_blank');
                      }
                    }}
                  >
                    {ch.cta || ch.action}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CONTACT FORM + OFFICES */}
      <section className="py-20 bg-secondary relative overflow-hidden">
        <div className="tech-grid absolute inset-0 opacity-5" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row gap-10">

            {/* FORM */}
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:w-3/5">
              <h2 className="text-3xl font-black text-white mb-6">Send Us a Message</h2>
              {submitted ? (
                <div className="p-8 bg-emerald-400/10 border border-emerald-400/20 rounded-2xl text-center">
                  <div className="w-14 h-14 bg-emerald-400/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Mail size={24} className="text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-black text-white mb-2">Message Sent!</h3>
                  <p className="text-slate-400 font-medium">We'll get back to you shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                      <input value={formState.name} onChange={e => setFormState(p => ({ ...p, name: e.target.value }))} required placeholder="John Smith" className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-primary/50 rounded-xl text-white text-sm font-medium outline-none transition-colors placeholder:text-slate-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                      <input type="email" value={formState.email} onChange={e => setFormState(p => ({ ...p, email: e.target.value }))} required placeholder="john@example.com" className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-primary/50 rounded-xl text-white text-sm font-medium outline-none transition-colors placeholder:text-slate-600" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Subject</label>
                    <input value={formState.subject} onChange={e => setFormState(p => ({ ...p, subject: e.target.value }))} required placeholder="How can we help?" className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-primary/50 rounded-xl text-white text-sm font-medium outline-none transition-colors placeholder:text-slate-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Message</label>
                    <textarea value={formState.message} onChange={e => setFormState(p => ({ ...p, message: e.target.value }))} required rows={5} placeholder="Tell us more about your issue or question..." className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-primary/50 rounded-xl text-white text-sm font-medium outline-none transition-colors placeholder:text-slate-600 resize-none" />
                  </div>
                  <button type="submit" className="flex items-center gap-2 px-8 py-3.5 bg-primary hover:bg-primary-600 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-primary/30 group">
                    Send Message <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </form>
              )}
            </motion.div>

            {/* OFFICES */}
            {offices.length > 0 && (
              <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:w-2/5">
                <h2 className="text-3xl font-black text-white mb-6">Our Offices</h2>
                <div className="space-y-4">
                  {offices.map((o: any, i: number) => (
                    <div key={i} className={`p-5 rounded-2xl border transition-all ${o.primary ? 'border-primary/30 bg-primary/5' : 'border-white/10 bg-white/5 hover:border-primary/20'}`}>
                      {o.primary && <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/20 rounded-full mb-3"><div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /><span className="text-primary-300 text-xs font-black uppercase tracking-widest">HQ</span></div>}
                      <h3 className="text-sm font-black text-white">{o.city} <span className="text-slate-500">·</span> {o.country}</h3>
                      <div className="flex items-start gap-2 mt-2">
                        <MapPin size={14} className="text-primary-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">{o.address}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* CONTACT FAQS */}
      {faqs.length > 0 && (
        <section className="py-20 bg-dark">
          <div className="container mx-auto px-6 max-w-3xl">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">FAQ</div>
              <h2 className="text-4xl font-black text-white mb-3">Quick Answers</h2>
            </div>
            <div className="space-y-3">
              {faqs.map((faq: any, i: number) => (
                <div key={i} className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors">
                    <span className="text-sm font-black text-white pr-3">{faq.q}</span>
                    {openFaq === i ? <ChevronUp size={16} className="text-primary-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-500 flex-shrink-0" />}
                  </button>
                  {openFaq === i && <div className="px-5 pb-4 pt-2 text-sm text-slate-400 font-medium leading-relaxed border-t border-white/5">{faq.a}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default ContactUs;
