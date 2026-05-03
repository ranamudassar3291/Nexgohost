import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Trash2, ArrowRight, Package, Globe, ChevronRight, ShieldCheck, Tag, ArrowLeft } from 'lucide-react';
import { useCart, CartItem } from '../context/CartContext';
import { useCurrency } from '../CurrencyContext';
import { useNavigate } from 'react-router-dom';

function getItemPrice(item: CartItem): number {
  switch (item.billingCycle) {
    case 'yearly': return item.yearlyPrice ?? item.monthlyPrice * 12;
    case 'semiannual': return item.semiannualPrice ?? item.monthlyPrice * 6;
    case 'quarterly': return item.quarterlyPrice ?? item.monthlyPrice * 3;
    default: return item.monthlyPrice;
  }
}

const CYCLE_LABELS: Record<CartItem['billingCycle'], string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: '6 Months',
  yearly: 'Yearly',
};

const CYCLE_SUFFIX: Record<CartItem['billingCycle'], string> = {
  monthly: '/mo',
  quarterly: '/3mo',
  semiannual: '/6mo',
  yearly: '/yr',
};

function availableCycles(item: CartItem): CartItem['billingCycle'][] {
  const all: CartItem['billingCycle'][] = ['monthly', 'quarterly', 'semiannual', 'yearly'];
  return all.filter(c => {
    if (c === 'monthly') return true;
    if (c === 'quarterly') return item.quarterlyPrice != null;
    if (c === 'semiannual') return item.semiannualPrice != null;
    if (c === 'yearly') return item.yearlyPrice != null;
    return false;
  });
}


const CartSidebar: React.FC = () => {
  const { items, removeItem, updateBillingCycle, isCartOpen, closeCart, getTotal } = useCart();
  const { convertFromPKR } = useCurrency();
  const navigate = useNavigate();

  const handleCheckout = () => {
    if (items.length === 0) return;
    closeCart();
    navigate('/client/orders/new');
  };

  const handleContinueShopping = () => {
    closeCart();
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-[420px] shadow-2xl z-[301] flex flex-col"
            style={{ background: '#0f0f14', borderLeft: '1px solid rgba(103,61,230,0.25)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/15 rounded-xl flex items-center justify-center">
                  <ShoppingCart size={18} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white">Your Cart</h2>
                  <p className="text-xs text-slate-500 font-medium">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                </div>
                {items.length > 0 && (
                  <span className="w-6 h-6 bg-primary text-white text-xs font-black rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
                    {items.length}
                  </span>
                )}
              </div>
              <button
                onClick={closeCart}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-16">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <ShoppingCart size={32} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="font-black text-white mb-1">Your cart is empty</p>
                    <p className="text-sm text-slate-500 font-medium">Browse our hosting plans and add them to your cart.</p>
                  </div>
                  <button
                    onClick={closeCart}
                    className="flex items-center gap-2 text-primary font-black text-sm hover:underline"
                  >
                    <ArrowLeft size={15} /> Browse Plans
                  </button>
                </div>
              ) : (
                items.map(item => {
                  const cycles = availableCycles(item);
                  const price = getItemPrice(item);
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl p-4 space-y-3"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      {/* Item header */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                          {item.type === 'domain' ? <Globe size={18} className="text-primary" /> : <Package size={18} className="text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-white text-sm truncate">{item.name}</p>
                          {item.domainName && (
                            <p className="text-xs text-slate-400 font-mono">{item.domainName}</p>
                          )}
                          <p className="text-xs text-slate-500 capitalize">{item.type === 'hosting' ? 'Hosting Package' : item.type === 'vps' ? 'VPS Hosting' : 'Domain'}</p>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                          style={{ background: 'rgba(255,255,255,0.04)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Billing Cycle Selector */}
                      {cycles.length > 1 && (
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Billing Cycle</p>
                          <div className="flex flex-wrap gap-1.5">
                            {cycles.map(c => {
                              const cyclePrice = c === 'monthly' ? item.monthlyPrice
                                : c === 'quarterly' ? (item.quarterlyPrice ?? item.monthlyPrice * 3)
                                : c === 'semiannual' ? (item.semiannualPrice ?? item.monthlyPrice * 6)
                                : (item.yearlyPrice ?? item.monthlyPrice * 12);
                              const savePct = c !== 'monthly' && item.monthlyPrice > 0
                                ? Math.round((1 - cyclePrice / (item.monthlyPrice * (c === 'quarterly' ? 3 : c === 'semiannual' ? 6 : 12))) * 100)
                                : 0;
                              const isSelected = item.billingCycle === c;
                              return (
                                <button
                                  key={c}
                                  onClick={() => updateBillingCycle(item.id, c)}
                                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                    isSelected
                                      ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                      : 'text-slate-400 hover:text-white hover:border-white/20'
                                  }`}
                                  style={!isSelected ? { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)' } : {}}
                                >
                                  {CYCLE_LABELS[c]}
                                  {savePct > 0 && (
                                    <span className={`text-[9px] font-black ${isSelected ? 'text-emerald-200' : 'text-emerald-500'}`}>
                                      -{savePct}%
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Price */}
                      <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <span className="text-xs text-slate-500 font-medium">{CYCLE_LABELS[item.billingCycle]} price</span>
                        <span className="text-base font-black text-white">
                          {convertFromPKR(price)}
                          <span className="text-xs font-bold text-slate-500">{CYCLE_SUFFIX[item.billingCycle]}</span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="px-4 py-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
                {/* Summary */}
                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                    <Tag size={13} className="text-primary" /> Subtotal
                  </div>
                  <span className="text-xl font-black text-white">{convertFromPKR(getTotal())}</span>
                </div>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-3 text-xs text-slate-500 font-medium py-1">
                  <span className="flex items-center gap-1"><ShieldCheck size={11} className="text-emerald-500" /> Secure</span>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <span>30-day money-back</span>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <span>No setup fees</span>
                </div>

                {/* Checkout Button */}
                <button
                  onClick={handleCheckout}
                  className="w-full py-3.5 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl hover:brightness-110 active:scale-[0.99]"
                  style={{ background: 'linear-gradient(135deg, #673de6 0%, #4c22cc 100%)', boxShadow: '0 8px 24px rgba(103,61,230,0.35)' }}
                >
                  Checkout Now <ChevronRight size={17} />
                </button>

                {/* Continue Shopping */}
                <button
                  onClick={handleContinueShopping}
                  className="w-full py-2.5 rounded-xl font-black text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <ArrowLeft size={14} /> Continue Shopping
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartSidebar;
