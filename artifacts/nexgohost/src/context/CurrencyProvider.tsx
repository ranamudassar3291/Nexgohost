import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { formatCurrency } from "../lib/currency-format";

export interface CurrencyInfo {
  code: string;
  symbol: string;
  rate: number;
  name: string;
  flag: string;
}

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  PK: "PKR", US: "USD", GB: "GBP", UK: "GBP",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR",
  PT: "EUR", AT: "EUR", BE: "EUR", GR: "EUR", FI: "EUR",
  IE: "EUR", LU: "EUR", MT: "EUR", CY: "EUR", SK: "EUR",
  SI: "EUR", LT: "EUR", LV: "EUR", EE: "EUR",
  AU: "AUD", CA: "CAD", IN: "INR", AE: "AED",
  SA: "AED", QA: "AED", KW: "AED", BH: "AED", OM: "AED",
};

const CURRENCY_FLAGS: Record<string, string> = {
  PKR: "🇵🇰", USD: "🇺🇸", GBP: "🇬🇧", EUR: "🇪🇺",
  AED: "🇦🇪", AUD: "🇦🇺", CAD: "🇨🇦", INR: "🇮🇳",
};

const FALLBACK_CURRENCIES: Record<string, CurrencyInfo> = {
  PKR: { code: "PKR", symbol: "Rs.", rate: 1,      name: "Pakistani Rupee",  flag: "🇵🇰" },
  USD: { code: "USD", symbol: "$",   rate: 0.0036,  name: "US Dollar",       flag: "🇺🇸" },
  GBP: { code: "GBP", symbol: "£",   rate: 0.0028,  name: "British Pound",   flag: "🇬🇧" },
  EUR: { code: "EUR", symbol: "€",   rate: 0.0033,  name: "Euro",            flag: "🇪🇺" },
  AED: { code: "AED", symbol: "AED", rate: 0.013,   name: "UAE Dirham",      flag: "🇦🇪" },
  AUD: { code: "AUD", symbol: "A$",  rate: 0.0055,  name: "Australian Dollar",flag: "🇦🇺" },
  CAD: { code: "CAD", symbol: "C$",  rate: 0.0049,  name: "Canadian Dollar", flag: "🇨🇦" },
  INR: { code: "INR", symbol: "₹",   rate: 0.30,    name: "Indian Rupee",    flag: "🇮🇳" },
};

const CurrencyContext = createContext<{
  currency: CurrencyInfo;
  setCurrency: (c: CurrencyInfo) => void;
  allCurrencies: CurrencyInfo[];
  currencies: CurrencyInfo[];
  loading: boolean;
  formatPrice: (pkrAmount: number) => string;
  convert: (usdAmount: number) => string;
}>({
  currency: FALLBACK_CURRENCIES.PKR,
  setCurrency: () => {},
  allCurrencies: Object.values(FALLBACK_CURRENCIES),
  currencies: Object.values(FALLBACK_CURRENCIES),
  loading: false,
  formatPrice: (a) => {
    const n = isNaN(a) || a == null ? 0 : a;
    return formatCurrency(n, "PKR", "Rs.");
  },
  convert: (u) => {
    const pkr = u / 0.0036;
    const n = isNaN(pkr) || pkr == null ? 0 : pkr;
    return formatCurrency(n, "PKR", "Rs.");
  },
});

const GEO_PROVIDERS = [
  () => fetch("https://ipapi.co/json/").then(r => r.ok ? r.json() : null)
    .then((d: any) => d?.country_code ?? null),
  () => fetch("https://ipinfo.io/json").then(r => r.ok ? r.json() : null)
    .then((d: any) => d?.country ?? null),
  () => fetch("https://freeipapi.com/api/json").then(r => r.ok ? r.json() : null)
    .then((d: any) => d?.countryCode ?? null),
];

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [allCurrencies, setAllCurrencies] = useState<CurrencyInfo[]>(Object.values(FALLBACK_CURRENCIES));
  const [currency, setCurrencyState] = useState<CurrencyInfo>(FALLBACK_CURRENCIES.PKR);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("currency");
    if (stored) {
      try { setCurrencyState(JSON.parse(stored)); } catch {}
    }

    setLoading(true);
    fetch("/api/currencies")
      .then(r => r.ok ? r.json() : null)
      .then(async (data: any[] | null) => {
        if (!data?.length) return;
        const mapped: CurrencyInfo[] = data.map(c => ({
          code: c.code,
          symbol: c.symbol,
          rate: Number(c.exchangeRate),
          name: c.name,
          flag: CURRENCY_FLAGS[c.code] ?? "🌐",
        }));
        setAllCurrencies(mapped);

        const token = localStorage.getItem("token");
        if (token) {
          try {
            const me = await fetch("/api/auth/me", {
              headers: { Authorization: `Bearer ${token}` },
            }).then(r => r.ok ? r.json() : null);
            if (me?.billingCurrency) {
              const serverSaved = mapped.find(c => c.code === me.billingCurrency);
              if (serverSaved) {
                setCurrencyState(serverSaved);
                localStorage.setItem("currency", JSON.stringify(serverSaved));
                return;
              }
            }
          } catch { /* non-fatal */ }
        }

        if (!stored) {
          detectCountryCurrency(mapped);
        } else {
          try {
            const storedObj: CurrencyInfo = JSON.parse(stored);
            const serverVersion = mapped.find(c => c.code === storedObj.code);
            if (serverVersion) {
              setCurrencyState(serverVersion);
              localStorage.setItem("currency", JSON.stringify(serverVersion));
            }
          } catch {}
        }
      })
      .catch(() => {
        if (!stored) detectCountryCurrency(Object.values(FALLBACK_CURRENCIES));
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function detectCountryCurrency(currencies: CurrencyInfo[]) {
    let countryCode: string | null = null;
    for (const provider of GEO_PROVIDERS) {
      try {
        countryCode = await provider();
        if (countryCode) break;
      } catch { /* try next */ }
    }
    const targetCode = countryCode ? (COUNTRY_TO_CURRENCY[countryCode] ?? "USD") : "USD";
    const found = currencies.find(c => c.code === targetCode)
      ?? currencies.find(c => c.code === "PKR")
      ?? currencies[0];
    if (found) setCurrencyAndStore(found);
  }

  function setCurrencyAndStore(c: CurrencyInfo) {
    setCurrencyState(c);
    localStorage.setItem("currency", JSON.stringify(c));
  }

  function setCurrency(c: CurrencyInfo) {
    setCurrencyAndStore(c);
  }

  function formatPrice(pkrAmount: number): string {
    const safe = isNaN(pkrAmount) || pkrAmount == null ? 0 : pkrAmount;
    const converted = safe * currency.rate;
    return formatCurrency(converted, currency.code, currency.symbol);
  }

  function convert(usdAmount: number): string {
    const safe = isNaN(usdAmount) || usdAmount == null ? 0 : usdAmount;
    const usdCurrency = allCurrencies.find(c => c.code === "USD") ?? FALLBACK_CURRENCIES.USD;
    const pkrAmount = safe / usdCurrency.rate;
    return formatPrice(pkrAmount);
  }

  return (
    <CurrencyContext.Provider value={{
      currency, setCurrency,
      allCurrencies, currencies: allCurrencies,
      loading, formatPrice, convert,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
