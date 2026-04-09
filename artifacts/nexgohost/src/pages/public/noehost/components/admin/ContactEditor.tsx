import React, { useState, useEffect } from 'react';
import { Phone } from 'lucide-react';
import { useContent } from '@/context/ContentContext';
import {
  SectionWrap, Card, CardTitle, Field, FieldRow, Input, Textarea,
  SaveBtn, AddBtn, DelBtn, AccordionItem, Divider, SuccessBadge, usePageSave, Toggle
} from './AdminShared';

const DEFAULT: any = {
  hero: {
    badge: 'We\'re Here to Help',
    title: 'Get in',
    titleHighlight: 'Touch.',
    description: 'Whatever you need — technical help, billing questions, or just guidance on which plan to choose — our team is ready.',
  },
  channels: [
    { title: 'Live Chat', desc: 'Chat with a real engineer in under 2 minutes.', detail: 'Available 24/7', cta: 'Start Chat', show: true },
    { title: 'Email Support', desc: 'Send us a detailed message and we will reply fast.', detail: 'support@noehost.com', cta: 'Send Email', show: true },
    { title: 'Phone Support', desc: 'Speak directly with our support team.', detail: '+1 (800) NEO-HOST', cta: 'Call Us', show: true },
  ],
  offices: [
    { city: 'Lahore', country: 'Pakistan', address: '42 Tech Hub, Johar Town, Lahore, Punjab 54782', primary: true },
    { city: 'Dubai', country: 'UAE', address: 'Level 14, DIFC Gate, Dubai International Financial Centre', primary: false },
    { city: 'London', country: 'UK', address: '3rd Floor, 1 Poultry, London, EC2R 8EJ', primary: false },
  ],
  faqs: [
    { q: 'How quickly will you respond to my ticket?', a: 'Our average first response time is under 2 minutes via live chat and under 1 hour via email ticket.' },
    { q: 'Can I call outside of business hours?', a: 'Yes! Phone and live chat support are available 24 hours a day, 7 days a week including public holidays.' },
    { q: 'I have a pre-sales question about hosting plans. Who do I contact?', a: 'Reach out via live chat or the form above — our sales engineers are happy to recommend the best plan for your needs.' },
  ],
};

const ContactEditor: React.FC = () => {
  const { content, updateContent } = useContent();
  const [data, setData] = useState<any>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openOffice, setOpenOffice] = useState<number | null>(null);
  const [openChannel, setOpenChannel] = useState<number | null>(null);

  useEffect(() => {
    if (content) setData(content['pages.contact'] || DEFAULT);
  }, [content]);

  const { save, saving, saved } = usePageSave('pages.contact', data, updateContent);

  const upd = (path: string, val: any) => {
    setData((prev: any) => {
      const next = { ...prev };
      const keys = path.split('.');
      let cur: any = next;
      for (let i = 0; i < keys.length - 1; i++) { cur[keys[i]] = { ...cur[keys[i]] }; cur = cur[keys[i]]; }
      cur[keys[keys.length - 1]] = val;
      return next;
    });
  };

  const updArr = (arrKey: string, idx: number, field: string, val: any) => {
    setData((prev: any) => {
      const arr = [...(prev[arrKey] || [])];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...prev, [arrKey]: arr };
    });
  };

  if (!data) return <div className="text-slate-400 p-8">Loading...</div>;

  return (
    <SectionWrap title="Contact Us Page" subtitle="Edit all content on the Contact Us page" icon={<Phone size={20} />}>
      <div className="flex items-center gap-4">
        <SaveBtn onClick={save} saving={saving} />
        <SuccessBadge show={saved} />
      </div>

      {/* HERO */}
      <Card>
        <CardTitle>Hero Section</CardTitle>
        <Field label="Badge"><Input value={data.hero?.badge || ''} onChange={v => upd('hero.badge', v)} /></Field>
        <FieldRow>
          <Field label="Main Title"><Input value={data.hero?.title || ''} onChange={v => upd('hero.title', v)} /></Field>
          <Field label="Highlighted Title"><Input value={data.hero?.titleHighlight || ''} onChange={v => upd('hero.titleHighlight', v)} /></Field>
        </FieldRow>
        <Field label="Description"><Textarea value={data.hero?.description || ''} onChange={v => upd('hero.description', v)} /></Field>
      </Card>

      {/* SUPPORT CHANNELS */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Support Channels</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, channels: [...(p.channels || []), { title: 'New Channel', desc: '', detail: '', cta: 'Contact Us', show: true }] }))} label="Add Channel" />
        </div>
        <div className="space-y-2">
          {(data.channels || []).map((ch: any, i: number) => (
            <AccordionItem key={i} title={ch.title} index={i} open={openChannel} setOpen={setOpenChannel}
              onDelete={() => setData((p: any) => { const a = [...p.channels]; a.splice(i, 1); return { ...p, channels: a }; })}>
              <Field label="Channel Title"><Input value={ch.title} onChange={v => updArr('channels', i, 'title', v)} /></Field>
              <Field label="Description"><Textarea value={ch.desc} onChange={v => updArr('channels', i, 'desc', v)} rows={2} /></Field>
              <FieldRow>
                <Field label="Contact Detail (email/phone/hours)"><Input value={ch.detail} onChange={v => updArr('channels', i, 'detail', v)} /></Field>
                <Field label="Button Text"><Input value={ch.cta} onChange={v => updArr('channels', i, 'cta', v)} /></Field>
              </FieldRow>
              <Toggle value={ch.show ?? true} onChange={v => updArr('channels', i, 'show', v)} label="Show this channel" />
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* OFFICES */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Office Locations</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, offices: [...(p.offices || []), { city: 'New City', country: 'Country', address: 'Office Address', primary: false }] }))} label="Add Office" />
        </div>
        <div className="space-y-2">
          {(data.offices || []).map((o: any, i: number) => (
            <AccordionItem key={i} title={`${o.city}, ${o.country}`} index={i} open={openOffice} setOpen={setOpenOffice}
              onDelete={() => setData((p: any) => { const a = [...p.offices]; a.splice(i, 1); return { ...p, offices: a }; })}>
              <FieldRow>
                <Field label="City"><Input value={o.city} onChange={v => updArr('offices', i, 'city', v)} /></Field>
                <Field label="Country"><Input value={o.country} onChange={v => updArr('offices', i, 'country', v)} /></Field>
              </FieldRow>
              <Field label="Full Address"><Textarea value={o.address} onChange={v => updArr('offices', i, 'address', v)} rows={2} /></Field>
              <Toggle value={o.primary ?? false} onChange={v => updArr('offices', i, 'primary', v)} label="Mark as Primary Office" />
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* FAQS */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Contact FAQs</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, faqs: [...(p.faqs || []), { q: 'New Question?', a: 'Answer here.' }] }))} label="Add FAQ" />
        </div>
        <div className="space-y-2">
          {(data.faqs || []).map((faq: any, i: number) => (
            <AccordionItem key={i} title={faq.q} index={i} open={openFaq} setOpen={setOpenFaq}
              onDelete={() => setData((p: any) => { const a = [...p.faqs]; a.splice(i, 1); return { ...p, faqs: a }; })}>
              <Field label="Question"><Input value={faq.q} onChange={v => updArr('faqs', i, 'q', v)} /></Field>
              <Field label="Answer"><Textarea value={faq.a} onChange={v => updArr('faqs', i, 'a', v)} rows={3} /></Field>
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

export default ContactEditor;
