import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Server, Shield, Zap, Lock, Cpu, MemoryStick, HardDrive, Wifi,
  Check, ChevronDown, Globe, Key, ArrowRight, Star, Menu, X, Cloud,
} from "lucide-react";
import { useCurrency } from "@/context/CurrencyProvider";

const P        = "#701AFE";
const PSHADOW  = "0 4px 20px rgba(112,26,254,0.28)";

interface VpsPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  yearlyPrice: number | null;
  saveAmount: number | null;
  cpuCores: number;
  ramGb: number;
  storageGb: number;
  bandwidthTb: number | null;
  virtualization: string | null;
  features: string[];
}

const FEATURES = [
  { icon: Cpu,    title: "Dedicated Resources",    desc: "Guaranteed CPU cores and RAM — never shared with other users." },
  { icon: Shield, title: "DDoS Protection",         desc: "Enterprise-grade DDoS mitigation included on all plans at no extra cost." },
  { icon: Zap,    title: "NVMe SSD Storage",        desc: "Blazing-fast NVMe drives deliver 5× the I/O of traditional SSDs." },
  { icon: Key,    title: "Full Root Access",         desc: "Complete control over your server. Install any software, any config." },
  { icon: Globe,  title: "4 Global Locations",      desc: "Deploy in the US, UK, Germany, or Singapore for the lowest latency." },
  { icon: Lock,   title: "30-Day Money-Back",        desc: "Not satisfied? Get a full refund within 30 days — no questions asked." },
];

const VPS_FAQS = [
  {
    q: "What is a VPS and how is it different from shared hosting?",
    a: "A VPS (Virtual Private Server) gives you dedicated CPU, RAM, and disk resources that are never shared with other customers. Unlike shared hosting, a VPS runs its own isolated operating system, so your performance is guaranteed regardless of what other users are doing.",
  },
  {
    q: "Which operating systems can I install?",
    a: "We support Ubuntu 22.04 and 20.04 LTS, Debian 12, CentOS 7, AlmaLinux 9, and Windows Server 2022. You can reinstall or change your OS at any time from your control panel.",
  },
  {
    q: "Can I upgrade my plan later?",
    a: "Yes! You can upgrade to a higher VPS plan at any time. Resources are scaled up instantly. Downgrades are also available at the end of your billing cycle.",
  },
  {
    q: "Do you provide managed VPS support?",
    a: "Our standard VPS plans are unmanaged — you have full root access and manage the server yourself. However, our 24/7 support team is always available for network and hardware issues.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit/debit cards, bank transfers, EasyPaisa, JazzCash, and other local PKR payment methods.",
  },
];

const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } };

interface VpsOsTemplate {
  id: string; name: string; version: string; iconUrl: string | null;
}
interface VpsLocation {
  id: string; countryName: string; countryCode: string; flagIcon: string | null;
  city: string | null; datacenter: string | null; networkSpeed: string;
}

export default function VpsHosting() {
  const [, setLocation] = useLocation();
  const { formatPrice }  = useCurrency();
  const [cycle, setCycle]     = useState<"monthly" | "yearly">("yearly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: plans = [], isLoading } = useQuery<VpsPlan[]>({
    queryKey: ["vps-plans-public"],
    queryFn:  () => fetch("/api/vps-plans").then(r => r.json()),
    staleTime: 120_000,
  });

  const { data: osTemplates = [] } = useQuery<VpsOsTemplate[]>({
    queryKey: ["vps-os-templates-public"],
    queryFn:  () => fetch("/api/vps-os-templates").then(r => r.json()),
    staleTime: 300_000,
  });

  const { data: locations = [] } = useQuery<VpsLocation[]>({
    queryKey: ["vps-locations-public"],
    queryFn:  () => fetch("/api/vps-locations").then(r => r.json()),
    staleTime: 300_000,
  });

  const midIdx = Math.floor(plans.length / 2);
  const maxSavePct = plans.reduce((best, p) => {
    if (!p.yearlyPrice || !p.price) return best;
    const pct = Math.round((1 - p.yearlyPrice / (p.price * 12)) * 100);
    return pct > best ? pct : best;
  }, 0);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link href="/">
            <span className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: P }}>
                <Server size={16} className="text-white"/>
              </div>
              <span className="text-[15px] font-extrabold text-gray-900">Nexgohost</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-[13px] font-medium text-gray-600">
            <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
            <Link href="/vps" className="font-bold transition-colors" style={{ color: P }}>VPS Hosting</Link>
            <Link href="/order" className="hover:text-gray-900 transition-colors">Order</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/client/login">
              <button className="px-4 py-2 rounded-lg text-[13px] font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                Login
              </button>
            </Link>
            <Link href="/client/orders/new">
              <button className="px-4 py-2 rounded-lg text-[13px] font-bold text-white transition-all"
                style={{ background: P, boxShadow: PSHADOW }}>
                Get Started
              </button>
            </Link>
          </div>
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(v => !v)}>
            {mobileMenuOpen ? <X size={20}/> : <Menu size={20}/>}
          </button>
        </div>
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div key="mobile-menu" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3">
              <Link href="/" onClick={() => setMobileMenuOpen(false)} className="block text-[14px] font-medium text-gray-700">Home</Link>
              <Link href="/vps" onClick={() => setMobileMenuOpen(false)} className="block text-[14px] font-bold" style={{ color: P }}>VPS Hosting</Link>
              <Link href="/order" onClick={() => setMobileMenuOpen(false)} className="block text-[14px] font-medium text-gray-700">Order</Link>
              <div className="flex gap-2 pt-2">
                <Link href="/client/login" className="flex-1">
                  <button className="w-full py-2 rounded-lg text-[13px] font-semibold border border-gray-200 text-gray-700">Login</button>
                </Link>
                <Link href="/client/orders/new" className="flex-1">
                  <button className="w-full py-2 rounded-lg text-[13px] font-bold text-white" style={{ background: P }}>Get Started</button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden pt-20 pb-24"
        style={{ background: "linear-gradient(160deg, #0A001F 0%, #1A0060 40%, #2C007A 70%, #0A001F 100%)" }}>
        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #9B59FE 0%, transparent 70%)" }}/>
          <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #701AFE 0%, transparent 70%)" }}/>
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div {...fade}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-[12px] font-bold text-purple-200"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <Zap size={11} className="fill-current"/> KVM Virtualization · NVMe SSD · Instant Provisioning
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight tracking-tight">
              Cloud VPS Hosting<br/>
              <span style={{ background: "linear-gradient(90deg, #B47AFF, #FF72C0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Built for Performance
              </span>
            </h1>
            <p className="text-purple-200 text-[17px] max-w-2xl mx-auto mb-10 leading-relaxed">
              Dedicated CPU, RAM, and NVMe SSD storage — all in a fully isolated environment with root access, DDoS protection, and your choice of OS.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="#plans">
                <button className="px-8 py-4 rounded-2xl text-[15px] font-extrabold text-white transition-all"
                  style={{ background: P, boxShadow: "0 8px 32px rgba(112,26,254,0.5)" }}>
                  View Plans <ArrowRight size={16} className="inline ml-1.5"/>
                </button>
              </a>
              <Link href="/client/login">
                <button className="px-8 py-4 rounded-2xl text-[15px] font-semibold text-white transition-all"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.2)" }}>
                  Login to Dashboard
                </button>
              </Link>
            </div>
          </motion.div>

          {/* Trust pills */}
          <div className="flex flex-wrap justify-center gap-4 mt-12 text-[12px] text-purple-300">
            {["Full Root Access", "13 Global Locations", "16 OS Templates", "99.9% Uptime SLA", "Instant Setup"].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <Check size={10} strokeWidth={2.5}/> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Plans ── */}
      <section id="plans" className="py-20 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Choose Your Plan</h2>
            <p className="text-gray-500 text-[15px]">Scale up or down any time. Pay monthly or save with annual billing.</p>
          </div>

          {/* Billing toggle */}
          <div className="flex flex-col items-center gap-2 mb-10">
            <div className="inline-flex bg-white rounded-2xl p-1.5 gap-1 shadow-sm border border-gray-200">
              <button onClick={() => setCycle("monthly")}
                className="px-8 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                style={cycle === "monthly"
                  ? { background: "#111", color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }
                  : { color: "#9CA3AF" }}>
                Monthly
              </button>
              <button onClick={() => setCycle("yearly")}
                className="relative px-8 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                style={cycle === "yearly"
                  ? { background: P, color: "#fff", boxShadow: PSHADOW }
                  : { color: "#9CA3AF" }}>
                Yearly
                {maxSavePct > 0 && (
                  <span className="absolute -top-2.5 -right-2.5 text-[10px] font-extrabold bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full leading-none">
                    -{maxSavePct}%
                  </span>
                )}
              </button>
            </div>
            {cycle === "yearly" && maxSavePct > 0 && (
              <motion.p {...fade} className="text-[12px] text-green-600 font-semibold flex items-center gap-1">
                <Check size={11} strokeWidth={2.5}/> Save up to {maxSavePct}% with annual billing
              </motion.p>
            )}
          </div>

          {/* Plan cards */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[1, 2, 3].map(i => <div key={i} className="h-96 bg-gray-200 rounded-3xl animate-pulse"/>)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
              {plans.map((plan, i) => {
                const monthlyPrice  = plan.price;
                const yearlyPrice   = plan.yearlyPrice;
                const displayPrice  = cycle === "yearly" && yearlyPrice ? yearlyPrice / 12 : monthlyPrice;
                const saveAmt       = plan.saveAmount ?? (yearlyPrice != null ? Math.max(0, monthlyPrice * 12 - yearlyPrice) : null);
                const savePct       = yearlyPrice && monthlyPrice ? Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100) : 0;
                const isPopular     = i === midIdx && plans.length > 1;
                const orderHref     = `/order/vps/${plan.id}`;

                return (
                  <motion.div key={plan.id} {...fade} transition={{ duration: 0.3, delay: i * 0.06 }}
                    className="relative flex flex-col rounded-3xl overflow-hidden"
                    style={isPopular
                      ? { background: "linear-gradient(145deg, #7B2FFF 0%, #5010D0 60%, #3D0BA8 100%)", boxShadow: `0 20px 60px ${P}40` }
                      : { background: "#fff", border: "1.5px solid #E5E7EB", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>

                    {/* Popular ribbon */}
                    {isPopular && (
                      <div className="py-1.5 text-center text-[10.5px] font-extrabold text-white/90 uppercase tracking-widest"
                        style={{ background: "rgba(255,255,255,0.12)" }}>
                        ⚡ Most Popular
                      </div>
                    )}

                    <div className="p-6 flex flex-col flex-1">
                      {/* Save badge */}
                      {cycle === "yearly" && savePct > 0 && (
                        <div className="self-end text-[10px] font-extrabold px-2 py-0.5 rounded-full mb-2"
                          style={isPopular
                            ? { background: "rgba(255,220,50,0.9)", color: "#7a4200" }
                            : { background: "#FEF3C7", color: "#92400E" }}>
                          Save {savePct}%
                        </div>
                      )}

                      {/* Plan name */}
                      <h3 className={`text-[16px] font-extrabold mb-1 ${isPopular ? "text-white" : "text-gray-900"}`}>
                        {plan.name}
                      </h3>
                      {plan.description && (
                        <p className={`text-[12px] mb-4 ${isPopular ? "text-white/65" : "text-gray-400"}`}>
                          {plan.description}
                        </p>
                      )}

                      {/* Price */}
                      <div className="mb-5">
                        {cycle === "yearly" && yearlyPrice && (
                          <div className={`text-[11.5px] line-through mb-0.5 ${isPopular ? "text-white/50" : "text-gray-400"}`}>
                            {formatPrice(monthlyPrice)}/mo
                          </div>
                        )}
                        <div className="flex items-end gap-1">
                          <span className={`text-[38px] font-extrabold leading-none tracking-tight ${isPopular ? "text-white" : "text-gray-900"}`}>
                            {formatPrice(displayPrice)}
                          </span>
                          <span className={`text-[13px] mb-1.5 ${isPopular ? "text-white/70" : "text-gray-400"}`}>/mo</span>
                        </div>
                        {cycle === "yearly" && yearlyPrice && (
                          <div className={`text-[11px] mt-1 ${isPopular ? "text-white/70" : "text-gray-400"}`}>
                            Billed {formatPrice(yearlyPrice)}/year
                            {saveAmt != null && saveAmt > 0 && (
                              <span className={`ml-1.5 font-bold ${isPopular ? "text-yellow-300" : "text-green-600"}`}>
                                · Save {formatPrice(saveAmt)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Spec chips */}
                      <div className="grid grid-cols-2 gap-2 mb-5">
                        {[
                          { icon: Cpu,         label: `${plan.cpuCores} vCPU${plan.cpuCores !== 1 ? "s" : ""}` },
                          { icon: MemoryStick, label: `${plan.ramGb} GB RAM` },
                          { icon: HardDrive,   label: `${plan.storageGb} GB NVMe` },
                          { icon: Wifi,        label: `${plan.bandwidthTb ?? 1} TB BW` },
                        ].map(({ icon: Icon, label }) => (
                          <div key={label} className="flex items-center gap-1.5 rounded-xl px-2.5 py-2"
                            style={isPopular
                              ? { background: "rgba(255,255,255,0.12)" }
                              : { background: `${P}08`, border: `1px solid ${P}15` }}>
                            <Icon size={12} style={isPopular ? { color: "rgba(255,255,255,0.8)" } : { color: P }}/>
                            <span className={`text-[11.5px] font-semibold ${isPopular ? "text-white/90" : "text-gray-700"}`}>{label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Virtualization tag */}
                      <div className={`text-[10px] font-bold uppercase tracking-widest mb-4 ${isPopular ? "text-white/45" : "text-gray-400"}`}>
                        {plan.virtualization ?? "KVM"} Virtualization
                      </div>

                      {/* Features */}
                      <div className="space-y-2 mb-6 flex-1">
                        {plan.features.slice(0, 5).map(f => (
                          <div key={f} className={`flex items-center gap-2 text-[12px] ${isPopular ? "text-white/85" : "text-gray-600"}`}>
                            <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                              style={isPopular ? { background: "rgba(255,255,255,0.2)" } : { background: `${P}15` }}>
                              <Check size={9} strokeWidth={2.5} style={isPopular ? { color: "#fff" } : { color: P }}/>
                            </div>
                            {f}
                          </div>
                        ))}
                      </div>

                      {/* CTA */}
                      <Link href={orderHref}>
                        <button className="w-full py-3.5 rounded-2xl text-[14px] font-extrabold transition-all"
                          style={isPopular
                            ? { background: "#fff", color: P }
                            : { background: P, color: "#fff", boxShadow: PSHADOW }}>
                          Get Started →
                        </button>
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          <p className="text-center text-[12px] text-gray-400 mt-6">
            All plans include DDoS protection, dedicated IP, and 24/7 support. Prices in PKR. Tax may apply.
          </p>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Everything You Need</h2>
            <p className="text-gray-500 text-[15px]">Premium features included with every VPS plan — no hidden extras.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <motion.div key={title} {...fade}
                className="p-6 rounded-2xl border border-gray-100 hover:border-purple-100 transition-all hover:shadow-lg group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors"
                  style={{ background: `${P}10` }}>
                  <Icon size={18} style={{ color: P }}/>
                </div>
                <h3 className="text-[15px] font-bold text-gray-900 mb-1.5">{title}</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── OS & Location strip ── */}
      <section className="py-16 px-4 sm:px-6"
        style={{ background: "linear-gradient(135deg, #F5F0FF 0%, #FAFAFA 100%)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* OS Templates */}
            <div>
              <h3 className="text-[20px] font-extrabold text-gray-900 mb-2">
                {osTemplates.length > 0 ? `${osTemplates.length} OS Templates` : "OS Templates"}
              </h3>
              <p className="text-gray-500 text-[13px] mb-5">Deploy with your preferred operating system in seconds.</p>
              <div className="grid grid-cols-2 gap-2.5">
                {(osTemplates.length > 0 ? osTemplates : [
                  { id: "u22", name: "Ubuntu",         version: "22.04 LTS",   iconUrl: "https://cdn.simpleicons.org/ubuntu/E95420" },
                  { id: "deb", name: "Debian",         version: "12 Bookworm", iconUrl: "https://cdn.simpleicons.org/debian/A81D33" },
                  { id: "al9", name: "AlmaLinux",      version: "9",           iconUrl: "https://cdn.simpleicons.org/almalinux/ACE3B0" },
                  { id: "win", name: "Windows Server", version: "2022",        iconUrl: "https://cdn.simpleicons.org/windows/0078D4" },
                ]).slice(0, 12).map(os => (
                  <div key={os.id} className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl px-3 py-2.5 text-[12.5px] font-medium text-gray-700 hover:border-purple-200 transition-colors">
                    {os.iconUrl ? (
                      <img src={os.iconUrl} alt={os.name} className="w-5 h-5 object-contain shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}/>
                    ) : (
                      <span className="text-[16px]">🐧</span>
                    )}
                    <span className="truncate">{os.name} {os.version}</span>
                  </div>
                ))}
              </div>
              {osTemplates.length > 12 && (
                <p className="text-[11px] text-gray-400 mt-2">+ {osTemplates.length - 12} more OS templates available</p>
              )}
            </div>

            {/* Locations */}
            <div>
              <h3 className="text-[20px] font-extrabold text-gray-900 mb-2">
                {locations.length > 0 ? `${locations.length} Global Locations` : "Global Locations"}
              </h3>
              <p className="text-gray-500 text-[13px] mb-5">Pick the data center closest to your audience.</p>
              <div className="grid grid-cols-1 gap-2.5">
                {(locations.length > 0 ? locations : [
                  { id: "us", countryName: "United States", countryCode: "US", flagIcon: "🇺🇸", city: "New York", datacenter: "Equinix NY5", networkSpeed: "10 Gbps" },
                  { id: "gb", countryName: "United Kingdom", countryCode: "GB", flagIcon: "🇬🇧", city: "London",   datacenter: "Telehouse North", networkSpeed: "10 Gbps" },
                  { id: "de", countryName: "Germany",        countryCode: "DE", flagIcon: "🇩🇪", city: "Frankfurt",datacenter: "DE-CIX Frankfurt", networkSpeed: "10 Gbps" },
                  { id: "sg", countryName: "Singapore",      countryCode: "SG", flagIcon: "🇸🇬", city: "Singapore",datacenter: "Equinix SG1", networkSpeed: "10 Gbps" },
                ]).slice(0, 9).map(loc => (
                  <div key={loc.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-purple-200 transition-colors">
                    <span className="text-[22px] shrink-0">{loc.flagIcon ?? "🌍"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-gray-800">{loc.countryName}</div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {loc.city && <span>{loc.city}</span>}
                        {loc.city && loc.datacenter && <span className="mx-1">·</span>}
                        {loc.datacenter && <span>{loc.datacenter}</span>}
                      </div>
                    </div>
                    {loc.networkSpeed && (
                      <span className="text-[10.5px] font-bold text-purple-500 shrink-0">{loc.networkSpeed}</span>
                    )}
                  </div>
                ))}
                {locations.length > 9 && (
                  <p className="text-[11px] text-gray-400 px-1">+ {locations.length - 9} more locations available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Frequently Asked Questions</h2>
            <p className="text-gray-400 text-[14px]">Everything you need to know about our VPS hosting.</p>
          </div>
          <div className="space-y-3">
            {VPS_FAQS.map((faq, i) => (
              <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden">
                <button className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span className="text-[14px] font-semibold text-gray-800">{faq.q}</span>
                  <ChevronDown size={16} className="shrink-0 text-gray-400 transition-transform"
                    style={{ transform: openFaq === i ? "rotate(180deg)" : "none" }}/>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <p className="px-5 pb-4 text-[13px] text-gray-500 leading-relaxed">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-20 px-4 sm:px-6"
        style={{ background: "linear-gradient(135deg, #1A0060 0%, #2C007A 50%, #1A0060 100%)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-[12px] font-bold text-purple-200"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <Cloud size={11}/> Instant Provisioning
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 leading-tight">
            Ready to Take Full Control?
          </h2>
          <p className="text-purple-200 text-[16px] mb-8">
            Deploy your VPS in minutes. No contracts. Scale as you grow.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#plans">
              <button className="px-8 py-4 rounded-2xl text-[15px] font-extrabold text-white"
                style={{ background: P, boxShadow: "0 8px 32px rgba(112,26,254,0.5)" }}>
                View Plans <ArrowRight size={16} className="inline ml-1.5"/>
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-950 py-10 px-4 sm:px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: P }}>
            <Server size={14} className="text-white"/>
          </div>
          <span className="text-[14px] font-bold text-white">Nexgohost</span>
        </div>
        <p className="text-gray-500 text-[12px]">© {new Date().getFullYear()} Nexgohost. All rights reserved.</p>
      </footer>
    </div>
  );
}
