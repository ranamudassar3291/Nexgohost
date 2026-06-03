import { Link } from "wouter";

const COMPANY = "Noehost (Pvt.) Ltd.";
const DOMAIN = "noehost.com";
const EMAIL = "support@noehost.com";
const BILLING_EMAIL = "billing@noehost.com";
const WA = "https://wa.me/923151711821";
const EFFECTIVE = "June 2, 2026";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10">
      <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
        <span className="w-1 h-5 rounded-full bg-violet-600 inline-block" />
        {title}
      </h2>
      <div className="text-gray-600 text-sm leading-relaxed space-y-2 pl-3">{children}</div>
    </section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="text-violet-500 mt-1 flex-shrink-0">•</span>
      <span>{children}</span>
    </li>
  );
}

function StatusBadge({ eligible }: { eligible: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${eligible ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      <span>{eligible ? "✓" : "✗"}</span>
      {eligible ? "Eligible for Refund" : "Non-Refundable"}
    </span>
  );
}

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 overflow-x-hidden">

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)" }} className="py-16 px-4 text-white text-center">
        <div className="max-w-4xl mx-auto">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(255,255,255,0.15)" }}>
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold mb-3">Refund Policy</h1>
          <p className="text-white/80 text-sm max-w-xl mx-auto">
            We want you to be completely satisfied with our services. Please read our refund terms carefully before making a purchase.
          </p>
          <div className="flex items-center justify-center gap-6 mt-5 text-xs text-white/70 flex-wrap">
            <span>Effective: {EFFECTIVE}</span>
            <span className="w-1 h-1 rounded-full bg-white/40" />
            <span>Pakistan Law Compliant</span>
            <span className="w-1 h-1 rounded-full bg-white/40" />
            <span>Processed within 5–10 Business Days</span>
          </div>
        </div>
      </div>

      {/* Quick Reference Table */}
      <div className="max-w-4xl mx-auto px-4 -mt-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Reference — Refund Eligibility</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">Service</th>
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">Refund Window</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  ["Shared Web Hosting (new account)", "7 calendar days from activation", true],
                  ["WordPress Hosting (new account)", "7 calendar days from activation", true],
                  ["Reseller Hosting (new account)", "7 calendar days from activation", true],
                  ["Annual Plans (post 7-day window)", "Pro-rated unused months (at discretion)", true],
                  ["Domain Registration / Transfer", "Non-refundable (registry fees paid)", false],
                  ["Domain Renewal", "Non-refundable", false],
                  ["VPS / Cloud Server", "Non-refundable after provisioning", false],
                  ["Dedicated Server", "Non-refundable after provisioning", false],
                  ["SSL Certificate", "Non-refundable once issued", false],
                  ["Email Hosting", "7 calendar days from activation", true],
                  ["Setup / Migration Fees", "Non-refundable", false],
                  ["Renewal Payments", "Non-refundable", false],
                ].map(([service, window, eligible], i) => (
                  <tr key={i} className="text-sm">
                    <td className="py-2.5 pr-4 text-gray-800 font-medium">{service as string}</td>
                    <td className="py-2.5 pr-4 text-gray-500">{window as string}</td>
                    <td className="py-2.5"><StatusBadge eligible={eligible as boolean} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">

          {/* Intro */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-10 text-sm text-blue-800">
            <strong>Important Notice:</strong> This Refund Policy forms part of our <Link href="/terms-and-conditions" className="underline">Terms &amp; Conditions</Link> and constitutes a binding agreement between you and {COMPANY}. By placing an order on {DOMAIN}, you confirm that you have read and agreed to this policy.
          </div>

          <Section id="overview" title="1. Overview & Scope">
            <p>This Refund Policy ("Policy") applies to all services purchased from <strong>{COMPANY}</strong> ("Noehost," "we," "us") through our website {DOMAIN} or client portal. It outlines the conditions under which customers ("you," "Client") are eligible for refunds, the process for requesting refunds, and the timelines for processing.</p>
            <p>All refund requests are evaluated on a case-by-case basis in accordance with this Policy. Noehost reserves the right to refuse refund requests that do not meet the eligibility criteria outlined below.</p>
            <p>This policy complies with applicable Pakistani consumer protection laws and State Bank of Pakistan (SBP) guidelines governing electronic payments and consumer rights.</p>
          </Section>

          <Section id="hosting" title="2. Shared & WordPress Hosting — 7-Day Money-Back Guarantee">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 my-3">
              <p className="text-green-800 font-semibold text-sm">7-Day Money-Back Guarantee</p>
              <p className="text-green-700 text-sm mt-1">New shared hosting and WordPress hosting accounts are covered by a full 7-day money-back guarantee, no questions asked.</p>
            </div>
            <ul className="space-y-1">
              <Li>The 7-day window begins at the moment of service activation (not order placement).</Li>
              <Li>Refund requests must be submitted within 7 calendar days of activation. Requests received on day 8 or later will not be eligible.</Li>
              <Li>The full amount paid will be refunded, minus any domain registration fees included in the package (domains are non-refundable).</Li>
              <Li>This guarantee applies to first-time purchases only. Accounts that have previously received a refund from Noehost are not eligible for a second money-back guarantee.</Li>
              <Li>Accounts suspended for policy violations are not eligible for the money-back guarantee.</Li>
            </ul>
            <p className="mt-2 font-semibold text-gray-800">After the 7-Day Window (Monthly Plans):</p>
            <ul className="space-y-1">
              <Li>No refunds are issued for the current billing cycle once the 7-day window has passed.</Li>
              <Li>Cancellations after the 7-day window take effect at the end of the current billing period.</Li>
            </ul>
            <p className="mt-2 font-semibold text-gray-800">After the 7-Day Window (Annual Plans):</p>
            <ul className="space-y-1">
              <Li>A pro-rated refund for unused complete months may be considered at Noehost's sole discretion.</Li>
              <Li>The refund amount, if approved, will be calculated as: (Total Paid ÷ 12 months) × Remaining Full Months — minus any setup fees, domain fees, or discounts applied.</Li>
              <Li>Pro-rated refunds are issued as account credits by default. Transfer to original payment method is available upon request.</Li>
            </ul>
          </Section>

          <Section id="reseller" title="3. Reseller Hosting">
            <ul className="space-y-1">
              <Li>New reseller hosting accounts are eligible for a 7-day money-back guarantee from the date of service activation.</Li>
              <Li>Refund requests must be submitted within 7 calendar days of activation.</Li>
              <Li>No refunds for any sub-accounts or client accounts provisioned under the reseller account.</Li>
              <Li>After the 7-day window, no refunds are issued for the current billing cycle.</Li>
            </ul>
          </Section>

          <Section id="domain" title="4. Domain Names — Non-Refundable">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 my-3">
              <p className="text-red-800 font-semibold text-sm">Domain Fees Are Non-Refundable</p>
              <p className="text-red-700 text-sm mt-1">Once a domain is registered or transferred, the registry fee is immediately paid to the domain registry and cannot be recovered.</p>
            </div>
            <ul className="space-y-1">
              <Li>Domain registration fees are fully non-refundable once the domain has been successfully registered.</Li>
              <Li>Domain transfer fees are non-refundable once the transfer process has been initiated.</Li>
              <Li>Domain renewal fees are non-refundable once the renewal has been processed.</Li>
              <Li>This applies to all top-level domains (TLDs) including .com, .net, .org, .pk, .com.pk, .net.pk, .edu.pk, .gov.pk, .info, .biz, and all country-code TLDs.</Li>
              <Li>If a domain registration fails for technical reasons on our end, a full refund will be issued for the domain fee.</Li>
            </ul>
            <p className="mt-2">This policy is consistent with ICANN regulations and PKNIC (Pakistan Network Information Centre) domain registration policies, which prohibit domain fee refunds after registration.</p>
          </Section>

          <Section id="vps" title="5. VPS, Cloud & Dedicated Servers — Non-Refundable">
            <ul className="space-y-1">
              <Li>VPS hosting, cloud servers, and dedicated server plans are non-refundable once the server has been provisioned and activated.</Li>
              <Li>Provisioning typically occurs within 1–4 hours of payment confirmation.</Li>
              <Li>We strongly recommend reviewing all plan specifications, hardware requirements, and technical details with our sales team before placing an order.</Li>
              <Li>If provisioning fails due to a technical error on our end and we are unable to deliver the ordered service, a full refund will be issued.</Li>
              <Li>Upgrade and downgrade fees between VPS plans are non-refundable.</Li>
            </ul>
          </Section>

          <Section id="ssl" title="6. SSL Certificates — Non-Refundable">
            <ul className="space-y-1">
              <Li>SSL/TLS certificate fees are non-refundable once the certificate has been issued by the Certificate Authority (CA).</Li>
              <Li>Free Let's Encrypt SSL certificates provided with hosting plans are included at no charge and are not subject to refund.</Li>
              <Li>If an SSL certificate cannot be issued due to an error on our end, a full refund of the certificate fee will be provided.</Li>
            </ul>
          </Section>

          <Section id="email" title="7. Email Hosting">
            <ul className="space-y-1">
              <Li>New email hosting accounts are eligible for a 7-day money-back guarantee from activation.</Li>
              <Li>After the 7-day window, email hosting fees for the current billing cycle are non-refundable.</Li>
            </ul>
          </Section>

          <Section id="nonrefundable" title="8. Non-Refundable Items (All Circumstances)">
            <p>The following services and fees are strictly non-refundable under any circumstances:</p>
            <ul className="space-y-1">
              <Li>Domain registration, transfer, and renewal fees</Li>
              <Li>SSL certificate fees (once issued)</Li>
              <Li>VPS and dedicated server fees (once provisioned)</Li>
              <Li>One-time setup fees and account migration fees</Li>
              <Li>WhatsApp notification service credits</Li>
              <Li>SMS credits and notification service fees</Li>
              <Li>Any service that has been suspended or terminated due to violation of our Terms &amp; Conditions or Acceptable Use Policy</Li>
              <Li>Renewal payments for any service</Li>
              <Li>Promotional or discounted services where the promotional terms exclude refunds</Li>
              <Li>Services purchased during a special offer where refund exclusion was noted at checkout</Li>
            </ul>
          </Section>

          <Section id="process" title="9. How to Request a Refund">
            <p>To submit a refund request, follow these steps:</p>
            <div className="mt-3 space-y-4">
              {[
                {
                  step: "Step 1",
                  title: "Submit a Refund Request",
                  desc: `Open a support ticket in your client portal at ${DOMAIN}/client/login and select "Billing & Refunds" as the department. Alternatively, email ${BILLING_EMAIL} with the subject line: "Refund Request — [Your Invoice Number]".`,
                },
                {
                  step: "Step 2",
                  title: "Provide Required Information",
                  desc: "Include in your request: your full name, registered email address, invoice number, service name, date of purchase, and a brief reason for the refund request.",
                },
                {
                  step: "Step 3",
                  title: "Review & Verification",
                  desc: "Our billing team will review your request within 2–3 business days and verify eligibility. We may contact you for additional information if needed.",
                },
                {
                  step: "Step 4",
                  title: "Approval & Processing",
                  desc: "If approved, the refund will be processed within 5–10 business days via the original payment method or as account credit. You will receive an email confirmation once processed.",
                },
              ].map((s, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex-shrink-0 w-20 text-xs font-bold text-violet-600 bg-violet-50 rounded-lg px-2 py-1 h-fit text-center">{s.step}</div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{s.title}</p>
                    <p className="text-gray-500 text-sm mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="methods" title="10. Refund Payment Methods & Timeline">
            <p>Approved refunds are issued through the following methods:</p>
            <ul className="space-y-1">
              <Li><strong>Bank Transfer:</strong> Refunds to Pakistani bank accounts (HBL, MCB, UBL, Meezan, etc.) are processed within 5–10 business days of approval.</Li>
              <Li><strong>JazzCash / EasyPaisa:</strong> Mobile wallet refunds are processed within 3–5 business days.</Li>
              <Li><strong>Account Credit:</strong> Instant. Credits are added to your Noehost account balance and can be used for future invoices.</Li>
              <Li><strong>Card Payments:</strong> Refunds to debit/credit cards are processed within 7–14 business days depending on your bank's processing time.</Li>
            </ul>
            <p className="mt-2">Noehost is not responsible for additional delays caused by your bank or payment processor. Bank transaction fees or gateway charges incurred during the original payment or refund transfer are non-recoverable.</p>
          </Section>

          <Section id="chargeback" title="11. Chargebacks & Payment Disputes">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 my-3">
              <p className="text-amber-800 font-semibold text-sm">Important — Please Contact Us Before Filing a Dispute</p>
              <p className="text-amber-700 text-sm mt-1">We encourage customers to contact our support team first. We resolve most billing issues within 24–48 hours.</p>
            </div>
            <ul className="space-y-1">
              <Li>Initiating a chargeback or payment dispute with your bank or payment gateway without first contacting Noehost support will result in <strong>immediate account suspension</strong> pending investigation.</Li>
              <Li>All services under the disputed account will be suspended until the chargeback is resolved.</Li>
              <Li>If the chargeback is found to be invalid or fraudulent, Noehost reserves the right to pursue legal remedies available under Pakistani law, including reporting to the Federal Investigation Agency (FIA) and State Bank of Pakistan.</Li>
              <Li>Customers found to have abused the chargeback process will be permanently banned from using Noehost services.</Li>
              <Li>Valid chargebacks resulting from unauthorized card use will be handled with full cooperation with the relevant financial institution.</Li>
            </ul>
          </Section>

          <Section id="exceptions" title="12. Special Circumstances & Exceptions">
            <p>Noehost may grant refunds outside the standard policy in the following exceptional circumstances, evaluated on a case-by-case basis:</p>
            <ul className="space-y-1">
              <Li><strong>Service Failure:</strong> If Noehost is unable to deliver an ordered service due to technical failure on our end, a full refund will be issued regardless of the standard policy.</Li>
              <Li><strong>Duplicate Payment:</strong> If you are accidentally charged twice for the same service, the duplicate payment will be refunded in full within 2 business days.</Li>
              <Li><strong>Billing Error:</strong> If you are incorrectly billed an amount different from the agreed price, the difference will be refunded promptly.</Li>
              <Li><strong>Extended Downtime:</strong> In the unlikely event of extended service outages beyond our SLA commitments, service credits will be issued as compensation.</Li>
            </ul>
            <p className="mt-2">To request a refund under exceptional circumstances, please contact us at {BILLING_EMAIL} with full details of the issue.</p>
          </Section>

          <Section id="cancellation" title="13. Service Cancellation">
            <p>You may cancel any service at any time from your client portal:</p>
            <ul className="space-y-1">
              <Li>Log in to your account at {DOMAIN}/client/login → Services → Select the service → Request Cancellation.</Li>
              <Li>Cancellation requests submitted before the next billing date will stop the automatic renewal.</Li>
              <Li>Services remain active until the end of the current paid billing period.</Li>
              <Li>Cancellation does not automatically trigger a refund unless within the eligible refund window.</Li>
              <Li>Domain cancellation does not result in a refund — the domain will remain registered in your name until its expiry date.</Li>
            </ul>
          </Section>

          <Section id="governing" title="14. Governing Law">
            <p>This Refund Policy is governed by and construed in accordance with the laws of the <strong>Islamic Republic of Pakistan</strong>, including relevant provisions of:</p>
            <ul className="space-y-1">
              <Li>Electronic Transactions Ordinance 2002</Li>
              <Li>State Bank of Pakistan payment and consumer protection guidelines</Li>
              <Li>Consumer Protection Acts applicable in Pakistan</Li>
              <Li>Contract Act 1872</Li>
            </ul>
            <p className="mt-2">Any disputes regarding refunds that cannot be resolved through our support channels shall be subject to the exclusive jurisdiction of the courts of Pakistan.</p>
          </Section>

          <Section id="changes" title="15. Changes to This Policy">
            <p>Noehost reserves the right to modify this Refund Policy at any time. Changes will be:</p>
            <ul className="space-y-1">
              <Li>Published on this page at {DOMAIN}/refund-policy with an updated effective date.</Li>
              <Li>Communicated to registered customers via email for material changes.</Li>
              <Li>Orders placed before a policy change are subject to the terms in effect at the time of purchase.</Li>
            </ul>
          </Section>

          {/* Contact box */}
          <div className="mt-10 bg-violet-50 border border-violet-200 rounded-2xl p-6">
            <h3 className="font-bold text-gray-900 mb-3">Contact for Refund Requests</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Company</p>
                <p className="text-gray-700">{COMPANY}</p>
                <p className="text-gray-500">Pakistan</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Billing Support</p>
                <a href={`mailto:${BILLING_EMAIL}`} className="text-violet-600 underline block">{BILLING_EMAIL}</a>
                <a href={`mailto:${EMAIL}`} className="text-violet-600 underline block mt-1">{EMAIL}</a>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">WhatsApp Support</p>
                <a href={WA} target="_blank" rel="noopener noreferrer" className="text-green-600 underline">+92-315-1711821</a>
                <p className="text-gray-400 text-xs mt-1">Mon–Sat, 9AM–10PM PKT</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4 border-t border-violet-200 pt-3">
              Refund requests are reviewed within 2–3 business days. Processing time after approval: 5–10 business days. For urgent billing issues, contact us via WhatsApp.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm text-gray-500">
          <Link href="/terms-and-conditions" className="text-violet-600 hover:underline">Terms &amp; Conditions</Link>
          <span>·</span>
          <Link href="/privacy-policy" className="text-violet-600 hover:underline">Privacy Policy</Link>
          <span>·</span>
          <Link href="/contact-us" className="text-violet-600 hover:underline">Contact Us</Link>
          <span>·</span>
          <Link href="/" className="text-violet-600 hover:underline">Home</Link>
        </div>
      </div>
    </div>
  );
}
