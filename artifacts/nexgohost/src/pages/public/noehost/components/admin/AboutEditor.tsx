import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { useContent } from '@/context/ContentContext';
import {
  SectionWrap, Card, CardTitle, Field, FieldRow, Input, Textarea,
  SaveBtn, AddBtn, DelBtn, AccordionItem, Divider, SuccessBadge, usePageSave
} from './AdminShared';

const DEFAULT: any = {
  hero: {
    badge: 'Our Story',
    title: 'Powering the Web',
    titleHighlight: 'Since 2018.',
    description: 'We started with one mission: make world-class web hosting accessible to every business, regardless of size or budget. Seven years later, we host over 2 million websites across 80+ countries.',
    primaryBtnText: 'Get Started',
    primaryBtnUrl: '/shared-hosting',
    secondaryBtnText: 'Contact Us',
    secondaryBtnUrl: '/contact-us',
  },
  stats: [
    { value: '2M+', label: 'Websites Hosted' },
    { value: '500K+', label: 'Happy Customers' },
    { value: '99.9%', label: 'Uptime Guaranteed' },
    { value: '24/7', label: 'Expert Support' },
  ],
  missionBadge: 'Our Mission',
  missionTitle: 'Democratising',
  missionHighlight: 'World-Class Hosting',
  missionDesc1: 'The internet should be accessible to everyone. Yet for too long, enterprise-grade infrastructure was reserved for companies with enterprise-grade budgets. We changed that.',
  missionDesc2: 'From a blogger in Karachi to a startup in Dubai, every Noehost customer gets the same cutting-edge servers, the same iron-clad security, and the same around-the-clock expert support.',
  missionPoints: ['99.9% uptime SLA on every plan', 'LiteSpeed & NVMe SSD on all servers', 'Free SSL, backups & DDoS protection', 'No hidden fees, ever'],
  missionCards: [
    { label: 'Countries Served', value: '80+' },
    { label: 'Data Centres', value: '12' },
    { label: 'Years of Experience', value: '7+' },
    { label: 'Awards Won', value: '24' },
  ],
  valuesTitle: 'What We Stand For',
  valuesDesc: 'Every decision we make, every product we build — these four principles guide us.',
  values: [
    { title: 'Performance First', desc: 'We obsess over speed. Every infrastructure decision is made with page load times and server response speeds in mind.' },
    { title: 'Security by Default', desc: 'DDoS protection, malware scanning, free SSL, and automated backups come standard on every plan — no upsells.' },
    { title: 'Customer Obsessed', desc: 'Our support team is staffed by real engineers, not scripts. Average response time under 2 minutes, 24/7.' },
    { title: 'Always Innovating', desc: 'From NVMe SSD storage to AI-powered chatbots, we continuously adopt the latest technology so you stay ahead.' },
  ],
  timelineTitle: 'How We Got Here',
  milestones: [
    { year: '2018', title: 'Founded in Lahore', desc: 'Noehost was born in a small office with a big dream — affordable, reliable hosting for everyone.' },
    { year: '2019', title: '10,000 Customers', desc: 'Reached our first major milestone and expanded data centre coverage to 3 continents.' },
    { year: '2021', title: 'NVMe Infrastructure', desc: 'Migrated all servers to NVMe SSD, delivering 10× faster storage performance across all plans.' },
    { year: '2023', title: 'AI-Powered Support', desc: 'Launched our AI chatbot and automated monitoring system, achieving sub-2-minute support response times.' },
    { year: '2024', title: '500K Customers', desc: 'Surpassed 500,000 customers across 80+ countries with 99.98% average annual uptime.' },
    { year: '2025', title: 'Global Expansion', desc: 'Opened new data centres in South Asia and the Middle East to serve our growing regional customer base.' },
  ],
  teamTitle: 'Meet the People Behind Noehost',
  teamDesc: 'A passionate team of engineers, designers, and support specialists committed to your success.',
  team: [
    { name: 'Aryan Shah', role: 'CEO & Co-Founder', initials: 'AS' },
    { name: 'Zara Malik', role: 'CTO & Co-Founder', initials: 'ZM' },
    { name: 'Omar Farooq', role: 'Head of Infrastructure', initials: 'OF' },
    { name: 'Nadia Hussain', role: 'Head of Customer Success', initials: 'NH' },
    { name: 'Bilal Ahmed', role: 'Lead Security Engineer', initials: 'BA' },
    { name: 'Sana Iqbal', role: 'Product Designer', initials: 'SI' },
  ],
  ctaTitle: 'Ready to Join 500,000+ Happy Customers?',
  ctaDesc: 'Start with any plan and get your website live in minutes. 30-day money-back guarantee included.',
  ctaBtnText: 'Start Hosting Today',
  ctaBtnUrl: '/shared-hosting',
};

const AboutEditor: React.FC = () => {
  const { content, updateContent } = useContent();
  const [data, setData] = useState<any>(null);
  const [openMilestone, setOpenMilestone] = useState<number | null>(null);
  const [openValue, setOpenValue] = useState<number | null>(null);
  const [openTeam, setOpenTeam] = useState<number | null>(null);

  useEffect(() => {
    if (content) setData(content['pages.about'] || DEFAULT);
  }, [content]);

  const { save, saving, saved } = usePageSave('pages.about', data, updateContent);

  const updArr = (arrKey: string, idx: number, field: string, val: any) => {
    setData((prev: any) => {
      const arr = [...(prev[arrKey] || [])];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...prev, [arrKey]: arr };
    });
  };

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

  if (!data) return <div className="text-slate-400 p-8">Loading...</div>;

  return (
    <SectionWrap title="About Us Page" subtitle="Edit all content on the About Us page" icon={<Star size={20} />}>
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
        <Field label="Description"><Textarea value={data.hero?.description || ''} onChange={v => upd('hero.description', v)} rows={3} /></Field>
        <Divider label="Buttons" />
        <FieldRow>
          <Field label="Primary Button Text"><Input value={data.hero?.primaryBtnText || ''} onChange={v => upd('hero.primaryBtnText', v)} /></Field>
          <Field label="Primary Button URL"><Input value={data.hero?.primaryBtnUrl || ''} onChange={v => upd('hero.primaryBtnUrl', v)} /></Field>
        </FieldRow>
        <FieldRow>
          <Field label="Secondary Button Text"><Input value={data.hero?.secondaryBtnText || ''} onChange={v => upd('hero.secondaryBtnText', v)} /></Field>
          <Field label="Secondary Button URL"><Input value={data.hero?.secondaryBtnUrl || ''} onChange={v => upd('hero.secondaryBtnUrl', v)} /></Field>
        </FieldRow>
      </Card>

      {/* STATS */}
      <Card>
        <CardTitle>Stats Bar</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          {(data.stats || []).map((s: any, i: number) => (
            <div key={i} className="p-3 rounded-xl space-y-2" style={{ border: '1px solid rgba(103,61,230,0.1)' }}>
              <Input value={s.value} onChange={v => updArr('stats', i, 'value', v)} placeholder="500K+" />
              <Input value={s.label} onChange={v => updArr('stats', i, 'label', v)} placeholder="Happy Customers" />
            </div>
          ))}
        </div>
        <AddBtn onClick={() => setData((p: any) => ({ ...p, stats: [...(p.stats || []), { value: '0', label: 'Metric' }] }))} label="Add Stat" />
      </Card>

      {/* MISSION */}
      <Card>
        <CardTitle>Mission Section</CardTitle>
        <FieldRow>
          <Field label="Badge"><Input value={data.missionBadge || ''} onChange={v => setData((p: any) => ({ ...p, missionBadge: v }))} /></Field>
          <Field label="Highlighted Text"><Input value={data.missionHighlight || ''} onChange={v => setData((p: any) => ({ ...p, missionHighlight: v }))} /></Field>
        </FieldRow>
        <Field label="Title"><Input value={data.missionTitle || ''} onChange={v => setData((p: any) => ({ ...p, missionTitle: v }))} /></Field>
        <Field label="Description 1"><Textarea value={data.missionDesc1 || ''} onChange={v => setData((p: any) => ({ ...p, missionDesc1: v }))} /></Field>
        <Field label="Description 2"><Textarea value={data.missionDesc2 || ''} onChange={v => setData((p: any) => ({ ...p, missionDesc2: v }))} /></Field>
        <Divider label="Mission Points" />
        {(data.missionPoints || []).map((pt: string, i: number) => (
          <div key={i} className="flex gap-2">
            <Input value={pt} onChange={v => { const a = [...(data.missionPoints || [])]; a[i] = v; setData((p: any) => ({ ...p, missionPoints: a })); }} />
            <DelBtn onClick={() => { const a = [...(data.missionPoints || [])]; a.splice(i, 1); setData((p: any) => ({ ...p, missionPoints: a })); }} />
          </div>
        ))}
        <AddBtn onClick={() => setData((p: any) => ({ ...p, missionPoints: [...(p.missionPoints || []), 'New point'] }))} label="Add Point" />
        <Divider label="Mission Cards" />
        <div className="grid grid-cols-2 gap-3">
          {(data.missionCards || []).map((c: any, i: number) => (
            <div key={i} className="p-3 rounded-xl space-y-2" style={{ border: '1px solid rgba(103,61,230,0.1)' }}>
              <Input value={c.value} onChange={v => updArr('missionCards', i, 'value', v)} placeholder="80+" />
              <Input value={c.label} onChange={v => updArr('missionCards', i, 'label', v)} placeholder="Countries Served" />
            </div>
          ))}
        </div>
      </Card>

      {/* VALUES */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Our Values</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, values: [...(p.values || []), { title: 'New Value', desc: '' }] }))} label="Add" />
        </div>
        <FieldRow>
          <Field label="Section Title"><Input value={data.valuesTitle || ''} onChange={v => setData((p: any) => ({ ...p, valuesTitle: v }))} /></Field>
          <Field label="Description"><Input value={data.valuesDesc || ''} onChange={v => setData((p: any) => ({ ...p, valuesDesc: v }))} /></Field>
        </FieldRow>
        <div className="space-y-2 mt-2">
          {(data.values || []).map((v: any, i: number) => (
            <AccordionItem key={i} title={v.title} index={i} open={openValue} setOpen={setOpenValue}
              onDelete={() => setData((p: any) => { const a = [...p.values]; a.splice(i, 1); return { ...p, values: a }; })}>
              <Field label="Title"><Input value={v.title} onChange={val => updArr('values', i, 'title', val)} /></Field>
              <Field label="Description"><Textarea value={v.desc} onChange={val => updArr('values', i, 'desc', val)} /></Field>
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* TIMELINE */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Company Timeline</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, milestones: [...(p.milestones || []), { year: '2026', title: 'New Milestone', desc: '' }] }))} label="Add" />
        </div>
        <Field label="Section Title"><Input value={data.timelineTitle || ''} onChange={v => setData((p: any) => ({ ...p, timelineTitle: v }))} /></Field>
        <div className="space-y-2 mt-2">
          {(data.milestones || []).map((m: any, i: number) => (
            <AccordionItem key={i} title={`${m.year} — ${m.title}`} index={i} open={openMilestone} setOpen={setOpenMilestone}
              onDelete={() => setData((p: any) => { const a = [...p.milestones]; a.splice(i, 1); return { ...p, milestones: a }; })}>
              <FieldRow>
                <Field label="Year"><Input value={m.year} onChange={v => updArr('milestones', i, 'year', v)} /></Field>
                <Field label="Title"><Input value={m.title} onChange={v => updArr('milestones', i, 'title', v)} /></Field>
              </FieldRow>
              <Field label="Description"><Textarea value={m.desc} onChange={v => updArr('milestones', i, 'desc', v)} /></Field>
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* TEAM */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Team Members</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, team: [...(p.team || []), { name: 'New Member', role: 'Role', initials: 'NM' }] }))} label="Add Member" />
        </div>
        <FieldRow>
          <Field label="Section Title"><Input value={data.teamTitle || ''} onChange={v => setData((p: any) => ({ ...p, teamTitle: v }))} /></Field>
          <Field label="Description"><Input value={data.teamDesc || ''} onChange={v => setData((p: any) => ({ ...p, teamDesc: v }))} /></Field>
        </FieldRow>
        <div className="space-y-2 mt-2">
          {(data.team || []).map((m: any, i: number) => (
            <AccordionItem key={i} title={`${m.name} — ${m.role}`} index={i} open={openTeam} setOpen={setOpenTeam}
              onDelete={() => setData((p: any) => { const a = [...p.team]; a.splice(i, 1); return { ...p, team: a }; })}>
              <FieldRow>
                <Field label="Full Name"><Input value={m.name} onChange={v => updArr('team', i, 'name', v)} /></Field>
                <Field label="Initials (2 letters)"><Input value={m.initials} onChange={v => updArr('team', i, 'initials', v)} placeholder="AS" /></Field>
              </FieldRow>
              <Field label="Role / Title"><Input value={m.role} onChange={v => updArr('team', i, 'role', v)} /></Field>
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* CTA */}
      <Card>
        <CardTitle>Bottom CTA Section</CardTitle>
        <Field label="Title"><Input value={data.ctaTitle || ''} onChange={v => setData((p: any) => ({ ...p, ctaTitle: v }))} /></Field>
        <Field label="Description"><Textarea value={data.ctaDesc || ''} onChange={v => setData((p: any) => ({ ...p, ctaDesc: v }))} /></Field>
        <FieldRow>
          <Field label="Button Text"><Input value={data.ctaBtnText || ''} onChange={v => setData((p: any) => ({ ...p, ctaBtnText: v }))} /></Field>
          <Field label="Button URL"><Input value={data.ctaBtnUrl || ''} onChange={v => setData((p: any) => ({ ...p, ctaBtnUrl: v }))} /></Field>
        </FieldRow>
      </Card>

      <div className="flex items-center gap-4 pt-2">
        <SaveBtn onClick={save} saving={saving} />
        <SuccessBadge show={saved} />
      </div>
    </SectionWrap>
  );
};

export default AboutEditor;
