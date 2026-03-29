/**
 * Smart International Phone Input
 * Shows a country flag + dial code prefix selector alongside a number input.
 * Auto-syncs with the selected country from the registration page.
 */
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";
import { COUNTRIES, type CountryOption } from "@/lib/countries";

interface Props {
  value: string;
  onChange: (fullNumber: string) => void;
  countryCode?: string;
  onCountryChange?: (country: CountryOption) => void;
  placeholder?: string;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  countryCode,
  onCountryChange,
  placeholder = "300 1234567",
  className = "",
}: Props) {
  const [open,       setOpen]       = useState(false);
  const [search,     setSearch]     = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(
    () => COUNTRIES.find(c => c.code === (countryCode ?? "PK")) ?? COUNTRIES[0]!
  );
  const [localNumber, setLocalNumber] = useState(value.replace(/^\+\d+\s?/, ""));
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef    = useRef<HTMLInputElement>(null);

  // Sync when parent country changes (IP detection)
  useEffect(() => {
    if (countryCode && countryCode !== selectedCountry.code) {
      const match = COUNTRIES.find(c => c.code === countryCode);
      if (match) {
        setSelectedCountry(match);
        emitChange(match, localNumber);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  function emitChange(country: CountryOption, number: string) {
    const trimmed = number.trim();
    onChange(trimmed ? `${country.dialCode} ${trimmed}` : "");
  }

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d\s\-()]/g, "");
    setLocalNumber(raw);
    emitChange(selectedCountry, raw);
  }

  function selectCountry(country: CountryOption) {
    setSelectedCountry(country);
    setOpen(false);
    setSearch("");
    emitChange(country, localNumber);
    onCountryChange?.(country);
  }

  const filtered = search
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dialCode.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  return (
    <div ref={containerRef} className={`relative flex items-stretch ${className}`}>
      {/* ── Flag + dial code selector ── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 shrink-0 h-11 px-3 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700 select-none"
        style={{ minWidth: "90px" }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-lg leading-none">{selectedCountry.flag}</span>
        <span className="text-xs text-gray-600 font-mono">{selectedCountry.dialCode}</span>
        <ChevronDown size={12} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* ── Number input ── */}
      <input
        type="tel"
        value={localNumber}
        onChange={handleNumberChange}
        placeholder={placeholder}
        autoComplete="tel-national"
        className="flex-1 h-11 px-3 rounded-r-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#4F46E5]/25 focus:border-[#4F46E5] bg-white transition-all"
      />

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl shadow-black/10 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search country or code…"
                className="w-full h-8 pl-7 pr-3 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#4F46E5]/25 focus:border-[#4F46E5]"
              />
            </div>
          </div>
          {/* List */}
          <ul className="max-h-52 overflow-y-auto" role="listbox">
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-xs text-gray-400 text-center">No countries found</li>
            )}
            {filtered.map(c => (
              <li
                key={c.code}
                role="option"
                aria-selected={c.code === selectedCountry.code}
                onClick={() => selectCountry(c)}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                  c.code === selectedCountry.code
                    ? "bg-violet-50 text-violet-700"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="flex-1 text-sm">{c.name}</span>
                <span className="text-xs font-mono text-gray-400">{c.dialCode}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
