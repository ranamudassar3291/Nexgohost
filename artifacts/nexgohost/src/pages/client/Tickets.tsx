import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Ticket as TicketIcon, Plus, MessageSquare, Loader2, Paperclip, X,
  Upload, BookOpen, CheckCircle2, ChevronRight, Lightbulb, ExternalLink,
  AlertCircle, Bot, ArrowRight, Search, Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import Fuse from "fuse.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import CaptchaWidget from "@/components/CaptchaWidget";
import { extractKeywords, getTagsForSlug } from "@/lib/kbTags";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf", "application/zip"];
const MAX_SIZE_MB = 5;

interface Attachment { name: string; type: string; size: number; data: string; }
interface KbArticle { id: string; title: string; slug: string; excerpt: string | null; }

// ── Error pattern → article slug mapping ──────────────────────────────────────
const ERROR_PATTERNS: Array<{ patterns: RegExp; slug: string; label: string }> = [
  { patterns: /\b404\b|not found|page missing/i, slug: "fixing-404-not-found-errors-noehost", label: "Fixing 404 Not Found Errors" },
  { patterns: /\b500\b|internal server error/i, slug: "fixing-500-internal-server-error-noehost", label: "Fixing 500 Internal Server Error" },
  { patterns: /white screen|wsod|blank screen/i, slug: "fixing-white-screen-of-death-wordpress", label: "Fixing WordPress White Screen of Death" },
  { patterns: /dns propagat|nameserver|ns1|ns2/i, slug: "dns-propagation-explained-noehost", label: "DNS Propagation Guide" },
  { patterns: /database connection|error establishing/i, slug: "fixing-database-connection-error-wordpress", label: "Fixing Database Connection Error" },
  { patterns: /cache|old content|not updating/i, slug: "fixing-caching-issues-website-not-updating-noehost", label: "Fixing Caching Issues" },
  { patterns: /slow|speed|performance/i, slug: "speed-up-wordpress-site-noehost", label: "How to Speed Up WordPress" },
  { patterns: /cpanel|control panel/i, slug: "how-to-log-in-to-cpanel-noehost", label: "How to Log In to cPanel" },
  { patterns: /email|mail setup|inbox/i, slug: "how-to-create-business-email-noehost", label: "How to Create a Business Email" },
  { patterns: /ftp|file manager|upload|public_html/i, slug: "uploading-website-file-manager-vs-ftp", label: "Uploading via File Manager vs FTP" },
  { patterns: /wordpress install|softaculous/i, slug: "one-click-wordpress-installation-noehost", label: "WordPress One-Click Installation" },
  { patterns: /plugin|theme/i, slug: "how-to-install-wordpress-theme-plugin", label: "How to Install WordPress Theme or Plugin" },
  { patterns: /spf|dkim|dmarc|deliverability/i, slug: "setting-up-spf-dkim-dmarc-noehost", label: "SPF, DKIM & DMARC Setup" },
  { patterns: /invoice|billing|payment|renew/i, slug: "understanding-invoices-auto-renew-noehost", label: "Understanding Invoices & Auto-Renew" },
  { patterns: /domain register|register domain/i, slug: "how-to-register-new-domain-noehost", label: "How to Register a Domain" },
  { patterns: /transfer domain/i, slug: "how-to-transfer-domain-to-noehost", label: "How to Transfer a Domain to Noehost" },
  { patterns: /password|reset password|forgot/i, slug: "how-to-change-account-password-noehost", label: "How to Change Your Password" },
  { patterns: /php version|php 8|php error/i, slug: "changing-php-versions-noehost", label: "Changing PHP Versions" },
];

function detectErrorLinks(text: string): Array<{ slug: string; label: string }> {
  const found: Array<{ slug: string; label: string }> = [];
  for (const { patterns, slug, label } of ERROR_PATTERNS) {
    if (patterns.test(text)) found.push({ slug, label });
    if (found.length >= 3) break;
  }
  return found;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  answered: "bg-green-500/10 text-green-400 border-green-500/20",
  customer_reply: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  closed: "bg-secondary text-muted-foreground border-border",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground", medium: "text-blue-400", high: "text-orange-400", urgent: "text-red-400",
};

// ── Support Bot Avatar ─────────────────────────────────────────────────────────
function BotAvatar({ size = 40 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size }}
      className="rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm">
      <Bot size={size * 0.5} className="text-white" />
    </div>
  );
}

// ── Article Suggestion Card ────────────────────────────────────────────────────
function ArticleSuggestionCard({
  article, ticketSubject, onDeflected, onNeedMore,
}: {
  article: KbArticle;
  ticketSubject: string;
  onDeflected: (article: KbArticle) => void;
  onNeedMore: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden bg-background hover:border-primary/30 transition-colors">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-secondary/30 transition-colors"
      >
        <BookOpen size={16} className="text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground line-clamp-1">{article.title}</p>
          {article.excerpt && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{article.excerpt}</p>
          )}
        </div>
        <ChevronRight size={16} className={`text-muted-foreground transition-transform shrink-0 mt-0.5 ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="border-t border-border/40 p-4 space-y-3 bg-secondary/20">
          <a
            href={`/help/${article.slug}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              try {
                localStorage.setItem("noehost_ticket_context", JSON.stringify({
                  ticketSubject: ticketSubject,
                  articleId: article.id,
                  articleSlug: article.slug,
                  articleTitle: article.title,
                }));
              } catch {}
            }}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink size={11} /> Read full article
          </a>

          <div className="pt-2 border-t border-border/40">
            <p className="text-xs text-muted-foreground mb-2.5 font-medium">Did this article solve your problem?</p>
            <div className="flex gap-2 flex-wrap">
              <Button
                type="button"
                size="sm"
                onClick={() => onDeflected(article)}
                className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1.5 h-8"
              >
                <CheckCircle2 size={13} /> Yes, this solved my issue!
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onNeedMore}
                className="text-xs gap-1.5 h-8"
              >
                I need additional support
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ClientTickets() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // Stage: null | "subject" | "deflected" | "form"
  const [stage, setStage] = useState<null | "subject" | "deflected" | "form">(null);
  const [subject, setSubject] = useState("");
  const [suggestions, setSuggestions] = useState<KbArticle[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [deflectedArticle, setDeflectedArticle] = useState<KbArticle | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFallbackSuggestions, setIsFallbackSuggestions] = useState(false);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formData, setFormData] = useState({ message: "", priority: "medium", department: "Technical Support" });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [detectedLinks, setDetectedLinks] = useState<Array<{ slug: string; label: string }>>([]);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const { data: captchaConfig } = useQuery({
    queryKey: ["captcha-config"],
    queryFn: () => fetch("/api/security/captcha-config").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const captchaRequired = captchaConfig?.enabledPages?.supportTicket && !!captchaConfig?.siteKey;

  const { data: tickets = [], isLoading } = useQuery<any[]>({
    queryKey: ["client-tickets"],
    queryFn: () => apiFetch("/api/tickets"),
  });

  // Fetch all KB articles once when the bot is open — used for client-side fuzzy search
  const { data: allArticles = [] } = useQuery<KbArticle[]>({
    queryKey: ["kb-articles-all"],
    queryFn: () => apiFetch("/api/kb/articles"),
    enabled: stage === "subject",
    staleTime: 5 * 60 * 1000,
  });

  // Augment articles with keyword tags for richer matching
  const articlesWithTags = useMemo(
    () => allArticles.map(a => ({ ...a, _tags: getTagsForSlug(a.slug) })),
    [allArticles]
  );

  // Fuse.js instance — recreated only when article list changes
  const fuse = useMemo(
    () =>
      new Fuse(articlesWithTags, {
        keys: [
          { name: "title",   weight: 0.55 },
          { name: "excerpt", weight: 0.30 },
          { name: "_tags",   weight: 0.15 },
        ],
        threshold: 0.42,
        includeScore: true,
        distance: 150,
        minMatchCharLength: 2,
        ignoreLocation: true,
      }),
    [articlesWithTags]
  );

  // Live dropdown suggestions — instant, no debounce (Fuse is synchronous)
  const dropdownSuggestions = useMemo(() => {
    const q = subject.trim();
    if (q.length < 2) return [];
    const keywords = extractKeywords(q);
    const query = keywords.length > 0 ? keywords.join(" ") : q;
    return fuse.search(query, { limit: 3 }).map(r => r.item);
  }, [subject, fuse]);

  // Deflection tracking mutation
  const deflectMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/api/kb/deflections", { method: "POST", body: JSON.stringify(data) }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/api/tickets", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Ticket Created", description: "Our team will respond within 1–4 hours." });
      resetAll();
      qc.invalidateQueries({ queryKey: ["client-tickets"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Fuzzy KB search — 200ms debounce, runs Fuse.js locally (no network roundtrip)
  const fuzzyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSuggestions([]);

    if (fuzzyTimeout.current) clearTimeout(fuzzyTimeout.current);

    const q = subject.trim();
    if (q.length < 3) {
      setIsSearching(false);
      return;
    }

    // Show loading state briefly while Fuse runs (keeps UX consistent)
    setIsSearching(true);

    fuzzyTimeout.current = setTimeout(() => {
      const keywords = extractKeywords(q);
      const query = keywords.length > 0 ? keywords.join(" ") : q;
      const results = fuse.search(query, { limit: 3 });

      if (results.length > 0) {
        setSuggestions(results.map(r => r.item));
        setIsFallbackSuggestions(false);
      } else {
        // Fallback: top 3 articles from index as related articles
        setSuggestions(articlesWithTags.slice(0, 3));
        setIsFallbackSuggestions(true);
      }
      setIsSearching(false);
    }, 200);

    return () => {
      if (fuzzyTimeout.current) clearTimeout(fuzzyTimeout.current);
    };
  }, [subject, fuse, articlesWithTags]);

  // Detect error codes in message
  useEffect(() => {
    setDetectedLinks(detectErrorLinks(formData.message));
  }, [formData.message]);

  function resetAll() {
    setStage(null);
    setSubject("");
    setSuggestions([]);
    setShowDropdown(false);
    setFormData({ message: "", priority: "medium", department: "Technical Support" });
    setAttachments([]);
    setDeflectedArticle(null);
    setCaptchaToken(null);
  }

  function handleDeflected(article: KbArticle) {
    deflectMutation.mutate({
      articleId: article.id,
      articleTitle: article.title,
      articleSlug: article.slug,
      ticketSubject: subject,
    });
    setDeflectedArticle(article);
    setStage("deflected");
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const valid: Attachment[] = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({ title: "Invalid file type", description: `${file.name} — only JPG, PNG, PDF, ZIP`, variant: "destructive" }); continue;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds ${MAX_SIZE_MB}MB`, variant: "destructive" }); continue;
      }
      const data = await fileToBase64(file);
      valid.push({ name: file.name, type: file.type, size: file.size, data });
    }
    setAttachments(prev => [...prev, ...valid]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (captchaRequired && !captchaToken) {
      toast({ title: "Security check required", description: "Please complete the captcha before submitting.", variant: "destructive" });
      return;
    }
    createMutation.mutate({ subject, ...formData, attachments, ...(captchaToken ? { captchaToken } : {}) });
  };

  const openCount = tickets.filter(t => t.status === "open" || t.status === "customer_reply").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Support Tickets</h2>
          <p className="text-muted-foreground mt-1">
            {openCount > 0 ? `${openCount} open ticket${openCount > 1 ? "s" : ""}` : "Get help from our expert team."}
          </p>
        </div>
        {stage === null && (
          <Button onClick={() => setStage("subject")} className="bg-primary hover:bg-primary/90 gap-2 shadow-sm">
            <Plus size={16} /> Open New Ticket
          </Button>
        )}
      </div>

      {/* ── STAGE: subject + KB suggestions ─────────────────────────── */}
      {stage === "subject" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
          {/* Bot header */}
          <div className="bg-gradient-to-r from-primary/10 via-violet-500/5 to-transparent border-b border-border/60 p-5 flex items-center gap-3">
            <BotAvatar size={44} />
            <div>
              <p className="font-bold text-foreground">Noehost Support Bot</p>
              <p className="text-xs text-muted-foreground">Let's try to solve your issue instantly</p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Subject input */}
            <div>
              <label className="text-sm font-semibold text-foreground block mb-2">
                What's your issue about?
              </label>
              <div className="relative" ref={inputWrapperRef}>
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                <Input
                  autoFocus
                  className="pl-9 bg-background pr-9"
                  placeholder="e.g. 404 error, WordPress slow, email not working..."
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => {
                    blurTimeoutRef.current = setTimeout(() => setShowDropdown(false), 150);
                  }}
                />
                {isSearching && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}

                {/* Live fuzzy suggestions dropdown */}
                {showDropdown && dropdownSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border/70 rounded-xl shadow-2xl shadow-black/20 z-50 overflow-hidden">
                    <div className="px-3.5 py-2 border-b border-border/50 bg-secondary/40 flex items-center gap-2">
                      <Sparkles size={12} className="text-primary" />
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Suggested Articles
                      </span>
                    </div>
                    {dropdownSuggestions.map(article => (
                      <button
                        key={article.id}
                        type="button"
                        onMouseDown={() => {
                          if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                          setShowDropdown(false);
                        }}
                        onClick={() => {
                          setSubject(article.title);
                          setShowDropdown(false);
                        }}
                        className="w-full flex items-start gap-3 px-3.5 py-2.5 hover:bg-secondary/60 transition-colors text-left border-b border-border/30 last:border-0"
                      >
                        <BookOpen size={14} className="text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground line-clamp-1">{article.title}</p>
                          {article.excerpt && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{article.excerpt}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Skeleton loader — visible while searching */}
            {isSearching && subject.trim().length >= 3 && suggestions.length === 0 && (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="border border-border/40 rounded-xl p-4 animate-pulse">
                    <div className="flex items-start gap-3">
                      <div className="w-4 h-4 rounded bg-muted shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Suggestions — only shown when not searching and results exist */}
            {!isSearching && suggestions.length > 0 && (
              <div className="space-y-3">
                {/* Interception banner — adapts based on whether results are fuzzy or fallback */}
                {isFallbackSuggestions ? (
                  <div className="flex items-start gap-2.5 bg-secondary/60 border border-border/60 rounded-xl p-3.5">
                    <BookOpen size={16} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">No exact match — here are our top guides.</p>
                      <p className="text-xs text-muted-foreground mt-0.5">These articles cover the most common issues. Browse them before submitting a ticket.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5">
                    <Lightbulb size={16} className="text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Wait! These articles might solve your problem instantly.</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Check these guides before opening a ticket — most issues are solved in minutes.</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {suggestions.map(article => (
                    <ArticleSuggestionCard
                      key={article.id}
                      article={article}
                      ticketSubject={subject}
                      onDeflected={handleDeflected}
                      onNeedMore={() => setStage("form")}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-border/40">
              {!isSearching && suggestions.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStage("form")}
                  className="gap-2 text-sm"
                >
                  <ArrowRight size={15} /> None of these helped — Open a Ticket
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={subject.trim().length < 3 || isSearching}
                  onClick={() => setStage("form")}
                  className="bg-primary gap-2 text-sm"
                >
                  {isSearching
                    ? <><Loader2 size={15} className="animate-spin" /> Searching articles...</>
                    : <><ArrowRight size={15} /> Continue to Ticket Form</>
                  }
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={resetAll} className="text-sm text-muted-foreground">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE: deflected — happy to help! ───────────────────────── */}
      {stage === "deflected" && deflectedArticle && (
        <div className="bg-card border border-green-500/30 rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-transparent border-b border-green-500/20 p-5 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-green-600 flex items-center justify-center shadow-lg shadow-green-500/30">
              <CheckCircle2 size={22} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-green-500">Happy to Help!</p>
              <p className="text-xs text-muted-foreground">We're glad the article solved your issue.</p>
            </div>
          </div>
          <div className="p-6 text-center space-y-4">
            <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-600 rounded-full px-4 py-2 text-sm font-medium">
              <BookOpen size={15} />
              <span className="line-clamp-1">{deflectedArticle.title}</span>
            </div>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Your ticket was not submitted. If your issue returns or you have more questions, you can always open a new support ticket.
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Button onClick={resetAll} className="bg-primary gap-2">
                <CheckCircle2 size={15} /> Done
              </Button>
              <Button variant="outline" onClick={() => setStage("form")} className="gap-2 text-sm">
                <TicketIcon size={15} /> Still need help?
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE: full ticket form ──────────────────────────────────── */}
      {stage === "form" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
          {/* Bot header */}
          <div className="bg-gradient-to-r from-primary/10 via-violet-500/5 to-transparent border-b border-border/60 p-5 flex items-center gap-3">
            <BotAvatar size={44} />
            <div>
              <p className="font-bold text-foreground">Noehost Support Team</p>
              <p className="text-xs text-muted-foreground">We typically reply within 1–4 hours · Subject: <span className="text-foreground/70">{subject}</span></p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Department</label>
                <select
                  className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  value={formData.department}
                  onChange={e => setFormData(d => ({ ...d, department: e.target.value }))}
                >
                  <option>Technical Support</option>
                  <option>Billing</option>
                  <option>Sales</option>
                  <option>Abuse</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Priority</label>
                <select
                  className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  value={formData.priority}
                  onChange={e => setFormData(d => ({ ...d, priority: e.target.value }))}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                required
                rows={5}
                className="bg-background resize-none"
                value={formData.message}
                onChange={e => setFormData(d => ({ ...d, message: e.target.value }))}
                placeholder="Describe your issue in detail — include any error messages, URLs, and what you've already tried..."
              />

              {/* Auto-detected error links */}
              {detectedLinks.length > 0 && (
                <div className="mt-2 rounded-xl bg-blue-500/8 border border-blue-500/15 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-500">
                    <Lightbulb size={13} />
                    <span>Noehost Support Bot detected relevant guides:</span>
                  </div>
                  {detectedLinks.map(link => (
                    <a
                      key={link.slug}
                      href={`/help/${link.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-xs text-primary hover:underline"
                    >
                      <ExternalLink size={11} /> {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Attachments <span className="text-muted-foreground font-normal">(optional)</span></label>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-2 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-xs">
                    <Paperclip size={12} className="text-muted-foreground" />
                    <span className="max-w-[120px] truncate">{att.name}</span>
                    <span className="text-muted-foreground">({(att.size / 1024).toFixed(0)}KB)</span>
                    <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground border border-dashed border-border rounded-lg hover:border-primary/50 hover:text-primary transition-colors">
                  <Upload size={12} /> Add file
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Allowed: JPG, PNG, PDF, ZIP · Max {MAX_SIZE_MB}MB each</p>
              <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf,.zip" multiple onChange={handleFileChange} />
            </div>

            {captchaRequired && captchaConfig?.siteKey && (
              <div className="pt-1">
                <CaptchaWidget
                  siteKey={captchaConfig.siteKey}
                  provider={captchaConfig.provider ?? "turnstile"}
                  onVerify={token => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-between pt-2 border-t border-border/40">
              <Button type="button" variant="ghost" onClick={() => setStage("subject")} className="text-muted-foreground gap-2">
                ← Back to Suggestions
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={resetAll}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || (captchaRequired && !captchaToken)} className="bg-primary gap-2">
                  {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <TicketIcon size={16} />}
                  Submit Ticket
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── Ticket list ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : tickets.length === 0 && stage === null ? (
        <div className="bg-card border border-dashed border-border rounded-3xl p-12 text-center">
          <TicketIcon className="w-12 h-12 mx-auto text-muted-foreground opacity-30 mb-3" />
          <h3 className="font-semibold text-foreground">No tickets yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-5">Our team is here when you need help.</p>
          <Button onClick={() => setStage("subject")} className="bg-primary gap-2"><Plus size={15} /> Open Ticket</Button>
        </div>
      ) : stage === null && (
        <div className="grid gap-3">
          {tickets.map(ticket => (
            <div key={ticket.id} onClick={() => setLocation(`/client/tickets/${ticket.id}`)}
              className="bg-card border border-border/50 hover:border-primary/30 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                    <TicketIcon size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{ticket.subject}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="font-mono">#{ticket.ticketNumber}</span>
                      <span>·</span>
                      <span>{ticket.department}</span>
                      <span>·</span>
                      <span className={`font-medium ${PRIORITY_COLORS[ticket.priority] || ""}`}>{ticket.priority}</span>
                      <span>·</span>
                      <span>{format(new Date(ticket.lastReply || ticket.createdAt), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 ml-14 sm:ml-0 shrink-0">
                  {ticket.attachments?.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Paperclip size={12} /> {ticket.attachments.length}
                    </span>
                  )}
                  <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md text-xs text-muted-foreground">
                    <MessageSquare size={12} /> {ticket.messagesCount || 1}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLORS[ticket.status] || STATUS_COLORS.closed}`}>
                    {ticket.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
