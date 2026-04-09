import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { useContent } from '@/context/ContentContext';
import {
  SectionWrap, Card, CardTitle, Field, FieldRow, Input, Textarea,
  SaveBtn, AddBtn, DelBtn, AccordionItem, Divider, SuccessBadge, usePageSave, Toggle
} from './AdminShared';

const DEFAULTS: Record<string, any> = {
  privacy: {
    title: 'Privacy Policy',
    lastUpdated: 'January 15, 2025',
    intro: 'This Privacy Policy describes how Noehost collects, uses, and protects your personal information.',
    sections: [
      { id: 'collection', title: '1. Information We Collect', content: 'We collect information you provide directly to us when you create an account, purchase a plan, or contact us for support. This includes account information, payment information, technical information, usage data, and communications.', show: true },
      { id: 'use', title: '2. How We Use Your Information', content: 'We use the information we collect to provide services, process transactions, customer support, security, communications, analytics, and legal compliance.', show: true },
      { id: 'sharing', title: '3. Information Sharing & Disclosure', content: 'We do not sell, trade, or rent your personal information to third parties. We may share your information with service providers, for legal requirements, or in the event of a business transfer.', show: true },
      { id: 'security', title: '4. Data Security', content: 'We implement appropriate technical and organisational security measures to protect your personal information against accidental or unlawful destruction, loss, alteration, unauthorised disclosure, or access.', show: true },
      { id: 'rights', title: '5. Your Rights', content: 'You have rights regarding your personal data including access, correction, deletion, portability, restriction of processing, and objection to processing. Contact us at privacy@noehost.com to exercise these rights.', show: true },
      { id: 'contact', title: '6. Contact Us', content: 'If you have any questions about this Privacy Policy, please contact us at privacy@noehost.com.', show: true },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    lastUpdated: 'January 15, 2025',
    intro: 'These Terms and Conditions outline the rules and regulations for the use of Noehost\'s services.',
    sections: [
      { id: 'acceptance', title: '1. Acceptance of Terms', content: 'By accessing or using Noehost\'s services, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.', show: true },
      { id: 'services', title: '2. Services & Acceptable Use', content: 'Noehost provides web hosting, domain registration, and related services. You agree to use these services only for lawful purposes and in accordance with these Terms. Prohibited activities include hosting illegal content, malware, phishing pages, and spam.', show: true },
      { id: 'payment', title: '3. Payment & Billing', content: 'All services are billed in advance. You agree to pay all charges at the prices then in effect for your purchases. We reserve the right to suspend or terminate services for non-payment.', show: true },
      { id: 'termination', title: '4. Termination', content: 'We may terminate or suspend your account immediately, without prior notice or liability, for any reason, including breach of these Terms. Upon termination, your right to use the service will immediately cease.', show: true },
      { id: 'liability', title: '5. Limitation of Liability', content: 'In no event shall Noehost be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, use, goodwill, or other intangible losses.', show: true },
      { id: 'contact', title: '6. Contact Us', content: 'If you have any questions about these Terms, please contact us at legal@noehost.com.', show: true },
    ],
  },
  refund: {
    title: 'Refund Policy',
    lastUpdated: 'January 15, 2025',
    intro: 'We want you to be completely satisfied with our services. This policy outlines when and how refunds are processed.',
    sections: [
      { id: 'guarantee', title: '1. 30-Day Money-Back Guarantee', content: 'We offer a 30-day money-back guarantee on all shared hosting, WordPress hosting, and reseller hosting plans. If you are not satisfied for any reason within the first 30 days, contact us for a full refund.', show: true },
      { id: 'exclusions', title: '2. Exclusions', content: 'The following are not eligible for refunds: domain registrations and renewals, SSL certificates, VPS hosting (after provisioning), dedicated servers, and add-on services used during the refund period.', show: true },
      { id: 'process', title: '3. How to Request a Refund', content: 'To request a refund, contact our billing team at billing@noehost.com with your account details and reason for the refund. Refunds are processed within 5-10 business days to your original payment method.', show: true },
      { id: 'renewals', title: '4. Renewals', content: 'Renewal payments are not eligible for refunds. We send renewal reminders 30 days before each billing date. It is your responsibility to cancel before renewal if you no longer wish to use our services.', show: true },
      { id: 'contact', title: '5. Contact Billing', content: 'For all billing and refund inquiries, please contact billing@noehost.com or open a support ticket in your client area.', show: true },
    ],
  },
};

interface LegalPageEditorProps {
  pageKey: 'privacy' | 'terms' | 'refund';
  title: string;
  subtitle: string;
}

const LegalPageEditor: React.FC<LegalPageEditorProps> = ({ pageKey, title, subtitle }) => {
  const { content, updateContent } = useContent();
  const contentKey = `pages.${pageKey}`;
  const [data, setData] = useState<any>(null);
  const [openSection, setOpenSection] = useState<number | null>(null);

  useEffect(() => {
    if (content) setData(content[contentKey] || DEFAULTS[pageKey]);
  }, [content]);

  const { save, saving, saved } = usePageSave(contentKey, data, updateContent);

  const updArr = (idx: number, field: string, val: any) => {
    setData((prev: any) => {
      const arr = [...(prev.sections || [])];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...prev, sections: arr };
    });
  };

  if (!data) return <div className="text-slate-400 p-8">Loading...</div>;

  return (
    <SectionWrap title={title} subtitle={subtitle} icon={<FileText size={20} />}>
      <div className="flex items-center gap-4">
        <SaveBtn onClick={save} saving={saving} />
        <SuccessBadge show={saved} />
      </div>

      {/* PAGE HEADER */}
      <Card>
        <CardTitle>Page Header</CardTitle>
        <FieldRow>
          <Field label="Page Title"><Input value={data.title || ''} onChange={v => setData((p: any) => ({ ...p, title: v }))} /></Field>
          <Field label="Last Updated Date"><Input value={data.lastUpdated || ''} onChange={v => setData((p: any) => ({ ...p, lastUpdated: v }))} placeholder="January 15, 2025" /></Field>
        </FieldRow>
        <Field label="Intro Paragraph">
          <Textarea value={data.intro || ''} onChange={v => setData((p: any) => ({ ...p, intro: v }))} rows={3} />
        </Field>
      </Card>

      {/* SECTIONS */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Content Sections</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({
            ...p,
            sections: [...(p.sections || []), {
              id: `section-${Date.now()}`,
              title: 'New Section',
              content: 'Section content here.',
              show: true
            }]
          }))} label="Add Section" />
        </div>
        <div className="space-y-2">
          {(data.sections || []).map((section: any, i: number) => (
            <AccordionItem key={i} title={section.title} index={i} open={openSection} setOpen={setOpenSection}
              onDelete={() => setData((p: any) => { const a = [...p.sections]; a.splice(i, 1); return { ...p, sections: a }; })}>
              <Field label="Section Heading"><Input value={section.title} onChange={v => updArr(i, 'title', v)} /></Field>
              <Field label="Content (supports markdown-style **bold**)">
                <Textarea value={section.content} onChange={v => updArr(i, 'content', v)} rows={6} placeholder="Section content..." />
              </Field>
              <Toggle value={section.show ?? true} onChange={v => updArr(i, 'show', v)} label="Show this section" />
            </AccordionItem>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-4 pt-2">
        <SaveBtn onClick={save} saving={saving} />
        <SuccessBadge show={saved} />
      </div>
    </SectionWrap>
  );
};

export default LegalPageEditor;
