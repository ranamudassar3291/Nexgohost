import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type BillingCycle = "monthly" | "quarterly" | "semiannual" | "yearly";
export type ProductType = "hosting" | "vps" | "email" | "domain";

export interface UnifiedCartItem {
  productType: ProductType;
  packageId: string;
  packageName: string;
  billingCycle: BillingCycle;
  monthlyPrice: number;
  quarterlyPrice?: number | null;
  semiannualPrice?: number | null;
  yearlyPrice?: number | null;
  renewalPrice?: number | null;
  renewalEnabled?: boolean;
  freeDomainEnabled?: boolean;
  freeDomainTlds?: string[];
  description?: string | null;
  features?: string[];
  diskSpace?: string | null;
  bandwidth?: string | null;
  emailAccounts?: string | null;
  domainName?: string;
  domainAction?: "register" | "transfer" | "skip";
  domainPrice?: number;
}

interface CouponResult {
  valid: boolean;
  code: string;
  discountPercent: number;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
}

interface ReferralResult {
  valid: boolean;
  code: string;
  affiliateId: string;
  discountPercent: number;
}

interface UnifiedCartContextType {
  items: UnifiedCartItem[];
  addItem: (item: UnifiedCartItem) => void;
  removeItem: (packageId: string) => void;
  updateCycle: (packageId: string, cycle: BillingCycle) => void;
  updateDomain: (packageId: string, domainName: string, domainAction: "register" | "transfer" | "skip", domainPrice: number) => void;
  clearCart: () => void;
  coupon: CouponResult | null;
  referral: ReferralResult | null;
  couponError: string;
  referralError: string;
  couponLoading: boolean;
  referralLoading: boolean;
  applyCoupon: (code: string, amount: number) => Promise<void>;
  applyReferral: (code: string) => Promise<void>;
  removeCoupon: () => void;
  removeReferral: () => void;
  getItemPrice: (item: UnifiedCartItem) => number;
  getSubtotal: () => number;
  getTotal: () => number;
  count: number;
}

const STORAGE_KEY = "noehost_cart_v2";

const Ctx = createContext<UnifiedCartContextType>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateCycle: () => {},
  updateDomain: () => {},
  clearCart: () => {},
  coupon: null,
  referral: null,
  couponError: "",
  referralError: "",
  couponLoading: false,
  referralLoading: false,
  applyCoupon: async () => {},
  applyReferral: async () => {},
  removeCoupon: () => {},
  removeReferral: () => {},
  getItemPrice: () => 0,
  getSubtotal: () => 0,
  getTotal: () => 0,
  count: 0,
});

function loadCart(): UnifiedCartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCart(items: UnifiedCartItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
}

export function getItemPrice(item: UnifiedCartItem): number {
  switch (item.billingCycle) {
    case "quarterly": return item.quarterlyPrice ?? item.monthlyPrice * 3;
    case "semiannual": return item.semiannualPrice ?? item.monthlyPrice * 6;
    case "yearly": return item.yearlyPrice ?? item.monthlyPrice * 12;
    default: return item.monthlyPrice;
  }
}

export function availableCycles(item: UnifiedCartItem): BillingCycle[] {
  const monthly = item.monthlyPrice || 0;
  const cycles: BillingCycle[] = ["monthly"];
  if (item.quarterlyPrice != null && item.quarterlyPrice >= monthly * 0.5)
    cycles.push("quarterly");
  if (item.semiannualPrice != null && item.semiannualPrice >= monthly * 0.5)
    cycles.push("semiannual");
  if (item.yearlyPrice != null && item.yearlyPrice >= monthly * 0.5)
    cycles.push("yearly");
  return cycles;
}

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semiannual: "6 Months",
  yearly: "Yearly",
};

export const CYCLE_SUFFIX: Record<BillingCycle, string> = {
  monthly: "/mo",
  quarterly: "/3mo",
  semiannual: "/6mo",
  yearly: "/yr",
};

export const CYCLE_MONTHS: Record<BillingCycle, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
};

export function UnifiedCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<UnifiedCartItem[]>(loadCart);
  const [coupon, setCoupon] = useState<CouponResult | null>(null);
  const [referral, setReferral] = useState<ReferralResult | null>(null);
  const [couponError, setCouponError] = useState("");
  const [referralError, setReferralError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [referralLoading, setReferralLoading] = useState(false);

  useEffect(() => { saveCart(items); }, [items]);

  const addItem = useCallback((item: UnifiedCartItem) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.packageId === item.packageId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });
    setCoupon(null);
  }, []);

  const removeItem = useCallback((packageId: string) => {
    setItems(prev => prev.filter(i => i.packageId !== packageId));
    setCoupon(null);
  }, []);

  const updateCycle = useCallback((packageId: string, cycle: BillingCycle) => {
    setItems(prev => prev.map(i => i.packageId === packageId ? { ...i, billingCycle: cycle } : i));
    setCoupon(null);
  }, []);

  const updateDomain = useCallback((packageId: string, domainName: string, domainAction: "register" | "transfer" | "skip", domainPrice: number) => {
    setItems(prev => prev.map(i => i.packageId === packageId ? { ...i, domainName, domainAction, domainPrice } : i));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCoupon(null);
    setReferral(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  const applyCoupon = useCallback(async (code: string, amount: number) => {
    setCouponError("");
    setCouponLoading(true);
    try {
      const res = await fetch("/api/cart/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), amount }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) { setCouponError(data.error || "Invalid promo code"); return; }
      setCoupon(data);
    } catch { setCouponError("Could not validate code"); }
    finally { setCouponLoading(false); }
  }, []);

  const applyReferral = useCallback(async (code: string) => {
    setReferralError("");
    setReferralLoading(true);
    try {
      const res = await fetch("/api/cart/validate-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) { setReferralError(data.error || "Invalid referral code"); return; }
      setReferral(data);
    } catch { setReferralError("Could not validate referral code"); }
    finally { setReferralLoading(false); }
  }, []);

  const removeCoupon = useCallback(() => { setCoupon(null); setCouponError(""); }, []);
  const removeReferral = useCallback(() => { setReferral(null); setReferralError(""); }, []);

  const getSubtotal = useCallback(() => {
    return items.reduce((sum, item) => {
      const price = getItemPrice(item);
      return sum + price + (item.domainAction === "register" && item.domainPrice ? item.domainPrice : 0);
    }, 0);
  }, [items]);

  const getTotal = useCallback(() => {
    const sub = getSubtotal();
    const couponOff = coupon?.discountAmount ?? 0;
    const referralOff = referral ? Math.round(sub * (referral.discountPercent / 100) * 100) / 100 : 0;
    return Math.max(0, sub - couponOff - referralOff);
  }, [getSubtotal, coupon, referral]);

  return (
    <Ctx.Provider value={{
      items, addItem, removeItem, updateCycle, updateDomain, clearCart,
      coupon, referral, couponError, referralError, couponLoading, referralLoading,
      applyCoupon, applyReferral, removeCoupon, removeReferral,
      getItemPrice, getSubtotal, getTotal,
      count: items.length,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUnifiedCart() { return useContext(Ctx); }
