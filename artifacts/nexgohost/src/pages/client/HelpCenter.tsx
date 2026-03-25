import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, BookOpen, Rocket, Server, Globe, CreditCard, Shield, Mail, HelpCircle, Settings, Zap, Star, ChevronRight, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

interface KbCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  articleCount: number;
}

interface KbArticle {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  excerpt: string | null;
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

export default function HelpCenter() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: categories = [], isLoading: catsLoading } = useQuery<KbCategory[]>({
    queryKey: ["/api/kb/categories"],
    queryFn: () => apiFetch("/api/kb/categories"),
  });

  const { data: allArticles = [], isLoading: articlesLoading } = useQuery<KbArticle[]>({
    queryKey: ["/api/kb/articles"],
    queryFn: () => apiFetch("/api/kb/articles"),
  });

  const featuredArticles = allArticles.filter(a => a.isFeatured);

  const searchResults = search.trim()
    ? allArticles.filter(a =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        (a.excerpt || "").toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const catMap: Record<string, string> = {};
  for (const c of categories) catMap[c.id] = c.name;

  const isLoading = catsLoading || articlesLoading;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Hero */}
      <div className="bg-primary/8 border-b pt-10 pb-12 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 text-primary text-sm font-medium bg-primary/10 px-3 py-1 rounded-full">
            <HelpCircle className="w-3.5 h-3.5" />
            Help Center
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">How can we help you?</h1>
          <p className="text-muted-foreground">Browse our guides, tutorials, and FAQs to find the answers you need.</p>
          <div className="relative max-w-xl mx-auto mt-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search articles…"
              className="pl-12 h-12 text-base shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-12">
        {/* Search Results */}
        {search.trim() && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              {searchResults.length === 0 ? "No results found" : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${search}"`}
            </h2>
            {searchResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Try different keywords, or browse the categories below.</p>
              </div>
            )}
            <div className="divide-y border rounded-lg overflow-hidden bg-card">
              {searchResults.map(a => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/help/${a.slug}`)}
                  className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-start gap-3"
                >
                  <BookOpen className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{a.title}</p>
                    {a.excerpt && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.excerpt}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{catMap[a.categoryId]}</p>
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
                  <h2 className="text-lg font-semibold">Popular Articles</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {featuredArticles.map(a => (
                    <button
                      key={a.id}
                      onClick={() => navigate(`/help/${a.slug}`)}
                      className="text-left p-4 border rounded-lg hover:border-primary/40 hover:bg-muted/30 transition-all group bg-card"
                    >
                      <div className="flex items-start gap-3">
                        <BookOpen className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm group-hover:text-primary transition-colors">{a.title}</p>
                          {a.excerpt && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.excerpt}</p>}
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
                  <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Help Center Coming Soon</p>
                <p className="text-sm mt-1">Our knowledge base is being set up. Check back soon!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Browse by Category</h2>
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
                          <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{cat.name}</h3>
                          {cat.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cat.description}</p>}
                          <p className="text-xs text-muted-foreground mt-2">{cat.articleCount} article{cat.articleCount !== 1 ? "s" : ""}</p>
                        </div>
                        {catArticles.length > 0 && (
                          <div className="border-t divide-y">
                            {catArticles.map(a => (
                              <button
                                key={a.id}
                                onClick={() => navigate(`/help/${a.slug}`)}
                                className="w-full text-left px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center gap-2"
                              >
                                <ChevronRight className="w-3 h-3 flex-shrink-0" />
                                <span className="line-clamp-1">{a.title}</span>
                              </button>
                            ))}
                            {cat.articleCount > 3 && (
                              <button
                                onClick={() => navigate(`/help?category=${cat.id}`)}
                                className="w-full text-left px-4 py-2.5 text-xs text-primary hover:bg-muted/30 transition-colors flex items-center gap-2 font-medium"
                              >
                                <span>View all {cat.articleCount} articles</span>
                                <ArrowRight className="w-3 h-3" />
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

        <div className="border rounded-xl p-6 bg-primary/5 text-center space-y-3">
          <HelpCircle className="w-8 h-8 mx-auto text-primary" />
          <h3 className="font-semibold">Still need help?</h3>
          <p className="text-sm text-muted-foreground">Our support team is here for you. Open a ticket and we'll get back to you quickly.</p>
          <button
            onClick={() => navigate("/client/tickets")}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Open a Support Ticket
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
