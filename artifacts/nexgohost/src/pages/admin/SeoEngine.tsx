import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Plus, Edit3, Trash2, Eye, EyeOff, Globe,
  Loader2, Search, Tag, Clock, CheckCircle2, XCircle,
  ChevronRight, Map, BarChart3, Link2, Save, X, BookOpen,
  AlertCircle, ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function authH() {
  const t = localStorage.getItem("token") || localStorage.getItem("noehost_token");
  return { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
}
function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

interface BlogPost {
  id: number; title: string; slug: string; excerpt: string;
  category: string; cover_image: string; author_name: string;
  published: boolean; published_at: string | null; read_time_mins: number;
  meta_title: string; meta_description: string; focus_keyword: string;
  content: string; created_at: string; updated_at: string;
}

const CATEGORIES = ["General", "Tutorials", "Hosting Guides", "Domain Tips", "WordPress", "Security", "SEO", "News"];
const HOSTING_PAGES = [
  { slug: "shared-hosting",    label: "Shared Hosting"    },
  { slug: "wordpress-hosting", label: "WordPress Hosting" },
  { slug: "reseller-hosting",  label: "Reseller Hosting"  },
  { slug: "vps-hosting",       label: "VPS Hosting"       },
];

const EMPTY_FORM: Omit<BlogPost, "id" | "created_at" | "updated_at"> = {
  title: "", slug: "", content: "", excerpt: "", category: "Hosting Guides",
  cover_image: "", author_name: "Noehost Team", published: false,
  published_at: null, meta_title: "", meta_description: "", focus_keyword: "",
  read_time_mins: 5,
};

// ─── Blog Editor Modal ────────────────────────────────────────────────────────
function BlogEditor({
  post, onClose, onSave,
}: { post: Partial<BlogPost> | null; onClose: () => void; onSave: (data: any, id?: number) => void }) {
  const isEdit = !!post?.id;
  const [form, setForm] = useState<typeof EMPTY_FORM>(() =>
    post ? { ...EMPTY_FORM, ...post } : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof typeof EMPTY_FORM, v: any) =>
    setForm(p => ({ ...p, [k]: v }));

  const autoSlug = () => {
    if (!form.slug && form.title) set("slug", slugify(form.title));
    if (!form.meta_title && form.title) set("meta_title", form.title);
    if (!form.meta_description && form.excerpt) set("meta_description", form.excerpt.slice(0, 160));
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.slug.trim() || !form.content.trim()) {
      setErr("Title, slug, and content are required."); return;
    }
    setSaving(true); setErr("");
    try { await onSave(form, post?.id); }
    catch (e: any) { setErr(e.message || "Save failed"); setSaving(false); }
  };

  const inputCls = "w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "16px", overflowY: "auto" }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 820, boxShadow: "0 24px 60px rgba(0,0,0,0.2)", margin: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid #F3F4F6" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#9CA3AF" }}>
              <ArrowLeft size={18} />
            </button>
            <span style={{ fontWeight: 800, fontSize: 16, color: "#111827" }}>{isEdit ? "Edit Post" : "New SEO Guide"}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, fontWeight: 700, color: form.published ? "#10B981" : "#9CA3AF" }}>
              <input type="checkbox" checked={form.published} onChange={e => set("published", e.target.checked)} style={{ accentColor: "#10B981" }} />
              {form.published ? "Published" : "Draft"}
            </label>
            <button onClick={handleSave} disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: "none", background: "#6B46C1", color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving…" : "Save Post"}
            </button>
            <button onClick={onClose} style={{ border: "none", background: "#F3F4F6", borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}>
              <X size={16} color="#6B7280" />
            </button>
          </div>
        </div>

        {err && (
          <div style={{ margin: "12px 24px 0", padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, color: "#DC2626", fontSize: 13 }}>
            {err}
          </div>
        )}

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Title + Slug row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Post Title *</label>
              <input className={inputCls} value={form.title} onChange={e => set("title", e.target.value)} onBlur={autoSlug} placeholder="Best Node.js Hosting in Pakistan" style={{ marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>URL Slug *</label>
              <div style={{ position: "relative", marginTop: 4 }}>
                <input className={inputCls} value={form.slug} onChange={e => set("slug", slugify(e.target.value))} placeholder="best-nodejs-hosting-pakistan" style={{ paddingRight: 80 }} />
                <button onClick={() => set("slug", slugify(form.title))} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "#F3F0FF", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#6B46C1", cursor: "pointer", fontWeight: 700 }}>
                  Auto
                </button>
              </div>
            </div>
          </div>

          {/* Excerpt */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Excerpt (shown on blog listing)</label>
            <textarea className={inputCls} value={form.excerpt} onChange={e => set("excerpt", e.target.value)} rows={2} placeholder="A quick summary of this guide…" style={{ marginTop: 4, resize: "vertical" }} />
          </div>

          {/* Content */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Content * (Markdown supported)</label>
            <textarea className={inputCls} value={form.content} onChange={e => set("content", e.target.value)} rows={12} placeholder="# Best Node.js Hosting in Pakistan&#10;&#10;Are you looking for fast, affordable Node.js hosting?…" style={{ marginTop: 4, resize: "vertical", fontFamily: "monospace", fontSize: 13 }} />
          </div>

          {/* Meta row */}
          <div style={{ background: "#F9FAFB", borderRadius: 12, padding: "14px 16px", border: "1px solid #E5E7EB" }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>SEO Meta</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>Meta Title (60 chars max)</label>
                <input className={inputCls} value={form.meta_title} onChange={e => set("meta_title", e.target.value)} placeholder="Same as title if blank" style={{ marginTop: 4 }} maxLength={70} />
                <span style={{ fontSize: 10, color: form.meta_title.length > 60 ? "#EF4444" : "#9CA3AF" }}>{form.meta_title.length}/60</span>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>Focus Keyword</label>
                <input className={inputCls} value={form.focus_keyword} onChange={e => set("focus_keyword", e.target.value)} placeholder="nodejs hosting pakistan" style={{ marginTop: 4 }} />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>Meta Description (160 chars max)</label>
              <textarea className={inputCls} value={form.meta_description} onChange={e => set("meta_description", e.target.value)} rows={2} placeholder="Appears under your title in Google…" style={{ marginTop: 4, resize: "none" }} maxLength={170} />
              <span style={{ fontSize: 10, color: form.meta_description.length > 160 ? "#EF4444" : "#9CA3AF" }}>{form.meta_description.length}/160</span>
            </div>
          </div>

          {/* Bottom row: category, author, read time, cover */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>Category</label>
              <select className={inputCls} value={form.category} onChange={e => set("category", e.target.value)} style={{ marginTop: 4 }}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>Author Name</label>
              <input className={inputCls} value={form.author_name} onChange={e => set("author_name", e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>Read Time (mins)</label>
              <input className={inputCls} type="number" min={1} max={60} value={form.read_time_mins} onChange={e => set("read_time_mins", Number(e.target.value))} style={{ marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>Cover Image URL</label>
              <input className={inputCls} value={form.cover_image} onChange={e => set("cover_image", e.target.value)} placeholder="https://…" style={{ marginTop: 4 }} />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Blog Manager Tab ─────────────────────────────────────────────────────────
function BlogManagerTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<BlogPost> | null | "new">(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [delId, setDelId] = useState<number | null>(null);

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["admin-blog"],
    queryFn: () => fetch("/api/admin/blog", { headers: authH() }).then(r => r.json()),
    staleTime: 10_000,
  });

  const saveMut = useMutation({
    mutationFn: async ({ data, id }: { data: any; id?: number }) => {
      const url = id ? `/api/admin/blog/${id}` : "/api/admin/blog";
      const r = await fetch(url, { method: id ? "PUT" : "POST", headers: authH(), body: JSON.stringify(data) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Save failed");
      return j;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-blog"] }); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/blog/${id}`, { method: "DELETE", headers: authH() });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-blog"] }); setDelId(null); },
  });

  const filtered = posts.filter(p =>
    (!search || p.title.toLowerCase().includes(search.toLowerCase()) || p.focus_keyword.toLowerCase().includes(search.toLowerCase())) &&
    (!filterCat || p.category === filterCat)
  );

  return (
    <div>
      {(editing !== null) && (
        <BlogEditor
          post={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (data, id) => {
            await saveMut.mutateAsync({ data, id });
          }}
        />
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <Search size={14} color="#9CA3AF" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts…"
            style={{ width: "100%", paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none", color: "#374151" }} />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          style={{ padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, color: "#374151", outline: "none" }}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={() => setEditing("new")}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none", background: "#6B46C1", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          <Plus size={14} /> New Post
        </button>
      </div>

      {/* Posts table */}
      {isLoading ? (
        <div style={{ padding: 48, display: "flex", justifyContent: "center" }}>
          <Loader2 size={22} className="animate-spin" color="#C7D2FE" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "52px 24px", textAlign: "center", background: "#fff", border: "1px solid #E8EAED", borderRadius: 16 }}>
          <BookOpen size={36} color="#C7D2FE" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontWeight: 700, color: "#374151", fontSize: 15 }}>
            {posts.length === 0 ? "No blog posts yet" : "No matching posts"}
          </p>
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>
            {posts.length === 0 ? "Create your first SEO guide to attract clients from search engines." : "Try a different search or category filter."}
          </p>
          {posts.length === 0 && (
            <button onClick={() => setEditing("new")}
              style={{ marginTop: 14, padding: "9px 20px", borderRadius: 10, border: "none", background: "#6B46C1", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              <Plus size={14} style={{ display: "inline", marginRight: 6 }} />Write First Post
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px 100px 120px", padding: "10px 16px", background: "#F9FAFB", borderBottom: "1px solid #F3F4F6" }}>
            {["Post", "Category", "Status", "Read Time", "Actions"].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
            ))}
          </div>
          {filtered.map((p, i) => (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px 100px 120px", padding: "14px 16px", borderBottom: i < filtered.length - 1 ? "1px solid #F9FAFB" : "none", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>/{p.slug}</span>
                  {p.focus_keyword && (
                    <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: "#F3F0FF", color: "#7C5DE2", fontWeight: 700 }}>
                      🎯 {p.focus_keyword}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 12, color: "#6B7280" }}>{p.category}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                background: p.published ? "#D1FAE5" : "#F3F4F6", color: p.published ? "#065F46" : "#6B7280" }}>
                {p.published ? <Eye size={11} /> : <EyeOff size={11} />}
                {p.published ? "Live" : "Draft"}
              </span>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>{p.read_time_mins} min</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setEditing(p)} title="Edit"
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", cursor: "pointer" }}>
                  <Edit3 size={13} color="#6B7280" />
                </button>
                <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" title="Preview"
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", display: "flex", alignItems: "center" }}>
                  <Globe size={13} color="#6B7280" />
                </a>
                {delId === p.id ? (
                  <button onClick={() => deleteMut.mutate(p.id)}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #FECACA", background: "#FEF2F2", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#DC2626" }}>
                    {deleteMut.isPending ? "…" : "Confirm"}
                  </button>
                ) : (
                  <button onClick={() => setDelId(p.id)} title="Delete"
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", cursor: "pointer" }}>
                    <Trash2 size={13} color="#EF4444" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats footer */}
      {posts.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 12, color: "#9CA3AF" }}>
          <span><strong style={{ color: "#374151" }}>{posts.filter(p => p.published).length}</strong> published</span>
          <span><strong style={{ color: "#374151" }}>{posts.filter(p => !p.published).length}</strong> drafts</span>
          <span><strong style={{ color: "#374151" }}>{posts.length}</strong> total posts</span>
        </div>
      )}
    </div>
  );
}

// ─── Schema & Sitemap Tab ─────────────────────────────────────────────────────
function SchemaTab() {
  const [checking, setChecking] = useState<string | null>(null);
  const [schemaData, setSchemaData] = useState<Record<string, any>>({});
  const [schemaErr, setSchemaErr] = useState<Record<string, string>>({});

  const checkSchema = async (slug: string) => {
    setChecking(slug);
    try {
      const r = await fetch(`/api/schema/packages/${slug}`);
      const d = await r.json();
      setSchemaData(prev => ({ ...prev, [slug]: d }));
      setSchemaErr(prev => ({ ...prev, [slug]: "" }));
    } catch (e: any) {
      setSchemaErr(prev => ({ ...prev, [slug]: e.message }));
    }
    setChecking(null);
  };

  const sitemapUrl = `${window.location.origin}/api/sitemap.xml`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Sitemap card */}
      <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", background: "#FAFBFF", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "#F3F0FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Map size={16} color="#6B46C1" />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: "#111827", margin: 0 }}>Auto-Generated Sitemap</p>
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>Includes all pages + published blog posts. Submit to Google Search Console.</p>
          </div>
        </div>
        <div style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 14px" }}>
            <Link2 size={14} color="#7C5DE2" />
            <code style={{ fontSize: 13, color: "#374151", flex: 1 }}>{sitemapUrl}</code>
            <a href={sitemapUrl} target="_blank" rel="noreferrer"
              style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#6B46C1", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
              View XML
            </a>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["/", "/shared-hosting", "/wordpress-hosting", "/reseller-hosting", "/vps-hosting", "/domains", "/blog"].map(p => (
              <span key={p} style={{ fontSize: 11, padding: "3px 9px", background: "#F3F0FF", color: "#6B46C1", borderRadius: 20, fontWeight: 600 }}>{p}</span>
            ))}
            <span style={{ fontSize: 11, padding: "3px 9px", background: "#D1FAE5", color: "#065F46", borderRadius: 20, fontWeight: 600 }}>+ blog posts</span>
          </div>
          <div style={{ marginTop: 12, padding: "10px 14px", background: "#FFF9C4", border: "1px solid #FDE68A", borderRadius: 10 }}>
            <p style={{ fontSize: 12, color: "#92400E", margin: 0, fontWeight: 600 }}>
              Next step: Submit <strong>{sitemapUrl}</strong> to{" "}
              <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" style={{ color: "#6B46C1" }}>Google Search Console</a>
              {" "}→ Sitemaps for instant indexing of all your pages and blog posts.
            </p>
          </div>
        </div>
      </div>

      {/* Schema cards */}
      <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", background: "#FAFBFF", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarChart3 size={16} color="#D97706" />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: "#111827", margin: 0 }}>JSON-LD Product Schema</p>
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>Shows Star Ratings + Price directly in Google Search results for each hosting page.</p>
          </div>
        </div>
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {HOSTING_PAGES.map(page => {
            const data = schemaData[page.slug];
            const err  = schemaErr[page.slug];
            const isChecking = checking === page.slug;
            return (
              <div key={page.slug} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {data ? <CheckCircle2 size={15} color="#10B981" /> : err ? <XCircle size={15} color="#EF4444" /> : <AlertCircle size={15} color="#D1D5DB" />}
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{page.label}</span>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>/{page.slug}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => checkSchema(page.slug)} disabled={isChecking}
                      style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 12, fontWeight: 700, color: "#6B46C1", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                      {isChecking ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                      {isChecking ? "Checking…" : data ? "Re-check" : "Check Schema"}
                    </button>
                    <a href={`/api/schema/packages/${page.slug}`} target="_blank" rel="noreferrer"
                      style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 12, fontWeight: 700, color: "#6B7280", cursor: "pointer", textDecoration: "none" }}>
                      View JSON
                    </a>
                  </div>
                </div>
                {data && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, padding: "3px 9px", background: "#D1FAE5", color: "#065F46", borderRadius: 20, fontWeight: 700 }}>
                      ✓ {(data["@graph"]?.filter((n: any) => n["@type"] === "Product") || []).length} products
                    </span>
                    <span style={{ fontSize: 11, padding: "3px 9px", background: "#D1FAE5", color: "#065F46", borderRadius: 20, fontWeight: 700 }}>
                      ✓ Star ratings
                    </span>
                    <span style={{ fontSize: 11, padding: "3px 9px", background: "#D1FAE5", color: "#065F46", borderRadius: 20, fontWeight: 700 }}>
                      ✓ Prices
                    </span>
                    <span style={{ fontSize: 11, padding: "3px 9px", background: "#D1FAE5", color: "#065F46", borderRadius: 20, fontWeight: 700 }}>
                      ✓ Breadcrumbs
                    </span>
                  </div>
                )}
                {err && <p style={{ fontSize: 12, color: "#DC2626", marginTop: 8 }}>Error: {err}</p>}
              </div>
            );
          })}
        </div>
        <div style={{ padding: "12px 18px", background: "#F0F9FF", borderTop: "1px solid #E0F2FE" }}>
          <p style={{ fontSize: 12, color: "#0369A1", margin: 0 }}>
            <strong>How it works:</strong> Each hosting page automatically injects JSON-LD into the page &lt;head&gt;. Google reads it to show rich snippets with star ratings and prices in search results — increasing your click-through rate by up to 30%.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SeoEngine() {
  const [tab, setTab] = useState<"blog" | "schema">("blog");

  const tabs = [
    { id: "blog",   label: "Blog Manager",      icon: FileText  },
    { id: "schema", label: "Schema & Sitemap",  icon: Globe     },
  ] as const;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 26, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: "linear-gradient(135deg,#F3F0FF,#E0E7FF)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Search size={20} color="#6B46C1" />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111827", margin: 0 }}>SEO & Marketing Engine</h1>
            <p style={{ fontSize: 14, color: "#6B7280", margin: 0 }}>Publish SEO guides, inject schema markup, and auto-generate your sitemap.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/blog" target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, fontWeight: 700, color: "#374151", textDecoration: "none" }}>
            <Globe size={14} /> View Blog
          </a>
        </div>
      </div>

      {/* Stats row */}
      <BlogStatsRow />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 22, background: "#F3F4F6", borderRadius: 14, padding: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 13, transition: "all 0.2s",
              background: tab === t.id ? "#fff" : "transparent", color: tab === t.id ? "#6B46C1" : "#6B7280",
              boxShadow: tab === t.id ? "0 1px 6px rgba(0,0,0,0.10)" : "none" }}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "blog"   && <motion.div key="blog"   initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><BlogManagerTab /></motion.div>}
        {tab === "schema" && <motion.div key="schema" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><SchemaTab /></motion.div>}
      </AnimatePresence>
    </div>
  );
}

function BlogStatsRow() {
  const { data: posts = [] } = useQuery<BlogPost[]>({
    queryKey: ["admin-blog"],
    queryFn: () => fetch("/api/admin/blog", { headers: authH() }).then(r => r.json()),
    staleTime: 10_000,
  });
  const stats = [
    { label: "Total Posts",  value: posts.length,                              color: "#6B46C1", bg: "#F3F0FF" },
    { label: "Published",    value: posts.filter(p => p.published).length,     color: "#10B981", bg: "#D1FAE5" },
    { label: "Drafts",       value: posts.filter(p => !p.published).length,    color: "#F59E0B", bg: "#FEF3C7" },
    { label: "Keywords",     value: new Set(posts.map(p => p.focus_keyword).filter(Boolean)).size, color: "#8B5CF6", bg: "#EDE9FE" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 14, padding: "16px 18px" }}>
          <p style={{ fontSize: 24, fontWeight: 900, color: s.color, margin: 0 }}>{s.value}</p>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>{s.label}</p>
        </div>
      ))}
    </div>
  );
}
