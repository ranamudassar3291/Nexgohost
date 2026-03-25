import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Save, Bold, Italic, List, ListOrdered, Heading2, Heading3,
  Code, Link2, Minus, Image, AlignLeft, Quote, Eye, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

interface KbCategory { id: string; name: string; }

interface FormState {
  categoryId: string;
  title: string;
  excerpt: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  isFeatured: boolean;
  isPublished: boolean;
}

const SCREENSHOT_TEMPLATE = `<div class="kb-screenshot"><div class="kb-screenshot-inner"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span class="kb-screenshot-tag">Screenshot</span><p class="kb-screenshot-caption">Add your caption here</p></div></div>`;

export default function KbArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEditing = !!id;

  const editorRef = useRef<HTMLDivElement>(null);
  const [editorMode, setEditorMode] = useState<"wysiwyg" | "source">("wysiwyg");

  const [form, setForm] = useState<FormState>({
    categoryId: "",
    title: "",
    excerpt: "",
    content: "",
    seoTitle: "",
    seoDescription: "",
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
      const loaded: FormState = {
        categoryId: article.categoryId,
        title: article.title,
        excerpt: article.excerpt || "",
        content: article.content || "",
        seoTitle: article.seoTitle || "",
        seoDescription: article.seoDescription || "",
        isFeatured: article.isFeatured,
        isPublished: article.isPublished,
      };
      setForm(loaded);
      if (editorRef.current) editorRef.current.innerHTML = loaded.content;
    }
  }, [article]);

  useEffect(() => {
    if (!form.categoryId && categories.length > 0) {
      setForm(f => ({ ...f, categoryId: categories[0].id }));
    }
  }, [categories, form.categoryId]);

  // Sync WYSIWYG → form.content on every edit
  const syncFromEditor = useCallback(() => {
    if (editorRef.current) {
      setForm(f => ({ ...f, content: editorRef.current!.innerHTML }));
    }
  }, []);

  // Switch between WYSIWYG and Source modes
  useEffect(() => {
    if (editorMode === "wysiwyg" && editorRef.current) {
      editorRef.current.innerHTML = form.content;
    }
  }, [editorMode]);

  const exec = (command: string, value?: string) => {
    if (editorMode !== "wysiwyg") return;
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncFromEditor();
  };

  const insertHTML = (html: string) => {
    if (editorMode !== "wysiwyg") return;
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    syncFromEditor();
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form };
      if (isEditing) {
        return apiFetch(`/api/admin/kb/articles/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      return apiFetch("/api/admin/kb/articles", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast({ title: isEditing ? "Article updated" : "Article created" });
      qc.invalidateQueries({ queryKey: ["/api/admin/kb/articles"] });
      navigate("/admin/knowledge-base");
    },
    onError: (e: any) => toast({ title: e?.message || "Failed to save article", variant: "destructive" }),
  });

  const canSave = form.title.trim() && form.categoryId && form.content.trim();

  const toolbarActions = [
    { icon: <Bold className="w-3.5 h-3.5" />, title: "Bold", action: () => exec("bold") },
    { icon: <Italic className="w-3.5 h-3.5" />, title: "Italic", action: () => exec("italic") },
    { icon: <Heading2 className="w-3.5 h-3.5" />, title: "Heading 2", action: () => exec("formatBlock", "<h2>") },
    { icon: <Heading3 className="w-3.5 h-3.5" />, title: "Heading 3", action: () => exec("formatBlock", "<h3>") },
    { icon: <AlignLeft className="w-3.5 h-3.5" />, title: "Paragraph", action: () => exec("formatBlock", "<p>") },
    { icon: <List className="w-3.5 h-3.5" />, title: "Bullet List", action: () => exec("insertUnorderedList") },
    { icon: <ListOrdered className="w-3.5 h-3.5" />, title: "Numbered List", action: () => exec("insertOrderedList") },
    { icon: <Code className="w-3.5 h-3.5" />, title: "Inline Code", action: () => insertHTML("<code>code</code>") },
    { icon: <Quote className="w-3.5 h-3.5" />, title: "Blockquote", action: () => exec("formatBlock", "<blockquote>") },
    { icon: <Link2 className="w-3.5 h-3.5" />, title: "Link", action: () => { const url = prompt("URL:"); if (url) exec("createLink", url); } },
    { icon: <Minus className="w-3.5 h-3.5" />, title: "Divider", action: () => insertHTML("<hr />") },
    { icon: <Image className="w-3.5 h-3.5" />, title: "Screenshot Placeholder", action: () => insertHTML(SCREENSHOT_TEMPLATE) },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/knowledge-base")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{isEditing ? "Edit Article" : "New Article"}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEditing ? "Update article content, SEO, and settings." : "Create a new help center article."}
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending} className="gap-2">
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? "Saving…" : "Save Article"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main Editor */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <Label>Article Title <span className="text-destructive">*</span></Label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. How to Create a Business Email on Noehost"
              className="text-lg font-medium mt-1"
            />
          </div>

          <div>
            <Label>Summary / Excerpt</Label>
            <Input
              value={form.excerpt}
              onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
              placeholder="Short summary shown in search results and category cards…"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Also used as the SEO description if left blank below.</p>
          </div>

          {/* WYSIWYG / Source toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Content <span className="text-destructive">*</span></Label>
              <Tabs value={editorMode} onValueChange={v => setEditorMode(v as "wysiwyg" | "source")}>
                <TabsList className="h-7">
                  <TabsTrigger value="wysiwyg" className="text-xs gap-1 h-6 px-2">
                    <Pencil className="w-3 h-3" /> WYSIWYG
                  </TabsTrigger>
                  <TabsTrigger value="source" className="text-xs gap-1 h-6 px-2">
                    <Eye className="w-3 h-3" /> HTML Source
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap gap-1 border rounded-t-md p-2 bg-muted/40">
              {toolbarActions.map(a => (
                <button
                  key={a.title}
                  title={a.title}
                  onMouseDown={e => { e.preventDefault(); a.action(); }}
                  disabled={editorMode === "source"}
                  className="p-1.5 rounded hover:bg-background border border-transparent hover:border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {a.icon}
                </button>
              ))}
              <div className="w-px bg-border mx-1 self-stretch" />
              <span className="self-center text-xs text-muted-foreground px-1">
                {editorMode === "wysiwyg" ? "Click image icon to insert screenshot placeholder" : "Editing raw HTML"}
              </span>
            </div>

            {/* WYSIWYG Editor */}
            <div
              className={editorMode === "wysiwyg" ? "block" : "hidden"}
            >
              <style>{`
                #kb-wysiwyg { min-height: 450px; }
                #kb-wysiwyg:focus { outline: none; }
                #kb-wysiwyg h2 { font-size: 1.25rem; font-weight: 600; margin: 1.5rem 0 0.5rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; }
                #kb-wysiwyg h3 { font-size: 1rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
                #kb-wysiwyg p { margin: 0.5rem 0; color: #475569; line-height: 1.7; }
                #kb-wysiwyg ul, #kb-wysiwyg ol { padding-left: 1.5rem; margin: 0.5rem 0; color: #475569; }
                #kb-wysiwyg li { margin: 0.25rem 0; }
                #kb-wysiwyg code { background: #f1f5f9; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.85em; font-family: monospace; }
                #kb-wysiwyg blockquote { border-left: 3px solid #6366f1; padding-left: 1rem; color: #64748b; margin: 1rem 0; }
                #kb-wysiwyg hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0; }
                #kb-wysiwyg a { color: #6366f1; }
                #kb-wysiwyg .kb-screenshot { border: 2px dashed #e2e8f0; border-radius: 12px; background: #f8fafc; margin: 1rem 0; }
                #kb-wysiwyg .kb-screenshot-inner { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1.5rem; gap: 0.5rem; color: #94a3b8; font-size: 0.875rem; }
                #kb-wysiwyg .kb-screenshot-inner svg { width: 2.5rem; height: 2.5rem; opacity: 0.5; }
                #kb-wysiwyg .kb-screenshot-caption { font-weight: 500; color: #64748b; }
                #kb-wysiwyg .kb-screenshot-tag { background: #e2e8f0; color: #475569; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; padding: 0.2rem 0.75rem; border-radius: 999px; }
              `}</style>
              <div
                id="kb-wysiwyg"
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncFromEditor}
                onKeyUp={syncFromEditor}
                onBlur={syncFromEditor}
                className="border border-t-0 rounded-b-md p-4 bg-background overflow-auto focus-visible:ring-2 focus-visible:ring-ring"
                data-placeholder="Start writing your article here… Use the toolbar above to format."
              />
            </div>

            {/* HTML Source Editor */}
            {editorMode === "source" && (
              <textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="<h2>Introduction</h2><p>Start writing your article here…</p>"
                className="w-full min-h-[450px] border border-t-0 rounded-b-md p-4 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
            )}
          </div>
        </div>

        {/* Right: Settings */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Category <span className="text-destructive">*</span></Label>
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
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">SEO Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>SEO Title</Label>
                <Input
                  value={form.seoTitle}
                  onChange={e => setForm(f => ({ ...f, seoTitle: e.target.value }))}
                  placeholder="e.g. Create Business Email — Noehost Help"
                  className="mt-1 text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">Shown in Google results. Leave blank to auto-generate.</p>
              </div>
              <div>
                <Label>SEO Description</Label>
                <textarea
                  value={form.seoDescription}
                  onChange={e => setForm(f => ({ ...f, seoDescription: e.target.value }))}
                  placeholder="Short description for search engines (150–160 chars)…"
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-ring"
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground">{form.seoDescription.length}/160 characters</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium mb-2">WYSIWYG Tips</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>• Use the toolbar to format text visually</p>
                <p>• Click 📷 to insert a screenshot placeholder</p>
                <p>• Switch to HTML Source for raw editing</p>
                <p>• Bold: Ctrl+B &nbsp;|&nbsp; Italic: Ctrl+I</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
