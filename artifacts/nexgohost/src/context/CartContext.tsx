import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";

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
  synced: boolean;
}

const STORAGE_KEY = "noehost_cart";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const CartContext = createContext<CartContextType>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateCycle: () => {},
  clearCart: () => {},
  count: 0,
  synced: false,
});

function loadLocalCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function saveLocalCart(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

function getToken(): string | null {
  return localStorage.getItem("token");
}

function isLoggedIn(): boolean {
  return !!getToken();
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken() || ""}`,
  };
}

// ─── DB row → CartItem ────────────────────────────────────────────────────────
function rowToItem(row: any): CartItem {
  return {
    planId: row.planId,
    planName: row.planName,
    billingCycle: (row.billingCycle || "monthly") as BillingCycle,
    monthlyPrice: parseFloat(row.monthlyPrice || "0"),
    quarterlyPrice: row.quarterlyPrice != null ? parseFloat(row.quarterlyPrice) : null,
    semiannualPrice: row.semiannualPrice != null ? parseFloat(row.semiannualPrice) : null,
    yearlyPrice: row.yearlyPrice != null ? parseFloat(row.yearlyPrice) : null,
    renewalPrice: row.renewalPrice != null ? parseFloat(row.renewalPrice) : null,
    renewalEnabled: row.renewalEnabled === "true",
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadLocalCart);
  const [synced, setSynced] = useState(false);
  const syncInProgress = useRef(false);

  // ─── On mount: if logged in, fetch DB cart and use it as source of truth ──
  useEffect(() => {
    if (!isLoggedIn()) {
      setSynced(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE}/api/client/cart`, { headers: authHeaders() });
        if (!res.ok) { setSynced(true); return; }
        const rows = await res.json();
        if (cancelled) return;

        if (Array.isArray(rows) && rows.length > 0) {
          const dbItems = rows.map(rowToItem);
          setItems(dbItems);
          saveLocalCart(dbItems);
        } else {
          // DB empty — push local cart to DB if any
          const local = loadLocalCart();
          if (local.length > 0) {
            for (const item of local) {
              await fetch(`${BASE}/api/client/cart`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify(item),
              }).catch(() => {});
            }
          }
        }
      } catch {
        // Network error — keep local cart
      } finally {
        if (!cancelled) setSynced(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ─── Keep localStorage in sync whenever items change ─────────────────────
  useEffect(() => {
    saveLocalCart(items);
  }, [items]);

  // ─── addItem: update state, localStorage, and DB ─────────────────────────
  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      const existing = prev.findIndex(i => i.planId === item.planId);
      let next: CartItem[];
      if (existing >= 0) {
        next = [...prev];
        next[existing] = item;
      } else {
        next = [...prev, item];
      }
      return next;
    });

    if (isLoggedIn()) {
      fetch(`${BASE}/api/client/cart`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(item),
      }).catch(() => {});
    }
  }, []);

  // ─── removeItem: update state, localStorage, and DB ──────────────────────
  const removeItem = useCallback((planId: string) => {
    setItems(prev => prev.filter(i => i.planId !== planId));

    if (isLoggedIn()) {
      fetch(`${BASE}/api/client/cart/${encodeURIComponent(planId)}`, {
        method: "DELETE",
        headers: authHeaders(),
      }).catch(() => {});
    }
  }, []);

  // ─── updateCycle: update state, localStorage, and DB ─────────────────────
  const updateCycle = useCallback((planId: string, cycle: BillingCycle) => {
    setItems(prev => prev.map(i => i.planId === planId ? { ...i, billingCycle: cycle } : i));

    if (isLoggedIn()) {
      fetch(`${BASE}/api/client/cart/${encodeURIComponent(planId)}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ billingCycle: cycle }),
      }).catch(() => {});
    }
  }, []);

  // ─── clearCart: wipe state, localStorage, and DB ─────────────────────────
  const clearCart = useCallback(() => {
    setItems([]);

    if (isLoggedIn()) {
      fetch(`${BASE}/api/client/cart`, {
        method: "DELETE",
        headers: authHeaders(),
      }).catch(() => {});
    }
  }, []);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateCycle, clearCart, count: items.length, synced }}>
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
