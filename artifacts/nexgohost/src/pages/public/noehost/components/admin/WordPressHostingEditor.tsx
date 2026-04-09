import React, { useState, useEffect } from 'react';
import { Layout } from 'lucide-react';
import { useContent } from '@/context/ContentContext';
import {
  SectionWrap, Card, CardTitle, Field, FieldRow, Input, NumInput, Textarea, Toggle,
  SaveBtn, AddBtn, DelBtn, AccordionItem, Divider, SuccessBadge, usePageSave
} from './AdminShared';

const DEFAULT: any = {
  hero: {
    badge: 'Optimized for WordPress',
    title: 'WordPress Hosting',
    titleHighlight: 'Built to Perform.',
    description: 'LiteSpeed servers, managed auto-updates, staging environments, and WordPress-specific security — all under one roof.',
    primaryBtn: { text: 'View WordPress Plans', url: '#wp-plans', show: true },
    secondaryBtn: { text: 'Migrate My Site Free', url: '/register', show: true },
    badges: ['Managed Updates', 'Free Migration', 'LiteSpeed Cache', '1-Click Staging'],
  },
  speedStats: [
    { label: 'Faster than Apache', value: '15x' },
    { label: 'Core Web Vitals Score', value: '99/100' },
    { label: 'Global CDN Locations', value: '35+' },
    { label: 'Time to First Byte', value: '< 40ms' },
  ],
  wpFeaturesTitle: 'Everything a WordPress Site Needs',
  wpFeaturesDesc: 'We didn\'t just put WordPress on a server. We built the entire stack around it.',
  wpFeatures: [
    { title: 'LiteSpeed + LSCache', desc: 'LiteSpeed web server with native caching makes WordPress load up to 15x faster than Apache.' },
    { title: 'Managed Auto-Updates', desc: 'WordPress core, themes, and plugins are automatically updated, keeping your site secure.' },
    { title: '1-Click Staging', desc: 'Clone your live site to staging, make changes, then push them live — without touching production.' },
    { title: 'Free Global CDN', desc: 'Content delivered from 35 edge locations worldwide for fast page loads everywhere.' },
    { title: 'WP-CLI Access', desc: 'Manage everything from the command line — install plugins, run database operations, manage users.' },
    { title: 'Object Caching (Redis)', desc: 'Redis object caching dramatically reduces database queries, speeding up dynamic pages.' },
  ],
  securityBadge: 'WordPress Security',
  securityTitle: 'Fortress-Level WordPress Security',
  securityDesc: 'WordPress is the world\'s most targeted CMS. Our layered security approach protects your site at the server, application, and DNS level.',
  securityBtnText: 'Secure My WordPress Site',
  securityBtnUrl: '/register',
  securityFeatures: [
    { title: 'Malware Scanner & Removal', desc: 'Daily automated malware scans with one-click removal. Infected sites are quarantined automatically.' },
    { title: 'WordPress Firewall (WAF)', desc: 'Application-layer firewall blocks SQLi, XSS, and OWASP Top 10 threats targeting WordPress.' },
    { title: 'Brute Force Protection', desc: 'Rate limiting and IP blocking on wp-admin and xmlrpc.php stops credential stuffing attacks.' },
    { title: 'Two-Factor Authentication', desc: 'Enable 2FA on your WordPress admin accounts and hosting control panel for double protection.' },
  ],
  plansTitle: 'Pick Your Perfect Plan',
  plansDesc: 'From solo bloggers to busy agencies — we have the right plan.',
  plans: [
    { name: 'WP Starter', price: 3.99, sites: '1 Site', storage: '20 GB SSD', highlight: false, badge: '', features: ['1 WordPress Site', '20 GB SSD Storage', 'Free SSL', 'Auto WordPress Updates', '1-Click Staging', 'Daily Backups', '5 Email Accounts'], btnText: 'Get Started', btnUrl: '/register' },
    { name: 'WP Business', price: 7.99, sites: '5 Sites', storage: '50 GB SSD', highlight: true, badge: 'Most Popular', features: ['5 WordPress Sites', '50 GB NVMe SSD', 'Free SSL + CDN', 'Auto WP + Plugin Updates', '1-Click Staging (per site)', 'Daily Backups', 'Unlimited Emails', 'Free Domain 1yr', 'Jetpack Free', 'Priority Support'], btnText: 'Get Started', btnUrl: '/register' },
    { name: 'WP Agency', price: 14.99, sites: 'Unlimited', storage: '200 GB SSD', highlight: false, badge: '', features: ['Unlimited WP Sites', '200 GB NVMe SSD', 'Wildcard SSL + CDN', 'Managed Updates', 'Multi-site Staging', 'Hourly Backups', 'Unlimited Emails', 'Free Domain 1yr', 'Malware Removal', 'Dedicated Support Manager'], btnText: 'Get Started', btnUrl: '/register' },
  ],
  faqTitle: 'Frequently Asked',
  faqs: [
    { q: 'Is WordPress pre-installed?', a: 'Yes, we can pre-install WordPress for you when you sign up, or install it with one click from your control panel.' },
    { q: 'Do you handle WordPress updates for me?', a: 'Yes, our managed auto-update system keeps WordPress core, themes, and plugins up to date with pre-update backups.' },
    { q: 'What is staging and why do I need it?', a: 'Staging lets you create an exact copy of your live site to test changes safely before pushing them to production.' },
    { q: 'Can I migrate my existing WordPress site?', a: 'Absolutely. Our team offers free migration from any host with zero downtime.' },
    { q: 'Is WooCommerce supported?', a: 'Yes, all plans are fully compatible with WooCommerce. Business and Agency plans include Redis caching for high-volume stores.' },
  ],
  migrationTitle: 'Move Your WordPress Site for Free',
  migrationDesc: 'Our WordPress migration experts will transfer your entire site — content, themes, plugins, and all settings — with zero downtime and zero cost.',
  migrationBtnText: 'Request Free Migration',
  migrationBtnUrl: '/register',
  migrationSteps: [
    { title: 'Full Site Transfer', desc: 'Files, database, themes, and plugins — everything moved over.' },
    { title: 'Expert WP Team', desc: 'WordPress specialists handle your migration, not automated scripts.' },
    { title: 'Zero Downtime', desc: 'Your old site stays live until the new one is verified and ready.' },
  ],
};

const WordPressHostingEditor: React.FC = () => {
  const { content, updateContent } = useContent();
  const [data, setData] = useState<any>(null);
  const [openPlan, setOpenPlan] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openFeat, setOpenFeat] = useState<number | null>(null);
  const [openSec, setOpenSec] = useState<number | null>(null);

  useEffect(() => {
    if (content) setData(content['pages.wordpressHosting'] || DEFAULT);
  }, [content]);

  const { save, saving, saved } = usePageSave('pages.wordpressHosting', data, updateContent);

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
    <SectionWrap title="WordPress Hosting Page" subtitle="Edit all content on the WordPress Hosting page" icon={<Layout size={20} />}>
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

      {/* SPEED STATS */}
      <Card>
        <CardTitle>Speed Stats Bar</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          {(data.speedStats || []).map((s: any, i: number) => (
            <div key={i} className="p-3 rounded-xl space-y-2" style={{ border: '1px solid rgba(103,61,230,0.1)' }}>
              <Input value={s.value} onChange={v => updArr('speedStats', i, 'value', v)} placeholder="15x" />
              <Input value={s.label} onChange={v => updArr('speedStats', i, 'label', v)} placeholder="Stat label" />
            </div>
          ))}
        </div>
        <AddBtn onClick={() => setData((p: any) => ({ ...p, speedStats: [...(p.speedStats || []), { value: '0', label: 'Metric' }] }))} label="Add Stat" />
      </Card>

      {/* WP FEATURES */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>WordPress Features</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, wpFeatures: [...(p.wpFeatures || []), { title: 'New Feature', desc: '' }] }))} label="Add" />
        </div>
        <FieldRow>
          <Field label="Section Title"><Input value={data.wpFeaturesTitle || ''} onChange={v => setData((p: any) => ({ ...p, wpFeaturesTitle: v }))} /></Field>
          <Field label="Description"><Input value={data.wpFeaturesDesc || ''} onChange={v => setData((p: any) => ({ ...p, wpFeaturesDesc: v }))} /></Field>
        </FieldRow>
        <div className="space-y-2 mt-2">
          {(data.wpFeatures || []).map((f: any, i: number) => (
            <AccordionItem key={i} title={f.title} index={i} open={openFeat} setOpen={setOpenFeat}
              onDelete={() => setData((p: any) => { const a = [...p.wpFeatures]; a.splice(i, 1); return { ...p, wpFeatures: a }; })}>
              <Field label="Title"><Input value={f.title} onChange={v => updArr('wpFeatures', i, 'title', v)} /></Field>
              <Field label="Description"><Textarea value={f.desc} onChange={v => updArr('wpFeatures', i, 'desc', v)} /></Field>
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* SECURITY */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Security Section</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, securityFeatures: [...(p.securityFeatures || []), { title: 'New Security Feature', desc: '' }] }))} label="Add" />
        </div>
        <FieldRow>
          <Field label="Section Title"><Input value={data.securityTitle || ''} onChange={v => setData((p: any) => ({ ...p, securityTitle: v }))} /></Field>
          <Field label="Badge"><Input value={data.securityBadge || ''} onChange={v => setData((p: any) => ({ ...p, securityBadge: v }))} /></Field>
        </FieldRow>
        <Field label="Description"><Textarea value={data.securityDesc || ''} onChange={v => setData((p: any) => ({ ...p, securityDesc: v }))} /></Field>
        <FieldRow>
          <Field label="Button Text"><Input value={data.securityBtnText || ''} onChange={v => setData((p: any) => ({ ...p, securityBtnText: v }))} /></Field>
          <Field label="Button URL"><Input value={data.securityBtnUrl || ''} onChange={v => setData((p: any) => ({ ...p, securityBtnUrl: v }))} /></Field>
        </FieldRow>
        <div className="space-y-2 mt-2">
          {(data.securityFeatures || []).map((sf: any, i: number) => (
            <AccordionItem key={i} title={sf.title} index={i} open={openSec} setOpen={setOpenSec}
              onDelete={() => setData((p: any) => { const a = [...p.securityFeatures]; a.splice(i, 1); return { ...p, securityFeatures: a }; })}>
              <Field label="Title"><Input value={sf.title} onChange={v => updArr('securityFeatures', i, 'title', v)} /></Field>
              <Field label="Description"><Textarea value={sf.desc} onChange={v => updArr('securityFeatures', i, 'desc', v)} /></Field>
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* PLANS */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>WordPress Plans</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, plans: [...(p.plans || []), { name: 'WP New', price: 9.99, sites: '1 Site', storage: '10 GB SSD', highlight: false, badge: '', features: [], btnText: 'Get Started', btnUrl: '/register' }] }))} label="Add Plan" />
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
                <Field label="Sites"><Input value={plan.sites} onChange={v => updArr('plans', i, 'sites', v)} placeholder="1 Site" /></Field>
                <Field label="Storage"><Input value={plan.storage} onChange={v => updArr('plans', i, 'storage', v)} placeholder="20 GB SSD" /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="Badge Text (optional)"><Input value={plan.badge || ''} onChange={v => updArr('plans', i, 'badge', v)} placeholder="Most Popular" /></Field>
                <div className="flex items-end pb-1">
                  <Toggle value={plan.highlight ?? false} onChange={v => updArr('plans', i, 'highlight', v)} label="Highlight (Featured)" />
                </div>
              </FieldRow>
              <FieldRow>
                <Field label="Button Text"><Input value={plan.btnText || 'Get Started'} onChange={v => updArr('plans', i, 'btnText', v)} /></Field>
                <Field label="Button URL"><Input value={plan.btnUrl || '/register'} onChange={v => updArr('plans', i, 'btnUrl', v)} /></Field>
              </FieldRow>
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

      {/* FAQS */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>FAQ Section</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, faqs: [...(p.faqs || []), { q: 'New Question?', a: 'Answer here.' }] }))} label="Add FAQ" />
        </div>
        <Field label="Section Title"><Input value={data.faqTitle || ''} onChange={v => setData((p: any) => ({ ...p, faqTitle: v }))} /></Field>
        <div className="space-y-2 mt-2">
          {(data.faqs || []).map((faq: any, i: number) => (
            <AccordionItem key={i} title={faq.q} index={i} open={openFaq} setOpen={setOpenFaq}
              onDelete={() => setData((p: any) => { const a = [...p.faqs]; a.splice(i, 1); return { ...p, faqs: a }; })}>
              <Field label="Question"><Input value={faq.q} onChange={v => updArr('faqs', i, 'q', v)} /></Field>
              <Field label="Answer"><Textarea value={faq.a} onChange={v => updArr('faqs', i, 'a', v)} rows={3} /></Field>
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* MIGRATION */}
      <Card>
        <CardTitle>Free Migration Section</CardTitle>
        <Field label="Title"><Input value={data.migrationTitle || ''} onChange={v => setData((p: any) => ({ ...p, migrationTitle: v }))} /></Field>
        <Field label="Description"><Textarea value={data.migrationDesc || ''} onChange={v => setData((p: any) => ({ ...p, migrationDesc: v }))} /></Field>
        <FieldRow>
          <Field label="Button Text"><Input value={data.migrationBtnText || ''} onChange={v => setData((p: any) => ({ ...p, migrationBtnText: v }))} /></Field>
          <Field label="Button URL"><Input value={data.migrationBtnUrl || ''} onChange={v => setData((p: any) => ({ ...p, migrationBtnUrl: v }))} /></Field>
        </FieldRow>
        <Divider label="Migration Steps" />
        {(data.migrationSteps || []).map((s: any, i: number) => (
          <div key={i} className="p-3 rounded-xl space-y-2" style={{ border: '1px solid rgba(103,61,230,0.1)' }}>
            <div className="flex gap-2">
              <Input value={s.title} onChange={v => { const a = [...(data.migrationSteps || [])]; a[i] = { ...a[i], title: v }; setData((p: any) => ({ ...p, migrationSteps: a })); }} placeholder="Step title" />
              <DelBtn onClick={() => { const a = [...(data.migrationSteps || [])]; a.splice(i, 1); setData((p: any) => ({ ...p, migrationSteps: a })); }} />
            </div>
            <Input value={s.desc} onChange={v => { const a = [...(data.migrationSteps || [])]; a[i] = { ...a[i], desc: v }; setData((p: any) => ({ ...p, migrationSteps: a })); }} placeholder="Step description" />
          </div>
        ))}
        <AddBtn onClick={() => setData((p: any) => ({ ...p, migrationSteps: [...(p.migrationSteps || []), { title: 'New Step', desc: '' }] }))} label="Add Step" />
      </Card>

      <div className="flex items-center gap-4 pt-2">
        <SaveBtn onClick={save} saving={saving} />
        <SuccessBadge show={saved} />
      </div>
    </SectionWrap>
  );
};

export default WordPressHostingEditor;
