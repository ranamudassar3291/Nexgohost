import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export interface CartItem {
  id: string;
  type: 'hosting' | 'domain' | 'vps' | 'domain_transfer';
  planId: string;
  name: string;
  billingCycle: 'monthly' | 'quarterly' | 'semiannual' | 'yearly';
  monthlyPrice: number;
  quarterlyPrice: number | null;
  semiannualPrice: number | null;
  yearlyPrice: number | null;
  domainName?: string;
  tld?: string;
  eppCode?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id'>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  updateBillingCycle: (id: string, cycle: CartItem['billingCycle']) => Promise<void>;
  clearCart: () => Promise<void>;
  syncWithBackend: () => Promise<void>;
  itemCount: number;
  getTotal: () => number;
  loading: boolean;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const STORAGE_KEY = 'noehost_website_cart';

export function getToken(): string | null {
  return localStorage.getItem('noehost_token') || localStorage.getItem('token');
}

async function apiFetch(method: string, path: string, body?: any) {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function mapBackendItem(b: any, idx: number): CartItem {
  const rawType = b.itemType || b.item_type || 'hosting';
  const type = (['hosting', 'domain', 'vps', 'domain_transfer'].includes(rawType) ? rawType : 'hosting') as CartItem['type'];
  const domainName = b.domainName || b.domain_name || undefined;
  const tld = b.tld || (domainName ? '.' + domainName.split('.').slice(1).join('.') : undefined);

  return {
    id: `${type}-${b.planId}-${idx}`,
    type,
    planId: String(b.planId),
    name: b.planName,
    billingCycle: (b.billingCycle || 'monthly') as CartItem['billingCycle'],
    monthlyPrice: parseFloat(b.monthlyPrice || '0'),
    quarterlyPrice: b.quarterlyPrice != null ? parseFloat(b.quarterlyPrice) : null,
    semiannualPrice: b.semiannualPrice != null ? parseFloat(b.semiannualPrice) : null,
    yearlyPrice: b.yearlyPrice != null ? parseFloat(b.yearlyPrice) : null,
    domainName,
    tld,
  };
}

function toLocalStorage(items: CartItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

function fromLocalStorage(): CartItem[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => fromLocalStorage());
  const [loading, setLoading] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const syncedRef = useRef(false);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const syncWithBackend = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const backendItems: any[] = await apiFetch('GET', '/api/client/cart') || [];
      const local = fromLocalStorage();

      for (const localItem of local) {
        const alreadyInBackend = backendItems.some(b => String(b.planId) === localItem.planId);
        if (!alreadyInBackend) {
          await apiFetch('POST', '/api/client/cart', {
            planId: localItem.planId,
            planName: localItem.name,
            itemType: localItem.type,
            domainName: localItem.domainName || null,
            tld: localItem.tld || null,
            billingCycle: localItem.billingCycle,
            monthlyPrice: localItem.monthlyPrice,
            quarterlyPrice: localItem.quarterlyPrice,
            semiannualPrice: localItem.semiannualPrice,
            yearlyPrice: localItem.yearlyPrice,
          });
        }
      }

      const refreshed: any[] = await apiFetch('GET', '/api/client/cart') || [];
      const mapped = refreshed.map((b, i) => mapBackendItem(b, i));
      setItems(mapped);
      toLocalStorage(mapped);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!syncedRef.current && getToken()) {
      syncedRef.current = true;
      syncWithBackend();
    }
  }, [syncWithBackend]);

  useEffect(() => {
    toLocalStorage(items);
  }, [items]);

  const addItem = useCallback(async (item: Omit<CartItem, 'id'>) => {
    const existing = items.find(i => i.planId === item.planId && i.type === item.type);
    if (existing) return;

    const newItem: CartItem = { ...item, id: `${item.type}-${item.planId}-${Date.now()}` };
    setItems(prev => [...prev, newItem]);

    const token = getToken();
    if (token) {
      await apiFetch('POST', '/api/client/cart', {
        planId: item.planId,
        planName: item.name,
        itemType: item.type,
        domainName: item.domainName || null,
        tld: item.tld || null,
        billingCycle: item.billingCycle,
        monthlyPrice: item.monthlyPrice,
        quarterlyPrice: item.quarterlyPrice,
        semiannualPrice: item.semiannualPrice,
        yearlyPrice: item.yearlyPrice,
      });
    }
  }, [items]);

  const removeItem = useCallback(async (id: string) => {
    const item = items.find(i => i.id === id);
    setItems(prev => prev.filter(i => i.id !== id));
    if (item && getToken()) {
      await apiFetch('DELETE', `/api/client/cart/${encodeURIComponent(item.planId)}`);
    }
  }, [items]);

  const updateBillingCycle = useCallback(async (id: string, cycle: CartItem['billingCycle']) => {
    const item = items.find(i => i.id === id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, billingCycle: cycle } : i));
    if (item && getToken()) {
      await apiFetch('PATCH', `/api/client/cart/${encodeURIComponent(item.planId)}`, { billingCycle: cycle });
    }
  }, [items]);

  const clearCart = useCallback(async () => {
    setItems([]);
    toLocalStorage([]);
    if (getToken()) {
      await apiFetch('DELETE', '/api/client/cart');
    }
  }, []);

  const getTotal = useCallback(() => {
    return items.reduce((sum, item) => {
      switch (item.billingCycle) {
        case 'monthly': return sum + item.monthlyPrice;
        case 'quarterly': return sum + (item.quarterlyPrice ?? item.monthlyPrice * 3);
        case 'semiannual': return sum + (item.semiannualPrice ?? item.monthlyPrice * 6);
        case 'yearly': return sum + (item.yearlyPrice ?? item.monthlyPrice * 12);
        default: return sum + item.monthlyPrice;
      }
    }, 0);
  }, [items]);

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, updateBillingCycle, clearCart,
      syncWithBackend, itemCount: items.length, getTotal, loading,
      isCartOpen, openCart, closeCart,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
