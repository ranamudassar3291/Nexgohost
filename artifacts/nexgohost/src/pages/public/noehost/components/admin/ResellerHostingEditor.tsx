import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { useContent } from '@/context/ContentContext';
import {
  SectionWrap, Card, CardTitle, Field, FieldRow, Input, NumInput, Textarea, Toggle,
  SaveBtn, AddBtn, DelBtn, AccordionItem, Divider, SuccessBadge, usePageSave
} from './AdminShared';

const DEFAULT: any = {
  hero: {
    badge: 'Start Your Hosting Business Today',
    title: 'Reseller Hosting.',
    titleHighlight: 'Your Brand. Our Infrastructure.',
    description: 'Launch your own web hosting company today. We power the servers. You own the brand, the clients, and the profits.',
    primaryBtn: { text: 'Start Reselling', url: '#reseller-plans', show: true },
    secondaryBtn: { text: 'Profit Calculator', url: '#calculator', show: true },
    badges: ['100% White-Label', 'Free WHMCS Included', 'Keep All Profit', 'Instant Setup'],
  },
  stepsTitle: 'Your Hosting Business in 3 Steps',
  stepsDesc: 'No infrastructure knowledge required. We built it — you sell it.',
  steps: [
    { num: '01', title: 'Choose Your Plan', desc: 'Select a reseller plan based on how many hosting accounts you need. Upgrade anytime as your business grows.' },
    { num: '02', title: 'Brand It Your Way', desc: 'Set up private nameservers, a custom client portal, and your own WHMCS billing — all under your brand.' },
    { num: '03', title: 'Sell to Your Clients', desc: 'Set your own prices, create packages, and sell hosting. Keep 100% of the profit you make above our cost.' },
  ],
  whitelabelTitle: 'Built to Be Your Brand',
  whitelabelDesc: 'Every tool you need to present a professional hosting business — all included.',
  whitelabelFeatures: [
    { title: 'Private Nameservers', desc: 'Use ns1.yourbrand.com and ns2.yourbrand.com — your clients never see Noehost.' },
    { title: 'WHMCS Billing Included', desc: 'The industry-leading billing, support, and automation platform — fully set up for your brand.' },
    { title: 'Custom Client Portal', desc: 'A branded portal where your clients log in, manage their accounts, and submit tickets.' },
    { title: 'WHM Control Panel', desc: 'Web Host Manager gives you admin-level access to create, suspend, and manage all client accounts.' },
    { title: 'Reseller API Access', desc: 'Automate account creation, billing, and provisioning with our full REST API.' },
    { title: '100% White-Label', desc: 'We stay completely invisible. Your clients see only your brand, pricing, and identity.' },
  ],
  plansTitle: 'Choose Your Reseller Package',
  plansDesc: 'Upgrade anytime. All plans include WHMCS, WHM, and full white-labeling.',
  plans: [
    { name: 'Reseller Starter', price: 19.99, storage: '50 GB SSD', bandwidth: '500 GB', accounts: '20 cPanel', highlight: false, badge: '', features: ['20 cPanel Accounts', '50 GB SSD Storage', '500 GB Bandwidth', 'Free WHMCS Lite', 'WHM Access', 'Private Nameservers', 'Free SSL per Account', 'Daily Backups'], btnText: 'Start Reselling', btnUrl: '/register' },
    { name: 'Reseller Pro', price: 39.99, storage: '150 GB SSD', bandwidth: 'Unlimited', accounts: '60 cPanel', highlight: true, badge: 'Most Popular', features: ['60 cPanel Accounts', '150 GB NVMe SSD', 'Unlimited Bandwidth', 'Free WHMCS Full', 'WHM Access', 'Private Nameservers', 'Free SSL per Account', 'Daily Backups', 'White-Label Branding', 'Priority Support', 'Free Domain Reseller'], btnText: 'Start Reselling', btnUrl: '/register' },
    { name: 'Reseller Agency', price: 79.99, storage: '400 GB SSD', bandwidth: 'Unlimited', accounts: 'Unlimited', highlight: false, badge: '', features: ['Unlimited cPanel Accounts', '400 GB NVMe SSD', 'Unlimited Bandwidth', 'Full WHMCS License', 'WHM + Softaculous', 'Private Nameservers', 'Wildcard SSL', 'Hourly Backups', 'Custom Client Portal', 'Dedicated Account Manager', 'API Access'], btnText: 'Start Reselling', btnUrl: '/register' },
  ],
  partnerBenefitsTitle: 'Why Resell with Noehost?',
  partnerBenefitsDesc: 'We\'re not just your server provider — we\'re your silent business partner.',
  partnerBenefits: [
    { title: '24/7 Backend Support', desc: 'We handle the server-level support so you can focus on growing your business. Your clients never know.' },
    { title: 'Recurring Revenue', desc: 'Hosting is a subscription model. Once you sign a client, you earn every month they renew.' },
    { title: 'Reseller Dashboard', desc: 'Monitor all client accounts, disk usage, bandwidth, and billing from one central dashboard.' },
    { title: 'Marketing Resources', desc: 'Access to branded marketing materials, rate cards, and sales scripts to help you close deals faster.' },
  ],
  finalCtaTitle: 'Ready to Start Your Hosting Business?',
  finalCtaDesc: 'Join hundreds of resellers already earning with Noehost. Setup takes less than 10 minutes.',
  finalCtaBtnText: 'Get Started for $19.99/mo',
  finalCtaBtnUrl: '/register',
};

const ResellerHostingEditor: React.FC = () => {
  const { content, updateContent } = useContent();
  const [data, setData] = useState<any>(null);
  const [openPlan, setOpenPlan] = useState<number | null>(null);
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [openWL, setOpenWL] = useState<number | null>(null);
  const [openBen, setOpenBen] = useState<number | null>(null);

  useEffect(() => {
    if (content) setData(content['pages.resellerHosting'] || DEFAULT);
  }, [content]);

  const { save, saving, saved } = usePageSave('pages.resellerHosting', data, updateContent);

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
    <SectionWrap title="Reseller Hosting Page" subtitle="Edit all content on the Reseller Hosting page" icon={<Users size={20} />}>
      <div className="flex items-center gap-4">
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
          <Field label="Text"><Input value={data.hero?.primaryBtn?.text || ''} onChange={v => upd('hero.primaryBtn.text', v)} /></Field>
          <Field label="URL"><Input value={data.hero?.primaryBtn?.url || ''} onChange={v => upd('hero.primaryBtn.url', v)} /></Field>
        </FieldRow>
        <Toggle value={data.hero?.primaryBtn?.show ?? true} onChange={v => upd('hero.primaryBtn.show', v)} label="Show Primary Button" />
        <Divider label="Secondary Button" />
        <FieldRow>
          <Field label="Text"><Input value={data.hero?.secondaryBtn?.text || ''} onChange={v => upd('hero.secondaryBtn.text', v)} /></Field>
          <Field label="URL"><Input value={data.hero?.secondaryBtn?.url || ''} onChange={v => upd('hero.secondaryBtn.url', v)} /></Field>
        </FieldRow>
        <Toggle value={data.hero?.secondaryBtn?.show ?? true} onChange={v => upd('hero.secondaryBtn.show', v)} label="Show Secondary Button" />
        <Divider label="Hero Badges" />
        {(data.hero?.badges || []).map((b: string, i: number) => (
          <div key={i} className="flex gap-2">
            <Input value={b} onChange={v => { const a = [...(data.hero?.badges || [])]; a[i] = v; upd('hero.badges', a); }} />
            <DelBtn onClick={() => { const a = [...(data.hero?.badges || [])]; a.splice(i, 1); upd('hero.badges', a); }} />
          </div>
        ))}
        <AddBtn onClick={() => upd('hero.badges', [...(data.hero?.badges || []), 'New Badge'])} label="Add Badge" />
      </Card>

      {/* HOW IT WORKS / STEPS */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>How It Works Steps</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, steps: [...(p.steps || []), { num: `0${(p.steps?.length || 0) + 1}`, title: 'New Step', desc: '' }] }))} label="Add Step" />
        </div>
        <FieldRow>
          <Field label="Section Title"><Input value={data.stepsTitle || ''} onChange={v => setData((p: any) => ({ ...p, stepsTitle: v }))} /></Field>
          <Field label="Description"><Input value={data.stepsDesc || ''} onChange={v => setData((p: any) => ({ ...p, stepsDesc: v }))} /></Field>
        </FieldRow>
        <div className="space-y-2 mt-2">
          {(data.steps || []).map((s: any, i: number) => (
            <AccordionItem key={i} title={`${s.num} — ${s.title}`} index={i} open={openStep} setOpen={setOpenStep}
              onDelete={() => setData((p: any) => { const a = [...p.steps]; a.splice(i, 1); return { ...p, steps: a }; })}>
              <FieldRow>
                <Field label="Step Number (e.g. 01)"><Input value={s.num} onChange={v => updArr('steps', i, 'num', v)} /></Field>
                <Field label="Title"><Input value={s.title} onChange={v => updArr('steps', i, 'title', v)} /></Field>
              </FieldRow>
              <Field label="Description"><Textarea value={s.desc} onChange={v => updArr('steps', i, 'desc', v)} /></Field>
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* WHITE-LABEL FEATURES */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>White-Label Features</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, whitelabelFeatures: [...(p.whitelabelFeatures || []), { title: 'New Feature', desc: '' }] }))} label="Add" />
        </div>
        <FieldRow>
          <Field label="Section Title"><Input value={data.whitelabelTitle || ''} onChange={v => setData((p: any) => ({ ...p, whitelabelTitle: v }))} /></Field>
          <Field label="Description"><Input value={data.whitelabelDesc || ''} onChange={v => setData((p: any) => ({ ...p, whitelabelDesc: v }))} /></Field>
        </FieldRow>
        <div className="space-y-2 mt-2">
          {(data.whitelabelFeatures || []).map((f: any, i: number) => (
            <AccordionItem key={i} title={f.title} index={i} open={openWL} setOpen={setOpenWL}
              onDelete={() => setData((p: any) => { const a = [...p.whitelabelFeatures]; a.splice(i, 1); return { ...p, whitelabelFeatures: a }; })}>
              <Field label="Title"><Input value={f.title} onChange={v => updArr('whitelabelFeatures', i, 'title', v)} /></Field>
              <Field label="Description"><Textarea value={f.desc} onChange={v => updArr('whitelabelFeatures', i, 'desc', v)} /></Field>
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* PLANS */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Reseller Plans</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, plans: [...(p.plans || []), { name: 'New Plan', price: 29.99, storage: '100 GB SSD', bandwidth: '1 TB', accounts: '30 cPanel', highlight: false, badge: '', features: [], btnText: 'Start Reselling', btnUrl: '/register' }] }))} label="Add Plan" />
        </div>
        <FieldRow>
          <Field label="Section Title"><Input value={data.plansTitle || ''} onChange={v => setData((p: any) => ({ ...p, plansTitle: v }))} /></Field>
          <Field label="Description"><Input value={data.plansDesc || ''} onChange={v => setData((p: any) => ({ ...p, plansDesc: v }))} /></Field>
        </FieldRow>
        <div className="space-y-2 mt-3">
          {(data.plans || []).map((plan: any, i: number) => (
            <AccordionItem key={i} title={`${plan.name} — $${plan.price}/mo`} index={i} open={openPlan} setOpen={setOpenPlan}
              onDelete={() => setData((p: any) => { const a = [...p.plans]; a.splice(i, 1); return { ...p, plans: a }; })}>
              <FieldRow>
                <Field label="Plan Name"><Input value={plan.name} onChange={v => updArr('plans', i, 'name', v)} /></Field>
                <Field label="Monthly Price ($/mo)"><NumInput value={plan.monthly ?? plan.price ?? 0} onChange={v => updArr('plans', i, 'monthly', v)} /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="Yearly Price ($/mo equivalent)"><NumInput value={plan.yearly ?? 0} onChange={v => updArr('plans', i, 'yearly', v)} /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="Storage"><Input value={plan.storage} onChange={v => updArr('plans', i, 'storage', v)} /></Field>
                <Field label="Bandwidth"><Input value={plan.bandwidth} onChange={v => updArr('plans', i, 'bandwidth', v)} /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="cPanel Accounts"><Input value={plan.accounts} onChange={v => updArr('plans', i, 'accounts', v)} /></Field>
                <Field label="Badge (optional)"><Input value={plan.badge || ''} onChange={v => updArr('plans', i, 'badge', v)} placeholder="Most Popular" /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="Button Text"><Input value={plan.btnText || 'Start Reselling'} onChange={v => updArr('plans', i, 'btnText', v)} /></Field>
                <Field label="Button URL"><Input value={plan.btnUrl || '/register'} onChange={v => updArr('plans', i, 'btnUrl', v)} /></Field>
              </FieldRow>
              <Toggle value={plan.highlight ?? false} onChange={v => updArr('plans', i, 'highlight', v)} label="Highlight (Featured Plan)" />
              <Divider label="Features List" />
              {(plan.features || []).map((f: string, j: number) => (
                <div key={j} className="flex gap-2">
                  <Input value={f} onChange={v => { const a = [...plan.features]; a[j] = v; updArr('plans', i, 'features', a); }} />
                  <DelBtn onClick={() => { const a = [...plan.features]; a.splice(j, 1); updArr('plans', i, 'features', a); }} />
                </div>
              ))}
              <AddBtn onClick={() => updArr('plans', i, 'features', [...(plan.features || []), 'New Feature'])} label="Add Feature" />
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* PARTNER BENEFITS */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Partner Benefits</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, partnerBenefits: [...(p.partnerBenefits || []), { title: 'New Benefit', desc: '' }] }))} label="Add" />
        </div>
        <FieldRow>
          <Field label="Section Title"><Input value={data.partnerBenefitsTitle || ''} onChange={v => setData((p: any) => ({ ...p, partnerBenefitsTitle: v }))} /></Field>
          <Field label="Description"><Input value={data.partnerBenefitsDesc || ''} onChange={v => setData((p: any) => ({ ...p, partnerBenefitsDesc: v }))} /></Field>
        </FieldRow>
        <div className="space-y-2 mt-2">
          {(data.partnerBenefits || []).map((b: any, i: number) => (
            <AccordionItem key={i} title={b.title} index={i} open={openBen} setOpen={setOpenBen}
              onDelete={() => setData((p: any) => { const a = [...p.partnerBenefits]; a.splice(i, 1); return { ...p, partnerBenefits: a }; })}>
              <Field label="Title"><Input value={b.title} onChange={v => updArr('partnerBenefits', i, 'title', v)} /></Field>
              <Field label="Description"><Textarea value={b.desc} onChange={v => updArr('partnerBenefits', i, 'desc', v)} /></Field>
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* FINAL CTA */}
      <Card>
        <CardTitle>Final CTA Banner</CardTitle>
        <Field label="Title"><Input value={data.finalCtaTitle || ''} onChange={v => setData((p: any) => ({ ...p, finalCtaTitle: v }))} /></Field>
        <Field label="Description"><Textarea value={data.finalCtaDesc || ''} onChange={v => setData((p: any) => ({ ...p, finalCtaDesc: v }))} /></Field>
        <FieldRow>
          <Field label="Button Text"><Input value={data.finalCtaBtnText || ''} onChange={v => setData((p: any) => ({ ...p, finalCtaBtnText: v }))} /></Field>
          <Field label="Button URL"><Input value={data.finalCtaBtnUrl || ''} onChange={v => setData((p: any) => ({ ...p, finalCtaBtnUrl: v }))} /></Field>
        </FieldRow>
      </Card>

      <div className="flex items-center gap-4 pt-2">
        <SaveBtn onClick={save} saving={saving} />
        <SuccessBadge show={saved} />
      </div>
    </SectionWrap>
  );
};

export default ResellerHostingEditor;
