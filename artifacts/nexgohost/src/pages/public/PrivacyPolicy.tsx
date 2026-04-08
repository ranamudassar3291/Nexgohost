import { Link } from "wouter";


const COMPANY = "Noehost";
const DOMAIN = "noehost.com";
const EMAIL = "support@noehost.com";
const WA = "https://wa.me/923151711821";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)" }} className="py-14 px-4 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            </div>
            <h1 className="text-3xl font-bold">{COMPANY} Privacy Policy</h1>
          </div>
          <p className="text-white/80 text-sm">Last updated: 27 March 2026 &nbsp;·&nbsp; Effective immediately</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-slate max-w-none">

          <section className="mb-8">
            <p className="text-gray-600 leading-relaxed">
              At <strong>{COMPANY}</strong>, we are committed to protecting your personal information. This Privacy Policy explains what data we collect, how we use it, and the choices you have. By using our Services, you consent to the practices described here.
            </p>
          </section>

          {[
            {
              title: "1. Information We Collect",
              items: [
                "Account information: name, email address, phone number, billing address.",
                "Payment information: bank transfer references, JazzCash/EasyPaisa transaction IDs. We do not store card numbers or PINs.",
                "Technical information: IP address, browser type, device information, and usage logs for security and fraud prevention.",
                "Domain WHOIS data: name, address, and contact information required by domain registries.",
                "Support communications: emails, tickets, and WhatsApp messages you send us.",
              ]
            },
            {
              title: "2. How We Use Your Information",
              items: [
                "To provision, manage, and support your hosting and domain services.",
                "To process payments and send invoices.",
                "To communicate important service updates, renewal reminders, and promotional offers.",
                "To detect and prevent fraud, abuse, and unauthorised access.",
                "To comply with legal obligations and cooperate with law enforcement where required.",
              ]
            },
            {
              title: "3. Data Sharing",
              items: [
                "We do not sell your personal data to third parties.",
                "We share data only with trusted partners necessary to deliver our Services (e.g., domain registries, payment processors, server infrastructure providers).",
                "We may disclose data when required by law, court order, or government authority.",
              ]
            },
            {
              title: "4. Cookies & Tracking",
              items: [
                "We use session cookies to keep you logged in and to remember your preferences.",
                "We may use analytics tools to understand how our website is used. This data is aggregated and not linked to your personal identity.",
                "You can disable cookies in your browser settings, but this may limit functionality.",
              ]
            },
            {
              title: "5. Data Retention",
              items: [
                "Account data is retained for as long as your account is active and for up to 5 years after closure for legal and compliance purposes.",
                "Payment records are retained for a minimum of 5 years as required by Pakistani financial regulations.",
                "Support communications are retained for 2 years.",
              ]
            },
            {
              title: "6. Data Security",
              items: [
                "We implement industry-standard security measures, including encryption (TLS) for data in transit and access controls for data at rest.",
                "Despite our best efforts, no system is 100% secure. Please use strong, unique passwords for your account.",
                "Report any suspected security issues to support@noehost.com immediately.",
              ]
            },
            {
              title: "7. Your Rights",
              items: [
                "Access: You may request a copy of the personal data we hold about you.",
                "Correction: You may update your account information at any time from your client area.",
                "Deletion: You may request deletion of your account and associated data, subject to legal retention requirements.",
                "Objection: You may opt out of marketing emails by clicking the unsubscribe link in any email we send.",
              ]
            },
            {
              title: "8. Children's Privacy",
              items: [
                `Our Services are not directed to children under 18. If we become aware that we have inadvertently collected data from a child, we will delete it promptly.`,
              ]
            },
            {
              title: "9. Changes to This Policy",
              items: [
                "We may update this Privacy Policy from time to time. We will notify you via email or a prominent notice on our website.",
                "Continued use of our Services after updates constitutes acceptance of the revised Policy.",
              ]
            },
          ].map((section, i) => (
            <section key={i} className="mb-7">
              <h2 className="text-lg font-bold text-gray-900 mb-2">{section.title}</h2>
              <ul className="list-disc list-outside pl-5 space-y-1">
                {section.items.map((item, j) => (
                  <li key={j} className="text-gray-600 text-sm leading-relaxed">{item}</li>
                ))}
              </ul>
            </section>
          ))}

          <section className="mb-7">
            <h2 className="text-lg font-bold text-gray-900 mb-2">10. Contact Us</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              For privacy-related enquiries, contact us at{" "}
              <a href={`mailto:${EMAIL}`} className="text-violet-600 underline">{EMAIL}</a>
              {" "}or via{" "}
              <a href={WA} target="_blank" rel="noopener noreferrer" className="text-green-600 underline">WhatsApp</a>.
            </p>
          </section>
        </div>

        {/* Footer nav */}
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
