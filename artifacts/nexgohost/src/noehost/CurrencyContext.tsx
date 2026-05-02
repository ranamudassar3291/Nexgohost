import React, { createContext, useContext, useState, useEffect } from 'react';

interface Currency {
  code: string;
  symbol: string;
  rate: number;
  flag: string;
  name: string;
}

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  currencies: Currency[];
  convert: (amount: number) => string;
  convertFromPKR: (amountPKR: number) => string;
  formatPKR: (amountPKR: number) => number;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const BASE_CURRENCIES: Currency[] = [
  { code: 'PKR', symbol: 'Rs', rate: 278.50,  flag: '🇵🇰', name: 'Pakistani Rupee' },
  { code: 'USD', symbol: '$',  rate: 1,        flag: '🇺🇸', name: 'US Dollar' },
  { code: 'EUR', symbol: '€',  rate: 0.92,     flag: '🇪🇺', name: 'Euro' },
  { code: 'GBP', symbol: '£',  rate: 0.79,     flag: '🇬🇧', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', rate: 3.67,    flag: '🇦🇪', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼',  rate: 3.75,     flag: '🇸🇦', name: 'Saudi Riyal' },
  { code: 'INR', symbol: '₹',  rate: 83.12,    flag: '🇮🇳', name: 'Indian Rupee' },
  { code: 'AUD', symbol: 'A$', rate: 1.53,     flag: '🇦🇺', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', rate: 1.36,     flag: '🇨🇦', name: 'Canadian Dollar' },
  { code: 'TRY', symbol: '₺',  rate: 32.10,    flag: '🇹🇷', name: 'Turkish Lira' },
  { code: 'BDT', symbol: '৳',  rate: 110.50,   flag: '🇧🇩', name: 'Bangladeshi Taka' },
];

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currencies, setCurrencies] = useState<Currency[]>(BASE_CURRENCIES);
  const [currency, setCurrencyState] = useState<Currency>(BASE_CURRENCIES[0]); // PKR default
  const [loading, setLoading] = useState(true);

  const detectAndSetCurrency = async () => {
    const COUNTRY_MAP: Record<string, string> = {
      PK: 'PKR', US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR',
      AE: 'AED', SA: 'SAR', IN: 'INR', AU: 'AUD', CA: 'CAD',
      TR: 'TRY', BD: 'BDT', NL: 'EUR', IT: 'EUR', ES: 'EUR',
      PT: 'EUR', BE: 'EUR', AT: 'EUR', CH: 'EUR', PL: 'EUR',
      KW: 'AED', QA: 'AED', OM: 'AED', BH: 'AED',
    };
    const applyCountry = (code: string): boolean => {
      const c = code.toUpperCase();
      if (!c || c.length !== 2) return false;
      const currencyCode = COUNTRY_MAP[c] || 'PKR';
      const match = BASE_CURRENCIES.find(cur => cur.code === currencyCode);
      if (match) { setCurrencyState(match); return true; }
      return false;
    };
    // 1. Try browser-side geo first — most accurate as browser uses real client IP
    try {
      const r = await fetch('https://api.country.is/', { signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        const d = await r.json();
        if (applyCountry(d.country || '')) return;
      }
    } catch { /* next */ }
    // 2. Server-side detection as fallback
    try {
      const res = await fetch('/api/detect-currency', { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        if (applyCountry(data.country || '')) return;
      }
    } catch { /* next */ }
    // 3. ipinfo.io as last resort
    try {
      const r2 = await fetch('https://ipinfo.io/json?fields=country', { signal: AbortSignal.timeout(4000) });
      if (r2.ok) {
        const d2 = await r2.json();
        applyCountry(d2.country || '');
      }
    } catch { /* keep PKR default */ }
  };

  const fetchLiveRates = async () => {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('rates failed');
      const data = await res.json();
      if (data.rates) {
        setCurrencies(prev => prev.map(c => ({
          ...c,
          rate: c.code === 'USD' ? 1 : (data.rates[c.code] ?? c.rate),
        })));
      }
    } catch {
      // Keep hardcoded rates as fallback
    }
  };

  useEffect(() => {
    Promise.allSettled([detectAndSetCurrency(), fetchLiveRates()])
      .finally(() => setLoading(false));
  }, []);

  // When user manually selects a currency, sync rate from live currencies list
  const setCurrency = (selected: Currency) => {
    const live = currencies.find(c => c.code === selected.code);
    setCurrencyState(live || selected);
  };

  const convert = (amount: number) => {
    const live = currencies.find(c => c.code === currency.code);
    const rate = live ? live.rate : currency.rate;
    const converted = amount * rate;
    return `${currency.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const convertFromPKR = (amountPKR: number) => {
    const pkrCur = currencies.find(c => c.code === 'PKR');
    const pkrRate = pkrCur ? pkrCur.rate : 278.50;
    const live = currencies.find(c => c.code === currency.code);
    const targetRate = live ? live.rate : currency.rate;
    const usdAmount = amountPKR / pkrRate;
    const converted = usdAmount * targetRate;
    return `${currency.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPKR = (amountPKR: number) => {
    const pkrCur = currencies.find(c => c.code === 'PKR');
    const pkrRate = pkrCur ? pkrCur.rate : 278.50;
    const live = currencies.find(c => c.code === currency.code);
    const targetRate = live ? live.rate : currency.rate;
    return (amountPKR / pkrRate) * targetRate;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, currencies, convert, convertFromPKR, formatPKR, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) throw new Error('useCurrency must be used within a CurrencyProvider');
  return context;
};
