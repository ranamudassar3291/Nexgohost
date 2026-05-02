import React from 'react';
import { Save, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

export const SectionWrap: React.FC<{ title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, subtitle, icon, children }) => (
  <div className="space-y-6">
    <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'rgba(103,61,230,0.2)' }}>
      {icon && <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(103,61,230,0.15)', color: '#a78bfa' }}>{icon}</div>}
      <div>
        <h2 className="text-xl font-black text-white">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`rounded-2xl p-6 space-y-4 ${className}`} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(103,61,230,0.15)' }}>
    {children}
  </div>
);

export const CardTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'rgba(103,61,230,0.8)' }}>{children}</h3>
);

export const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">{children}</label>
);

export const Input: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; className?: string }> = ({ value, onChange, placeholder, className = '' }) => (
  <input
    type="text"
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className={`w-full px-4 py-2.5 rounded-xl text-sm text-white font-medium outline-none transition-all ${className}`}
    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(103,61,230,0.2)', color: '#e2e8f0' }}
    onFocus={e => e.target.style.borderColor = '#673de6'}
    onBlur={e => e.target.style.borderColor = 'rgba(103,61,230,0.2)'}
  />
);

export const NumInput: React.FC<{ value: number; onChange: (v: number) => void; step?: number; min?: number; placeholder?: string }> = ({ value, onChange, step = 0.01, min = 0, placeholder }) => (
  <input
    type="number"
    value={value}
    onChange={e => onChange(parseFloat(e.target.value) || 0)}
    placeholder={placeholder}
    step={step}
    min={min}
    className="w-full px-4 py-2.5 rounded-xl text-sm text-white font-medium outline-none"
    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(103,61,230,0.2)', color: '#e2e8f0' }}
  />
);

export const Textarea: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }> = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea
    rows={rows}
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-4 py-2.5 rounded-xl text-sm text-white font-medium outline-none resize-none transition-all"
    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(103,61,230,0.2)', color: '#e2e8f0' }}
    onFocus={e => e.target.style.borderColor = '#673de6'}
    onBlur={e => e.target.style.borderColor = 'rgba(103,61,230,0.2)'}
  />
);

export const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; label?: string }> = ({ value, onChange, label }) => (
  <div className="flex items-center gap-3">
    <button
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${value ? 'bg-primary' : 'bg-white/10'}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-6' : 'left-1'}`} />
    </button>
    {label && <span className="text-sm text-slate-400 font-medium">{label}</span>}
  </div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <Label>{label}</Label>
    {children}
  </div>
);

export const FieldRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
);

export const SaveBtn: React.FC<{ onClick: () => void; saving?: boolean }> = ({ onClick, saving }) => (
  <button
    onClick={onClick}
    disabled={saving}
    className="flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm text-white transition-all disabled:opacity-50"
    style={{ background: 'linear-gradient(135deg, #673de6, #8b5cf6)', boxShadow: '0 4px 20px rgba(103,61,230,0.35)' }}
  >
    <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
  </button>
);

export const AddBtn: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = 'Add Item' }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-white transition-all hover:opacity-80"
    style={{ background: 'rgba(103,61,230,0.25)', border: '1px solid rgba(103,61,230,0.3)' }}
  >
    <Plus size={14} /> {label}
  </button>
);

export const DelBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
  >
    <Trash2 size={14} />
  </button>
);

export const AccordionItem: React.FC<{ title: string; children: React.ReactNode; onDelete?: () => void; index: number; open: number | null; setOpen: (v: number | null) => void }> = ({ title, children, onDelete, index, open, setOpen }) => (
  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(103,61,230,0.15)', background: 'rgba(255,255,255,0.02)' }}>
    <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setOpen(open === index ? null : index)}>
      <span className="text-sm font-bold text-white">{title || `Item ${index + 1}`}</span>
      <div className="flex items-center gap-2">
        {onDelete && <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1 text-red-400 hover:bg-red-400/10 rounded transition-all"><Trash2 size={13} /></button>}
        {open === index ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </div>
    </div>
    {open === index && <div className="px-4 pb-4 pt-2 space-y-3 border-t" style={{ borderColor: 'rgba(103,61,230,0.1)' }}>{children}</div>}
  </div>
);

export const Divider: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex items-center gap-3 my-2">
    <div className="flex-1 h-px" style={{ background: 'rgba(103,61,230,0.15)' }} />
    {label && <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{label}</span>}
    <div className="flex-1 h-px" style={{ background: 'rgba(103,61,230,0.15)' }} />
  </div>
);

export const SuccessBadge: React.FC<{ show: boolean }> = ({ show }) => show ? (
  <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full">Saved!</span>
) : null;

export function usePageSave(contentKey: string, localData: any, updateContent: (k: string, v: any) => Promise<void>) {
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const save = async () => {
    setSaving(true);
    await updateContent(contentKey, localData);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return { save, saving, saved };
}
