import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search, BookOpen, Rocket, Server, Globe, CreditCard, Shield,
  Mail, HelpCircle, Settings, Zap, Star, ChevronRight, ArrowRight,
  Languages, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { type KbLang, LANG_META, t } from "@/lib/kbI18n";

interface KbCategory {
  id: string;
  name: string;
  nameUr?: string;
  nameAr?: string;
  slug: string;
  description: string | null;
  descriptionUr?: string;
  descriptionAr?: string;
  icon: string;
  articleCount: number;
}

interface KbArticle {
  id: string;
  categoryId: string;
  title: string;
  titleUr?: string;
  titleAr?: string;
  slug: string;
  excerpt: string | null;
  excerptUr?: string;
  excerptAr?: string;
  isFeatured: boolean;
  views: number;
  updatedAt: string;
}

const ICON_MAP: Record<string, any> = {
  BookOpen, Rocket, Server, Globe, CreditCard, Shield, Mail, HelpCircle, Settings, Zap,
};

function CategoryIcon({ name }: { name: string }) {
  const Icon = ICON_MAP[name] || BookOpen;
  return <Icon className="w-5 h-5" />;
}

const BG_COLORS = [
  "bg-blue-50 text-blue-600 border-blue-100",
  "bg-purple-50 text-purple-600 border-purple-100",
  "bg-green-50 text-green-600 border-green-100",
  "bg-orange-50 text-orange-600 border-orange-100",
  "bg-pink-50 text-pink-600 border-pink-100",
  "bg-teal-50 text-teal-600 border-teal-100",
];

const LANG_KEY = "noehost_kb_lang";

function useLang() {
  const [lang, setLangState] = useState<KbLang>(() => {
    return (localStorage.getItem(LANG_KEY) as KbLang) || "en";
  });
  const setLang = (l: KbLang) => {
    localStorage.setItem(LANG_KEY, l);
    setLangState(l);
  };
  return { lang, setLang };
}

function getTitle(a: { title: string; titleUr?: string; titleAr?: string }, lang: KbLang) {
  if (lang === "ur" && a.titleUr) return a.titleUr;
  if (lang === "ar" && a.titleAr) return a.titleAr;
  return a.title;
}

function getExcerpt(a: { excerpt?: string | null; excerptUr?: string; excerptAr?: string }, lang: KbLang) {
  if (lang === "ur" && a.excerptUr) return a.excerptUr;
  if (lang === "ar" && a.excerptAr) return a.excerptAr;
  return a.excerpt ?? "";
}

function getCatName(c: { name: string; nameUr?: string; nameAr?: string }, lang: KbLang) {
  if (lang === "ur" && c.nameUr) return c.nameUr;
  if (lang === "ar" && c.nameAr) return c.nameAr;
  return c.name;
}

function getCatDesc(c: { description: string | null; descriptionUr?: string; descriptionAr?: string }, lang: KbLang) {
  if (lang === "ur" && c.descriptionUr) return c.descriptionUr;
  if (lang === "ar" && c.descriptionAr) return c.descriptionAr;
  return c.description ?? "";
}

export default function HelpCenter() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const { lang, setLang } = useLang();

  const dir = LANG_META[lang].dir;

  const { data: categories = [], isLoading: catsLoading } = useQuery<KbCategory[]>({
    queryKey: ["/api/kb/categories"],
    queryFn: () => apiFetch("/api/kb/categories"),
  });

  const { data: allArticles = [], isLoading: articlesLoading } = useQuery<KbArticle[]>({
    queryKey: ["/api/kb/articles"],
    queryFn: () => apiFetch("/api/kb/articles"),
  });

  const featuredArticles = allArticles.filter(a => a.isFeatured);

  const suggestions = useMemo(() => {
    if (!search.trim() || search.length < 2) return [];
    const q = search.toLowerCase();
    return allArticles.filter(a =>
      getTitle(a, lang).toLowerCase().includes(q) ||
      getExcerpt(a, lang).toLowerCase().includes(q)
    ).slice(0, 6);
  }, [search, allArticles, lang]);

  const searchResults = search.trim().length >= 2 ? suggestions : [];
  const showDropdown = searchFocused && search.trim().length >= 2 && suggestions.length > 0;

  const catMap: Record<string, KbCategory> = {};
  for (const c of categories) catMap[c.id] = c;

  const isLoading = catsLoading || articlesLoading;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function goArticle(slug: string) {
    setSearch("");
    setSearchFocused(false);
    navigate(`/help/${slug}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background" dir={dir}>
      {/* Hero */}
      <div className="bg-primary/8 border-b pt-10 pb-12 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-4">

          {/* Language Switcher */}
          <div className="flex justify-end mb-2" ref={langRef}>
            <div className="relative">
              <button
                onClick={() => setLangOpen(o => !o)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 bg-background hover:border-primary/40 transition-all"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>{LANG_META[lang].flag} {LANG_META[lang].label}</span>
              </button>
              {langOpen && (
                <div className="absolute top-full mt-1 right-0 bg-card border rounded-xl shadow-lg z-50 overflow-hidden w-40">
                  {(Object.keys(LANG_META) as KbLang[]).map(l => (
                    <button
                      key={l}
                      onClick={() => { setLang(l); setLangOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-muted/50 transition-colors ${lang === l ? "bg-primary/10 text-primary font-medium" : ""}`}
                    >
                      <span>{LANG_META[l].flag}</span>
                      <span>{LANG_META[l].label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="inline-flex items-center gap-2 text-primary text-sm font-medium bg-primary/10 px-3 py-1 rounded-full">
            <HelpCircle className="w-3.5 h-3.5" />
            {t(lang, "helpCenter")}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t(lang, "howCanWeHelp")}</h1>
          <p className="text-muted-foreground">{t(lang, "browseGuides")}</p>

          {/* Search with dropdown */}
          <div className="relative max-w-xl mx-auto mt-4">
            <Search className={`absolute ${dir === "rtl" ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 pointer-events-none`} />
            <Input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder={t(lang, "searchPlaceholder")}
              className={`${dir === "rtl" ? "pr-12 pl-10" : "pl-12 pr-10"} h-12 text-base shadow-sm`}
              dir={dir}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className={`absolute ${dir === "rtl" ? "left-4" : "right-4"} top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground`}
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Instant Search Dropdown */}
            {showDropdown && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-card border rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground">{t(lang, "searchSuggestions")}</p>
                </div>
                {suggestions.map(a => (
                  <button
                    key={a.id}
                    onMouseDown={() => goArticle(a.slug)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-start gap-3 group"
                  >
                    <BookOpen className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                        {getTitle(a, lang)}
                      </p>
                      {getExcerpt(a, lang) && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{getExcerpt(a, lang)}</p>
                      )}
                      {catMap[a.categoryId] && (
                        <p className="text-xs text-muted-foreground mt-0.5">{getCatName(catMap[a.categoryId], lang)}</p>
                      )}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-12">
        {/* Full Search Results (when submitted) */}
        {search.trim().length >= 2 && !showDropdown && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              {searchResults.length === 0
                ? t(lang, "noResults")
                : `${searchResults.length} ${t(lang, "resultsFor")} "${search}"`}
            </h2>
            {searchResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>{t(lang, "tryDifferent")}</p>
              </div>
            )}
            <div className="divide-y border rounded-lg overflow-hidden bg-card">
              {searchResults.map(a => (
                <button
                  key={a.id}
                  onClick={() => goArticle(a.slug)}
                  className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-start gap-3"
                >
                  <BookOpen className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{getTitle(a, lang)}</p>
                    {getExcerpt(a, lang) && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{getExcerpt(a, lang)}</p>
                    )}
                    {catMap[a.categoryId] && (
                      <p className="text-xs text-muted-foreground mt-1">{getCatName(catMap[a.categoryId], lang)}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto flex-shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          </div>
        )}

        {!search.trim() && (
          <>
            {featuredArticles.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-400" />
                  <h2 className="text-lg font-semibold">{t(lang, "popularArticles")}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {featuredArticles.map(a => (
                    <button
                      key={a.id}
                      onClick={() => goArticle(a.slug)}
                      className="text-left p-4 border rounded-lg hover:border-primary/40 hover:bg-muted/30 transition-all group bg-card"
                    >
                      <div className="flex items-start gap-3">
                        <BookOpen className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm group-hover:text-primary transition-colors">{getTitle(a, lang)}</p>
                          {getExcerpt(a, lang) && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{getExcerpt(a, lang)}</p>
                          )}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">{t(lang, "comingSoon")}</p>
                <p className="text-sm mt-1">{t(lang, "comingSoonDesc")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">{t(lang, "browseByCategory")}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((cat, i) => {
                    const color = BG_COLORS[i % BG_COLORS.length];
                    const catArticles = allArticles.filter(a => a.categoryId === cat.id).slice(0, 3);
                    return (
                      <div key={cat.id} className="border rounded-xl bg-card hover:border-primary/30 hover:shadow-sm transition-all overflow-hidden group">
                        <div className="p-4">
                          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border ${color} mb-3`}>
                            <CategoryIcon name={cat.icon} />
                          </div>
                          <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{getCatName(cat, lang)}</h3>
                          {getCatDesc(cat, lang) && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{getCatDesc(cat, lang)}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {cat.articleCount} {cat.articleCount !== 1 ? t(lang, "articles") : t(lang, "article")}
                          </p>
                        </div>
                        {catArticles.length > 0 && (
                          <div className="border-t divide-y">
                            {catArticles.map(a => (
                              <button
                                key={a.id}
                                onClick={() => goArticle(a.slug)}
                                className="w-full text-left px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center gap-2"
                              >
                                <ChevronRight className={`w-3 h-3 flex-shrink-0 ${dir === "rtl" ? "rotate-180" : ""}`} />
                                <span className="line-clamp-1">{getTitle(a, lang)}</span>
                              </button>
                            ))}
                            {cat.articleCount > 3 && (
                              <button
                                onClick={() => navigate(`/help?category=${cat.id}`)}
                                className="w-full text-left px-4 py-2.5 text-xs text-primary hover:bg-muted/30 transition-colors flex items-center gap-2 font-medium"
                              >
                                <span>{t(lang, "viewAll")} {cat.articleCount} {t(lang, "articles")}</span>
                                <ArrowRight className={`w-3 h-3 ${dir === "rtl" ? "rotate-180" : ""}`} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Still Need Help CTA */}
        <div className="border rounded-xl p-6 bg-primary/5 text-center space-y-3">
          <HelpCircle className="w-8 h-8 mx-auto text-primary" />
          <h3 className="font-semibold">{t(lang, "stillNeedHelp")}</h3>
          <p className="text-sm text-muted-foreground">{t(lang, "stillNeedHelpDesc")}</p>
          <button
            onClick={() => navigate("/client/tickets")}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {t(lang, "openTicket")}
            <ArrowRight className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
