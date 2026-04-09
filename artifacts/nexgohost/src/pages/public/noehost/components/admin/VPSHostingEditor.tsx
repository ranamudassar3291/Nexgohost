import React, { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';
import { useContent } from '@/context/ContentContext';
import {
  SectionWrap, Card, CardTitle, Field, FieldRow, Input, NumInput, Textarea, Toggle,
  SaveBtn, AddBtn, DelBtn, AccordionItem, Divider, SuccessBadge, usePageSave
} from './AdminShared';

const DEFAULT: any = {
  hero: {
    badge: 'KVM Virtualization — Full Root Access',
    title: 'VPS Hosting.',
    titleHighlight: 'Your Rules.',
    description: 'Deploy a high-performance KVM VPS in under 60 seconds. Full root access, NVMe SSD storage, and a guaranteed 10 Gbps network uplink.',
    primaryBtn: { text: 'Deploy Now', url: '#vps-plans', show: true },
    secondaryBtn: { text: 'View Specs', url: '#vps-specs', show: true },
    badges: ['Root SSH Access', 'Deploy in 60s', 'NVMe SSD', 'DDoS Protection'],
  },
  plans: [
    { name: 'VPS-1', cpu: '1 vCPU', ram: '2 GB RAM', storage: '40 GB NVMe', bandwidth: '2 TB', price: 9.99, popular: false, btnText: 'Deploy Now', btnUrl: '/register' },
    { name: 'VPS-2', cpu: '2 vCPU', ram: '4 GB RAM', storage: '80 GB NVMe', bandwidth: '4 TB', price: 19.99, popular: true, btnText: 'Deploy Now', btnUrl: '/register' },
    { name: 'VPS-4', cpu: '4 vCPU', ram: '8 GB RAM', storage: '160 GB NVMe', bandwidth: '8 TB', price: 39.99, popular: false, btnText: 'Deploy Now', btnUrl: '/register' },
    { name: 'VPS-8', cpu: '8 vCPU', ram: '16 GB RAM', storage: '320 GB NVMe', bandwidth: '16 TB', price: 79.99, popular: false, btnText: 'Deploy Now', btnUrl: '/register' },
  ],
  plansTitle: 'Choose Your Power',
  plansDesc: 'All plans include 10 Gbps uplink, DDoS protection & instant provisioning.',
  useCasesTitle: 'What Will You Build?',
  useCasesDesc: 'VPS hosting is the ideal foundation for virtually any application or workload.',
  useCases: [
    { title: 'Development & Testing', desc: 'Isolated environments for dev, staging and CI/CD pipelines.' },
    { title: 'High-Traffic Websites', desc: 'Dedicated resources ensure no traffic spike slows you down.' },
    { title: 'Database Servers', desc: 'Host MySQL, PostgreSQL, MongoDB with full configuration control.' },
    { title: 'Game Servers', desc: 'Low-latency VPS nodes perfect for Minecraft, CS:GO, and Rust.' },
    { title: 'VPN & Security', desc: 'Run your own VPN, proxy, or security appliance.' },
    { title: 'Analytics & APIs', desc: 'Handle real-time workloads, webhooks, and data pipelines.' },
  ],
  techSpecs: [
    { spec: 'Virtualization', value: 'KVM (Kernel-based VM)' },
    { spec: 'Storage Type', value: 'NVMe SSD RAID-10' },
    { spec: 'Network Speed', value: '10 Gbps uplink' },
    { spec: 'DDoS Protection', value: 'Up to 1 Tbps mitigation' },
    { spec: 'Operating Systems', value: 'Ubuntu, Debian, CentOS, AlmaLinux, Windows' },
    { spec: 'Root Access', value: 'Full SSH root access' },
    { spec: 'Control Panel', value: 'Optional Plesk / cPanel / Webmin' },
    { spec: 'Provisioning', value: 'Instant (< 60 seconds)' },
    { spec: 'Backups', value: 'Weekly automated + on-demand snapshots' },
    { spec: 'IPv4/IPv6', value: '1 IPv4 + /64 IPv6 block included' },
  ],
  datacenters: [
    { city: 'New York', region: 'US East', ping: '5ms' },
    { city: 'Los Angeles', region: 'US West', ping: '8ms' },
    { city: 'London', region: 'EU West', ping: '3ms' },
    { city: 'Frankfurt', region: 'EU Central', ping: '2ms' },
    { city: 'Singapore', region: 'APAC', ping: '4ms' },
    { city: 'Sydney', region: 'AU', ping: '7ms' },
  ],
  migrationTitle: 'Free Migration from Any Host',
  migrationDesc: 'Already on a VPS elsewhere? Our migration team will move your entire server — files, databases, configs — at no cost and with zero downtime.',
  migrationPoints: ['Zero Downtime Migration', 'Free of Charge', 'Done in Under 4 Hours'],
  migrationBtnText: 'Request Free Migration',
  migrationBtnUrl: '/register',
  securityTitle: 'Total Control. Maximum Security.',
  securityDesc: 'From DDoS mitigation to full SSH root access, your VPS is fortified and entirely yours.',
  securityItems: [
    { title: 'DDoS Mitigation', desc: 'Up to 1 Tbps volumetric attack protection at the network edge.' },
    { title: 'Firewall Control', desc: 'Configurable iptables / nftables rules with UFW GUI support.' },
    { title: 'Root SSH Access', desc: 'Full command-line control. Configure every setting, install anything.' },
    { title: 'Snapshot Backups', desc: 'One-click snapshots. Rollback to any state in seconds.' },
  ],
  securityBtnText: 'Deploy Your VPS Now',
  securityBtnUrl: '/register',
};

const VPSHostingEditor: React.FC = () => {
  const { content, updateContent } = useContent();
  const [data, setData] = useState<any>(null);
  const [openPlan, setOpenPlan] = useState<number | null>(null);
  const [openUC, setOpenUC] = useState<number | null>(null);
  const [openSec, setOpenSec] = useState<number | null>(null);

  useEffect(() => {
    if (content) setData(content['pages.vpsHosting'] || DEFAULT);
  }, [content]);

  const { save, saving, saved } = usePageSave('pages.vpsHosting', data, updateContent);

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

  if (!data) return <div className="text-slate-400 p-8">Loading...</div>;

  return (
    <SectionWrap title="VPS Hosting Page" subtitle="Edit all content on the VPS Hosting page" icon={<Cpu size={20} />}>
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
          <Field label="Button Text"><Input value={data.hero?.primaryBtn?.text || ''} onChange={v => upd('hero.primaryBtn.text', v)} /></Field>
          <Field label="Button URL"><Input value={data.hero?.primaryBtn?.url || ''} onChange={v => upd('hero.primaryBtn.url', v)} /></Field>
        </FieldRow>
        <Toggle value={data.hero?.primaryBtn?.show ?? true} onChange={v => upd('hero.primaryBtn.show', v)} label="Show Primary Button" />
        <Divider label="Secondary Button" />
        <FieldRow>
          <Field label="Button Text"><Input value={data.hero?.secondaryBtn?.text || ''} onChange={v => upd('hero.secondaryBtn.text', v)} /></Field>
          <Field label="Button URL"><Input value={data.hero?.secondaryBtn?.url || ''} onChange={v => upd('hero.secondaryBtn.url', v)} /></Field>
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

      {/* PLANS */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>VPS Plans</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, plans: [...(p.plans || []), { name: 'VPS-New', cpu: '1 vCPU', ram: '2 GB RAM', storage: '40 GB NVMe', bandwidth: '1 TB', price: 9.99, popular: false, btnText: 'Deploy Now', btnUrl: '/register' }] }))} label="Add Plan" />
        </div>
        <FieldRow>
          <Field label="Section Title"><Input value={data.plansTitle || ''} onChange={v => setData((p: any) => ({ ...p, plansTitle: v }))} /></Field>
          <Field label="Section Description"><Input value={data.plansDesc || ''} onChange={v => setData((p: any) => ({ ...p, plansDesc: v }))} /></Field>
        </FieldRow>
        <div className="space-y-2 mt-3">
          {(data.plans || []).map((plan: any, i: number) => (
            <AccordionItem key={i} title={`${plan.name} — $${plan.price}/mo`} index={i} open={openPlan} setOpen={setOpenPlan}
              onDelete={() => setData((p: any) => { const a = [...p.plans]; a.splice(i, 1); return { ...p, plans: a }; })}>
              <FieldRow>
                <Field label="Plan Name"><Input value={plan.name} onChange={v => updArr('plans', i, 'name', v)} /></Field>
                <Field label="Price ($/mo)"><NumInput value={plan.price} onChange={v => updArr('plans', i, 'price', v)} /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="CPU"><Input value={plan.cpu} onChange={v => updArr('plans', i, 'cpu', v)} placeholder="2 vCPU" /></Field>
                <Field label="RAM"><Input value={plan.ram} onChange={v => updArr('plans', i, 'ram', v)} placeholder="4 GB RAM" /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="Storage"><Input value={plan.storage} onChange={v => updArr('plans', i, 'storage', v)} placeholder="80 GB NVMe" /></Field>
                <Field label="Bandwidth"><Input value={plan.bandwidth} onChange={v => updArr('plans', i, 'bandwidth', v)} placeholder="4 TB" /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="Button Text"><Input value={plan.btnText || 'Deploy Now'} onChange={v => updArr('plans', i, 'btnText', v)} /></Field>
                <Field label="Button URL"><Input value={plan.btnUrl || '/register'} onChange={v => updArr('plans', i, 'btnUrl', v)} /></Field>
              </FieldRow>
              <Toggle value={plan.popular ?? false} onChange={v => updArr('plans', i, 'popular', v)} label="Mark as Popular" />
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* USE CASES */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Use Cases</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, useCases: [...(p.useCases || []), { title: 'New Use Case', desc: '' }] }))} label="Add" />
        </div>
        <FieldRow>
          <Field label="Section Title"><Input value={data.useCasesTitle || ''} onChange={v => setData((p: any) => ({ ...p, useCasesTitle: v }))} /></Field>
          <Field label="Description"><Input value={data.useCasesDesc || ''} onChange={v => setData((p: any) => ({ ...p, useCasesDesc: v }))} /></Field>
        </FieldRow>
        <div className="space-y-2 mt-3">
          {(data.useCases || []).map((uc: any, i: number) => (
            <AccordionItem key={i} title={uc.title} index={i} open={openUC} setOpen={setOpenUC}
              onDelete={() => setData((p: any) => { const a = [...p.useCases]; a.splice(i, 1); return { ...p, useCases: a }; })}>
              <Field label="Title"><Input value={uc.title} onChange={v => updArr('useCases', i, 'title', v)} /></Field>
              <Field label="Description"><Textarea value={uc.desc} onChange={v => updArr('useCases', i, 'desc', v)} /></Field>
            </AccordionItem>
          ))}
        </div>
      </Card>

      {/* TECH SPECS */}
      <Card>
        <CardTitle>Technical Specs</CardTitle>
        <div className="space-y-2">
          {(data.techSpecs || []).map((s: any, i: number) => (
            <div key={i} className="flex gap-2 items-center">
              <Input value={s.spec} onChange={v => updArr('techSpecs', i, 'spec', v)} placeholder="Spec name" />
              <Input value={s.value} onChange={v => updArr('techSpecs', i, 'value', v)} placeholder="Value" />
              <DelBtn onClick={() => setData((p: any) => { const a = [...p.techSpecs]; a.splice(i, 1); return { ...p, techSpecs: a }; })} />
            </div>
          ))}
        </div>
        <AddBtn onClick={() => setData((p: any) => ({ ...p, techSpecs: [...(p.techSpecs || []), { spec: 'New Spec', value: 'Value' }] }))} label="Add Spec Row" />
      </Card>

      {/* DATA CENTERS */}
      <Card>
        <CardTitle>Data Centers</CardTitle>
        <div className="space-y-2">
          {(data.datacenters || []).map((dc: any, i: number) => (
            <div key={i} className="flex gap-2">
              <Input value={dc.city} onChange={v => updArr('datacenters', i, 'city', v)} placeholder="City" />
              <Input value={dc.region} onChange={v => updArr('datacenters', i, 'region', v)} placeholder="Region" />
              <Input value={dc.ping} onChange={v => updArr('datacenters', i, 'ping', v)} placeholder="5ms" />
              <DelBtn onClick={() => setData((p: any) => { const a = [...p.datacenters]; a.splice(i, 1); return { ...p, datacenters: a }; })} />
            </div>
          ))}
        </div>
        <AddBtn onClick={() => setData((p: any) => ({ ...p, datacenters: [...(p.datacenters || []), { city: 'New City', region: 'Region', ping: '10ms' }] }))} label="Add Datacenter" />
      </Card>

      {/* MIGRATION CTA */}
      <Card>
        <CardTitle>Migration CTA Section</CardTitle>
        <Field label="Title"><Input value={data.migrationTitle || ''} onChange={v => setData((p: any) => ({ ...p, migrationTitle: v }))} /></Field>
        <Field label="Description"><Textarea value={data.migrationDesc || ''} onChange={v => setData((p: any) => ({ ...p, migrationDesc: v }))} /></Field>
        <div className="space-y-2">
          {(data.migrationPoints || []).map((pt: string, i: number) => (
            <div key={i} className="flex gap-2">
              <Input value={pt} onChange={v => { const a = [...(data.migrationPoints || [])]; a[i] = v; setData((p: any) => ({ ...p, migrationPoints: a })); }} />
              <DelBtn onClick={() => { const a = [...(data.migrationPoints || [])]; a.splice(i, 1); setData((p: any) => ({ ...p, migrationPoints: a })); }} />
            </div>
          ))}
          <AddBtn onClick={() => setData((p: any) => ({ ...p, migrationPoints: [...(p.migrationPoints || []), 'New Point'] }))} label="Add Point" />
        </div>
        <FieldRow>
          <Field label="Button Text"><Input value={data.migrationBtnText || ''} onChange={v => setData((p: any) => ({ ...p, migrationBtnText: v }))} /></Field>
          <Field label="Button URL"><Input value={data.migrationBtnUrl || ''} onChange={v => setData((p: any) => ({ ...p, migrationBtnUrl: v }))} /></Field>
        </FieldRow>
      </Card>

      {/* SECURITY */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Security & Control Section</CardTitle>
          <AddBtn onClick={() => setData((p: any) => ({ ...p, securityItems: [...(p.securityItems || []), { title: 'New Item', desc: '' }] }))} label="Add Item" />
        </div>
        <Field label="Section Title"><Input value={data.securityTitle || ''} onChange={v => setData((p: any) => ({ ...p, securityTitle: v }))} /></Field>
        <Field label="Section Description"><Textarea value={data.securityDesc || ''} onChange={v => setData((p: any) => ({ ...p, securityDesc: v }))} /></Field>
        <div className="space-y-2 mt-2">
          {(data.securityItems || []).map((s: any, i: number) => (
            <AccordionItem key={i} title={s.title} index={i} open={openSec} setOpen={setOpenSec}
              onDelete={() => setData((p: any) => { const a = [...p.securityItems]; a.splice(i, 1); return { ...p, securityItems: a }; })}>
              <Field label="Title"><Input value={s.title} onChange={v => updArr('securityItems', i, 'title', v)} /></Field>
              <Field label="Description"><Textarea value={s.desc} onChange={v => updArr('securityItems', i, 'desc', v)} /></Field>
            </AccordionItem>
          ))}
        </div>
        <FieldRow>
          <Field label="Bottom Button Text"><Input value={data.securityBtnText || ''} onChange={v => setData((p: any) => ({ ...p, securityBtnText: v }))} /></Field>
          <Field label="Bottom Button URL"><Input value={data.securityBtnUrl || ''} onChange={v => setData((p: any) => ({ ...p, securityBtnUrl: v }))} /></Field>
        </FieldRow>
      </Card>

      <div className="flex items-center gap-4 pt-2">
        <SaveBtn onClick={save} saving={saving} />
        <SuccessBadge show={saved} />
      </div>
    </SectionWrap>
  );
};

export default VPSHostingEditor;
