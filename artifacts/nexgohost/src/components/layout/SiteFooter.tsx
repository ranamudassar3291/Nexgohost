import { Link } from "wouter";
import { Server, Twitter, Github, Linkedin } from "lucide-react";

const footerLinks = [
  {
    title: "HOSTING",
    links: [
      { label: "Shared Hosting",    href: "/order" },
      { label: "WordPress Hosting", href: "/order" },
      { label: "VPS Hosting",       href: "/vps-hosting" },
      { label: "Reseller Hosting",  href: "/order" },
    ],
  },
  {
    title: "COMPANY",
    links: [
      { label: "About Noehost",     href: "/about-us" },
      { label: "Contact Us",        href: "/contact" },
      { label: "Affiliate Program", href: "#" },
      { label: "Partner with Us",   href: "#" },
    ],
  },
  {
    title: "LEGAL",
    links: [
      { label: "Privacy Policy",     href: "/legal/privacy" },
      { label: "Terms & Conditions", href: "/legal/terms" },
      { label: "Refund Policy",      href: "/legal/refund" },
      { label: "Cookie Policy",      href: "#" },
      { label: "SLA",                href: "#" },
    ],
  },
  {
    title: "SUPPORT",
    links: [
      { label: "Knowledge Base",    href: "#" },
      { label: "System Status",     href: "/status" },
      { label: "Billing Support",   href: "/contact" },
      { label: "Technical Support", href: "/contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-[#0F172A] text-white pt-24 pb-12">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-20">
          {/* Brand Column */}
          <div className="lg:col-span-1 space-y-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                <Server size={20} />
              </div>
              <span className="text-xl font-black tracking-tighter text-white">NOEHOST</span>
            </Link>
            <p className="text-slate-500 text-sm leading-relaxed font-medium">
              Noehost is a world-class web hosting provider. We provide a wide range of services, from shared hosting to VPS and cloud solutions.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all text-slate-400">
                <Twitter size={18} />
              </a>
              <a href="#" className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all text-slate-400">
                <Github size={18} />
              </a>
              <a href="#" className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all text-slate-400">
                <Linkedin size={18} />
              </a>
            </div>
          </div>

          {/* Link Columns */}
          {footerLinks.map((column) => (
            <div key={column.title}>
              <h4 className="text-xs font-black text-white uppercase tracking-widest mb-8">{column.title}</h4>
              <ul className="space-y-4">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href === "#" ? (
                      <a href="#" className="text-slate-500 hover:text-primary text-sm font-bold transition-colors">{link.label}</a>
                    ) : (
                      <Link href={link.href} className="text-slate-500 hover:text-primary text-sm font-bold transition-colors">{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <p className="text-slate-600 text-xs font-bold">
              © {new Date().getFullYear()} Noehost. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:border-white/25 transition-all">
                <svg viewBox="0 0 60 20" width="42" height="14" aria-label="Visa">
                  <text x="0" y="16" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="18" fill="#ffffff" letterSpacing="-0.5">VISA</text>
                </svg>
              </div>
              <div className="flex items-center justify-center px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:border-white/25 transition-all">
                <svg viewBox="0 0 38 24" width="36" height="22" aria-label="Mastercard">
                  <circle cx="14" cy="12" r="10" fill="#EB001B" />
                  <circle cx="24" cy="12" r="10" fill="#F79E1B" />
                  <path d="M19 5.3a10 10 0 0 1 0 13.4A10 10 0 0 1 19 5.3z" fill="#FF5F00" />
                </svg>
              </div>
              <div className="flex items-center justify-center px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:border-white/25 transition-all">
                <svg viewBox="0 0 72 20" width="52" height="16" aria-label="PayPal">
                  <text x="0" y="15" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="14" fill="#009cde">Pay</text>
                  <text x="26" y="15" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="14" fill="#aad4f5">Pal</text>
                </svg>
              </div>
              <div className="flex items-center justify-center px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:border-white/25 transition-all">
                <svg viewBox="0 0 52 18" width="44" height="14" aria-label="Amex">
                  <text x="0" y="14" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="12" fill="#60aaee" letterSpacing="0.5">AMEX</text>
                </svg>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs font-black text-slate-600 uppercase tracking-widest">
            <Link href="/contact"       className="hover:text-white transition-colors">Support</Link>
            <Link href="/about-us"      className="hover:text-white transition-colors">About</Link>
            <Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/legal/terms"   className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
