import { Link } from "wouter";

const COMPANY = "Noehost";
const DOMAIN = "noehost.com";
const EMAIL = "support@noehost.com";
const WA = "https://wa.me/923151711821";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)" }} className="py-14 px-4 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            </div>
            <h1 className="text-3xl font-bold">{COMPANY} Terms of Service</h1>
          </div>
          <p className="text-white/80 text-sm">Last updated: 27 March 2026 &nbsp;·&nbsp; Effective immediately</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-slate max-w-none">

          <section className="mb-8">
            <p className="text-gray-600 leading-relaxed">
              Welcome to <strong>{COMPANY}</strong> ({DOMAIN}). By registering an account, placing an order, or using any of our services, you agree to be bound by these Terms of Service ("Terms"). Please read them carefully before proceeding. If you do not agree to these Terms, you may not use our services.
            </p>
          </section>

          {[
            {
              title: "1. Services",
              body: `${COMPANY} provides web hosting, domain registration, VPS hosting, and related digital services ("Services") to clients in Pakistan and worldwide. We reserve the right to modify, suspend, or discontinue any Service at any time, with reasonable notice where possible. Service features, pricing, and availability may change over time.`
            },
            {
              title: "2. Account Registration & Eligibility",
              body: `You must be at least 18 years old to create an account. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to provide accurate, current, and complete information during registration and to update it as necessary. ${COMPANY} reserves the right to terminate accounts found to contain false or misleading information.`
            },
            {
              title: "3. Acceptable Use",
              body: `You agree not to use ${COMPANY} Services for any unlawful, abusive, or harmful purposes, including but not limited to: hosting malware, phishing sites, spam operations, hacking tools, or illegal content. Any violation may result in immediate suspension or termination of your account without refund. We cooperate fully with law enforcement authorities when required by applicable law.`
            },
            {
              title: "4. Payment & Billing",
              body: `All prices are listed in Pakistani Rupees (PKR). Payment is due at the time of order. We accept payments via bank transfer, JazzCash, EasyPaisa, Safepay, PayPal, and cryptocurrency. Services are not activated until payment is confirmed by our team. Invoices must be paid by their due date to avoid service interruption. ${COMPANY} is not liable for any bank fees, exchange rate differences, or third-party payment processor charges.`
            },
            {
              title: "5. Renewals & Service Continuity",
              body: `Hosting and domain services are billed on a recurring basis (monthly, quarterly, semi-annual, or annual). It is your responsibility to renew services before their expiry date. ${COMPANY} will send renewal reminder emails to your registered address. Failure to renew on time may result in service suspension, and domain names may be released to the public registry after the grace period.`
            },
            {
              title: "6. Refunds",
              body: `Please refer to our Refund Policy for full details. In general, domain registration fees are non-refundable once processed. Hosting plans may be eligible for a prorated refund within 7 days of activation, subject to the terms of our Refund Policy.`
            },
            {
              title: "7. Uptime & Service Levels",
              body: `${COMPANY} strives to maintain 99.9% uptime for shared hosting services. Scheduled maintenance, emergency fixes, or circumstances beyond our control (force majeure) may result in downtime. ${COMPANY} does not guarantee uninterrupted or error-free service and is not liable for losses caused by service interruptions.`
            },
            {
              title: "8. Data & Backups",
              body: `While ${COMPANY} may perform routine backups, you are solely responsible for maintaining your own backups. We strongly recommend backing up all website data, databases, and email regularly. ${COMPANY} does not guarantee the availability or integrity of backup data and is not liable for data loss.`
            },
            {
              title: "9. Intellectual Property",
              body: `All content, trademarks, logos, and materials on ${DOMAIN} are the property of ${COMPANY} or its licensors. You may not reproduce, distribute, or create derivative works without express written permission. You retain ownership of content you upload to your hosting account.`
            },
            {
              title: "10. Limitation of Liability",
              body: `${COMPANY}'s total liability to you for any claim arising from use of our Services shall not exceed the amount you paid for the affected Service in the 30 days preceding the claim. ${COMPANY} is not liable for indirect, incidental, consequential, or punitive damages of any kind, including loss of data, revenue, or profits.`
            },
            {
              title: "11. Privacy",
              body: `Your use of our Services is also governed by our Privacy Policy, which is incorporated into these Terms by reference. Please review our Privacy Policy to understand our practices.`
            },
            {
              title: "12. Changes to Terms",
              body: `${COMPANY} may update these Terms at any time. We will notify you via email or a notice on our website. Continued use of our Services after changes take effect constitutes your acceptance of the revised Terms.`
            },
            {
              title: "13. Governing Law",
              body: `These Terms are governed by and construed in accordance with the laws of the Islamic Republic of Pakistan. Any disputes shall be subject to the exclusive jurisdiction of the courts of Pakistan.`
            },
            {
              title: "14. Contact Us",
              body: null,
              contact: true,
            },
          ].map((section, i) => (
            <section key={i} className="mb-7">
              <h2 className="text-lg font-bold text-gray-900 mb-2">{section.title}</h2>
              {section.body && <p className="text-gray-600 leading-relaxed text-sm">{section.body}</p>}
              {section.contact && (
                <p className="text-gray-600 leading-relaxed text-sm">
                  For questions about these Terms, please contact us at{" "}
                  <a href={`mailto:${EMAIL}`} className="text-violet-600 underline">{EMAIL}</a>
                  {" "}or via{" "}
                  <a href={WA} target="_blank" rel="noopener noreferrer" className="text-green-600 underline">WhatsApp</a>.
                </p>
              )}
            </section>
          ))}
        </div>

        {/* Footer nav */}
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
