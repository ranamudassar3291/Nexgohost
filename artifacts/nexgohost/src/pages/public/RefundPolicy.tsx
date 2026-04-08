import { Link } from "wouter";


const COMPANY = "Noehost";
const DOMAIN = "noehost.com";
const EMAIL = "support@noehost.com";
const WA = "https://wa.me/923151711821";

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)" }} className="py-14 px-4 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
            </div>
            <h1 className="text-3xl font-bold">{COMPANY} Refund Policy</h1>
          </div>
          <p className="text-white/80 text-sm">Last updated: 27 March 2026 &nbsp;·&nbsp; Effective immediately</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-slate max-w-none">

          <section className="mb-8">
            <p className="text-gray-600 leading-relaxed">
              At <strong>{COMPANY}</strong>, we want you to be satisfied with your purchase. This Refund Policy outlines the conditions under which refunds may be granted. Please read it carefully before placing an order.
            </p>
          </section>

          {/* Highlight box */}
          <div className="bg-violet-50 border border-violet-200 border-l-4 border-l-violet-600 rounded-xl p-5 mb-8">
            <p className="text-violet-800 font-semibold text-sm mb-1">Quick Summary</p>
            <ul className="text-violet-700 text-sm space-y-1 list-disc list-outside pl-4">
              <li>Shared Hosting: 7-day money-back guarantee from activation date.</li>
              <li>Domain Names: Non-refundable once registered or transferred.</li>
              <li>VPS / Dedicated: Non-refundable after provisioning.</li>
              <li>Prorated refunds are available for annual plans cancelled after the 7-day window.</li>
            </ul>
          </div>

          {[
            {
              title: "1. Shared Hosting — 7-Day Money-Back Guarantee",
              body: `New shared hosting accounts are eligible for a full refund if requested within 7 calendar days of service activation. After the 7-day window, no refunds are issued for the current billing cycle. For annual plans cancelled after 7 days, a prorated refund (minus any setup fees and the used period) may be considered at ${COMPANY}'s discretion.`
            },
            {
              title: "2. Domain Names — Non-Refundable",
              body: `Domain registration, transfer, and renewal fees are non-refundable in all cases. Once a domain name has been registered or transferred, we cannot recover the registration fee from the domain registry. This applies to all TLDs including .com, .pk, .net, .org, and all others.`
            },
            {
              title: "3. VPS & Dedicated Servers — Non-Refundable",
              body: `VPS hosting and dedicated server plans are non-refundable once the service has been provisioned. Please ensure you have reviewed the plan specifications and requirements before placing your order. We recommend contacting our sales team with questions before purchasing.`
            },
            {
              title: "4. Prorated Refunds",
              body: `For annual or multi-month hosting plans cancelled after the 7-day money-back window, ${COMPANY} may issue a prorated refund for the unused full months remaining on the plan, minus any applicable discounts used or one-time setup fees. Prorated refunds are issued as account credits by default and may be transferred to your bank account upon request.`
            },
            {
              title: "5. Non-Refundable Items",
              body: `The following are not eligible for refunds under any circumstances: domain registrations and renewals, SSL certificates once issued, WhatsApp notification services, SMS credits, one-time setup/migration fees, and any service suspended for Terms of Service violations.`
            },
            {
              title: "6. How to Request a Refund",
              body: `To request a refund, open a support ticket in your client area or email us at support@noehost.com within the eligible window. Include your invoice number and a brief reason for the request. Refunds are processed within 5–10 business days to your original payment method or as account credit.`
            },
            {
              title: "7. Payment Method Considerations",
              body: `Refunds are typically issued via the same method used for payment (bank transfer, JazzCash, EasyPaisa). Cryptocurrency and international wire payments may incur additional processing delays. ${COMPANY} is not responsible for fees charged by your bank or payment processor when processing a refund.`
            },
            {
              title: "8. Chargebacks",
              body: `Initiating a chargeback or payment dispute without first contacting ${COMPANY} support will result in immediate account suspension pending investigation. If the chargeback is found to be fraudulent, ${COMPANY} reserves the right to pursue legal remedies available under Pakistani law.`
            },
            {
              title: "9. Changes to This Policy",
              body: `${COMPANY} reserves the right to modify this Refund Policy at any time. Changes will be communicated via email and posted on ${DOMAIN}. Orders placed before a policy change are subject to the terms in effect at the time of purchase.`
            },
          ].map((section, i) => (
            <section key={i} className="mb-7">
              <h2 className="text-lg font-bold text-gray-900 mb-2">{section.title}</h2>
              <p className="text-gray-600 leading-relaxed text-sm">{section.body}</p>
            </section>
          ))}

          <section className="mb-7">
            <h2 className="text-lg font-bold text-gray-900 mb-2">10. Contact Us</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              For refund requests or questions about this policy, contact us at{" "}
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
          <Link href="/legal/privacy" className="text-violet-600 hover:underline">Privacy Policy</Link>
          <span>·</span>
          <Link href="/client/login" className="text-violet-600 hover:underline">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
