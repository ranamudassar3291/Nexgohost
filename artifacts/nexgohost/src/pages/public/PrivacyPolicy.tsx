import { Link } from "wouter";

const COMPANY = "Noehost (Pvt.) Ltd.";
const DOMAIN = "noehost.com";
const EMAIL = "support@noehost.com";
const PRIVACY_EMAIL = "privacy@noehost.com";
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

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 overflow-x-hidden">

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)" }} className="py-16 px-4 text-white text-center">
        <div className="max-w-4xl mx-auto">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(255,255,255,0.15)" }}>
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold mb-3">Privacy Policy</h1>
          <p className="text-white/80 text-sm max-w-xl mx-auto">
            Your privacy is our priority. This policy explains what personal data we collect, how we use it, and your rights as a customer of {DOMAIN}.
          </p>
          <div className="flex items-center justify-center gap-6 mt-5 text-xs text-white/70 flex-wrap">
            <span>Effective: {EFFECTIVE}</span>
            <span className="w-1 h-1 rounded-full bg-white/40" />
            <span>Pakistan Law Compliant</span>
            <span className="w-1 h-1 rounded-full bg-white/40" />
            <span>No Data Selling</span>
          </div>
        </div>
      </div>

      {/* TOC */}
      <div className="max-w-4xl mx-auto px-4 -mt-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contents</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              ["#overview","1. Overview"],["#collect","2. Data We Collect"],["#use","3. How We Use It"],
              ["#share","4. Data Sharing"],["#retention","5. Data Retention"],["#security","6. Security"],
              ["#cookies","7. Cookies"],["#rights","8. Your Rights"],["#children","9. Children's Privacy"],
              ["#payments","10. Payment Data"],["#transfer","11. Cross-Border Transfer"],["#changes","12. Policy Changes"],
            ].map(([href,label]) => (
              <a key={href} href={href} className="text-violet-600 hover:text-violet-800 hover:underline text-xs">{label}</a>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-10 text-sm text-green-800">
            <strong>Our Commitment:</strong> {COMPANY} does not sell, rent, or trade your personal data to any third party for marketing purposes. We collect only what is necessary to provide our services.
          </div>

          <Section id="overview" title="1. Overview & Data Controller">
            <p>This Privacy Policy ("Policy") describes how <strong>{COMPANY}</strong> ("Noehost," "we," "us," "our") collects, processes, stores, and protects personal information when you use our website ({DOMAIN}), client portal, or any related services.</p>
            <p>As the data controller, Noehost is responsible for ensuring that your personal data is processed lawfully, fairly, and transparently in compliance with applicable Pakistani privacy and data protection laws, including the <strong>Prevention of Electronic Crimes Act (PECA) 2016</strong> and relevant State Bank of Pakistan (SBP) regulations governing electronic payments.</p>
            <p>This Policy applies to all visitors, registered customers, potential customers, and any other individuals whose information we process in connection with our business.</p>
          </Section>

          <Section id="collect" title="2. Personal Data We Collect">
            <p>We collect the following categories of personal data:</p>

            <p className="font-semibold text-gray-800 mt-3">a) Account & Identity Information</p>
            <ul className="space-y-1">
              <Li>Full legal name</Li>
              <Li>Email address (primary contact and billing)</Li>
              <Li>Phone number (including WhatsApp number, if provided)</Li>
              <Li>Postal / billing address</Li>
              <Li>CNIC number (National Identity Card) — required for .pk domain registrations per PKNIC policy</Li>
              <Li>Company name and designation (for business accounts)</Li>
            </ul>

            <p className="font-semibold text-gray-800 mt-3">b) Financial & Transaction Information</p>
            <ul className="space-y-1">
              <Li>Transaction references and payment confirmation numbers</Li>
              <Li>Bank account title and last 4 digits (for manual bank transfer verification)</Li>
              <Li>JazzCash / EasyPaisa mobile account number (for refund processing)</Li>
              <Li>Invoice history and billing records</Li>
              <Li><em>Note: We do not store full credit/debit card numbers. Card data is processed by our PCI-DSS compliant payment gateway partners.</em></Li>
            </ul>

            <p className="font-semibold text-gray-800 mt-3">c) Technical & Usage Information</p>
            <ul className="space-y-1">
              <Li>IP address and approximate geographic location</Li>
              <Li>Browser type, version, and operating system</Li>
              <Li>Device type and screen resolution</Li>
              <Li>Pages visited, time on site, and referral source</Li>
              <Li>Login timestamps and session activity</Li>
              <Li>Server access logs and error logs</Li>
            </ul>

            <p className="font-semibold text-gray-800 mt-3">d) Domain & Hosting Data</p>
            <ul className="space-y-1">
              <Li>Domain WHOIS registration information (name, email, address, phone) as required by ICANN and PKNIC</Li>
              <Li>Hosting service configuration and server resource usage</Li>
              <Li>Support ticket content and communication history</Li>
            </ul>

            <p className="font-semibold text-gray-800 mt-3">e) Communication Data</p>
            <ul className="space-y-1">
              <Li>Support ticket messages and email correspondence</Li>
              <Li>Chat messages sent through our support chat widget</Li>
              <Li>WhatsApp messages sent to our business WhatsApp number for support purposes</Li>
            </ul>
          </Section>

          <Section id="use" title="3. How We Use Your Personal Data">
            <p>We process your personal data for the following lawful purposes:</p>
            <ul className="space-y-1">
              <Li><strong>Service Delivery:</strong> To provision, manage, and maintain your hosting, domain, and email services.</Li>
              <Li><strong>Account Management:</strong> To create and manage your client account, authenticate logins, and handle account-related requests.</Li>
              <Li><strong>Billing & Payments:</strong> To process orders, generate invoices, collect payments, and issue refunds.</Li>
              <Li><strong>Customer Support:</strong> To respond to support tickets, troubleshoot technical issues, and provide assistance.</Li>
              <Li><strong>Service Notifications:</strong> To send renewal reminders, service expiry alerts, maintenance announcements, and security notifications.</Li>
              <Li><strong>Legal Compliance:</strong> To comply with Pakistani law, regulatory requirements, court orders, or law enforcement requests.</Li>
              <Li><strong>Fraud Prevention:</strong> To detect, investigate, and prevent fraudulent transactions and unauthorized access.</Li>
              <Li><strong>Service Improvement:</strong> To analyze aggregated usage patterns (anonymized) to improve our platform.</Li>
              <Li><strong>Marketing (opt-in only):</strong> To send promotional offers or news about new services — only if you have explicitly opted in. You may opt out at any time.</Li>
            </ul>
            <p className="mt-2">We will not process your personal data for any purpose incompatible with the above without your explicit consent.</p>
          </Section>

          <Section id="share" title="4. Data Sharing & Third Parties">
            <p><strong>We do not sell, rent, or trade your personal data.</strong> We share your information only in the following limited circumstances:</p>
            <ul className="space-y-1">
              <Li><strong>Domain Registries (ICANN/PKNIC):</strong> WHOIS registration data as required by domain registry policies for domain registration and management.</Li>
              <Li><strong>Payment Processors:</strong> Transaction data shared with payment gateway providers (e.g., Rapid Gateway, JazzCash, bank partners) to process payments securely. These partners are bound by their own privacy and security policies.</Li>
              <Li><strong>Server Infrastructure Providers:</strong> Technical data shared with our upstream data center and server infrastructure partners (e.g., 20i, cPanel, WHM) solely for service delivery.</Li>
              <Li><strong>Email Delivery Services:</strong> Email address and message content shared with transactional email providers to deliver service notifications and invoices.</Li>
              <Li><strong>Legal & Regulatory Authorities:</strong> Personal data may be disclosed to Pakistani law enforcement agencies (FIA, PTA, SBP) when legally required by a valid court order, subpoena, or government request.</Li>
              <Li><strong>Professional Advisors:</strong> Lawyers and accountants under confidentiality obligations, when necessary for legal or financial compliance.</Li>
            </ul>
            <p className="mt-2">All third-party service providers are contractually required to maintain confidentiality and process data only as directed by Noehost.</p>
          </Section>

          <Section id="retention" title="5. Data Retention">
            <p>We retain your personal data only for as long as necessary to fulfill the purposes described in this Policy or as required by Pakistani law:</p>
            <ul className="space-y-1">
              <Li><strong>Active account data:</strong> Retained for the duration of your account plus 5 years after account closure (for legal and tax compliance).</Li>
              <Li><strong>Financial records & invoices:</strong> Retained for 7 years as required by Pakistani tax and corporate law.</Li>
              <Li><strong>Support ticket records:</strong> Retained for 3 years from last interaction.</Li>
              <Li><strong>Server access logs:</strong> Retained for 90 days, then automatically purged.</Li>
              <Li><strong>Marketing consent records:</strong> Retained until opt-out, then purged within 30 days.</Li>
              <Li><strong>Deleted accounts:</strong> Data purged within 90 days of account deletion, except where required for legal compliance.</Li>
            </ul>
          </Section>

          <Section id="security" title="6. Data Security">
            <p>Noehost implements industry-standard technical and organizational security measures to protect your personal data:</p>
            <ul className="space-y-1">
              <Li><strong>Encryption in transit:</strong> All data transmitted between your browser and our servers is protected by TLS 1.2/1.3 (HTTPS).</Li>
              <Li><strong>Encryption at rest:</strong> Sensitive data fields (API keys, credentials) are encrypted using AES-256 at rest.</Li>
              <Li><strong>Password security:</strong> All passwords are hashed using bcrypt with a minimum cost factor of 12. We never store plain-text passwords.</Li>
              <Li><strong>Access controls:</strong> Employee access to customer data is restricted on a need-to-know basis with full audit logging.</Li>
              <Li><strong>Two-factor authentication:</strong> Available for all customer accounts via TOTP.</Li>
              <Li><strong>Regular security audits:</strong> We conduct periodic security reviews and vulnerability assessments of our systems.</Li>
              <Li><strong>Incident response:</strong> In the event of a data breach, we will notify affected customers within 72 hours as required by law.</Li>
            </ul>
            <p className="mt-2">However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your data, we cannot guarantee absolute security.</p>
          </Section>

          <Section id="cookies" title="7. Cookies & Tracking Technologies">
            <p>Noehost uses the following types of cookies on our website:</p>
            <ul className="space-y-1">
              <Li><strong>Essential cookies:</strong> Required for login sessions, security (CSRF protection), and basic site functionality. Cannot be disabled.</Li>
              <Li><strong>Preference cookies:</strong> Remember your language and interface preferences for a better experience.</Li>
              <Li><strong>Analytics cookies:</strong> We may use privacy-friendly analytics to understand how users interact with our site (aggregated, anonymized data only).</Li>
            </ul>
            <p className="mt-2">We do <strong>not</strong> use third-party advertising cookies, Facebook Pixel, Google Ads tracking, or any behavioral profiling technologies on our platform.</p>
            <p className="mt-2">You can control cookies through your browser settings. Disabling essential cookies may affect site functionality.</p>
          </Section>

          <Section id="rights" title="8. Your Rights & Choices">
            <p>As a data subject under applicable Pakistani law, you have the following rights regarding your personal data:</p>
            <ul className="space-y-1">
              <Li><strong>Right to Access:</strong> Request a copy of all personal data we hold about you.</Li>
              <Li><strong>Right to Correction:</strong> Request correction of inaccurate or incomplete personal data.</Li>
              <Li><strong>Right to Deletion:</strong> Request deletion of your personal data, subject to legal retention requirements.</Li>
              <Li><strong>Right to Data Portability:</strong> Request your data in a machine-readable format (e.g., CSV).</Li>
              <Li><strong>Right to Withdraw Consent:</strong> Withdraw consent for marketing communications at any time.</Li>
              <Li><strong>Right to Object:</strong> Object to processing of your data for certain purposes.</Li>
              <Li><strong>Right to Complain:</strong> Lodge a complaint with the relevant Pakistani regulatory authority (PTA / FIA) if you believe your data rights have been violated.</Li>
            </ul>
            <p className="mt-2">To exercise any of these rights, contact us at <a href={`mailto:${PRIVACY_EMAIL}`} className="text-violet-600 underline">{PRIVACY_EMAIL}</a>. We will respond within 30 business days. Identity verification may be required before processing certain requests.</p>
          </Section>

          <Section id="children" title="9. Children's Privacy">
            <p>Our services are not directed to children under the age of <strong>18 years</strong>. We do not knowingly collect personal information from minors.</p>
            <p>If we become aware that we have inadvertently collected personal data from a person under 18, we will take prompt steps to delete such data. If you believe we have collected data from a minor, please contact us immediately at {EMAIL}.</p>
          </Section>

          <Section id="payments" title="10. Payment Data & PCI Compliance">
            <p>Noehost takes payment security seriously. Our payment processing practices comply with relevant <strong>State Bank of Pakistan (SBP)</strong> regulations and Payment Card Industry (PCI) standards:</p>
            <ul className="space-y-1">
              <Li>We do not store full credit or debit card numbers on our servers.</Li>
              <Li>Card transactions are processed through PCI-DSS compliant payment gateway partners.</Li>
              <Li>Payment gateway partners (including Rapid Gateway) have their own privacy policies governing how they handle card data.</Li>
              <Li>Bank account information shared for refund processing is encrypted and used solely for the purpose of issuing the refund.</Li>
            </ul>
          </Section>

          <Section id="transfer" title="11. International Data Transfers">
            <p>Your data is primarily stored and processed in Pakistan. In some cases, data may be transferred to servers located outside Pakistan (e.g., domain registry servers operated by ICANN, or international data center infrastructure).</p>
            <p>Where such transfers occur, we ensure that adequate safeguards are in place, including contractual obligations requiring the recipient to maintain the same level of data protection as required by Pakistani law.</p>
          </Section>

          <Section id="changes" title="12. Changes to This Privacy Policy">
            <p>We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. When we make material changes:</p>
            <ul className="space-y-1">
              <Li>The updated policy will be posted on this page with a revised effective date.</Li>
              <Li>Registered customers will be notified via email at least 7 days before material changes take effect.</Li>
              <Li>Continued use of our services after the effective date constitutes acceptance of the updated policy.</Li>
            </ul>
            <p className="mt-2">We encourage you to review this Policy periodically to stay informed about how we protect your information.</p>
          </Section>

          {/* Contact box */}
          <div className="mt-10 bg-violet-50 border border-violet-200 rounded-2xl p-6">
            <h3 className="font-bold text-gray-900 mb-3">Privacy Contact & Data Requests</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Data Controller</p>
                <p className="text-gray-700">{COMPANY}</p>
                <p className="text-gray-500">Pakistan</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Privacy Requests</p>
                <a href={`mailto:${PRIVACY_EMAIL}`} className="text-violet-600 underline">{PRIVACY_EMAIL}</a>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">WhatsApp Support</p>
                <a href={WA} target="_blank" rel="noopener noreferrer" className="text-green-600 underline">+92-315-1711821</a>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">Response time: Within 30 business days for data requests. Emergency security concerns will be addressed within 24 hours.</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm text-gray-500">
          <Link href="/terms-and-conditions" className="text-violet-600 hover:underline">Terms &amp; Conditions</Link>
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
