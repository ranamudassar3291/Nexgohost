import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight,
  Star, ArrowRight, Zap, Globe, Server, Shield, Database, Lock,
  HeadphonesIcon, Cpu, Mail, Activity, Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/context/CurrencyProvider";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";

interface Plan {
  id: string; name: string; description: string | null; price: number; yearlyPrice: number | null;
  billingCycle: string; diskSpace: string; bandwidth: string;
  emailAccounts: number | null; databases: number | null; features: string[];
}

interface DomainResult {
  tld: string; available: boolean; registrationPrice?: number;
}

async function fetchPublicPlans(): Promise<Plan[]> {
  const res = await fetch("/api/packages");
  if (!res.ok) return [];
  return res.json();
}

async function checkDomain(name: string): Promise<{ name: string; results: DomainResult[] }> {
  const res = await fetch(`/api/domains/availability?domain=${encodeURIComponent(name)}`);
  if (!res.ok) return { name, results: [] };
  return res.json();
}

const FEATURES = [
  { icon: Zap,            title: "Instant Setup",            desc: "Your hosting account is ready in seconds after order. No waiting." },
  { icon: Shield,         title: "99.9% Uptime SLA",         desc: "Enterprise-grade infrastructure with guaranteed uptime and redundancy." },
  { icon: HeadphonesIcon, title: "24/7 Expert Support",      desc: "Our team of hosting experts is available round the clock to assist you." },
  { icon: Database,       title: "Daily Backups",            desc: "Automated daily backups keep your data safe and always recoverable." },
  { icon: Lock,           title: "Free SSL Certificates",    desc: "Every hosting plan includes free Let's Encrypt SSL for all your domains." },
  { icon: Cpu,            title: "High-Performance Servers", desc: "NVMe SSD storage and LiteSpeed servers deliver blazing-fast load times." },
];

const TESTIMONIALS = [
  { name: "Ahmed Khan",    role: "E-commerce Owner", rating: 5, text: "Noehost has been the perfect hosting partner. My store loads incredibly fast and I've had zero downtime in 2 years." },
  { name: "Sarah Johnson", role: "Web Developer",    rating: 5, text: "The cPanel interface is clean and the support team always resolves issues within minutes. Highly recommended!" },
  { name: "Muhammad Ali",  role: "Blogger",          rating: 5, text: "Switched from another host and couldn't be happier. The value for money is unbeatable and the speed is phenomenal." },
];

const FAQS = [
  { q: "What hosting plans do you offer?",       a: "We offer Shared Hosting, Business Hosting, and Enterprise plans — each suited for different stages of growth. All plans include free SSL, 99.9% uptime SLA, cPanel access, and 24/7 support." },
  { q: "How do I register a domain name?",       a: "Simply search for your desired domain in our domain checker above. If it's available, add it to your cart and complete checkout. We support .com, .pk, .net, .org, and many more TLDs." },
  { q: "Is there a money-back guarantee?",       a: "Yes! All hosting plans come with a 30-day money-back guarantee. Contact our support team within 30 days of purchase for a full refund — no questions asked." },
  { q: "Do I get free SSL with my hosting?",     a: "Absolutely. Every hosting account includes a free Let's Encrypt SSL certificate. We also offer premium certificates for extended validation or wildcard coverage." },
  { q: "Can I migrate my existing website?",     a: "Yes, we offer free website migration for all new customers. Our technical team handles the full migration — files, databases, emails — with minimal downtime." },
  { q: "What control panel do you use?",         a: "We use cPanel, the industry-standard control panel trusted by millions of websites. It gives you complete control over files, databases, email accounts, and DNS settings." },
];

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      {FAQS.map((faq, i) => (
        <div key={i} className="rounded-2xl overflow-hidden transition-all" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <button className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left" onClick={() => setOpen(open === i ? null : i)}>
            <span className="font-bold text-slate-200 text-sm sm:text-base">{faq.q}</span>
            <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform duration-300 ${open === i ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }}>
                <div className="px-6 pb-5 text-sm text-slate-400 leading-relaxed" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "1rem" }}>{faq.a}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function HeroIllustration() {
  return (
    <div className="relative w-full max-w-lg mx-auto select-none">
      <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full"></div>
      <div className="relative rounded-3xl p-6 shadow-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-3 h-3 rounded-full bg-red-400"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
          <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
          <div className="flex-1 h-5 ml-3 rounded-full flex items-center px-3" style={{ background: "rgba(255,255,255,0.08)" }}>
            <span className="text-[9px] text-slate-400 font-mono">noehost.com — Secured</span>
          </div>
          <Lock size={10} className="text-emerald-400" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Uptime", value: "99.9%", color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "Speed",  value: "< 1ms", color: "text-primary",     bg: "bg-primary/10" },
            { label: "Sites",  value: "2M+",   color: "text-purple-400",  bg: "bg-purple-500/10" },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} rounded-2xl p-3 text-center`} style={{ border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="space-y-2 mb-4">
          {[
            { name: "Web Server", status: "Running", icon: <Server size={14} />,   color: "text-emerald-400" },
            { name: "Database",   status: "Active",  icon: <Database size={14} />, color: "text-blue-400" },
            { name: "CDN Network",status: "Optimal", icon: <Wifi size={14} />,     color: "text-purple-400" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span className={s.color}>{s.icon}</span>
              <span className="text-xs font-bold text-slate-300 flex-1">{s.name}</span>
              <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                <div className="h-full w-4/5 bg-gradient-to-r from-primary to-primary/60 rounded-full"></div>
              </div>
              <span className="text-[9px] font-black text-emerald-400 uppercase">{s.status}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={14} className="text-primary" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center"><Lock size={10} className="text-emerald-400" /></div>
              <span className="text-[10px] text-slate-300 font-bold">SSL Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center"><Shield size={10} className="text-blue-400" /></div>
              <span className="text-[10px] text-slate-300 font-bold">DDoS Guard</span>
            </div>
          </div>
          <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Activity size={14} className="text-primary" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity</span>
            </div>
            {[70, 85, 55].map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`h-1.5 rounded-full bg-gradient-to-r from-primary to-primary/60`} style={{ width: `${w}%` }}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Homepage() {
  const [, setLocation] = useLocation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [domainQuery, setDomainQuery] = useState("");
  const [domainResults, setDomainResults] = useState<DomainResult[]>([]);
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainSearched, setDomainSearched] = useState("");
  const { formatPrice } = useCurrency();

  useEffect(() => {
    fetchPublicPlans().then(p => { setPlans(p.slice(0, 3)); setPlansLoading(false); });
  }, []);

  const handleDomainSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = domainQuery.trim().toLowerCase().replace(/^https?:\/\//, "").split(".")[0];
    if (!q) return;
    setDomainLoading(true);
    setDomainSearched(q);
    const data = await checkDomain(q);
    setDomainResults(data.results || []);
    setDomainLoading(false);
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#020617", color: "#cbd5e1" }}>

      {/* ── Announcement bar ── */}
      <div className="py-2.5 relative z-[110]" style={{ background: "linear-gradient(90deg, #0F172A, #0F172A)", borderBottom: "1px solid rgba(106,98,254,0.4)" }}>
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <a href="mailto:support@noehost.com" className="flex items-center gap-2 hover:text-primary transition-all">
              <Mail size={12} className="text-primary" /> support@noehost.com
            </a>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-yellow-400 animate-pulse">
            <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
            Flash Sale: 50% Off all Shared Plans! Use code: NOE50
          </div>
        </div>
      </div>

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50">
        <SiteNavbar />
      </header>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center pt-10 overflow-hidden" style={{ background: "#020617" }}>
        <div className="absolute inset-0 tech-grid opacity-20" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(at 0% 0%, hsla(244,98%,63%,0.25) 0px, transparent 50%), radial-gradient(at 100% 0%, hsla(244,98%,63%,0.15) 0px, transparent 50%), radial-gradient(at 50% 100%, hsla(244,98%,63%,0.1) 0px, transparent 50%)" }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 w-full py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-primary text-xs font-black uppercase tracking-widest" style={{ background: "rgba(106,98,254,0.1)", border: "1px solid rgba(106,98,254,0.2)" }}>
                <Zap size={12} /> Pakistan's #1 Web Hosting Provider
              </div>

              <h1 className="text-5xl sm:text-6xl font-black leading-[1.05] mb-6 text-white" style={{ letterSpacing: "-0.03em" }}>
                The Fastest Web
                <br />
                <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #6A62FE, #a78bfa)" }}>
                  Hosting Platform.
                </span>
              </h1>

              <p className="text-lg text-slate-400 max-w-xl mb-10 leading-relaxed font-medium">
                Professional web hosting with cPanel, free SSL, daily backups, and 24/7 expert support.
                Get your website online in minutes with Pakistan's most trusted host.
              </p>

              {/* Domain Search */}
              <form onSubmit={handleDomainSearch} className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="text"
                    value={domainQuery}
                    onChange={e => setDomainQuery(e.target.value)}
                    placeholder="Search your domain (e.g. mywebsite)"
                    className="w-full h-14 pl-12 pr-4 rounded-xl text-white text-base focus:outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1" }}
                    onFocus={e => (e.target.style.borderColor = "#6A62FE")}
                    onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  />
                </div>
                <button type="submit"
                  disabled={domainLoading || !domainQuery.trim()}
                  className="h-14 px-8 rounded-xl text-white font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #6A62FE, #8B7FFF)", boxShadow: "0 4px 20px rgba(106,98,254,0.4)" }}>
                  {domainLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  {domainLoading ? "Searching..." : "Check Availability"}
                </button>
              </form>

              {/* Domain Results */}
              <AnimatePresence>
                {domainSearched && !domainLoading && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="rounded-2xl overflow-hidden shadow-2xl text-left mb-6" style={{ background: "#0F172A", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Results for <span className="text-white">{domainSearched}</span></p>
                    </div>
                    {domainResults.length === 0 ? (
                      <div className="px-5 py-6 text-center text-slate-500 text-sm">No TLD pricing configured. Contact admin.</div>
                    ) : (
                      <div className="divide-y max-h-64 overflow-y-auto" style={{ "--tw-divide-opacity": "0.05" } as React.CSSProperties}>
                        {domainResults.slice(0, 8).map(r => (
                          <div key={r.tld} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <div className="flex items-center gap-3">
                              {r.available ? <CheckCircle size={16} className="text-emerald-400 shrink-0" /> : <XCircle size={16} className="text-red-400 shrink-0" />}
                              <span className="font-mono font-bold text-slate-200">{domainSearched}{r.tld}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              {r.registrationPrice != null && (
                                <span className="text-sm text-slate-500">{formatPrice(Number(r.registrationPrice))}/yr</span>
                              )}
                              {r.available ? (
                                <button className="h-7 px-3 text-xs font-black text-white rounded-lg uppercase tracking-wide"
                                  style={{ background: "#6A62FE" }}
                                  onClick={() => setLocation(`/client/register-domain?name=${encodeURIComponent(domainSearched + r.tld)}`)}>
                                  Register
                                </button>
                              ) : (
                                <span className="text-xs text-red-400 font-black uppercase">Taken</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 font-bold uppercase tracking-widest">
                {["Free SSL", "99.9% Uptime", "24/7 Support", "Easy cPanel"].map(item => (
                  <div key={item} className="flex items-center gap-1.5">
                    <CheckCircle size={13} className="text-emerald-400" /> {item}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
              className="hidden lg:block">
              <HeroIllustration />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ background: "#0F172A", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: "50,000+", label: "Websites Hosted" },
            { value: "99.9%",   label: "Uptime Guarantee" },
            { value: "24/7",    label: "Expert Support" },
            { value: "10+",     label: "Years Experience" },
          ].map(stat => (
            <div key={stat.label}>
              <div className="text-3xl font-black text-primary mb-1">{stat.value}</div>
              <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Hosting Plans ── */}
      <section id="plans" className="py-24 px-4 sm:px-6" style={{ background: "#020617" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 text-primary text-xs font-black uppercase tracking-widest" style={{ background: "rgba(106,98,254,0.1)", border: "1px solid rgba(106,98,254,0.2)" }}>
              <Server size={12} /> Hosting Plans
            </div>
            <h2 className="text-4xl font-black text-white mb-4" style={{ letterSpacing: "-0.02em" }}>Choose Your Perfect Plan</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto font-medium">All plans include free SSL, daily backups, 24/7 support, and one-click WordPress installation.</p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary" /></div>
          ) : plans.length === 0 ? (
            <div className="text-center py-16 text-slate-500">No plans available yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan, i) => {
                const isPopular = i === 1;
                return (
                  <motion.div key={plan.id}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                    className="relative rounded-3xl p-8 flex flex-col transition-all hover:-translate-y-1 hover:shadow-2xl"
                    style={isPopular ? {
                      background: "linear-gradient(160deg, rgba(106,98,254,0.12), rgba(15,23,42,1))",
                      border: "1px solid rgba(106,98,254,0.4)",
                      boxShadow: "0 8px 40px rgba(106,98,254,0.15)"
                    } : {
                      background: "#0F172A",
                      border: "1px solid rgba(255,255,255,0.06)"
                    }}>
                    {isPopular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-black text-white uppercase tracking-widest" style={{ background: "linear-gradient(135deg, #6A62FE, #8B7FFF)" }}>
                        MOST POPULAR
                      </div>
                    )}
                    <div className="mb-6">
                      <h3 className="text-xl font-black text-white mb-1">{plan.name}</h3>
                      {plan.description && <p className="text-sm text-slate-500 font-medium">{plan.description}</p>}
                    </div>
                    <div className="mb-6">
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-black text-primary">{formatPrice(Number(plan.price))}</span>
                        <span className="text-slate-500 mb-1 font-bold">/{plan.billingCycle === "yearly" ? "yr" : "mo"}</span>
                      </div>
                      {plan.yearlyPrice && plan.billingCycle !== "yearly" && (
                        <p className="text-xs text-slate-500 mt-1">
                          or {formatPrice(Number(plan.yearlyPrice))}/year — save {Math.round((1 - Number(plan.yearlyPrice) / (Number(plan.price) * 12)) * 100)}%
                        </p>
                      )}
                    </div>
                    <ul className="space-y-2.5 mb-8 flex-1 text-sm">
                      {[
                        `${plan.diskSpace} Storage`,
                        `${plan.bandwidth} Bandwidth`,
                        ...(plan.emailAccounts != null ? [`${plan.emailAccounts === -1 ? "Unlimited" : plan.emailAccounts} Email Accounts`] : []),
                        ...(plan.databases != null ? [`${plan.databases === -1 ? "Unlimited" : plan.databases} Databases`] : []),
                        ...(plan.features || []).slice(0, 4),
                      ].map((f, fi) => (
                        <li key={fi} className="flex items-center gap-2 text-slate-300">
                          <CheckCircle size={14} className="text-emerald-400 shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => setLocation(`/order/add/${plan.id}`)}
                      className="w-full rounded-2xl py-3.5 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                      style={isPopular ? { background: "linear-gradient(135deg, #6A62FE, #8B7FFF)", color: "#fff", boxShadow: "0 4px 20px rgba(106,98,254,0.35)" } : { background: "rgba(255,255,255,0.06)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.08)" }}>
                      Order Now <ArrowRight size={16} />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="text-center mt-10">
            <p className="text-sm text-slate-500 font-medium">
              Need a custom plan?{" "}
              <button onClick={() => setLocation("/contact")} className="text-primary hover:underline font-bold">Contact our sales team</button>
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-4 sm:px-6" style={{ background: "#0F172A", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 text-emerald-400 text-xs font-black uppercase tracking-widest" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>
              <Star size={12} /> Why Noehost
            </div>
            <h2 className="text-4xl font-black text-white mb-4" style={{ letterSpacing: "-0.02em" }}>Everything You Need to Succeed Online</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto font-medium">Enterprise-grade infrastructure at prices that work for everyone.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <motion.div key={feat.title}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }} viewport={{ once: true }}
                  className="rounded-2xl p-6 transition-all hover:-translate-y-1 group cursor-default"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all" style={{ background: "rgba(106,98,254,0.12)", border: "1px solid rgba(106,98,254,0.2)" }}>
                    <Icon size={22} className="text-primary" />
                  </div>
                  <h3 className="font-black text-white mb-2">{feat.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed font-medium">{feat.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 px-4 sm:px-6" style={{ background: "#020617" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-black text-white mb-4" style={{ letterSpacing: "-0.02em" }}>Trusted by Thousands of Customers</h2>
            <p className="text-slate-400 text-lg font-medium">Don't just take our word for it.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={t.name}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                className="rounded-2xl p-6 transition-all"
                style={{ background: "#0F172A", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, si) => (
                    <Star key={si} size={14} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-400 leading-relaxed mb-4 font-medium">"{t.text}"</p>
                <div>
                  <p className="font-black text-white text-sm">{t.name}</p>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-4 sm:px-6" style={{ background: "#0F172A", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-black uppercase tracking-widest text-primary px-3 py-1.5 rounded-full mb-4" style={{ background: "rgba(106,98,254,0.1)", border: "1px solid rgba(106,98,254,0.2)" }}>FAQ</span>
            <h2 className="text-4xl font-black text-white mb-3" style={{ letterSpacing: "-0.02em" }}>Frequently Asked Questions</h2>
            <p className="text-slate-400 font-medium">Everything you need to know about our hosting services.</p>
          </div>
          <FaqAccordion />
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-4 sm:px-6 relative overflow-hidden" style={{ background: "#020617" }}>
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(at 50% 50%, rgba(106,98,254,0.15) 0px, transparent 70%)" }} />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-black text-white mb-4" style={{ letterSpacing: "-0.02em" }}>Ready to Launch Your Website?</h2>
          <p className="text-slate-400 text-lg mb-10 font-medium">Join 50,000+ customers who trust Noehost for their online presence.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => setLocation("/register")}
              className="flex items-center justify-center gap-2 px-10 py-4 rounded-xl text-white font-black text-sm uppercase tracking-widest transition-all shadow-2xl"
              style={{ background: "linear-gradient(135deg, #6A62FE, #8B7FFF)", boxShadow: "0 6px 30px rgba(106,98,254,0.4)" }}>
              Get Started Now <ChevronRight size={18} />
            </button>
            <button onClick={() => scrollTo("plans")}
              className="flex items-center justify-center gap-2 px-10 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all text-slate-300 hover:text-white"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              View Plans
            </button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
