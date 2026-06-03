import { Link } from "wouter";
import { useEffect, useState } from "react";

const COMPANY = "Noehost (Pvt.) Ltd.";
const DOMAIN = "noehost.com";
const EMAIL = "support@noehost.com";
const BILLING_EMAIL = "billing@noehost.com";
const ADDRESS = "Pakistan";
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

export default function TermsOfService() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(true); }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 overflow-x-hidden">

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)" }} className="py-16 px-4 text-white text-center">
        <div className="max-w-4xl mx-auto">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(255,255,255,0.15)" }}>
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold mb-3">Terms &amp; Conditions</h1>
          <p className="text-white/80 text-sm max-w-xl mx-auto">
            Please read these terms carefully before using our services. By accessing or using {DOMAIN}, you agree to be legally bound by these Terms and Conditions.
          </p>
          <div className="flex items-center justify-center gap-6 mt-5 text-xs text-white/70 flex-wrap">
            <span>Effective: {EFFECTIVE}</span>
            <span className="w-1 h-1 rounded-full bg-white/40" />
            <span>Governed by Pakistani Law</span>
            <span className="w-1 h-1 rounded-full bg-white/40" />
            <span>PECA 2016 Compliant</span>
          </div>
        </div>
      </div>

      {/* TOC card */}
      <div className="max-w-4xl mx-auto px-4 -mt-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contents</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {[
              ["#parties","1. Parties & Agreement"],["#services","2. Services"],["#account","3. Account"],
              ["#acceptable","4. Acceptable Use"],["#payment","5. Payment & Billing"],["#refund","6. Refunds"],
              ["#uptime","7. Uptime & SLA"],["#data","8. Data & Backups"],["#ip","9. Intellectual Property"],
              ["#privacy","10. Privacy"],["#liability","11. Liability"],["#termination","12. Termination"],
              ["#dispute","13. Dispute Resolution"],["#governing","14. Governing Law"],["#changes","15. Changes"],
            ].map(([href,label]) => (
              <a key={href} href={href} className="text-violet-600 hover:text-violet-800 hover:underline text-xs">{label}</a>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-10 text-sm text-amber-800">
            <strong>Important:</strong> These Terms constitute a legally binding agreement between you ("Customer," "User") and {COMPANY} ("Noehost," "we," "us," "our"). If you do not agree to these terms, do not use our services.
          </div>

          <Section id="parties" title="1. Parties & Agreement">
            <p>These Terms and Conditions ("Agreement") govern the relationship between <strong>{COMPANY}</strong>, a web hosting and digital services company operating in Pakistan, and you (the "Customer" or "User") who accesses or uses any of our products or services through {DOMAIN} or affiliated platforms.</p>
            <p>By registering an account, placing an order, or using any service provided by Noehost, you acknowledge that you have read, understood, and agree to be bound by this Agreement in its entirety, including our Privacy Policy and Refund Policy, which are incorporated herein by reference.</p>
            <p>If you are using our services on behalf of a business entity, you represent that you have the authority to bind that entity to these terms.</p>
          </Section>

          <Section id="services" title="2. Services Provided">
            <p>Noehost provides the following digital services to customers in Pakistan and internationally:</p>
            <ul className="space-y-1 mt-2">
              {[
                "Shared web hosting, cPanel hosting, and managed WordPress hosting",
                "Virtual Private Server (VPS) and cloud server provisioning",
                "Domain name registration, transfer, and renewal for all TLDs including .pk, .com, .net, .org",
                "SSL/TLS certificate issuance and management",
                "Business email hosting and email solutions",
                "Reseller hosting and white-label services",
                "Technical support and managed services",
              ].map((s,i) => <Li key={i}>{s}</Li>)}
            </ul>
            <p className="mt-3">We reserve the right to modify, add, or discontinue any service at our discretion with reasonable prior notice.</p>
          </Section>

          <Section id="account" title="3. Account Registration & Responsibility">
            <p>You must be at least 18 years of age to register an account and purchase services. By registering, you confirm that all information provided is accurate, complete, and current.</p>
            <ul className="space-y-1 mt-2">
              <Li>You are solely responsible for maintaining the confidentiality of your account credentials (username and password).</Li>
              <Li>All activities conducted under your account, whether by you or a third party, are your full responsibility.</Li>
              <Li>You must notify us immediately at {EMAIL} if you suspect any unauthorized access to your account.</Li>
              <Li>Noehost will not be liable for any loss resulting from unauthorized use of your account credentials.</Li>
              <Li>You may not transfer or assign your account to another party without our prior written consent.</Li>
            </ul>
          </Section>

          <Section id="acceptable" title="4. Acceptable Use Policy">
            <p>You agree to use Noehost services in compliance with all applicable laws of Pakistan including but not limited to the <strong>Prevention of Electronic Crimes Act (PECA) 2016</strong>, <strong>Pakistan Telecommunication (Re-organization) Act 1996</strong>, and all PTA regulations.</p>
            <p className="mt-2 font-semibold text-gray-800 text-xs uppercase tracking-wide">Strictly Prohibited Activities:</p>
            <ul className="space-y-1 mt-2">
              {[
                "Hosting, distributing, or transmitting any content that violates Pakistani law or international law",
                "Sending unsolicited bulk email (spam), phishing emails, or fraudulent communications",
                "Hosting malware, ransomware, spyware, botnets, or any malicious software",
                "Operating phishing pages, fraud websites, or deceptive online services",
                "Hosting or distributing child sexual abuse material (CSAM) — zero tolerance, will be reported to FIA",
                "Conducting distributed denial-of-service (DDoS) attacks or any network attacks",
                "Mining cryptocurrency using shared server resources",
                "Overloading shared server resources in ways that degrade service for other customers",
                "Hosting content that promotes terrorism, incitement to violence, or hate speech",
                "Unauthorized scanning, probing, or hacking of any systems",
                "Reselling or sharing account credentials without explicit written permission",
                "Violating intellectual property rights of any person or entity",
              ].map((s,i) => <Li key={i}>{s}</Li>)}
            </ul>
            <p className="mt-3">Violation of this Acceptable Use Policy may result in immediate account suspension without refund and may be reported to relevant Pakistani law enforcement authorities including the Federal Investigation Agency (FIA).</p>
          </Section>

          <Section id="payment" title="5. Payment, Billing & Invoicing">
            <p>All prices are listed and charged in <strong>Pakistani Rupees (PKR)</strong> unless otherwise stated. International pricing may be displayed in USD for reference purposes but will be billed in PKR at the prevailing exchange rate.</p>
            <ul className="space-y-1 mt-2">
              <Li>Payment is due immediately upon order placement. Services are not activated until payment is confirmed.</Li>
              <Li>We accept payments via bank transfer, JazzCash, EasyPaisa, credit/debit cards, and other gateways as made available.</Li>
              <Li>Renewal invoices are automatically generated 14 days before the service expiry date and sent to your registered email address.</Li>
              <Li>Services not renewed by their expiry date will be suspended after a 7-day grace period and permanently deleted after 30 days of non-payment.</Li>
              <Li>Noehost reserves the right to change pricing with 30 days' prior notice via email.</Li>
              <Li>All transactions are subject to applicable Pakistani taxes (including Sales Tax where applicable).</Li>
              <Li>Bank transaction fees and payment gateway charges are the responsibility of the customer.</Li>
            </ul>
            <p className="mt-3">For billing inquiries, contact: <strong>{BILLING_EMAIL}</strong></p>
          </Section>

          <Section id="refund" title="6. Refund Policy Summary">
            <p>Our complete Refund Policy is available at <Link href="/refund-policy" className="text-violet-600 underline">noehost.com/refund-policy</Link>. Key terms:</p>
            <ul className="space-y-1 mt-2">
              <Li>Shared hosting: 7-day money-back guarantee from service activation date.</Li>
              <Li>Domain names: Non-refundable once registered or transferred.</Li>
              <Li>VPS/Dedicated servers: Non-refundable once provisioned.</Li>
              <Li>SSL certificates: Non-refundable once issued.</Li>
              <Li>Refunds will be processed within 5–10 business days via the original payment method.</Li>
            </ul>
          </Section>

          <Section id="uptime" title="7. Service Availability & SLA">
            <p>Noehost targets a monthly uptime of <strong>99.9%</strong> for all shared and VPS hosting services, excluding scheduled maintenance windows.</p>
            <ul className="space-y-1 mt-2">
              <Li>Scheduled maintenance will be announced at least 24 hours in advance via email and our status page.</Li>
              <Li>In the event of unplanned downtime exceeding 0.1% monthly uptime, customers may request a pro-rated service credit for the affected period.</Li>
              <Li>SLA credits are the sole remedy for downtime and do not entitle you to a cash refund.</Li>
              <Li>Noehost is not responsible for downtime caused by force majeure events, customer-side issues, DDoS attacks directed at customer accounts, or third-party network failures.</Li>
            </ul>
          </Section>

          <Section id="data" title="8. Data, Content & Backups">
            <p>You retain full ownership of all content, data, and files stored on our servers. By using our services, you grant Noehost a limited license to store and transmit your content solely for the purpose of providing services.</p>
            <ul className="space-y-1 mt-2">
              <Li>You are solely responsible for maintaining regular backups of all your website data, databases, and email.</Li>
              <Li>While Noehost may perform periodic server-level backups, we do not guarantee the availability or completeness of such backups.</Li>
              <Li>We strongly recommend maintaining independent backups of all critical data at all times.</Li>
              <Li>Noehost will not be liable for any data loss regardless of cause, including hardware failure, cyberattacks, or accidental deletion.</Li>
              <Li>Upon account termination, your data may be permanently deleted after a 30-day retention period.</Li>
            </ul>
          </Section>

          <Section id="ip" title="9. Intellectual Property">
            <p>All trademarks, logos, service names, software, interfaces, and content on {DOMAIN} are the exclusive intellectual property of {COMPANY} or its licensors and are protected under Pakistani intellectual property law.</p>
            <ul className="space-y-1 mt-2">
              <Li>You may not reproduce, copy, distribute, or create derivative works from any Noehost intellectual property without explicit written permission.</Li>
              <Li>You represent that all content you host on our servers does not infringe the intellectual property rights of any third party.</Li>
              <Li>Noehost will respond to valid DMCA/copyright takedown notices and Pakistan copyright law complaints promptly.</Li>
            </ul>
          </Section>

          <Section id="privacy" title="10. Privacy & Data Protection">
            <p>Your privacy is important to us. Our complete Privacy Policy, which describes how we collect, use, and protect your personal information, is available at <Link href="/privacy-policy" className="text-violet-600 underline">noehost.com/privacy-policy</Link>.</p>
            <p className="mt-2">We comply with applicable Pakistani data protection laws and implement industry-standard security measures to protect your personal information.</p>
          </Section>

          <Section id="liability" title="11. Limitation of Liability">
            <p>To the maximum extent permitted by applicable Pakistani law:</p>
            <ul className="space-y-1 mt-2">
              <Li>Noehost's total liability for any claim arising out of or related to these Terms shall not exceed the total amount paid by you for the specific service in the 3 months preceding the claim.</Li>
              <Li>Noehost shall not be liable for any indirect, incidental, consequential, special, or punitive damages, including but not limited to lost profits, lost data, or business interruption.</Li>
              <Li>Noehost is not liable for losses caused by third-party service providers, internet infrastructure failures, or events outside our reasonable control.</Li>
              <Li>You agree to indemnify and hold harmless Noehost, its officers, employees, and agents from any claims, losses, or liabilities arising from your use of our services or violation of these Terms.</Li>
            </ul>
          </Section>

          <Section id="termination" title="12. Termination of Services">
            <p>Either party may terminate this agreement at any time:</p>
            <ul className="space-y-1 mt-2">
              <Li><strong>By you:</strong> Cancel anytime from your client portal. Refunds are subject to our Refund Policy.</Li>
              <Li><strong>By Noehost (with notice):</strong> 30-day written notice for service discontinuation.</Li>
              <Li><strong>By Noehost (immediately):</strong> We may suspend or terminate accounts without notice for: violation of Acceptable Use Policy, non-payment, fraudulent activity, illegal content hosting, chargebacks, or any activity posing risk to our infrastructure or other customers.</Li>
            </ul>
            <p className="mt-2">Upon termination for policy violations, no refund will be issued and access to all data will be immediately revoked.</p>
          </Section>

          <Section id="dispute" title="13. Dispute Resolution">
            <p>In the event of any dispute arising from or related to these Terms or our services, the parties agree to the following process:</p>
            <ul className="space-y-1 mt-2">
              <Li><strong>Step 1 — Direct Resolution:</strong> Contact our support team at {EMAIL}. We will endeavor to resolve the dispute within 15 business days.</Li>
              <Li><strong>Step 2 — Mediation:</strong> If direct resolution fails, parties agree to attempt mediation before pursuing legal action.</Li>
              <Li><strong>Step 3 — Legal Action:</strong> Any unresolved dispute shall be subject to the exclusive jurisdiction of the courts of Pakistan.</Li>
            </ul>
          </Section>

          <Section id="governing" title="14. Governing Law & Jurisdiction">
            <p>These Terms and Conditions shall be governed by and construed in accordance with the laws of the <strong>Islamic Republic of Pakistan</strong>, including but not limited to:</p>
            <ul className="space-y-1 mt-2">
              <Li>Prevention of Electronic Crimes Act (PECA) 2016</Li>
              <Li>Electronic Transactions Ordinance 2002</Li>
              <Li>Pakistan Telecommunication (Re-organization) Act 1996</Li>
              <Li>Contract Act 1872 (as applicable)</Li>
              <Li>Relevant State Bank of Pakistan (SBP) payment and consumer protection regulations</Li>
            </ul>
            <p className="mt-2">Any legal proceedings shall be initiated exclusively in the courts of competent jurisdiction within Pakistan.</p>
          </Section>

          <Section id="changes" title="15. Changes to These Terms">
            <p>Noehost reserves the right to amend these Terms and Conditions at any time. Changes will be:</p>
            <ul className="space-y-1 mt-2">
              <Li>Posted on {DOMAIN}/terms-and-conditions with an updated effective date.</Li>
              <Li>Communicated to registered customers via email at least 7 days before taking effect for material changes.</Li>
              <Li>Deemed accepted by continued use of our services after the effective date.</Li>
            </ul>
            <p className="mt-2">It is your responsibility to review these Terms periodically. If you do not agree to updated terms, you must stop using our services before the effective date.</p>
          </Section>

          {/* Contact box */}
          <div className="mt-10 bg-violet-50 border border-violet-200 rounded-2xl p-6">
            <h3 className="font-bold text-gray-900 mb-3">Contact & Legal Inquiries</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Company</p>
                <p className="text-gray-700">{COMPANY}</p>
                <p className="text-gray-500">{ADDRESS}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">General Support</p>
                <a href={`mailto:${EMAIL}`} className="text-violet-600 underline">{EMAIL}</a>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">WhatsApp Support</p>
                <a href={WA} target="_blank" rel="noopener noreferrer" className="text-green-600 underline">+92-315-1711821</a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm text-gray-500">
          <Link href="/privacy-policy" className="text-violet-600 hover:underline">Privacy Policy</Link>
          <span>·</span>
          <Link href="/refund-policy" className="text-violet-600 hover:underline">Refund Policy</Link>
          <span>·</span>
          <Link href="/contact-us" className="text-violet-600 hover:underline">Contact Us</Link>
          <span>·</span>
          <Link href="/" className="text-violet-600 hover:underline">Home</Link>
        </div>
      </div>
    </div>
  );
}
