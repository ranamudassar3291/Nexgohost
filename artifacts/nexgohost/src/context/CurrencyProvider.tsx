import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface CurrencyInfo {
  code: string;
  symbol: string;
  rate: number;
  name: string;
}

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  PK: "PKR", US: "USD", GB: "GBP", UK: "GBP",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR",
  PT: "EUR", AT: "EUR", BE: "EUR", GR: "EUR", FI: "EUR",
  IE: "EUR", LU: "EUR", MT: "EUR", CY: "EUR", SK: "EUR",
  SI: "EUR", LT: "EUR", LV: "EUR", EE: "EUR",
  AU: "AUD", CA: "CAD", IN: "INR", AE: "AED",
};

const FALLBACK_CURRENCIES: Record<string, CurrencyInfo> = {
  PKR: { code: "PKR", symbol: "Rs.", rate: 1, name: "Pakistani Rupee" },
  USD: { code: "USD", symbol: "$", rate: 1, name: "US Dollar" },
  GBP: { code: "GBP", symbol: "£", rate: 1, name: "British Pound" },
  EUR: { code: "EUR", symbol: "€", rate: 1, name: "Euro" },
};

const CurrencyContext = createContext<{
  currency: CurrencyInfo;
  setCurrency: (c: CurrencyInfo) => void;
  allCurrencies: CurrencyInfo[];
  formatPrice: (amount: number) => string;
}>({
  currency: FALLBACK_CURRENCIES.PKR,
  setCurrency: () => {},
  allCurrencies: Object.values(FALLBACK_CURRENCIES),
  formatPrice: (a) => `Rs. ${a.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [allCurrencies, setAllCurrencies] = useState<CurrencyInfo[]>(Object.values(FALLBACK_CURRENCIES));
  const [currency, setCurrencyState] = useState<CurrencyInfo>(FALLBACK_CURRENCIES.PKR);

  useEffect(() => {
    const stored = localStorage.getItem("currency");
    if (stored) {
      try { setCurrencyState(JSON.parse(stored)); } catch {}
    }

    fetch("/api/currencies")
      .then(r => r.ok ? r.json() : null)
      .then((data: any[] | null) => {
        if (!data?.length) return;
        const mapped: CurrencyInfo[] = data.map(c => ({
          code: c.code, symbol: c.symbol, rate: Number(c.exchangeRate), name: c.name,
        }));
        setAllCurrencies(mapped);

        if (!stored) {
          detectCountryCurrency(mapped);
        } else {
          const storedCode = JSON.parse(stored).code;
          const serverCurrency = mapped.find(c => c.code === storedCode);
          if (serverCurrency) setCurrencyState(serverCurrency);
        }
      })
      .catch(() => {});
  }, []);

  function detectCountryCurrency(currencies: CurrencyInfo[]) {
    fetch("https://ipapi.co/json/")
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => {
        if (!data?.country_code) return;
        const targetCode = COUNTRY_TO_CURRENCY[data.country_code];
        const found = currencies.find(c => c.code === targetCode);
        if (found) { setCurrencyAndStore(found); return; }
        const pkr = currencies.find(c => c.code === "PKR");
        if (pkr) setCurrencyAndStore(pkr);
      })
      .catch(() => {
        const pkr = currencies.find(c => c.code === "PKR");
        if (pkr) setCurrencyAndStore(pkr);
      });
  }

  function setCurrencyAndStore(c: CurrencyInfo) {
    setCurrencyState(c);
    localStorage.setItem("currency", JSON.stringify(c));
  }

  function setCurrency(c: CurrencyInfo) {
    setCurrencyAndStore(c);
  }

  function formatPrice(amount: number) {
    const converted = amount * currency.rate;
    const formatted = converted.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (currency.code === "PKR") {
      return `Rs. ${formatted}`;
    }
    return `${currency.symbol}${formatted}`;
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, allCurrencies, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
