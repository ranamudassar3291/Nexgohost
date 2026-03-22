import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Server, Globe, Shield, Zap, Clock, HeadphonesIcon,
  Search, CheckCircle, XCircle, Loader2, ChevronRight, ChevronDown,
  Star, ArrowRight, Menu, X, Database, Lock, Cpu, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/context/CurrencyProvider";

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
  { icon: Zap,            title: "Instant Setup",           desc: "Your hosting account is ready in seconds after order. No waiting." },
  { icon: Shield,         title: "99.9% Uptime SLA",        desc: "Enterprise-grade infrastructure with guaranteed uptime and redundancy." },
  { icon: HeadphonesIcon, title: "24/7 Expert Support",     desc: "Our team of hosting experts is available round the clock to assist you." },
  { icon: Database,       title: "Daily Backups",           desc: "Automated daily backups keep your data safe and always recoverable." },
  { icon: Lock,           title: "Free SSL Certificates",   desc: "Every hosting plan includes free Let's Encrypt SSL for all your domains." },
  { icon: Cpu,            title: "High-Performance Servers", desc: "NVMe SSD storage and LiteSpeed servers deliver blazing-fast load times." },
];

const TESTIMONIALS = [
  { name: "Ahmed Khan",      role: "E-commerce Owner", rating: 5, text: "Nexgohost has been the perfect hosting partner. My store loads incredibly fast and I've had zero downtime in 2 years." },
  { name: "Sarah Johnson",   role: "Web Developer",    rating: 5, text: "The cPanel interface is clean and the support team always resolves issues within minutes. Highly recommended!" },
  { name: "Muhammad Ali",    role: "Blogger",          rating: 5, text: "Switched from another host and couldn't be happier. The value for money is unbeatable and the speed is phenomenal." },
];

const FAQS = [
  {
    q: "What hosting plans do you offer?",
    a: "We offer Shared Hosting, Business Hosting, and Enterprise plans — each suited for different stages of growth. All plans include free SSL, 99.9% uptime SLA, cPanel access, and 24/7 support. You can upgrade or downgrade at any time.",
  },
  {
    q: "How do I register a domain name?",
    a: "Simply search for your desired domain in our domain checker above. If it's available, add it to your cart and complete checkout. We support .com, .pk, .net, .org, and many more TLDs at competitive prices.",
  },
  {
    q: "Is there a money-back guarantee?",
    a: "Yes! All hosting plans come with a 30-day money-back guarantee. If you're not satisfied for any reason, contact our support team within 30 days of purchase and we'll issue a full refund — no questions asked.",
  },
  {
    q: "Do I get free SSL with my hosting?",
    a: "Absolutely. Every hosting account includes a free Let's Encrypt SSL certificate. We also offer premium Comodo/RapidSSL certificates for businesses that need extended validation or wildcard coverage.",
  },
  {
    q: "Can I migrate my existing website to Nexgohost?",
    a: "Yes, we offer free website migration for all new customers. Our technical team will handle the full migration — files, databases, emails — with minimal downtime. Just open a support ticket after signing up.",
  },
  {
    q: "What control panel do you use?",
    a: "We use cPanel, the industry-standard control panel trusted by millions of websites. It gives you complete control over your files, databases, email accounts, DNS settings, and much more through an intuitive interface.",
  },
  {
    q: "Do you offer dedicated or VPS hosting?",
    a: "Our Business and Enterprise plans are built on cloud infrastructure with dedicated resources. For fully dedicated servers, please contact our sales team for a custom quote tailored to your workload.",
  },
  {
    q: "How do I reach support if I need help?",
    a: "Our support team is available 24/7 via live chat, ticket system, and email. Average first response time is under 15 minutes. Premium plans also include priority queue access for even faster resolutions.",
  },
];

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      {FAQS.map((faq, i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-colors"
        >
          <button
            className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="font-semibold text-foreground text-sm sm:text-base">{faq.q}</span>
            <ChevronDown
              size={18}
              className={`shrink-0 text-muted-foreground transition-transform duration-300 ${open === i ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-4">
                  {faq.a}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

export default function Homepage() {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggedIn] = useState(() => !!localStorage.getItem("token"));
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [domainQuery, setDomainQuery] = useState("");
  const [domainResults, setDomainResults] = useState<DomainResult[]>([]);
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainSearched, setDomainSearched] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const domainInputRef = useRef<HTMLInputElement>(null);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    fetchPublicPlans().then(p => { setPlans(p.slice(0, 3)); setPlansLoading(false); });
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
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
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const navLinks = [
    { label: "Home",     action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
    { label: "Hosting",  action: () => scrollTo("plans") },
    { label: "Domains",  action: () => scrollTo("domain-search") },
    { label: "Features", action: () => scrollTo("features") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Sticky Header ── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/95 backdrop-blur border-b border-border/40 shadow-lg shadow-black/20" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-primary/30">N</div>
            <span className="font-display font-bold text-xl text-foreground">Nexgohost</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <button key={link.label} onClick={link.action}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                {link.label}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/client/login")}>Sign In</Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" onClick={() => setLocation("/register")}>Get Started</Button>
          </div>

          <button className="md:hidden p-2 text-foreground" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="md:hidden bg-card border-b border-border px-4 py-4 space-y-3">
              {navLinks.map(link => (
                <button key={link.label} onClick={link.action}
                  className="block w-full text-left text-sm text-muted-foreground hover:text-foreground py-2 border-b border-border/30">
                  {link.label}
                </button>
              ))}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setMenuOpen(false); setLocation("/client/login"); }}>Sign In</Button>
                <Button size="sm" className="flex-1 bg-primary" onClick={() => { setMenuOpen(false); setLocation("/register"); }}>Get Started</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-purple-900/10 to-background" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[120px] -z-0" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-[100px] -z-0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_hsl(var(--background))_100%)]" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              <Zap size={14} /> Pakistan's #1 Web Hosting Provider
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold leading-tight mb-6">
              Fast. Reliable.
              <span className="block bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Affordable Hosting.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Professional web hosting with cPanel, free SSL, daily backups, and 24/7 expert support.
              Get your website online in minutes.
            </p>

            {/* Domain Search */}
            <form id="domain-search" onSubmit={handleDomainSearch}
              className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto mb-8">
              <div className="relative flex-1">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  ref={domainInputRef}
                  type="text"
                  value={domainQuery}
                  onChange={e => setDomainQuery(e.target.value)}
                  placeholder="Search your domain (e.g. mywebsite)"
                  className="w-full h-14 pl-12 pr-4 rounded-2xl bg-card/80 backdrop-blur border border-border/60 text-foreground placeholder:text-muted-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
                />
              </div>
              <Button type="submit" size="lg"
                className="h-14 px-8 bg-primary hover:bg-primary/90 rounded-2xl text-base font-semibold shadow-lg shadow-primary/25"
                disabled={domainLoading || !domainQuery.trim()}>
                {domainLoading ? <Loader2 size={20} className="animate-spin mr-2" /> : <Search size={20} className="mr-2" />}
                {domainLoading ? "Searching..." : "Check Availability"}
              </Button>
            </form>

            {/* Domain Results */}
            <AnimatePresence>
              {domainSearched && !domainLoading && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="max-w-2xl mx-auto bg-card/90 backdrop-blur border border-border rounded-2xl overflow-hidden shadow-2xl text-left mb-8">
                  <div className="px-5 py-3 border-b border-border bg-secondary/40">
                    <p className="text-sm text-muted-foreground">Results for <strong className="text-foreground">{domainSearched}</strong></p>
                  </div>
                  {domainResults.length === 0 ? (
                    <div className="px-5 py-6 text-center text-muted-foreground text-sm">No TLD pricing configured. Contact admin.</div>
                  ) : (
                    <div className="divide-y divide-border/50 max-h-64 overflow-y-auto">
                      {domainResults.slice(0, 8).map(r => (
                        <div key={r.tld} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-3">
                            {r.available
                              ? <CheckCircle size={16} className="text-green-400 shrink-0" />
                              : <XCircle size={16} className="text-red-400 shrink-0" />
                            }
                            <span className="font-mono font-medium text-foreground">{domainSearched}{r.tld}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            {r.registrationPrice != null && (
                              <span className="text-sm text-muted-foreground">{formatPrice(Number(r.registrationPrice))}/yr</span>
                            )}
                            {r.available ? (
                              <Button size="sm" className="h-7 px-3 text-xs bg-primary hover:bg-primary/90"
                                onClick={() => setLocation(`/register`)}>
                                Register
                              </Button>
                            ) : (
                              <span className="text-xs text-red-400 font-medium">Taken</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              {["Free SSL Certificate", "99.9% Uptime SLA", "24/7 Support", "Easy cPanel"].map(item => (
                <div key={item} className="flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-green-400" />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-border flex items-start justify-center pt-2">
            <div className="w-1 h-2 rounded-full bg-primary animate-pulse" />
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="border-y border-border bg-card/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: "50,000+", label: "Websites Hosted" },
            { value: "99.9%",   label: "Uptime Guarantee" },
            { value: "24/7",    label: "Expert Support" },
            { value: "10+",     label: "Years Experience" },
          ].map(stat => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-primary">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Hosting Plans ── */}
      <section id="plans" className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              <Server size={14} /> Hosting Plans
            </div>
            <h2 className="text-4xl font-display font-bold text-foreground mb-4">Choose Your Perfect Plan</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">All plans include free SSL, daily backups, 24/7 support, and one-click WordPress installation.</p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary" /></div>
          ) : plans.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">No plans available yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan, i) => {
                const isPopular = i === 1;
                return (
                  <motion.div key={plan.id}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                    className={`relative rounded-3xl border p-8 flex flex-col transition-all hover:-translate-y-1 hover:shadow-xl ${isPopular ? "border-primary/50 bg-gradient-to-b from-primary/10 to-card shadow-lg shadow-primary/10" : "border-border bg-card"}`}>
                    {isPopular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary rounded-full text-xs font-bold text-white shadow-lg shadow-primary/30">
                        MOST POPULAR
                      </div>
                    )}
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                      {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
                    </div>
                    <div className="mb-6">
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-bold text-primary">{formatPrice(Number(plan.price))}</span>
                        <span className="text-muted-foreground mb-1">/{plan.billingCycle === "yearly" ? "yr" : "mo"}</span>
                      </div>
                      {plan.yearlyPrice && plan.billingCycle !== "yearly" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          or {formatPrice(Number(plan.yearlyPrice))}/year — save {Math.round((1 - Number(plan.yearlyPrice) / (Number(plan.price) * 12)) * 100)}%
                        </p>
                      )}
                    </div>
                    <ul className="space-y-2.5 mb-8 flex-1 text-sm">
                      <li className="flex items-center gap-2 text-foreground"><CheckCircle size={15} className="text-green-400 shrink-0" /> {plan.diskSpace} Storage</li>
                      <li className="flex items-center gap-2 text-foreground"><CheckCircle size={15} className="text-green-400 shrink-0" /> {plan.bandwidth} Bandwidth</li>
                      {plan.emailAccounts != null && (
                        <li className="flex items-center gap-2 text-foreground"><CheckCircle size={15} className="text-green-400 shrink-0" /> {plan.emailAccounts === -1 ? "Unlimited" : plan.emailAccounts} Email Accounts</li>
                      )}
                      {plan.databases != null && (
                        <li className="flex items-center gap-2 text-foreground"><CheckCircle size={15} className="text-green-400 shrink-0" /> {plan.databases === -1 ? "Unlimited" : plan.databases} Databases</li>
                      )}
                      {(plan.features || []).slice(0, 4).map((f, fi) => (
                        <li key={fi} className="flex items-center gap-2 text-foreground"><CheckCircle size={15} className="text-green-400 shrink-0" /> {f}</li>
                      ))}
                    </ul>
                    <Button
                      onClick={() => {
                        if (isLoggedIn) {
                          const params = new URLSearchParams({
                            packageId: plan.id,
                            packageName: plan.name,
                            amount: String(plan.price),
                            ...(plan.yearlyPrice ? { yearlyPrice: String(plan.yearlyPrice) } : {}),
                          });
                          setLocation(`/client/checkout?${params.toString()}`);
                        } else {
                          setLocation("/client/login");
                        }
                      }}
                      className={`w-full rounded-2xl ${isPopular ? "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" : "bg-secondary hover:bg-secondary/80 text-foreground"}`}>
                      Order Now <ArrowRight size={16} className="ml-2" />
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="text-center mt-10">
            <p className="text-sm text-muted-foreground">
              Looking for enterprise solutions?{" "}
              <button onClick={() => setLocation("/client/login")} className="text-primary hover:underline">Contact our sales team</button>
            </p>
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section id="features" className="py-24 px-4 sm:px-6 bg-card/30 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium mb-4">
              <Star size={14} /> Why Nexgohost
            </div>
            <h2 className="text-4xl font-display font-bold text-foreground mb-4">Everything You Need to Succeed Online</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">Enterprise-grade infrastructure at prices that work for everyone.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <motion.div key={feat.title}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }} viewport={{ once: true }}
                  className="bg-card border border-border rounded-2xl p-6 hover:border-primary/30 hover:-translate-y-1 transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:border-primary/40 transition-colors">
                    <Icon size={22} className="text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feat.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-display font-bold text-foreground mb-4">Trusted by Thousands of Customers</h2>
            <p className="text-muted-foreground text-lg">Don't just take our word for it.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={t.name}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                className="bg-card border border-border rounded-2xl p-6 hover:border-primary/20 transition-colors">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, si) => (
                    <Star key={si} size={14} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-foreground text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20 mb-4">FAQ</span>
            <h2 className="text-4xl font-display font-bold text-foreground mb-3">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">Everything you need to know about our hosting services.</p>
          </div>
          <FaqAccordion />
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-20 px-4 sm:px-6 bg-gradient-to-r from-primary/20 via-purple-600/15 to-transparent border-y border-primary/10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-display font-bold text-foreground mb-4">Ready to Launch Your Website?</h2>
          <p className="text-muted-foreground text-lg mb-8">Join 50,000+ customers who trust Nexgohost for their online presence.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8 shadow-lg shadow-primary/25"
              onClick={() => setLocation("/register")}>
              Get Started Now <ChevronRight size={20} className="ml-1" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8"
              onClick={() => scrollTo("plans")}>
              View Plans
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-primary/20">N</div>
                <span className="font-display font-bold text-xl">Nexgohost</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">Pakistan's premier web hosting provider with enterprise-grade infrastructure and 24/7 expert support.</p>
            </div>
            {[
              { title: "Hosting", links: [{ l: "Shared Hosting", a: "plans" }, { l: "Domain Registration", a: "domain-search" }, { l: "SSL Certificates", a: "features" }, { l: "Business Email", a: "plans" }] },
              { title: "Company",  links: [{ l: "About Us", a: "features" }, { l: "Contact", a: "features" }, { l: "Blog", a: "features" }, { l: "Careers", a: "features" }] },
              { title: "Support",  links: [{ l: "Help Center", a: "features" }, { l: "Submit Ticket", a: "" }, { l: "Server Status", a: "" }, { l: "Community", a: "" }] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="font-semibold text-foreground mb-4">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map(link => (
                    <li key={link.l}>
                      <button onClick={() => link.a ? scrollTo(link.a) : undefined}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {link.l}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Nexgohost. All rights reserved.</p>
            <div className="flex gap-6">
              <button className="hover:text-foreground transition-colors">Privacy Policy</button>
              <button className="hover:text-foreground transition-colors">Terms of Service</button>
              <button className="hover:text-foreground transition-colors">Refund Policy</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
