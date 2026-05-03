import { Link } from "wouter";
import { useEffect, useState } from "react";

function renderMarkdown(body: string): React.ReactNode[] {
  return body.split("\n").map((line, i) => {
    if (line.startsWith("## ")) {
      return <h2 key={i} className="text-lg font-bold text-gray-900 mt-6 mb-2">{line.slice(3)}</h2>;
    }
    if (line.startsWith("# ")) {
      return <h1 key={i} className="text-2xl font-bold text-gray-900 mt-6 mb-3">{line.slice(2)}</h1>;
    }
    if (line.trim() === "") return <br key={i} />;
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-gray-600 leading-relaxed text-sm mb-1">
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    );
  });
}

const HARDCODED_SECTIONS = {
  header: { title: "Privacy Policy", lastUpdated: "27 March 2026" },
  content: {
    body: `At Noehost, we are committed to protecting your personal information.

## 1. Information We Collect
- Account information: name, email address, phone number, billing address
- Payment information: bank transfer references, transaction IDs (we do not store card numbers)
- Technical information: IP address, browser type, device information
- Domain WHOIS data required by domain registries
- Support communications: tickets and messages you send us

## 2. How We Use Your Information
- To provision and manage your hosting and domain services
- To process payments and send invoices
- To communicate service updates and renewal reminders
- To detect and prevent fraud and unauthorized access
- To comply with legal obligations

## 3. Data Sharing
We do not sell your personal data. We share data only with partners necessary to deliver our services (domain registries, payment processors, server providers).

## 4. Data Security
We use industry-standard encryption and security practices to protect your data.

## 5. Your Rights
You may request access to, correction of, or deletion of your personal data by contacting us at support@noehost.com.

## 6. Cookies
We use essential cookies for login sessions. No third-party tracking cookies are used.

## 7. Changes
We may update this policy. Continued use of our services constitutes acceptance of changes.

## 8. Contact
For privacy questions: support@noehost.com`,
  },
};

export default function PrivacyPolicy() {
  const [sections, setSections] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pages/privacy", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.sections) setSections(data.sections);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const header = sections?.header?.isVisible !== false
    ? (sections?.header?.content ?? HARDCODED_SECTIONS.header)
    : HARDCODED_SECTIONS.header;

  const contentData = sections?.content?.isVisible !== false
    ? (sections?.content?.content ?? HARDCODED_SECTIONS.content)
    : HARDCODED_SECTIONS.content;

  const meta = sections?.meta?.content;
  if (meta?.title && typeof document !== "undefined") {
    document.title = meta.title;
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)" }} className="py-14 px-4 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold">{header.title}</h1>
          </div>
          <p className="text-white/80 text-sm">Last updated: {header.lastUpdated} &nbsp;·&nbsp; Effective immediately</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-slate max-w-none">
          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>
          ) : (
            renderMarkdown(contentData.body ?? "")
          )}
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-wrap gap-4 justify-center text-sm text-gray-500">
          <Link href="/legal/terms" className="text-violet-600 hover:underline">Terms of Service</Link>
          <span>·</span>
          <Link href="/legal/refund" className="text-violet-600 hover:underline">Refund Policy</Link>
          <span>·</span>
          <Link href="/client/login" className="text-violet-600 hover:underline">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
