import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Save, Bold, Italic, List, ListOrdered, Heading2, Heading3, Code, Link2, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

interface KbCategory { id: string; name: string; }

interface FormState {
  categoryId: string;
  title: string;
  excerpt: string;
  content: string;
  isFeatured: boolean;
  isPublished: boolean;
}

function insertAtCursor(textarea: HTMLTextAreaElement, before: string, after = "", placeholder = "text") {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end) || placeholder;
  const newText = before + selected + after;
  const newValue = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
  const newPos = start + before.length + selected.length + after.length;
  return { newValue, newPos };
}

export default function KbArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEditing = !!id;
  const [preview, setPreview] = useState(false);

  const [form, setForm] = useState<FormState>({
    categoryId: "",
    title: "",
    excerpt: "",
    content: "",
    isFeatured: false,
    isPublished: true,
  });

  const { data: categories = [] } = useQuery<KbCategory[]>({
    queryKey: ["/api/admin/kb/categories"],
    queryFn: () => apiFetch("/api/admin/kb/categories"),
  });

  const { data: article } = useQuery({
    queryKey: ["/api/admin/kb/articles", id],
    queryFn: () => apiFetch(`/api/admin/kb/articles/${id}`),
    enabled: isEditing,
  });

  useEffect(() => {
    if (article) {
      setForm({
        categoryId: article.categoryId,
        title: article.title,
        excerpt: article.excerpt || "",
        content: article.content || "",
        isFeatured: article.isFeatured,
        isPublished: article.isPublished,
      });
    }
  }, [article]);

  useEffect(() => {
    if (!form.categoryId && categories.length > 0) {
      setForm(f => ({ ...f, categoryId: categories[0].id }));
    }
  }, [categories, form.categoryId]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (isEditing) {
        return apiFetch(`/api/admin/kb/articles/${id}`, { method: "PUT", body: JSON.stringify(form) });
      }
      return apiFetch("/api/admin/kb/articles", { method: "POST", body: JSON.stringify(form) });
    },
    onSuccess: () => {
      toast({ title: isEditing ? "Article updated" : "Article created" });
      qc.invalidateQueries({ queryKey: ["/api/admin/kb/articles"] });
      navigate("/admin/knowledge-base");
    },
    onError: (e: any) => toast({ title: e?.message || "Failed to save article", variant: "destructive" }),
  });

  const toolbar = [
    { icon: <Bold className="w-3.5 h-3.5" />, title: "Bold", apply: (ta: HTMLTextAreaElement) => insertAtCursor(ta, "<strong>", "</strong>", "bold text") },
    { icon: <Italic className="w-3.5 h-3.5" />, title: "Italic", apply: (ta: HTMLTextAreaElement) => insertAtCursor(ta, "<em>", "</em>", "italic text") },
    { icon: <Heading2 className="w-3.5 h-3.5" />, title: "Heading 2", apply: (ta: HTMLTextAreaElement) => insertAtCursor(ta, "<h2>", "</h2>", "Heading") },
    { icon: <Heading3 className="w-3.5 h-3.5" />, title: "Heading 3", apply: (ta: HTMLTextAreaElement) => insertAtCursor(ta, "<h3>", "</h3>", "Heading") },
    { icon: <List className="w-3.5 h-3.5" />, title: "Bullet List", apply: (ta: HTMLTextAreaElement) => insertAtCursor(ta, "<ul>\n  <li>", "</li>\n</ul>", "List item") },
    { icon: <ListOrdered className="w-3.5 h-3.5" />, title: "Numbered List", apply: (ta: HTMLTextAreaElement) => insertAtCursor(ta, "<ol>\n  <li>", "</li>\n</ol>", "List item") },
    { icon: <Code className="w-3.5 h-3.5" />, title: "Inline Code", apply: (ta: HTMLTextAreaElement) => insertAtCursor(ta, "<code>", "</code>", "code") },
    { icon: <Link2 className="w-3.5 h-3.5" />, title: "Link", apply: (ta: HTMLTextAreaElement) => insertAtCursor(ta, '<a href="URL">', "</a>", "link text") },
    { icon: <Minus className="w-3.5 h-3.5" />, title: "Divider", apply: (ta: HTMLTextAreaElement) => insertAtCursor(ta, "\n<hr />\n", "", "") },
  ];

  const handleToolbar = (applyFn: (ta: HTMLTextAreaElement) => { newValue: string; newPos: number }) => {
    const ta = document.getElementById("kb-content") as HTMLTextAreaElement;
    if (!ta) return;
    const { newValue, newPos } = applyFn(ta);
    setForm(f => ({ ...f, content: newValue }));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(newPos, newPos); }, 0);
  };

  const canSave = form.title.trim() && form.categoryId && form.content.trim();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/knowledge-base")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{isEditing ? "Edit Article" : "New Article"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreview(p => !p)}>
            {preview ? <><EyeOff className="w-3.5 h-3.5 mr-1" />Edit</> : <><Eye className="w-3.5 h-3.5 mr-1" />Preview</>}
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Saving…" : "Save Article"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div>
            <Label>Article Title</Label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. How to Set Up Email on Your Phone"
              className="text-lg font-medium mt-1"
            />
          </div>
          <div>
            <Label>Excerpt (shown in search results)</Label>
            <Input
              value={form.excerpt}
              onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
              placeholder="Short summary of this article…"
              className="mt-1"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Content (HTML)</Label>
            </div>
            <div className="flex flex-wrap gap-1 border rounded-t-md p-2 bg-muted/40">
              {toolbar.map(t => (
                <button
                  key={t.title}
                  title={t.title}
                  onClick={() => handleToolbar(t.apply)}
                  className="p-1.5 rounded hover:bg-background border border-transparent hover:border-border transition-colors"
                >
                  {t.icon}
                </button>
              ))}
            </div>
            {preview ? (
              <div
                className="min-h-[400px] border border-t-0 rounded-b-md p-4 prose prose-sm max-w-none bg-background overflow-auto"
                dangerouslySetInnerHTML={{ __html: form.content || "<p class='text-muted-foreground'>Nothing to preview yet…</p>" }}
              />
            ) : (
              <textarea
                id="kb-content"
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="<h2>Introduction</h2><p>Start writing your article here…</p>"
                className="w-full min-h-[400px] border border-t-0 rounded-b-md p-4 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
            )}
            <p className="text-xs text-muted-foreground mt-1">Write HTML directly. Use the toolbar buttons above to insert common tags quickly.</p>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div>
                <Label>Category</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                  value={form.categoryId}
                  onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                >
                  <option value="">Select a category…</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Published</Label>
                <Switch checked={form.isPublished} onCheckedChange={v => setForm(f => ({ ...f, isPublished: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Featured</Label>
                  <p className="text-xs text-muted-foreground">Shows on Help Center home</p>
                </div>
                <Switch checked={form.isFeatured} onCheckedChange={v => setForm(f => ({ ...f, isFeatured: v }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium mb-2">HTML Quick Reference</p>
              <div className="space-y-1 text-xs text-muted-foreground font-mono">
                <p><code>&lt;h2&gt;Section Title&lt;/h2&gt;</code></p>
                <p><code>&lt;p&gt;Paragraph text&lt;/p&gt;</code></p>
                <p><code>&lt;strong&gt;Bold&lt;/strong&gt;</code></p>
                <p><code>&lt;ul&gt;&lt;li&gt;Item&lt;/li&gt;&lt;/ul&gt;</code></p>
                <p><code>&lt;ol&gt;&lt;li&gt;Step&lt;/li&gt;&lt;/ol&gt;</code></p>
                <p><code>&lt;code&gt;inline code&lt;/code&gt;</code></p>
                <p><code>&lt;a href="URL"&gt;Link&lt;/a&gt;</code></p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
