import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search, Clock, Tag, ChevronRight, BookOpen, Rss } from "lucide-react";
import { JsonLd } from "../JsonLd";

interface BlogPost {
  id: number; title: string; slug: string; excerpt: string;
  category: string; cover_image: string; author_name: string;
  published_at: string; read_time_mins: number;
  meta_title: string; meta_description: string; focus_keyword: string;
}

function timeAgo(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  "Hosting Guides": { bg: "#F3F0FF", text: "#6B46C1" },
  "WordPress":      { bg: "#FCE7F3", text: "#9D174D" },
  "Security":       { bg: "#FEF3C7", text: "#92400E" },
  "SEO":            { bg: "#D1FAE5", text: "#065F46" },
  "Domain Tips":    { bg: "#E0F2FE", text: "#0369A1" },
  "Tutorials":      { bg: "#F3E8FF", text: "#7C3AED" },
  "News":           { bg: "#FFE4E6", text: "#9F1239" },
  "General":        { bg: "#F3F4F6", text: "#6B7280" },
};
function catStyle(cat: string) {
  return CAT_COLORS[cat] || { bg: "#F3F4F6", text: "#6B7280" };
}

function PostCard({ post }: { post: BlogPost }) {
  const cs = catStyle(post.category);
  return (
    <Link to={`/blog/${post.slug}`} style={{ textDecoration: "none" }}>
      <div style={{ background: "#fff", borderRadius: 18, overflow: "hidden", border: "1px solid #E8EAED", transition: "box-shadow 0.2s, transform 0.2s", cursor: "pointer" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(79,70,229,0.12)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
        {/* Cover */}
        <div style={{ height: 180, background: post.cover_image ? undefined : "linear-gradient(135deg,#F3F0FF 0%,#E0E7FF 100%)", position: "relative", overflow: "hidden" }}>
          {post.cover_image ? (
            <img src={post.cover_image} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={40} color="#A5B4FC" />
            </div>
          )}
          <span style={{ position: "absolute", top: 12, left: 12, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: cs.bg, color: cs.text }}>
            {post.category}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 18px" }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: "0 0 8px", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {post.title}
          </h3>
          {post.excerpt && (
            <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 12px", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {post.excerpt}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#7C5DE2,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>{post.author_name[0]}</span>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#374151", margin: 0 }}>{post.author_name}</p>
                <p style={{ fontSize: 10, color: "#9CA3AF", margin: 0 }}>{timeAgo(post.published_at)}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#9CA3AF" }}>
              <Clock size={11} />
              {post.read_time_mins} min read
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function FeaturedPost({ post }: { post: BlogPost }) {
  const cs = catStyle(post.category);
  return (
    <Link to={`/blog/${post.slug}`} style={{ textDecoration: "none" }}>
      <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", border: "1px solid #E8EAED", display: "grid", gridTemplateColumns: "1fr 1fr", transition: "box-shadow 0.2s", cursor: "pointer" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(79,70,229,0.14)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
        <div style={{ minHeight: 260, background: post.cover_image ? undefined : "linear-gradient(135deg,#6B46C1 0%,#7C3AED 100%)", position: "relative" }}>
          {post.cover_image ? (
            <img src={post.cover_image} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={60} color="rgba(255,255,255,0.4)" />
            </div>
          )}
        </div>
        <div style={{ padding: "28px 28px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: cs.bg, color: cs.text }}>{post.category}</span>
            <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>FEATURED</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: "#111827", margin: "0 0 10px", lineHeight: 1.3 }}>{post.title}</h2>
          {post.excerpt && <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 16px", lineHeight: 1.65 }}>{post.excerpt}</p>}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#7C5DE2,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>{post.author_name[0]}</span>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: 0 }}>{post.author_name}</p>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>{timeAgo(post.published_at)}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "#6B46C1" }}>
              Read More <ChevronRight size={14} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Blog() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const PER_PAGE = 9;

  const { data, isLoading } = useQuery<{ posts: BlogPost[]; total: number; categories: string[] }>({
    queryKey: ["public-blog", category, page],
    queryFn: () => fetch(`/api/blog?limit=${PER_PAGE}&offset=${page * PER_PAGE}${category ? `&category=${encodeURIComponent(category)}` : ""}`).then(r => r.json()),
    staleTime: 60_000,
  });

  const posts = data?.posts || [];
  const total = data?.total || 0;
  const categories = data?.categories || [];
  const totalPages = Math.ceil(total / PER_PAGE);

  const filtered = search
    ? posts.filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || p.excerpt.toLowerCase().includes(search.toLowerCase()))
    : posts;

  const featured = page === 0 && !search && !category ? filtered[0] : null;
  const rest = featured ? filtered.slice(1) : filtered;

  const blogListSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Noehost Blog",
    "description": "SEO guides, hosting tutorials, and digital marketing tips from the Noehost team.",
    "url": `${window.location.origin}/blog`,
    "blogPost": posts.slice(0, 10).map(p => ({
      "@type": "BlogPosting",
      "headline": p.title,
      "description": p.excerpt,
      "author": { "@type": "Person", "name": p.author_name },
      "datePublished": p.published_at,
      "url": `${window.location.origin}/blog/${p.slug}`,
    })),
  };

  return (
    <>
      <JsonLd id="blog-list-schema" schema={blogListSchema} />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "#F3F0FF", borderRadius: 20, marginBottom: 14 }}>
            <Rss size={13} color="#6B46C1" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#6B46C1" }}>Noehost Blog</span>
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 900, color: "#111827", margin: "0 0 12px", lineHeight: 1.2 }}>
            Hosting Guides & SEO Tips
          </h1>
          <p style={{ fontSize: 16, color: "#6B7280", maxWidth: 560, margin: "0 auto" }}>
            Expert tutorials on web hosting, WordPress, domains, and digital marketing to help your business grow online.
          </p>
        </div>

        {/* Search + Category Filter */}
        <div style={{ display: "flex", gap: 10, marginBottom: 32, flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ position: "relative", maxWidth: 380, flex: 1 }}>
            <Search size={15} color="#9CA3AF" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guides…"
              style={{ width: "100%", paddingLeft: 38, paddingRight: 14, paddingTop: 11, paddingBottom: 11, border: "1px solid #E5E7EB", borderRadius: 12, fontSize: 14, outline: "none", color: "#374151", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => { setCategory(""); setPage(0); }}
              style={{ padding: "10px 16px", borderRadius: 12, border: `2px solid ${!category ? "#6B46C1" : "#E5E7EB"}`, background: !category ? "#6B46C1" : "#fff", color: !category ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => { setCategory(cat); setPage(0); }}
                style={{ padding: "10px 16px", borderRadius: 12, border: `2px solid ${category === cat ? "#6B46C1" : "#E5E7EB"}`, background: category === cat ? "#6B46C1" : "#fff", color: category === cat ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #C7D2FE", borderTopColor: "#6B46C1", animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>Loading guides…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "64px 24px", textAlign: "center" }}>
            <BookOpen size={48} color="#C7D2FE" style={{ margin: "0 auto 16px" }} />
            <p style={{ fontWeight: 700, color: "#374151", fontSize: 18 }}>No guides found</p>
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>Try a different search term or category.</p>
          </div>
        ) : (
          <>
            {featured && (
              <div style={{ marginBottom: 32 }}>
                <FeaturedPost post={featured} />
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
              {rest.map(p => <PostCard key={p.id} post={p} />)}
            </div>

            {/* Pagination */}
            {totalPages > 1 && !search && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 40 }}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} onClick={() => setPage(i)}
                    style={{ width: 36, height: 36, borderRadius: 10, border: `2px solid ${i === page ? "#6B46C1" : "#E5E7EB"}`, background: i === page ? "#6B46C1" : "#fff", color: i === page ? "#fff" : "#6B7280", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* CTA */}
        <div style={{ marginTop: 60, background: "linear-gradient(135deg,#6B46C1,#7C3AED)", borderRadius: 20, padding: "40px 32px", textAlign: "center" }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: "0 0 10px" }}>Ready to Launch Your Website?</h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.8)", margin: "0 0 22px" }}>Get blazing-fast hosting with free SSL, cPanel, and 24/7 support.</p>
          <Link to="/shared-hosting" style={{ display: "inline-block", padding: "13px 28px", borderRadius: 12, background: "#fff", color: "#6B46C1", fontWeight: 800, fontSize: 15, textDecoration: "none" }}>
            View Hosting Plans →
          </Link>
        </div>
      </div>
    </>
  );
}
