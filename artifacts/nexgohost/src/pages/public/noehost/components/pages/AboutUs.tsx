import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { Check, ArrowRight, Star } from 'lucide-react';
import { useContent } from '@/context/ContentContext';

const ABOUT_DEFAULT: any = {
  hero: {
    badge: 'Our Story', title: 'Powering the Web,', titleHighlight: 'One Site at a Time.',
    description: 'Founded with the vision of making enterprise-grade hosting accessible to everyone, Noehost has grown into a globally trusted platform serving thousands of customers worldwide.',
    primaryBtn: { text: 'Meet the Team', url: '#team', show: true },
    secondaryBtn: { text: 'Our Mission', url: '#mission', show: true },
    badges: ['Est. 2019', '99.9% Uptime SLA', '50,000+ Customers', '24/7 Expert Support'],
  },
  stats: [
    { value: '50,000+', label: 'Happy Customers' },
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '6', label: 'Global Data Centers' },
    { value: '24/7', label: 'Expert Support' },
  ],
  missionPoints: [
    'Enterprise-grade infrastructure at accessible prices.',
    'Transparent, honest pricing with no hidden fees.',
    '24/7 support from real hosting experts.',
    'Constant innovation driven by customer feedback.',
  ],
  missionCards: [
    { title: 'Innovation First', desc: 'We invest heavily in the latest NVMe SSD, KVM virtualisation, and edge networking technologies.' },
    { title: 'Customer Obsessed', desc: 'Every feature we build starts with a customer problem. Our roadmap is driven by feedback.' },
    { title: 'Radical Transparency', desc: 'No hidden fees, no surprise renewals. What you see on our pricing page is what you pay.' },
  ],
  values: [
    { title: 'Reliability', desc: 'Our infrastructure is built for 99.9% uptime backed by an SLA.' },
    { title: 'Transparency', desc: 'Honest pricing and clear communication — always.' },
    { title: 'Innovation', desc: 'We use the latest technologies to give you a performance edge.' },
    { title: 'Support', desc: '24/7 expert support from people who love hosting.' },
  ],
  milestones: [
    { year: '2019', title: 'Founded', desc: 'Noehost launched with a mission to democratise web hosting.' },
    { year: '2020', title: '10,000 Customers', desc: 'We hit our first major milestone: 10,000 happy customers.' },
    { year: '2022', title: 'Global Expansion', desc: 'Opened data centres in London, Singapore, and New York.' },
    { year: '2024', title: '50,000 Customers', desc: 'Serving over 50,000 customers across 120+ countries.' },
  ],
  team: [
    { name: 'Alex Johnson', role: 'CEO & Co-Founder', bio: 'Alex has 15+ years of experience in web hosting and infrastructure. Former engineering lead at a Fortune 500 tech company.' },
    { name: 'Sarah Chen', role: 'CTO & Co-Founder', bio: 'Sarah leads our engineering team. She is passionate about distributed systems and high-availability infrastructure.' },
    { name: 'Omar Reyes', role: 'Head of Support', bio: 'Omar ensures every customer gets fast, expert help. He built our support team from the ground up.' },
  ],
  teamTitle: 'The Team Behind Noehost',
  teamDesc: 'We are a passionate team of engineers, designers, and support specialists dedicated to your success.',
  ctaTitle: 'Ready to Experience the Noehost Difference?',
  ctaDesc: 'Join over 50,000 customers who trust Noehost with their websites, apps, and businesses.',
  ctaBtnText: 'Get Started Today',
  ctaBtnUrl: '/register',
};

const AboutUs: React.FC = () => {
  const { content } = useContent();
  const pgCms = content?.["pages.about"] || {};
  const pg = { ...ABOUT_DEFAULT, ...pgCms };

  const hero = pg.hero || {};
  const stats = pg.stats || [];
  const values = pg.values || [];
  const milestones = pg.milestones || [];
  const team = pg.team || [];

  const renderLink = (to: string, children: React.ReactNode, className: string) => {
    if (!to) return null;
    if (to.startsWith('#') || to.startsWith('http')) return <a href={to} className={className}>{children}</a>;
    return <Link to={to} className={className}>{children}</Link>;
  };

  return (
    <div className="noehost-public min-h-screen bg-dark">

      {/* HERO */}
      <section className="relative bg-secondary overflow-hidden pt-36 pb-24">
        <div className="tech-grid absolute inset-0 opacity-5" />
        <div className="absolute top-0 left-0 w-[700px] h-[700px] rounded-full blur-[150px]" style={{ background: 'radial-gradient(circle, rgba(103,61,230,0.25) 0%, transparent 70%)' }} />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {hero.badge && (
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-6 uppercase tracking-widest">
                <Star size={12} className="fill-primary-400" /> {hero.badge}
              </div>
            )}
            <h1 className="text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
              {hero.title || 'Powering the Web'}<br />
              <span className="text-primary-300">{hero.titleHighlight || 'Since 2018.'}</span>
            </h1>
            <p className="text-lg text-slate-400 font-medium leading-relaxed mb-8">
              {hero.description || 'We started with one mission: make world-class web hosting accessible to every business.'}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {hero.primaryBtnText && renderLink(hero.primaryBtnUrl || '/', <>{hero.primaryBtnText} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>, 'px-8 py-4 bg-primary hover:bg-primary-600 text-white rounded-xl font-black text-sm transition-all shadow-xl shadow-primary/30 flex items-center gap-2 group')}
              {hero.secondaryBtnText && renderLink(hero.secondaryBtnUrl || '/contact-us', hero.secondaryBtnText, 'px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-sm transition-all border border-white/10')}
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      {stats.length > 0 && (
        <section className="py-12 bg-primary">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((s: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                  <div className="text-3xl font-black text-white mb-1">{s.value}</div>
                  <div className="text-primary-200 text-xs font-black uppercase tracking-widest">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* MISSION */}
      {(pg.missionTitle || pg.missionDesc1) && (
        <section className="py-20 bg-dark">
          <div className="container mx-auto px-6">
            <div className="flex flex-col lg:flex-row gap-14 items-center">
              <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:w-1/2">
                {pg.missionBadge && (
                  <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-6 uppercase tracking-widest">{pg.missionBadge}</div>
                )}
                <h2 className="text-4xl font-black text-white mb-5">
                  {pg.missionTitle || ''} <span className="text-primary-300">{pg.missionHighlight || ''}</span>
                </h2>
                {pg.missionDesc1 && <p className="text-slate-400 font-medium leading-relaxed mb-4">{pg.missionDesc1}</p>}
                {pg.missionDesc2 && <p className="text-slate-400 font-medium leading-relaxed mb-6">{pg.missionDesc2}</p>}
                {(pg.missionPoints || []).length > 0 && (
                  <ul className="space-y-3">
                    {pg.missionPoints.map((pt: string, i: number) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-slate-300 font-medium">
                        <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0"><Check size={12} className="text-primary-400" /></div>
                        {pt}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
              {(pg.missionCards || []).length > 0 && (
                <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:w-1/2 grid grid-cols-2 gap-4">
                  {pg.missionCards.map((c: any, i: number) => (
                    <div key={i} className="p-6 bg-white/5 rounded-2xl border border-white/10 text-center hover:border-primary/30 transition-colors">
                      <div className="text-3xl font-black text-primary-300 mb-2">{c.value}</div>
                      <div className="text-sm text-slate-400 font-medium">{c.label}</div>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* VALUES */}
      {values.length > 0 && (
        <section className="py-20 bg-secondary relative overflow-hidden">
          <div className="tech-grid absolute inset-0 opacity-5" />
          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">Values</div>
              <h2 className="text-4xl font-black text-white mb-3">{pg.valuesTitle || 'What We Stand For'}</h2>
              <p className="text-slate-400 font-medium max-w-xl mx-auto">{pg.valuesDesc || ''}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {values.map((v: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} whileHover={{ y: -5 }}
                  className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-primary/30 hover:bg-white/10 transition-all">
                  <div className="w-10 h-10 bg-primary/10 text-primary-400 rounded-xl flex items-center justify-center mb-4">
                    <Star size={18} className="fill-primary-400/50" />
                  </div>
                  <h3 className="text-sm font-black text-white mb-2">{v.title}</h3>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">{v.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TIMELINE */}
      {milestones.length > 0 && (
        <section className="py-20 bg-dark">
          <div className="container mx-auto px-6 max-w-3xl">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">Our Journey</div>
              <h2 className="text-4xl font-black text-white mb-3">{pg.timelineTitle || 'How We Got Here'}</h2>
            </div>
            <div className="relative">
              <div className="absolute left-[68px] top-0 bottom-0 w-px bg-white/5" />
              <div className="space-y-8">
                {milestones.map((m: any, i: number) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className="flex gap-5 items-start">
                    <div className="w-[76px] flex-shrink-0 text-right">
                      <span className="text-sm font-black text-primary-400">{m.year}</span>
                    </div>
                    <div className="w-3 h-3 rounded-full bg-primary mt-1.5 flex-shrink-0 shadow-lg shadow-primary/50 relative z-10" />
                    <div className="flex-1 pb-4">
                      <h3 className="text-sm font-black text-white mb-1">{m.title}</h3>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed">{m.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TEAM */}
      {team.length > 0 && (
        <section className="py-20 bg-secondary relative overflow-hidden">
          <div className="tech-grid absolute inset-0 opacity-5" />
          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-300 text-xs font-black px-4 py-2 rounded-full mb-4 uppercase tracking-widest">The Team</div>
              <h2 className="text-4xl font-black text-white mb-3">{pg.teamTitle || 'Meet the People Behind Noehost'}</h2>
              <p className="text-slate-400 font-medium max-w-xl mx-auto">{pg.teamDesc || ''}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {team.map((member: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                  className="p-5 bg-white/5 rounded-2xl border border-white/10 hover:border-primary/30 transition-all text-center group">
                  <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3 text-white font-black text-sm group-hover:scale-110 transition-transform">
                    {member.initials}
                  </div>
                  <h3 className="text-xs font-black text-white mb-1 leading-tight">{member.name}</h3>
                  <p className="text-[10px] text-slate-500 font-medium leading-tight">{member.role}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      {pg.ctaTitle && (
        <section className="py-20 bg-primary relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          <div className="container mx-auto px-6 text-center relative z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-4xl font-black text-white mb-4">{pg.ctaTitle}</h2>
              <p className="text-primary-200 font-medium leading-relaxed mb-8 text-lg max-w-xl mx-auto">{pg.ctaDesc}</p>
              {renderLink(pg.ctaBtnUrl || '/shared-hosting', <>{pg.ctaBtnText || 'Start Hosting Today'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>, 'inline-flex items-center gap-2 px-8 py-4 bg-white text-primary hover:bg-primary-50 rounded-xl font-black text-sm transition-all group shadow-xl shadow-black/20')}
            </motion.div>
          </div>
        </section>
      )}
    </div>
  );
};

export default AboutUs;
