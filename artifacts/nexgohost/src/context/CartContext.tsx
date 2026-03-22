import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type BillingCycle = "monthly" | "quarterly" | "semiannual" | "yearly";

export interface CartItem {
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  monthlyPrice: number;
  quarterlyPrice?: number | null;
  semiannualPrice?: number | null;
  yearlyPrice?: number | null;
  renewalPrice?: number | null;
  renewalEnabled?: boolean;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (planId: string) => void;
  updateCycle: (planId: string, cycle: BillingCycle) => void;
  clearCart: () => void;
  count: number;
}

const STORAGE_KEY = "nexgohost_cart";

const CartContext = createContext<CartContextType>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateCycle: () => {},
  clearCart: () => {},
  count: 0,
});

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    saveCart(items);
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      const existing = prev.findIndex(i => i.planId === item.planId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = item;
        return updated;
      }
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((planId: string) => {
    setItems(prev => prev.filter(i => i.planId !== planId));
  }, []);

  const updateCycle = useCallback((planId: string, cycle: BillingCycle) => {
    setItems(prev => prev.map(i => i.planId === planId ? { ...i, billingCycle: cycle } : i));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateCycle, clearCart, count: items.length }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semiannual: "Semiannual",
  yearly: "Yearly",
};

export const CYCLE_SUFFIX: Record<BillingCycle, string> = {
  monthly: "/mo",
  quarterly: "/qtr",
  semiannual: "/6mo",
  yearly: "/yr",
};

export const CYCLE_MONTHS: Record<BillingCycle, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
};

export function getItemPrice(item: CartItem): number {
  switch (item.billingCycle) {
    case "quarterly": return item.quarterlyPrice ?? item.monthlyPrice * 3;
    case "semiannual": return item.semiannualPrice ?? item.monthlyPrice * 6;
    case "yearly": return item.yearlyPrice ?? item.monthlyPrice * 12;
    default: return item.monthlyPrice;
  }
}

export function availableCycles(item: CartItem): BillingCycle[] {
  const cycles: BillingCycle[] = ["monthly"];
  if (item.quarterlyPrice != null) cycles.push("quarterly");
  if (item.semiannualPrice != null) cycles.push("semiannual");
  if (item.yearlyPrice != null) cycles.push("yearly");
  return cycles;
}
