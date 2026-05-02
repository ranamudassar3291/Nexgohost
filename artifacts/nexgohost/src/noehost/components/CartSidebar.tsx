import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Trash2, ArrowRight, Package, Globe } from 'lucide-react';
import { useCart, CartItem } from '../context/CartContext';
import { useCurrency } from '../CurrencyContext';

function getItemPrice(item: CartItem): number {
  switch (item.billingCycle) {
    case 'yearly': return item.yearlyPrice ?? item.monthlyPrice * 12;
    case 'semiannual': return item.semiannualPrice ?? item.monthlyPrice * 6;
    case 'quarterly': return item.quarterlyPrice ?? item.monthlyPrice * 3;
    default: return item.monthlyPrice;
  }
}

function cycleSuffix(cycle: CartItem['billingCycle']): string {
  switch (cycle) {
    case 'yearly': return '/yr';
    case 'semiannual': return '/6mo';
    case 'quarterly': return '/3mo';
    default: return '/mo';
  }
}

const CartSidebar: React.FC = () => {
  const { items, removeItem, isCartOpen, closeCart, getTotal } = useCart();
  const { convertFromPKR } = useCurrency();

  const handleCheckout = () => {
    closeCart();
    const hostingItems = items.filter(i => i.type === 'hosting' || i.type === 'vps');
    const domainItems = items.filter(i => i.type === 'domain');

    if (hostingItems.length === 1 && domainItems.length === 0) {
      const item = hostingItems[0];
      window.location.href = `/client/order/add/${item.planId}?cycle=${item.billingCycle}`;
    } else if (domainItems.length === 1 && hostingItems.length === 0) {
      const d = domainItems[0];
      window.location.href = `/client/order?domain=${encodeURIComponent(d.domainName || '')}`;
    } else {
      window.location.href = '/client/order';
    }
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
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[300]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[301] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <ShoppingCart size={20} className="text-primary" />
                <h2 className="text-lg font-black text-slate-900">Your Cart</h2>
                {items.length > 0 && (
                  <span className="w-6 h-6 bg-primary text-white text-xs font-black rounded-full flex items-center justify-center">
                    {items.length}
                  </span>
                )}
              </div>
              <button onClick={closeCart} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <ShoppingCart size={32} className="text-slate-300" />
                  </div>
                  <div>
                    <p className="font-black text-slate-700 mb-1">Your cart is empty</p>
                    <p className="text-sm text-slate-400">Browse our hosting plans and add them to your cart.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map(item => (
                    <div key={item.id} className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.type === 'domain' ? 'bg-primary/10 text-primary' : 'bg-primary/10 text-primary'}`}>
                        {item.type === 'domain' ? <Globe size={18} /> : <Package size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900 text-sm truncate">{item.name}</p>
                        {item.domainName && (
                          <p className="text-xs text-slate-500 font-medium">{item.domainName}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full capitalize">{item.billingCycle}</span>
                          <span className="text-sm font-black text-slate-900">
                            {convertFromPKR(getItemPrice(item))}{cycleSuffix(item.billingCycle)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="px-6 py-4 border-t border-slate-100 bg-white">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold text-slate-500">Subtotal</span>
                  <span className="text-xl font-black text-slate-900">{convertFromPKR(getTotal())}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  className="w-full py-3.5 bg-primary hover:bg-primary-600 text-white rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
                >
                  Proceed to Checkout <ArrowRight size={16} />
                </button>
                <p className="text-center text-xs text-slate-400 mt-3">Secure checkout via Noehost Billing Portal</p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartSidebar;
