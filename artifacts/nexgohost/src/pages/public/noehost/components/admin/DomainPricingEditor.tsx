import React, { useState, useEffect } from 'react';
import { Globe, DollarSign, Save } from 'lucide-react';
import { useContent } from '@/context/ContentContext';
import { SectionWrap, Card, CardTitle, SuccessBadge } from './AdminShared';

const TOP_20_TLDS = [
  { ext: '.com', label: 'Commercial (.com)' },
  { ext: '.net', label: 'Network (.net)' },
  { ext: '.org', label: 'Organization (.org)' },
  { ext: '.info', label: 'Information (.info)' },
  { ext: '.biz', label: 'Business (.biz)' },
  { ext: '.io', label: 'Tech Startup (.io)' },
  { ext: '.co', label: 'Company (.co)' },
  { ext: '.pk', label: 'Pakistan (.pk)' },
  { ext: '.store', label: 'Store (.store)' },
  { ext: '.online', label: 'Online (.online)' },
  { ext: '.tech', label: 'Technology (.tech)' },
  { ext: '.xyz', label: 'Generic (.xyz)' },
  { ext: '.ai', label: 'AI / Tech (.ai)' },
  { ext: '.app', label: 'Application (.app)' },
  { ext: '.dev', label: 'Developer (.dev)' },
  { ext: '.shop', label: 'Shop (.shop)' },
  { ext: '.site', label: 'Website (.site)' },
  { ext: '.website', label: 'Website (.website)' },
  { ext: '.blog', label: 'Blog (.blog)' },
  { ext: '.cloud', label: 'Cloud (.cloud)' },
];

const DEFAULT_PRICES: Record<string, { register: number; transfer: number }> = {
  '.com':     { register: 9.99,  transfer: 8.99  },
  '.net':     { register: 8.99,  transfer: 7.99  },
  '.org':     { register: 8.49,  transfer: 7.49  },
  '.info':    { register: 5.99,  transfer: 4.99  },
  '.biz':     { register: 7.99,  transfer: 6.99  },
  '.io':      { register: 39.99, transfer: 35.99 },
  '.co':      { register: 24.99, transfer: 22.99 },
  '.pk':      { register: 4.99,  transfer: 4.49  },
  '.store':   { register: 2.99,  transfer: 2.49  },
  '.online':  { register: 2.99,  transfer: 2.49  },
  '.tech':    { register: 12.99, transfer: 11.99 },
  '.xyz':     { register: 1.99,  transfer: 1.49  },
  '.ai':      { register: 79.99, transfer: 74.99 },
  '.app':     { register: 19.99, transfer: 17.99 },
  '.dev':     { register: 14.99, transfer: 12.99 },
  '.shop':    { register: 4.99,  transfer: 3.99  },
  '.site':    { register: 3.99,  transfer: 2.99  },
  '.website': { register: 3.49,  transfer: 2.49  },
  '.blog':    { register: 5.99,  transfer: 4.99  },
  '.cloud':   { register: 9.99,  transfer: 8.99  },
};

const buildDefault = () =>
  TOP_20_TLDS.map(t => ({
    ext: t.ext,
    register: DEFAULT_PRICES[t.ext]?.register ?? 9.99,
    transfer: DEFAULT_PRICES[t.ext]?.transfer ?? 8.99,
  }));

const DomainPricingEditor: React.FC = () => {
  const { content, updateContent } = useContent();
  const [tlds, setTlds] = useState<{ ext: string; register: number; transfer: number }[]>(buildDefault());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (content?.domainPricing?.tlds?.length) {
      const cms = content.domainPricing.tlds as { ext: string; register: number; transfer: number }[];
      const cmsMap = Object.fromEntries(cms.map((t: any) => [t.ext, t]));
      setTlds(TOP_20_TLDS.map(t => ({
        ext: t.ext,
        register: cmsMap[t.ext]?.register ?? DEFAULT_PRICES[t.ext]?.register ?? 9.99,
        transfer: cmsMap[t.ext]?.transfer ?? DEFAULT_PRICES[t.ext]?.transfer ?? 8.99,
      })));
    }
  }, [content?.domainPricing]);

  const update = (ext: string, field: 'register' | 'transfer', val: number) => {
    setTlds(prev => prev.map(t => t.ext === ext ? { ...t, [field]: val } : t));
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateContent('domainPricing', { tlds });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert('Failed to save domain pricing.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionWrap
      title="Domain Pricing"
      subtitle="Set register and transfer prices (USD) for all domain extensions. Prices auto-convert to visitor's currency."
      icon={<Globe size={20} />}
    >
      <div className="rounded-xl px-5 py-4 text-sm font-medium text-slate-300 flex items-start gap-3"
        style={{ background: 'rgba(103,61,230,0.08)', border: '1px solid rgba(103,61,230,0.2)' }}>
        <DollarSign size={18} className="text-primary flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-black text-white">Prices are in USD.</span> They are automatically
          converted and displayed in each visitor's local currency (PKR, GBP, EUR, etc.) based on live
          exchange rates. The <strong>Register</strong> price shows for available domains; the{' '}
          <strong>Transfer</strong> price shows for taken domains.
        </div>
      </div>

      <div className="grid grid-cols-[1fr_140px_140px] gap-3 px-4 py-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Extension</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Register (USD)</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Transfer (USD)</span>
      </div>

      <Card>
        <div className="space-y-0">
          {tlds.map((tld, i) => {
            const meta = TOP_20_TLDS.find(t => t.ext === tld.ext);
            return (
              <div
                key={tld.ext}
                className="grid grid-cols-[1fr_140px_140px] gap-3 items-center py-3 border-b last:border-0"
                style={{ borderColor: 'rgba(103,61,230,0.1)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0"
                    style={{ background: 'rgba(103,61,230,0.15)', color: '#a78bfa' }}>
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-black text-white text-sm">{tld.ext}</div>
                    <div className="text-[11px] text-slate-500 font-medium">{meta?.label}</div>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tld.register}
                    onChange={e => update(tld.ext, 'register', parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm font-bold outline-none text-right"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tld.transfer}
                    onChange={e => update(tld.ext, 'transfer', parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm font-bold outline-none text-right"
                    style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)', color: '#fb923c' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm text-white transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #673de6, #8b5cf6)', boxShadow: '0 4px 20px rgba(103,61,230,0.35)' }}
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {saved && (
          <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full">Saved!</span>
        )}
      </div>
    </SectionWrap>
  );
};

export default DomainPricingEditor;
