import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Trash2, ArrowLeft, ArrowRight, Package } from 'lucide-react';
import { useCart, CartItem } from '../../context/CartContext';
import { useCurrency } from '../../CurrencyContext';

const CYCLE_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Semi-Annual',
  yearly: 'Yearly',
};

const CYCLE_OPTIONS: CartItem['billingCycle'][] = ['monthly', 'quarterly', 'semiannual', 'yearly'];

const Cart: React.FC = () => {
  const { items, removeItem, updateBillingCycle, clearCart, getTotal } = useCart();
  const { convertFromPKR } = useCurrency();

  const getItemPrice = (item: CartItem) => {
    switch (item.billingCycle) {
      case 'monthly': return item.monthlyPrice;
      case 'quarterly': return item.quarterlyPrice ?? item.monthlyPrice * 3;
      case 'semiannual': return item.semiannualPrice ?? item.monthlyPrice * 6;
      case 'yearly': return item.yearlyPrice ?? item.monthlyPrice * 12;
      default: return item.monthlyPrice;
    }
  };

  const getCycleSuffix = (cycle: string) => {
    switch (cycle) {
      case 'monthly': return '/mo';
      case 'quarterly': return '/3mo';
      case 'semiannual': return '/6mo';
      case 'yearly': return '/yr';
      default: return '';
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-dark pt-36 pb-20">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <div className="bg-secondary rounded-3xl p-12 border border-white/10">
            <ShoppingCart className="mx-auto mb-6 text-slate-500" size={64} />
            <h1 className="text-3xl font-black text-white mb-3">Your Cart is Empty</h1>
            <p className="text-slate-400 mb-8">Browse our hosting plans and add something to get started.</p>
            <Link
              to="/shared-hosting"
              className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white font-black rounded-2xl hover:bg-primary-600 transition-all"
            >
              Browse Plans <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark pt-36 pb-20">
      <div className="container mx-auto px-6 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <ShoppingCart size={28} /> Your Cart
            <span className="text-sm bg-primary/20 text-primary px-3 py-1 rounded-full font-bold">{items.length} item{items.length !== 1 ? 's' : ''}</span>
          </h1>
          <button
            onClick={clearCart}
            className="text-sm text-red-400 hover:text-red-300 font-bold transition-colors"
          >
            Clear All
          </button>
        </div>

        <div className="space-y-4 mb-8">
          {items.map(item => (
            <div key={item.id} className="bg-secondary rounded-2xl border border-white/10 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Package size={22} className="text-primary" />
              </div>

              <div className="flex-grow min-w-0">
                <h3 className="text-lg font-black text-white">{item.name}</h3>
                <p className="text-xs text-slate-400 font-medium capitalize">{item.type} Plan</p>
                {item.domainName && (
                  <p className="text-xs text-primary font-bold mt-1">{item.domainName}</p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={item.billingCycle}
                  onChange={e => updateBillingCycle(item.id, e.target.value as CartItem['billingCycle'])}
                  className="bg-dark border border-white/10 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none"
                >
                  {CYCLE_OPTIONS.map(c => {
                    const price = (() => {
                      switch (c) {
                        case 'monthly': return item.monthlyPrice;
                        case 'quarterly': return item.quarterlyPrice;
                        case 'semiannual': return item.semiannualPrice;
                        case 'yearly': return item.yearlyPrice;
                        default: return null;
                      }
                    })();
                    if (price === null || price === undefined) return null;
                    return (
                      <option key={c} value={c}>
                        {CYCLE_LABELS[c]}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="text-right flex-shrink-0 min-w-[100px]">
                <div className="text-xl font-black text-primary">
                  {convertFromPKR(getItemPrice(item))}
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {getCycleSuffix(item.billingCycle)}
                </div>
              </div>

              <button
                onClick={() => removeItem(item.id)}
                className="p-2 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>

        <div className="bg-secondary rounded-2xl border border-white/10 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 font-bold">Total</span>
            <span className="text-2xl font-black text-white">{convertFromPKR(getTotal())}</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/shared-hosting"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border border-white/10 text-white font-black rounded-2xl hover:bg-white/5 transition-all text-sm"
            >
              <ArrowLeft size={16} /> Continue Shopping
            </Link>
            <Link
              to="/checkout"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-black rounded-2xl hover:bg-primary-600 transition-all text-sm shadow-xl shadow-primary/20"
            >
              Proceed to Checkout <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
