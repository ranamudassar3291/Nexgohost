import React, { useState, useEffect } from 'react';
import { Server } from 'lucide-react';
import { useContent } from '@/context/ContentContext';
import {
  SectionWrap, Card, CardTitle, Field, FieldRow, Input, NumInput, Textarea, Toggle,
  SaveBtn, AddBtn, DelBtn, AccordionItem, Divider, SuccessBadge, usePageSave
} from './AdminShared';

const DEFAULT: any = {
  hero: {
    badge: 'Perfect for Beginners & Small Business',
    title: 'Shared Hosting',
    titleHighlight: 'Made Simple.',
    description: 'Launch your website today with blazing-fast SSD storage, free SSL, and a one-click app installer. No technical skills needed.',
    primaryBtn: { text: 'See Plans', url: '#sh-plans', show: true },
    secondaryBtn: { text: 'Start Free Trial', url: '/register', show: true },
    badges: ['Free Domain', 'Free SSL', '30-Day Guarantee', 'No Setup Fee'],
  },
  stats: [
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '< 1ms', label: 'Response Time' },
    { value: '2M+', label: 'Sites Hosted' },
    { value: '500K+', label: 'Happy Customers' },
  ],
  plans: [
    {
      name: 'WP Start', desc: 'Ideal for beginners building a single website',
      monthly: 2.99, yearly: 1.99, freeMonths: 3, savePercent: 33, popular: false,
      btnText: 'Explore Now', btnUrl: '/register',
      topFeatures: ['1 WordPress website', '10 email addresses', '100GB NVMe storage', 'FREE domain registration'],
      additionalFeatures: [{ label: 'Standard SSL Certificate', included: true }, { label: 'WordPress Staging', included: false }],
      suiteName: 'Starter Suite',
      suite: [{ label: 'DDoS Protection power Pro', note: '(Free for the full Duration)', included: false }, { label: 'Free Content Delivery Net', note: '(Free for the full Duration)', included: false }, { label: '02GB Auto Backup', note: '(Free for the full Duration)', included: false }],
    },
    {
      name: 'Business', desc: 'A versatile Web Hosting plan catering to the majority',
      monthly: 5.99, yearly: 3.99, freeMonths: 3, savePercent: 33, popular: true,
      btnText: 'Explore Now', btnUrl: '/register',
      topFeatures: ['Unlimited websites', '200GB NVMe storage', 'Unlimited email address', 'FREE domain registration'],
      additionalFeatures: [{ label: 'Staging Website', included: true }, { label: 'Jetpack free pre-installed', included: true }],
      suiteName: 'Premium Suite',
      suite: [{ label: 'DDoS Protection power Pro', note: '(Free for the full Duration)', included: true }, { label: 'Free Content Delivery Net', note: '(Free for the full Duration)', included: true }, { label: '05GB Auto Backup', note: '(Free for the full Duration)', included: true }],
    },
    {
      name: 'Growth', desc: 'Ideal for growing businesses needing more power',
      monthly: 14.99, yearly: 9.99, freeMonths: 3, savePercent: 33, popular: false,
      btnText: 'Explore Now', btnUrl: '/register',
      topFeatures: ['1 WordPress website', '10 email addresses', '100GB NVMe storage', 'FREE domain registration'],
      additionalFeatures: [{ label: 'Standard SSL Certificate', included: true }, { label: 'WordPress Staging', included: true }],
      suiteName: 'Growth Suite',
      suite: [{ label: 'DDoS Protection power Pro', note: '(Free for the full Duration)', included: true }, { label: 'Free Content Delivery Net', note: '(Free for the full Duration)', included: true }, { label: '02GB Auto Backup', note: '(Free for the full Duration)', included: true }],
    },
    {
      name: 'Pro', desc: 'Complete solution for established businesses',
      monthly: 24.99, yearly: 16.99, freeMonths: 3, savePercent: 33, popular: false,
      btnText: 'Explore Now', btnUrl: '/register',
      topFeatures: ['1 WordPress website', '10 email addresses', '100GB NVMe storage', 'FREE domain registration'],
      additionalFeatures: [{ label: 'Standard SSL Certificate', included: true }, { label: 'WordPress Staging', included: true }],
      suiteName: 'Pro Suite',
      suite: [{ label: 'DDoS Protection power Pro', note: '(Free for the full Duration)', included: true }, { label: 'Free Content Delivery Net', note: '(Free for the full Duration)', included: true }, { label: '02GB Auto Backup', note: '(Free for the full Duration)', included: true }],
    },
  ],
  plansTitle: 'Simple, Transparent Pricing',
  plansSubtitle: 'No hidden fees. Cancel anytime.',
  featuresTitle: 'Built for Your Success',
  featuresDesc: 'Every plan comes packed with features to get your website live, fast and secure.',
  features: [
    { title: 'cPanel Control Panel', desc: 'Industry-standard hosting control panel. Manage files, databases, email and domains — all from one place.' },
    { title: '1-Click App Installer', desc: 'Deploy WordPress, Joomla, Drupal, and 300+ apps instantly with Softaculous.' },
    { title: 'Free SSL Certificate', desc: 'Every plan includes a free Let\'s Encrypt SSL, automatically renewed.' },
    { title: 'Professional Email', desc: 'Create business emails like you@yourdomain.com with full spam protection.' },
    { title: 'Daily Backups', desc: 'Automatic daily backups stored for 30 days. Restore any file or database with one click.' },
    { title: '24/7 Expert Support', desc: 'Real humans available around the clock via live chat, ticket and phone.' },
  ],
  faqTitle: 'Frequently Asked Questions',
  faqs: [
    { q: 'What is shared hosting?', a: 'Shared hosting means your website shares server resources with other sites. It\'s the most affordable way to host and perfect for small to medium-sized sites.' },
    { q: 'Can I host multiple websites on one plan?', a: 'Yes! Our Business and Pro plans support unlimited websites under a single account.' },
    { q: 'Do you offer a money-back guarantee?', a: 'Absolutely. We offer a 30-day money-back guarantee on all plans, no questions asked.' },
    { q: 'Is WordPress pre-installed?', a: 'WordPress can be installed with a single click through Softaculous in your cPanel, taking less than 2 minutes.' },
    { q: 'Can I upgrade my plan later?', a: 'Yes, upgrades are instant and available at any time from your dashboard with no downtime.' },
    { q: 'What kind of support do you offer?', a: 'We offer 24/7 live chat, email ticketing, and phone support with an average response time under 2 minutes.' },
  ],
};

const SharedHostingEditor: React.FC = () => {
  const { content, updateContent } = useContent();
  const [data, setData] = useState<any>(null);
  const [openPlan, setOpenPlan] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openFeat, setOpenFeat] = useState<number | null>(null);

  useEffect(() => {
    if (content) setData(content['pages.sharedHosting'] || DEFAULT);
  }, [content]);

  const { save, saving, saved } = usePageSave('pages.sharedHosting', data, updateContent);

  const upd = (path: string, val: any) => {
    setData((prev: any) => {
      const next = { ...prev };
      const keys = path.split('.');
      let cur: any = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...cur[keys[i]] };
        cur = cur[keys[i]];
      }
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

  const updNested = (arrKey: string, idx: number, subKey: string, subIdx: number, field: string, val: any) => {
    setData((prev: any) => {
      const arr = [...(prev[arrKey] || [])];
      const sub = [...(arr[idx][subKey] || [])];
      sub[subIdx] = { ...sub[subIdx], [field]: val };
      arr[idx] = { ...arr[idx], [subKey]: sub };
      return { ...prev, [arrKey]: arr };
    });
  };

  if (!data) return <div className="text-slate-400 p-8">Loading...</div>;

  return (
    <SectionWrap title="Shared Hosting Page" subtitle="Edit all content on the Shared Hosting page" icon={<Server size={20} />}>
      <div className="flex items-center justify-between">
        <SaveBtn onClick={save} saving={saving} />
        <SuccessBadge show={saved} />
      </div>

      {/* HERO */}
      <Card>
        <CardTitle>Hero Section</CardTitle>
        <Field label="Badge Text"><Input value={data.hero?.badge || ''} onChange={v => upd('hero.badge', v)} /></Field>
        <FieldRow>
          <Field label="Main Title"><Input value={data.hero?.title || ''} onChange={v => upd('hero.title', v)} /></Field>
          <Field label="Highlighted Title"><Input value={data.hero?.titleHighlight || ''} onChange={v => upd('hero.titleHighlight', v)} /></Field>
        </FieldRow>
        <Field label="Description"><Textarea value={data.hero?.description || ''} onChange={v => upd('hero.description', v)} /></Field>
        <Divider label="Primary Button" />
        <FieldRow>
          <Field label="Button Text"><Input value={data.hero?.primaryBtn?.text || ''} onChange={v => upd('hero.primaryBtn.text', v)} /></Field>
          <Field label="Button URL"><Input value={data.hero?.primaryBtn?.url || ''} onChange={v => upd('hero.primaryBtn.url', v)} placeholder="#sh-plans or /register" /></Field>
        </FieldRow>
        <Toggle value={data.hero?.primaryBtn?.show ?? true} onChange={v => upd('hero.primaryBtn.show', v)} label="Show Primary Button" />
        <Divider label="Secondary Button" />
        <FieldRow>
          <Field label="Button Text"><Input value={data.hero?.secondaryBtn?.text || ''} onChange={v => upd('hero.secondaryBtn.text', v)} /></Field>
          <Field label="Button URL"><Input value={data.hero?.secondaryBtn?.url || ''} onChange={v => upd('hero.secondaryBtn.url', v)} /></Field>
        </FieldRow>
        <Toggle value={data.hero?.secondaryBtn?.show ?? true} onChange={v => upd('hero.secondaryBtn.show', v)} label="Show Secondary Button" />
        <Divider label="Hero Badges" />
        <div className="space-y-2">
          {(data.hero?.badges || []).map((b: string, i: number) => (
            <div key={i} className="flex gap-2">
              <Input value={b} onChange={v => {
                const arr = [...(data.hero?.badges || [])]; arr[i] = v;
                upd('hero.badges', arr);
              }} placeholder="Badge text" />
              <DelBtn onClick={() => { const arr = [...(data.hero?.badges || [])]; arr.splice(i, 1); upd('hero.badges', arr); }} />
            </div>
          ))}
          <AddBtn onClick={() => upd('hero.badges', [...(data.hero?.badges || []), 'New Badge'])} label="Add Badge" />
        </div>
      </Card>

      {/* STATS */}
      <Card>
        <CardTitle>Stats Bar</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          {(data.stats || []).map((s: any, i: number) => (
            <div key={i} className="p-3 rounded-xl space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(103,61,230,0.1)' }}>
              <Input value={s.value} onChange={v => updArr('stats', i, 'value', v)} placeholder="99.9%" />
              <Input value={s.label} onChange={v => updArr('stats', i, 'label', v)} placeholder="Uptime SLA" />
            </div>
          ))}
        </div>
        <AddBtn onClick={() => setData((p: any) => ({ ...p, stats: [...(p.stats || []), { value: '0', label: 'Metric' }] }))} label="Add Stat" />
      </Card>

      {/* PLANS */}
      <Card>
        <div className="mb-4">
          <CardTitle>Pricing Plans Section</CardTitle>
          <FieldRow>
            <Field label="Section Title"><Input value={data.plansTitle || 'Simple, Transparent Pricing'} onChange={v => upd('plansTitle', v)} /></Field>
            <Field label="Section Subtitle"><Input value={data.plansSubtitle || 'No hidden fees. Cancel anytime.'} onChange={v => upd('plansSubtitle', v)} /></Field>
          </FieldRow>
          <Divider label="Plans" />
        </div>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Individual Plans</CardTitle>
          <AddBtn onClick={() => {
            setData((p: any) => ({
              ...p,
              plans: [...(p.plans || []), { name: 'New Plan', desc: '', monthly: 9.99, yearly: 6.99, freeMonths: 3, savePercent: 33, popular: false, btnText: 'Get Started', btnUrl: '/register', topFeatures: [], additionalFeatures: [], suiteName: 'Suite', suite: [] }]
            }));
          }} label="Add Plan" />
        </div>
        <div className="space-y-2">
          {(data.plans || []).map((plan: any, i: number) => (
            <AccordionItem key={i} title={plan.name || `Plan ${i + 1}`} index={i} open={openPlan} setOpen={setOpenPlan}
              onDelete={() => setData((p: any) => { const a = [...p.plans]; a.splice(i, 1); return { ...p, plans: a }; })}>
              <FieldRow>
                <Field label="Plan Name"><Input value={plan.name} onChange={v => updArr('plans', i, 'name', v)} /></Field>
                <Field label="Description"><Input value={plan.desc} onChange={v => updArr('plans', i, 'desc', v)} /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="Monthly Price ($)"><NumInput value={plan.monthly} onChange={v => updArr('plans', i, 'monthly', v)} /></Field>
                <Field label="Yearly Price ($)"><NumInput value={plan.yearly} onChange={v => updArr('plans', i, 'yearly', v)} /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="Free Months"><NumInput value={plan.freeMonths} onChange={v => updArr('plans', i, 'freeMonths', v)} step={1} /></Field>
                <Field label="Save Percent"><NumInput value={plan.savePercent} onChange={v => updArr('plans', i, 'savePercent', v)} step={1} /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="Button Text"><Input value={plan.btnText || 'Explore Now'} onChange={v => updArr('plans', i, 'btnText', v)} /></Field>
                <Field label="Button URL"><Input value={plan.btnUrl || '/register'} onChange={v => updArr('plans', i, 'btnUrl', v)} /></Field>
              </FieldRow>
              <Toggle value={plan.popular ?? false} onChange={v => updArr('plans', i, 'popular', v)} label="Mark as Popular" />
              <Divider label="Top Features" />
              {(plan.topFeatures || []).map((f: string, j: number) => (
                <div key={j} className="flex gap-2">
                  <Input value={f} onChange={v => { const a = [...plan.topFeatures]; a[j] = v; updArr('plans', i, 'topFeatures', a); }} />
                  <DelBtn onClick={() => { const a = [...plan.topFeatures]; a.splice(j, 1); updArr('plans', i, 'topFeatures', a); }} />
                </div>
              ))}
              <AddBtn onClick={() => updArr('plans', i, 'topFeatures', [...(plan.topFeatures || []), 'New Feature'])} label="Add Feature" />
              <Divider label="Additional Features" />
              {(plan.additionalFeatures || []).map((f: any, j: number) => (
                <div key={j} className="flex gap-2 items-center">
                  <Input value={f.label} onChange={v => updNested('plans', i, 'additionalFeatures', j, 'label', v)} placeholder="Feature label" />
                  <Toggle value={f.included} onChange={v => updNested('plans', i, 'additionalFeatures', j, 'included', v)} label="Included" />
                  <DelBtn onClick={() => { const a = [...plan.additionalFeatures]; a.splice(j, 1); updArr('plans', i, 'additionalFeatures', a); }} />
                </div>
              ))}
              <AddBtn onClick={() => updArr('plans', i, 'additionalFeatures', [...(plan.additionalFeatures || []), { label: 'Feature', included: true }])} label="Add Additional Feature" />
              <Divider label="Suite Name & Items" />
              <Field label="Suite Name"><Input value={plan.suiteName || ''} onChange={v => updArr('plans', i, 'suiteName', v)} /></Field>
              {(plan.suite || []).map((s: any, j: number) => (
                <div key={j} className="p-3 rounded-xl space-y-2" style={{ border: '1px solid rgba(103,61,230,0.1)' }}>
                  <div className="flex gap-2">
                    <Input value={s.label} onChange={v => updNested('plans', i, 'suite', j, 'label', v)} placeholder="Suite item label" />
                    <DelBtn onClick={() => { const a = [...plan.suite]; a.splice(j, 1); updArr('plans', i, 'suite', a); }} />
                  </div>
                  <Input value={s.note || ''} onChange={v => updNested('plans', i, 'suite', j, 'note', v)} placeholder="Note e.g. (Free for the full Duration)" />
                  <Toggle value={s.included} onChange={v => updNested('plans', i, 'suite', j, 'included', v)} label="Included" />
                </div>
              ))}
              <AddBtn onClick={() => updArr('plans', i, 'suite', [...(plan.suite || []), { label: 'Suite Item', note: '', included: true }])} label="Add Suite Item" />
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* FEATURES */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Features Section</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, features: [...(p.features || []), { title: 'New Feature', desc: '' }] }))} label="Add Feature" />
        </div>
        <FieldRow>
          <Field label="Section Title"><Input value={data.featuresTitle || ''} onChange={v => setData((p: any) => ({ ...p, featuresTitle: v }))} /></Field>
          <Field label="Section Description"><Input value={data.featuresDesc || ''} onChange={v => setData((p: any) => ({ ...p, featuresDesc: v }))} /></Field>
        </FieldRow>
        <div className="space-y-2 mt-3">
          {(data.features || []).map((f: any, i: number) => (
            <AccordionItem key={i} title={f.title} index={i} open={openFeat} setOpen={setOpenFeat}
              onDelete={() => setData((p: any) => { const a = [...p.features]; a.splice(i, 1); return { ...p, features: a }; })}>
              <Field label="Title"><Input value={f.title} onChange={v => updArr('features', i, 'title', v)} /></Field>
              <Field label="Description"><Textarea value={f.desc} onChange={v => updArr('features', i, 'desc', v)} /></Field>
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* FAQS */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>FAQ Section</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, faqs: [...(p.faqs || []), { q: 'New Question?', a: 'Answer here.' }] }))} label="Add FAQ" />
        </div>
        <Field label="Section Title"><Input value={data.faqTitle || ''} onChange={v => setData((p: any) => ({ ...p, faqTitle: v }))} /></Field>
        <div className="space-y-2 mt-3">
          {(data.faqs || []).map((faq: any, i: number) => (
            <AccordionItem key={i} title={faq.q} index={i} open={openFaq} setOpen={setOpenFaq}
              onDelete={() => setData((p: any) => { const a = [...p.faqs]; a.splice(i, 1); return { ...p, faqs: a }; })}>
              <Field label="Question"><Input value={faq.q} onChange={v => updArr('faqs', i, 'q', v)} /></Field>
              <Field label="Answer"><Textarea value={faq.a} onChange={v => updArr('faqs', i, 'a', v)} rows={4} /></Field>
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

export default SharedHostingEditor;
