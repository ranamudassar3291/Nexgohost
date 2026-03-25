import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, BookOpen, Eye, EyeOff, Star, StarOff, Search, FolderOpen, Layers, TrendingDown, Trophy, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";

interface KbCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  sortOrder: number;
  isPublished: boolean;
  articleCount: number;
}

interface KbArticle {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  views: number;
  helpfulYes: number;
  helpfulNo: number;
  updatedAt: string;
}

const ICONS = ["BookOpen", "Rocket", "Server", "Globe", "CreditCard", "Shield", "Mail", "HelpCircle", "Settings", "Zap"];

export default function KnowledgeBase() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"articles" | "categories" | "deflections">("articles");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [catDialog, setCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<KbCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: "", description: "", icon: "BookOpen", sortOrder: 0, isPublished: true });
  const [deleteDialog, setDeleteDialog] = useState<{ type: "cat" | "article"; id: string; name: string } | null>(null);

  const { data: categories = [] } = useQuery<KbCategory[]>({
    queryKey: ["/api/admin/kb/categories"],
    queryFn: () => apiFetch("/api/admin/kb/categories"),
  });

  const { data: articles = [] } = useQuery<KbArticle[]>({
    queryKey: ["/api/admin/kb/articles"],
    queryFn: () => apiFetch("/api/admin/kb/articles"),
  });

  const { data: deflStats } = useQuery<any>({
    queryKey: ["/api/admin/kb/deflection-stats"],
    queryFn: () => apiFetch("/api/admin/kb/deflection-stats"),
    enabled: tab === "deflections",
  });

  const seedMutation = useMutation({
    mutationFn: () => apiFetch("/api/admin/kb/seed", { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Knowledge base seeded with starter articles!" });
      qc.invalidateQueries({ queryKey: ["/api/admin/kb/categories"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/kb/articles"] });
    },
    onError: () => toast({ title: "Seed failed", variant: "destructive" }),
  });

  const saveCatMutation = useMutation({
    mutationFn: (data: typeof catForm) => {
      if (editingCat) {
        return apiFetch(`/api/admin/kb/categories/${editingCat.id}`, { method: "PUT", body: JSON.stringify(data) });
      }
      return apiFetch("/api/admin/kb/categories", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      toast({ title: editingCat ? "Category updated" : "Category created" });
      qc.invalidateQueries({ queryKey: ["/api/admin/kb/categories"] });
      setCatDialog(false);
    },
    onError: (e: any) => toast({ title: e?.message || "Failed to save category", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (d: { type: "cat" | "article"; id: string }) => {
      const url = d.type === "cat" ? `/api/admin/kb/categories/${d.id}` : `/api/admin/kb/articles/${d.id}`;
      return apiFetch(url, { method: "DELETE" });
    },
    onSuccess: (_, d) => {
      toast({ title: d.type === "cat" ? "Category deleted" : "Article deleted" });
      qc.invalidateQueries({ queryKey: ["/api/admin/kb/categories"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/kb/articles"] });
      setDeleteDialog(null);
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const toggleArticle = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: string; value: boolean }) =>
      apiFetch(`/api/admin/kb/articles/${id}`, { method: "PUT", body: JSON.stringify({ [field]: value }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/kb/articles"] }),
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const toggleCat = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      apiFetch(`/api/admin/kb/categories/${id}`, { method: "PUT", body: JSON.stringify({ isPublished: value }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/kb/categories"] }),
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const openNewCat = () => {
    setEditingCat(null);
    setCatForm({ name: "", description: "", icon: "BookOpen", sortOrder: 0, isPublished: true });
    setCatDialog(true);
  };

  const openEditCat = (cat: KbCategory) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, description: cat.description || "", icon: cat.icon || "BookOpen", sortOrder: cat.sortOrder, isPublished: cat.isPublished });
    setCatDialog(true);
  };

  const catMap: Record<string, string> = {};
  for (const c of categories) catMap[c.id] = c.name;

  const filteredArticles = articles.filter(a => {
    const matchesSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || (a.excerpt || "").toLowerCase().includes(search.toLowerCase());
    const matchesCat = !selectedCategory || a.categoryId === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage help articles and categories</p>
        </div>
        <div className="flex gap-2">
          {articles.length === 0 && categories.length === 0 && (
            <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? "Seeding…" : "Seed Starter Articles"}
            </Button>
          )}
          <Button onClick={() => navigate("/admin/knowledge-base/new")}>
            <Plus className="w-4 h-4 mr-2" />
            New Article
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{articles.length}</p>
            <p className="text-sm text-muted-foreground">Total Articles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{articles.filter(a => a.isPublished).length}</p>
            <p className="text-sm text-muted-foreground">Published</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{articles.filter(a => a.isFeatured).length}</p>
            <p className="text-sm text-muted-foreground">Featured</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{articles.reduce((s, a) => s + a.views, 0).toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Views</p>
          </CardContent>
        </Card>
      </div>

      <div className="border-b flex gap-6">
        <button
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === "articles" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("articles")}
        >
          Articles ({articles.length})
        </button>
        <button
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === "categories" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("categories")}
        >
          Categories ({categories.length})
        </button>
        <button
          className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === "deflections" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("deflections")}
        >
          <TrendingDown size={14} /> Deflection Rate
        </button>
      </div>

      {tab === "articles" && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input placeholder="Search articles…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={selectedCategory || ""}
              onChange={e => setSelectedCategory(e.target.value || null)}
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-left p-4 font-medium">Title</th>
                    <th className="text-left p-4 font-medium">Category</th>
                    <th className="text-center p-4 font-medium">Views</th>
                    <th className="text-center p-4 font-medium">Feedback</th>
                    <th className="text-center p-4 font-medium">Featured</th>
                    <th className="text-center p-4 font-medium">Published</th>
                    <th className="text-right p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredArticles.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        {articles.length === 0 ? (
                          <div className="space-y-2">
                            <BookOpen className="w-8 h-8 mx-auto opacity-40" />
                            <p>No articles yet. Click "Seed Starter Articles" to get started.</p>
                          </div>
                        ) : "No articles match your filters."}
                      </td>
                    </tr>
                  )}
                  {filteredArticles.map(a => (
                    <tr key={a.id} className="hover:bg-muted/30">
                      <td className="p-4">
                        <div className="font-medium">{a.title}</div>
                        {a.excerpt && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.excerpt}</div>}
                      </td>
                      <td className="p-4 text-muted-foreground">{catMap[a.categoryId] || "—"}</td>
                      <td className="p-4 text-center text-muted-foreground">{a.views.toLocaleString()}</td>
                      <td className="p-4 text-center">
                        <span className="text-green-600 text-xs font-medium">+{a.helpfulYes}</span>
                        <span className="text-muted-foreground text-xs mx-1">/</span>
                        <span className="text-red-500 text-xs font-medium">-{a.helpfulNo}</span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => toggleArticle.mutate({ id: a.id, field: "isFeatured", value: !a.isFeatured })}
                          className="text-muted-foreground hover:text-yellow-500 transition-colors"
                          title={a.isFeatured ? "Unfeature" : "Feature"}
                        >
                          {a.isFeatured ? <Star className="w-4 h-4 fill-yellow-400 text-yellow-500" /> : <StarOff className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => toggleArticle.mutate({ id: a.id, field: "isPublished", value: !a.isPublished })}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          {a.isPublished ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => navigate(`/admin/knowledge-base/${a.id}/edit`)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setDeleteDialog({ type: "article", id: a.id, name: a.title })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "categories" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewCat}>
              <Plus className="w-4 h-4 mr-2" />
              New Category
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No categories yet. Create one or seed starter content.</p>
              </div>
            )}
            {categories.map(cat => (
              <Card key={cat.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-primary" />
                        <span className="font-medium">{cat.name}</span>
                        {!cat.isPublished && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                      </div>
                      {cat.description && <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>}
                      <p className="text-xs text-muted-foreground mt-2">{cat.articleCount} articles</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => toggleCat.mutate({ id: cat.id, value: !cat.isPublished })} className="p-1.5 hover:bg-muted rounded-md transition-colors">
                        {cat.isPublished ? <Eye className="w-3.5 h-3.5 text-green-600" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                      <button onClick={() => openEditCat(cat)} className="p-1.5 hover:bg-muted rounded-md transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteDialog({ type: "cat", id: cat.id, name: cat.name })} className="p-1.5 hover:bg-muted rounded-md transition-colors text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "deflections" && (
        <div className="space-y-6">
          {/* Overview cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{deflStats?.totalDeflections ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">Total Deflections</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{deflStats?.topArticles?.length ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">Articles That Helped</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{articles.reduce((s, a) => s + a.helpfulYes, 0)}</p>
                    <p className="text-xs text-muted-foreground">Total "Helpful" Votes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top deflecting articles */}
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-sm">Top Articles by Deflections</h3>
                </div>
                {!deflStats?.topArticles?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No deflections recorded yet. Once clients use the KB-first ticket flow, deflection data will appear here.</p>
                ) : (
                  <div className="space-y-3">
                    {deflStats.topArticles.map((art: any, i: number) => (
                      <div key={art.articleSlug} className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "bg-amber-500/20 text-amber-600" : i === 1 ? "bg-secondary text-muted-foreground" : "bg-secondary text-muted-foreground"}`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1">{art.articleTitle}</p>
                          <a href={`/help/${art.articleSlug}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">/help/{art.articleSlug}</a>
                        </div>
                        <span className="text-sm font-bold text-green-600 shrink-0">{art.deflectionCount}×</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent deflections */}
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">Recent Deflections</h3>
                </div>
                {!deflStats?.recentDeflections?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No recent deflections yet.</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {deflStats.recentDeflections.map((d: any) => (
                      <div key={d.id} className="border border-border/40 rounded-xl p-3 space-y-1">
                        <p className="text-xs font-semibold text-foreground line-clamp-1">{d.ticketSubject}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 size={11} className="text-green-500" />
                          <span className="line-clamp-1">Solved by: {d.articleTitle}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(d.createdAt), "MMM d, yyyy · h:mm a")}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="bg-secondary/30 border border-border/40 rounded-xl p-4 text-sm text-muted-foreground">
            <strong className="text-foreground">How deflection works:</strong> When a client opens a ticket and starts typing their subject, the Noehost Support Bot searches the Knowledge Base and shows relevant articles. If the client clicks <em>"Yes, this solved my issue!"</em>, the ticket is cancelled and a deflection is recorded here. A high deflection rate means your KB is working well and reducing support load.
          </div>
        </div>
      )}

      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Getting Started" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Icon</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={catForm.icon} onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}>
                  {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input type="number" value={catForm.sortOrder} onChange={e => setCatForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} className="w-24" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={catForm.isPublished} onCheckedChange={v => setCatForm(f => ({ ...f, isPublished: v }))} />
              <Label>Published</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog(false)}>Cancel</Button>
            <Button onClick={() => saveCatMutation.mutate(catForm)} disabled={!catForm.name || saveCatMutation.isPending}>
              {saveCatMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>"{deleteDialog?.name}"</strong>?
            {deleteDialog?.type === "cat" && " All articles in this category will also be deleted."}
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteDialog && deleteMutation.mutate({ type: deleteDialog.type, id: deleteDialog.id })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
