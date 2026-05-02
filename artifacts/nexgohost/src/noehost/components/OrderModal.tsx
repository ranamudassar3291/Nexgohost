import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import { useCurrency } from '../CurrencyContext';

export interface OrderPlan {
  id: string;
  name: string;
  description?: string;
  monthlyPrice: number;
  yearlyPrice: number | null;
  quarterlyPrice?: number | null;
  semiannualPrice?: number | null;
  type: 'hosting' | 'vps' | 'domain';
  features?: string[];
  defaultCycle?: 'monthly' | 'quarterly' | 'semiannual' | 'yearly';
}

type BillingCycle = 'monthly' | 'quarterly' | 'semiannual' | 'yearly';

interface OrderModalProps {
  plan: OrderPlan | null;
  onClose: () => void;
}

interface CycleOption {
  key: BillingCycle;
  label: string;
  sublabel: string;
  price: number;
  perMonth: number;
  available: boolean;
  savePct: number;
}

const OrderModal: React.FC<OrderModalProps> = ({ plan, onClose }) => {
  const { convertFromPKR } = useCurrency();

  const buildCycles = (p: OrderPlan): CycleOption[] => {
    const monthly = p.monthlyPrice;
    return [
      {
        key: 'monthly',
        label: 'Monthly',
        sublabel: '/month',
        price: monthly,
        perMonth: monthly,
        available: true,
        savePct: 0,
      },
      {
        key: 'quarterly',
        label: 'Quarterly',
        sublabel: '/3 months',
        price: p.quarterlyPrice ?? monthly * 3,
        perMonth: (p.quarterlyPrice ?? monthly * 3) / 3,
        available: p.quarterlyPrice != null,
        savePct: p.quarterlyPrice != null
          ? Math.round((1 - p.quarterlyPrice / (monthly * 3)) * 100)
          : 0,
      },
      {
        key: 'semiannual',
        label: 'Semi-Annual',
        sublabel: '/6 months',
        price: p.semiannualPrice ?? monthly * 6,
        perMonth: (p.semiannualPrice ?? monthly * 6) / 6,
        available: p.semiannualPrice != null,
        savePct: p.semiannualPrice != null
          ? Math.round((1 - p.semiannualPrice / (monthly * 6)) * 100)
          : 0,
      },
      {
        key: 'yearly',
        label: 'Yearly',
        sublabel: '/year',
        price: p.yearlyPrice ?? monthly * 12,
        perMonth: (p.yearlyPrice ?? monthly * 12) / 12,
        available: p.yearlyPrice != null,
        savePct: p.yearlyPrice != null
          ? Math.round((1 - p.yearlyPrice / (monthly * 12)) * 100)
          : 0,
      },
    ];
  };

  const [cycle, setCycle] = useState<BillingCycle>(
    plan?.defaultCycle ?? (plan?.yearlyPrice ? 'yearly' : 'monthly')
  );

  if (!plan) return null;

  const cycles = buildCycles(plan);
  const activeCycle = cycles.find(c => c.key === cycle) || cycles[0];

  const handleProceed = () => {
    const dest = `/client/order/add/${encodeURIComponent(plan.id)}?cycle=${cycle}`;
    window.location.href = dest;
  };

  return (
    <AnimatePresence>
      {plan && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md z-10 overflow-hidden"
          >
            <div className="bg-gradient-to-br from-primary to-primary-600 px-6 pt-6 pb-8">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              >
                <X size={16} />
              </button>
              <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-black px-3 py-1 rounded-full mb-3 uppercase tracking-widest">
                <Zap size={10} fill="white" /> Choose Your Billing
              </div>
              <h2 className="text-2xl font-black text-white mb-1">{plan.name}</h2>
              {plan.description && (
                <p className="text-primary-200 text-sm font-medium">{plan.description}</p>
              )}
            </div>

            <div className="-mt-4 mx-4 bg-white rounded-2xl shadow-lg p-5 border border-slate-100">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                Select Billing Cycle
              </p>
              <div className="grid grid-cols-2 gap-3">
                {cycles.map(c => (
                  <button
                    key={c.key}
                    onClick={() => c.available && setCycle(c.key)}
                    disabled={!c.available}
                    className={`p-4 rounded-xl border-2 text-left transition-all relative ${
                      cycle === c.key
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-slate-200 hover:border-slate-300'
                    } ${!c.available ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {c.savePct > 0 && (
                      <span className="absolute -top-2.5 -right-2.5 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow">
                        Save {c.savePct}%
                      </span>
                    )}
                    <p className="text-xs font-bold text-slate-500 mb-1">{c.label}</p>
                    {c.available ? (
                      <>
                        <p className="text-xl font-black text-slate-900">
                          {convertFromPKR(c.perMonth)}
                          <span className="text-xs font-bold text-slate-400">/mo</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {convertFromPKR(c.price)}{c.sublabel}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400 font-medium mt-1">Not available</p>
                    )}
                  </button>
                ))}
              </div>

              {activeCycle.savePct > 0 && (
                <p className="mt-3 text-center text-xs text-emerald-600 font-bold">
                  Billed as {convertFromPKR(activeCycle.price)}{activeCycle.sublabel} — save {activeCycle.savePct}%
                </p>
              )}
            </div>

            <div className="px-6 pt-3 pb-2">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium justify-center">
                <ShieldCheck size={13} className="text-emerald-500" />
                Login or create a free account at checkout — no account needed to browse
              </div>
            </div>

            <div className="px-6 pb-5 pt-2 flex gap-3">
              <button
                onClick={onClose}
                className="flex-shrink-0 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-black text-sm hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleProceed}
                className="flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 bg-primary hover:bg-primary-600 text-white shadow-lg shadow-primary/30 transition-all"
              >
                Continue to Checkout <ArrowRight size={15} />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default OrderModal;
