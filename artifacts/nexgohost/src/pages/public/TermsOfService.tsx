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
    // inline bold
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
  header: { title: "Terms of Service", lastUpdated: "27 March 2026" },
  content: {
    body: `By accessing or using Noehost's services, you agree to be bound by these Terms of Service.

## 1. Account Responsibility
You are responsible for maintaining the security of your account credentials. Any activities under your account are your responsibility. Notify us immediately of any unauthorized access.

## 2. Acceptable Use
You agree not to use our services for:
- Sending spam or unsolicited email
- Hosting malware, phishing pages, or illegal content
- Violating any applicable laws or regulations
- Overloading shared server resources

## 3. Payment & Billing
All prices are listed in Pakistani Rupees (PKR). Payment is due at the time of order. Services are not activated until payment is confirmed. Invoices must be paid by their due date to avoid service interruption.

## 4. Refund Policy
Hosting plans include a 30-day money-back guarantee. Domain registrations are non-refundable. Renewal payments are non-refundable.

## 5. Service Availability
We target 99.9% uptime. Scheduled maintenance will be announced in advance. We are not liable for losses due to downtime beyond our control.

## 6. Data & Backups
You are solely responsible for maintaining your own backups. We strongly recommend backing up all website data and databases regularly.

## 7. Termination
We reserve the right to suspend or terminate accounts that violate these terms without prior notice.

## 8. Changes
We may update these terms at any time. Continued use of our services constitutes acceptance of the revised terms.

## 9. Contact
For any questions: support@noehost.com`,
  },
};

export default function TermsOfService() {
  const [sections, setSections] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pages/terms", { cache: "no-store" })
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
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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
          <Link href="/legal/privacy" className="text-violet-600 hover:underline">Privacy Policy</Link>
          <span>·</span>
          <Link href="/legal/refund" className="text-violet-600 hover:underline">Refund Policy</Link>
          <span>·</span>
          <Link href="/client/login" className="text-violet-600 hover:underline">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
