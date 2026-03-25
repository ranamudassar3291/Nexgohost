import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, BookOpen, Eye, ThumbsUp, ThumbsDown, ChevronRight, Clock, Share2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

interface KbArticleFull {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  isFeatured: boolean;
  views: number;
  helpfulYes: number;
  helpfulNo: number;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; slug: string };
  related?: Array<{ id: string; title: string; slug: string; excerpt: string | null }>;
}

export default function HelpCenterArticle() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(null);

  const { data: article, isLoading, error } = useQuery<KbArticleFull>({
    queryKey: ["/api/kb/articles", slug],
    queryFn: () => apiFetch(`/api/kb/articles/${slug}`),
    retry: false,
  });

  const feedbackMutation = useMutation({
    mutationFn: (helpful: boolean) =>
      apiFetch(`/api/kb/articles/${article!.id}/feedback`, { method: "POST", body: JSON.stringify({ helpful }) }),
    onSuccess: (_data, helpful) => {
      setFeedbackGiven(helpful);
      toast({ title: helpful ? "Thanks! Glad it helped." : "Thanks for the feedback." });
    },
    onError: () => toast({ title: "Failed to submit feedback", variant: "destructive" }),
  });

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
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Help Center
        </Button>
      </div>
    );
  }

  const updatedDate = new Date(article.updatedAt).toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 flex-wrap">
            <button onClick={() => navigate("/help")} className="hover:text-foreground transition-colors">Help Center</button>
            {article.category && (
              <>
                <ChevronRight className="w-3.5 h-3.5" />
                <button onClick={() => navigate("/help")} className="hover:text-foreground transition-colors">{article.category.name}</button>
              </>
            )}
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium line-clamp-1">{article.title}</span>
          </nav>

          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold leading-tight mb-3">{article.title}</h1>
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Updated {updatedDate}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {article.views.toLocaleString()} views
              </span>
              {article.category && (
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{article.category.name}</span>
              )}
            </div>
          </div>

          <div
            className="prose prose-sm md:prose max-w-none
              prose-headings:font-semibold prose-headings:tracking-tight
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:border-b prose-h2:pb-2
              prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
              prose-p:text-muted-foreground prose-p:leading-relaxed
              prose-li:text-muted-foreground
              prose-strong:text-foreground prose-strong:font-semibold
              prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:text-foreground
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-hr:border-border
              prose-ol:space-y-1 prose-ul:space-y-1"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          <div className="mt-12 border rounded-xl p-6 bg-muted/30 text-center">
            {feedbackGiven === null ? (
              <>
                <p className="font-medium mb-4">Was this article helpful?</p>
                <div className="flex gap-3 justify-center">
                  <Button
                    variant="outline"
                    className="gap-2 hover:border-green-500 hover:text-green-600"
                    onClick={() => feedbackMutation.mutate(true)}
                    disabled={feedbackMutation.isPending}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Yes, it helped!
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 hover:border-red-400 hover:text-red-500"
                    onClick={() => feedbackMutation.mutate(false)}
                    disabled={feedbackMutation.isPending}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Not really
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {article.helpfulYes + article.helpfulNo > 0
                    ? `${article.helpfulYes} of ${article.helpfulYes + article.helpfulNo} people found this helpful`
                    : "Be the first to rate this article"}
                </p>
              </>
            ) : (
              <div className="space-y-1">
                <p className="font-medium">{feedbackGiven ? "Great! Glad it helped." : "Thanks for the feedback."}</p>
                <p className="text-sm text-muted-foreground">
                  {feedbackGiven
                    ? "If you need more help, open a support ticket below."
                    : "Our team reviews feedback to improve our articles."}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate("/help")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Help Center
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/client/tickets")}>
                Open a Support Ticket
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
                <h3 className="text-sm font-semibold">Related Articles</h3>
              </div>
              <div className="divide-y">
                {article.related.map(r => (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/help/${r.slug}`)}
                    className="w-full text-left p-3 hover:bg-muted/30 transition-colors group"
                  >
                    <p className="text-xs font-medium group-hover:text-primary transition-colors line-clamp-2">{r.title}</p>
                    {r.excerpt && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{r.excerpt}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border rounded-xl p-4 bg-primary/5 space-y-3">
            <h3 className="text-sm font-semibold">Need more help?</h3>
            <p className="text-xs text-muted-foreground">Our support team is available to help you with any questions.</p>
            <Button size="sm" className="w-full" onClick={() => navigate("/client/tickets")}>
              Contact Support
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
