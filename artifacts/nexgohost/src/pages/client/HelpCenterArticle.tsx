import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, BookOpen, Eye, ThumbsUp, ThumbsDown, ChevronRight,
  Clock, Share2, ExternalLink, CheckCircle2, MessageSquare, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { type KbLang, LANG_META, t } from "@/lib/kbI18n";

interface KbArticleFull {
  id: string;
  categoryId: string;
  title: string;
  titleUr?: string;
  titleAr?: string;
  slug: string;
  content: string;
  excerpt: string | null;
  seoTitle?: string;
  seoDescription?: string;
  isFeatured: boolean;
  views: number;
  helpfulYes: number;
  helpfulNo: number;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; nameUr?: string; nameAr?: string; slug: string };
  related?: Array<{
    id: string; title: string; titleUr?: string; titleAr?: string;
    slug: string; excerpt: string | null;
  }>;
}

const LANG_KEY = "noehost_kb_lang";
const TICKET_CTX_KEY = "noehost_ticket_context";

function useLang(): KbLang {
  const [lang] = useState<KbLang>(() => (localStorage.getItem(LANG_KEY) as KbLang) || "en");
  return lang;
}

function getTitle(a: { title: string; titleUr?: string; titleAr?: string }, lang: KbLang) {
  if (lang === "ur" && a.titleUr) return a.titleUr;
  if (lang === "ar" && a.titleAr) return a.titleAr;
  return a.title;
}

function getCatName(c: { name: string; nameUr?: string; nameAr?: string }, lang: KbLang) {
  if (lang === "ur" && c.nameUr) return c.nameUr;
  if (lang === "ar" && c.nameAr) return c.nameAr;
  return c.name;
}

function useSeoMeta(title?: string, description?: string) {
  useEffect(() => {
    if (!title) return;
    const prevTitle = document.title;
    document.title = title;
    let meta = document.querySelector<HTMLMetaElement>("meta[name='description']");
    const prevContent = meta?.content ?? "";
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    if (description) meta.content = description;
    return () => {
      document.title = prevTitle;
      if (meta) meta.content = prevContent;
    };
  }, [title, description]);
}

const ARTICLE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  /* ── Base typography ─────────────────────────────────────────────────── */
  .kb-article-content {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 0.96rem;
    counter-reset: kb-step-counter;
    color: #374151;
  }

  /* ── Real image blocks ───────────────────────────────────────────────── */
  .kb-article-content .kb-img-block {
    margin: 2rem 0;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    box-shadow: 0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04);
    background: #fff;
  }
  .kb-article-content .kb-img-block::before {
    content: "● ● ●";
    display: block;
    background: #1e293b;
    color: rgba(255,255,255,0.5);
    font-size: 8px;
    letter-spacing: 5px;
    padding: 9px 16px;
  }
  .kb-article-content .kb-img-block img {
    width: 100%;
    display: block;
    object-fit: cover;
  }
  .kb-article-content .kb-img-caption {
    background: #f8fafc;
    border-top: 1px solid #e5e7eb;
    padding: 0.6rem 1.25rem;
    font-size: 0.78rem;
    color: #64748b;
    text-align: center;
    font-style: italic;
    letter-spacing: 0.01em;
  }

  /* ── Legacy screenshot placeholder (graceful fallback) ───────────────── */
  .kb-article-content .kb-screenshot {
    margin: 2rem 0;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  }
  .kb-article-content .kb-screenshot::before {
    content: "● ● ●";
    display: block;
    background: #1e293b;
    color: rgba(255,255,255,0.5);
    font-size: 8px;
    letter-spacing: 5px;
    padding: 9px 16px;
  }
  .kb-article-content .kb-screenshot-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 0.75rem;
    background: #f8fafc;
  }
  .kb-article-content .kb-screenshot-caption {
    font-size: 0.88rem;
    color: #64748b;
    text-align: center;
    max-width: 36rem;
    line-height: 1.5;
  }
  .kb-article-content .kb-screenshot-tag {
    display: none;
  }

  /* ── Annotation callout box (below images) ───────────────────────────── */
  .kb-article-content .kb-annotation-box {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-top: 3px solid #2563eb;
    border-radius: 0 0 10px 10px;
    padding: 1rem 1.25rem;
    margin-top: -2rem;
    margin-bottom: 2rem;
  }
  .kb-article-content .kb-annotation-row {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
    font-size: 0.875rem;
    color: #334155;
    line-height: 1.55;
  }
  .kb-article-content .kb-pin-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #2563eb;
    color: white;
    font-size: 0.63rem;
    font-weight: 800;
    flex-shrink: 0;
    margin-top: 1px;
    box-shadow: 0 2px 6px rgba(37,99,235,0.3);
  }

  /* ── Callout boxes ───────────────────────────────────────────────────── */
  .kb-article-content .kb-info {
    background: #eff6ff;
    border-left: 4px solid #2563eb;
    border-radius: 0 8px 8px 0;
    padding: 0.875rem 1.1rem;
    margin: 1.5rem 0;
    font-size: 0.9rem;
    color: #1d4ed8;
    line-height: 1.65;
  }
  .kb-article-content .kb-warning {
    background: #fff7ed;
    border-left: 4px solid #ea580c;
    border-radius: 0 8px 8px 0;
    padding: 0.875rem 1.1rem;
    margin: 1.5rem 0;
    font-size: 0.9rem;
    color: #9a3412;
    line-height: 1.65;
  }
  .kb-article-content .kb-tip {
    background: #f0fdf4;
    border-left: 4px solid #16a34a;
    border-radius: 0 8px 8px 0;
    padding: 0.875rem 1.1rem;
    margin: 1.5rem 0;
    font-size: 0.9rem;
    color: #15803d;
    line-height: 1.65;
  }
  .kb-article-content .kb-danger {
    background: #fef2f2;
    border-left: 4px solid #dc2626;
    border-radius: 0 8px 8px 0;
    padding: 0.875rem 1.1rem;
    margin: 1.5rem 0;
    font-size: 0.9rem;
    color: #991b1b;
    line-height: 1.65;
  }

  /* ── Headings ────────────────────────────────────────────────────────── */
  .kb-article-content h2 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #0f172a;
    margin-top: 2.25rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid #e2e8f0;
    letter-spacing: -0.025em;
  }
  .kb-article-content h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    letter-spacing: -0.015em;
  }
  .kb-article-content p {
    color: #4b5563;
    line-height: 1.8;
    margin-bottom: 0.85rem;
  }
  .kb-article-content li {
    color: #4b5563;
    line-height: 1.75;
  }
  .kb-article-content strong {
    color: #0f172a;
    font-weight: 600;
  }
  .kb-article-content pre {
    background: #0f172a;
    color: #e2e8f0;
    border-radius: 8px;
    padding: 1rem 1.25rem;
    margin: 1.25rem 0;
    overflow-x: auto;
    font-size: 0.83rem;
    line-height: 1.6;
  }
  .kb-article-content code {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    color: #2563eb;
    padding: 0.15rem 0.45rem;
    border-radius: 5px;
    font-size: 0.83em;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  }
  .kb-article-content pre code {
    background: transparent;
    border: none;
    color: inherit;
    padding: 0;
    font-size: inherit;
  }
  .kb-article-content a {
    color: #2563eb;
    text-decoration: none;
    font-weight: 500;
  }
  .kb-article-content a:hover {
    text-decoration: underline;
    color: #1d4ed8;
  }
  .kb-article-content ol {
    counter-reset: kb-counter;
    list-style: none;
    padding-left: 0;
  }
  .kb-article-content ol > li {
    counter-increment: kb-counter;
    display: flex;
    gap: 0.875rem;
    align-items: flex-start;
    margin-bottom: 0.6rem;
  }
  .kb-article-content ol > li::before {
    content: counter(kb-counter);
    min-width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    background: #2563eb;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 0.1rem;
  }
  .kb-article-content ul {
    padding-left: 0;
    list-style: none;
  }
  .kb-article-content ul > li {
    padding-left: 1.3rem;
    position: relative;
    margin-bottom: 0.4rem;
  }
  .kb-article-content ul > li::before {
    content: "▸";
    position: absolute;
    left: 0;
    color: #2563eb;
    font-size: 0.8rem;
    top: 0.05rem;
  }
  .kb-article-content hr {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 2.25rem 0;
  }
  .kb-article-content table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
    margin: 1.5rem 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
  }
  .kb-article-content th {
    background: #1e293b;
    color: #f1f5f9;
    font-weight: 600;
    padding: 0.7rem 1rem;
    text-align: left;
    letter-spacing: 0.02em;
  }
  .kb-article-content td {
    padding: 0.6rem 1rem;
    border-top: 1px solid #e5e7eb;
    color: #374151;
  }
  .kb-article-content tr:nth-child(even) td {
    background: #f8fafc;
  }
`;

export default function HelpCenterArticle() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [feedbackState, setFeedbackState] = useState<"idle" | "solved" | "thanks-no">("idle");
  const lang = useLang();
  const dir = LANG_META[lang].dir;

  // Read ticket context from localStorage (set by Tickets.tsx when user clicks "Read full article")
  const ticketCtx = useCallback(() => {
    try {
      const raw = localStorage.getItem(TICKET_CTX_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const { data: article, isLoading, error } = useQuery<KbArticleFull>({
    queryKey: ["/api/kb/articles", slug],
    queryFn: () => apiFetch(`/api/kb/articles/${slug}`),
    retry: false,
  });

  useSeoMeta(
    article?.seoTitle || (article ? `${article.title} | Noehost Help Center` : undefined),
    article?.seoDescription || article?.excerpt || undefined
  );

  const feedbackMutation = useMutation({
    mutationFn: (helpful: boolean) =>
      apiFetch(`/api/kb/articles/${article!.id}/feedback`, { method: "POST", body: JSON.stringify({ helpful }) }),
    onSuccess: (_d, helpful) => {
      setFeedbackState(helpful ? "solved" : "thanks-no");
    },
    onError: () => toast({ title: "Failed to submit feedback", variant: "destructive" }),
  });

  const deflectionMutation = useMutation({
    mutationFn: (payload: { articleId: string; articleTitle: string; articleSlug: string; ticketSubject: string }) =>
      apiFetch("/api/kb/deflections", { method: "POST", body: JSON.stringify(payload) }),
  });

  const handleSolved = () => {
    if (!article) return;
    const ctx = ticketCtx();
    if (ctx?.ticketSubject) {
      // Record a full deflection (came from ticket creation flow)
      deflectionMutation.mutate({
        articleId: article.id,
        articleTitle: article.title,
        articleSlug: article.slug,
        ticketSubject: ctx.ticketSubject,
      });
      localStorage.removeItem(TICKET_CTX_KEY);
    } else {
      // Just record helpful vote
      feedbackMutation.mutate(true);
    }
    setFeedbackState("solved");
  };

  const handleNeedHelp = () => {
    if (!article) return;
    // Store context so Tickets.tsx can pre-fill subject if coming from help
    try {
      const existing = ticketCtx();
      if (!existing) {
        localStorage.setItem(TICKET_CTX_KEY, JSON.stringify({
          fromArticle: true,
          articleSlug: article.slug,
          articleTitle: article.title,
        }));
      }
    } catch {}
    navigate("/client/tickets");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied to clipboard" });
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded" />
        <div className="h-8 w-3/4 bg-muted rounded" />
        <div className="space-y-2 mt-6">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-4 bg-muted rounded" style={{ width: `${70 + i * 5}%` }} />)}
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center py-20">
        <BookOpen className="w-12 h-12 mx-auto text-muted-foreground opacity-40 mb-4" />
        <h2 className="text-xl font-semibold">Article Not Found</h2>
        <p className="text-muted-foreground mt-2">The article you're looking for doesn't exist or has been removed.</p>
        <Button className="mt-6" onClick={() => navigate("/help")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> {t(lang, "backToHelp")}
        </Button>
      </div>
    );
  }

  const updatedDate = new Date(article.updatedAt).toLocaleDateString("en-PK", {
    year: "numeric", month: "long", day: "numeric"
  });
  const displayTitle = getTitle(article, lang);
  const ctx = ticketCtx();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6" dir={dir}>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-5 flex-wrap">
            <button onClick={() => navigate("/help")} className="hover:text-foreground transition-colors">
              {t(lang, "helpCenter")}
            </button>
            {article.category && (
              <>
                <ChevronRight className={`w-3.5 h-3.5 ${dir === "rtl" ? "rotate-180" : ""}`} />
                <button onClick={() => navigate("/help")} className="hover:text-foreground transition-colors">
                  {getCatName(article.category, lang)}
                </button>
              </>
            )}
            <ChevronRight className={`w-3.5 h-3.5 ${dir === "rtl" ? "rotate-180" : ""}`} />
            <span className="text-foreground font-medium line-clamp-1">{displayTitle}</span>
          </nav>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold leading-tight mb-3 text-gray-900 dark:text-white tracking-tight">
              {displayTitle}
            </h1>
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {t(lang, "updated")} {updatedDate}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {article.views.toLocaleString()} {t(lang, "views")}
              </span>
              {article.category && (
                <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-medium">
                  {getCatName(article.category, lang)}
                </span>
              )}
              {article.isFeatured && (
                <span className="bg-amber-500/10 text-amber-600 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Featured
                </span>
              )}
            </div>
          </div>

          {/* Article Content */}
          <style>{ARTICLE_CSS}</style>
          <div
            className="kb-article-content max-w-none"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {/* ── 20i-style Deflection / Feedback Section ────────────────────── */}
          <div className="mt-12">
            {feedbackState === "idle" ? (
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-violet-500/5 p-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Did this article solve your problem?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ctx?.ticketSubject
                        ? `You were looking for help with: "${ctx.ticketSubject}"`
                        : "Let us know if this guide helped you. Your feedback improves our support."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleSolved}
                    disabled={feedbackMutation.isPending || deflectionMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold text-sm rounded-xl px-5 py-3 transition-all shadow-md shadow-green-600/25 disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Yes, this solved my issue!
                  </button>
                  <button
                    onClick={handleNeedHelp}
                    className="flex-1 flex items-center justify-center gap-2.5 border border-border hover:border-primary/40 hover:bg-primary/5 text-foreground font-semibold text-sm rounded-xl px-5 py-3 transition-all"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 text-primary" />
                    I need additional support
                  </button>
                </div>

                {/* Thumbs up/down for non-ticket visitors */}
                {!ctx?.ticketSubject && (
                  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border/40">
                    <span className="text-xs text-muted-foreground">Quick rating:</span>
                    <button
                      onClick={() => feedbackMutation.mutate(true)}
                      disabled={feedbackMutation.isPending}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-green-600 transition-colors disabled:opacity-50"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" /> Helpful
                    </button>
                    <button
                      onClick={() => feedbackMutation.mutate(false)}
                      disabled={feedbackMutation.isPending}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" /> Not really
                    </button>
                    {article.helpfulYes + article.helpfulNo > 0 && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {article.helpfulYes} found this helpful
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : feedbackState === "solved" ? (
              <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-green-600" />
                </div>
                <h3 className="font-bold text-lg text-green-700 dark:text-green-400">Happy to help! 🎉</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Great — glad the article sorted things out. Feel free to explore more guides in our Help Center.
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/help")}>
                  <BookOpen className="w-4 h-4 mr-2" /> Browse More Articles
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-6 text-center">
                <ThumbsDown className="w-8 h-8 mx-auto text-muted-foreground mb-3 opacity-60" />
                <p className="font-medium">{t(lang, "thankNoMsg")}</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">{t(lang, "thankNoDesc")}</p>
                <Button size="sm" onClick={handleNeedHelp}>
                  <MessageSquare className="w-4 h-4 mr-2" /> Open a Support Ticket
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate("/help")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> {t(lang, "backToHelp")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Share2 className="w-3.5 h-3.5 mr-1.5" /> {t(lang, "shareArticle")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleNeedHelp}>
                {t(lang, "contactSupport")}
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {article.related && article.related.length > 0 && (
            <div className="border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/40">
                <h3 className="text-sm font-semibold">{t(lang, "relatedArticles")}</h3>
              </div>
              <div className="divide-y">
                {article.related.map(r => (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/help/${r.slug}`)}
                    className="w-full text-left p-3 hover:bg-muted/30 transition-colors group"
                  >
                    <p className="text-xs font-medium group-hover:text-primary transition-colors line-clamp-2">
                      {getTitle(r, lang)}
                    </p>
                    {r.excerpt && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{r.excerpt}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-violet-500/5 p-4 space-y-3">
            <h3 className="text-sm font-semibold">{t(lang, "needMoreHelp")}</h3>
            <p className="text-xs text-muted-foreground">{t(lang, "needMoreHelpDesc")}</p>
            <Button size="sm" className="w-full" onClick={handleNeedHelp}>
              <MessageSquare className="w-3.5 h-3.5 mr-2" />
              {t(lang, "contactSupport")}
            </Button>
          </div>

          <div className="rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground text-xs">Noehost Support</p>
            <p>Available 24/7 — avg response &lt; 2 hours</p>
            <p>Nameservers: <code className="text-primary">ns1.noehost.com</code></p>
            <p><code className="text-primary">ns2.noehost.com</code></p>
          </div>
        </div>
      </div>
    </div>
  );
}
