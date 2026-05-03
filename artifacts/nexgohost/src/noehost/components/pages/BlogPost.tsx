import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, Tag, ArrowLeft, BookOpen, ChevronRight, AlertCircle } from "lucide-react";
import { JsonLd } from "../JsonLd";

interface BlogPostData {
  id: number; title: string; slug: string; content: string; excerpt: string;
  category: string; cover_image: string; author_name: string;
  published_at: string; read_time_mins: number;
  meta_title: string; meta_description: string; focus_keyword: string;
}

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 style="font-size:18px;font-weight:800;color:#111827;margin:24px 0 10px">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 style="font-size:22px;font-weight:900;color:#111827;margin:32px 0 12px;border-bottom:2px solid #E8EAED;padding-bottom:8px">$2</h2>')
    .replace(/^# (.+)$/gm,   '<h1 style="font-size:28px;font-weight:900;color:#111827;margin:0 0 16px">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,    '<em>$1</em>')
    .replace(/`(.+?)`/g,      '<code style="background:#F3F4F6;padding:2px 6px;border-radius:5px;font-size:0.9em;font-family:monospace">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#4F46E5;font-weight:600;text-decoration:underline">$1</a>')
    .replace(/^- (.+)$/gm,    '<li style="margin:4px 0;color:#374151">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="margin:12px 0 12px 20px;list-style:disc">$&</ul>')
    .replace(/^\d+\. (.+)$/gm,'<li style="margin:4px 0;color:#374151">$1</li>')
    .replace(/^---$/gm,       '<hr style="border:none;border-top:1px solid #E8EAED;margin:24px 0">')
    .replace(/^(?!<[h|u|l|h|o])(.*\S.*)$/gm, '<p style="margin:0 0 14px;line-height:1.75;color:#374151">$1</p>')
    .replace(/<p style="[^"]*"><\/p>/g, "");
}

const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  "Hosting Guides": { bg: "#EEF2FF", text: "#4F46E5" },
  "WordPress":      { bg: "#FCE7F3", text: "#9D174D" },
  "Security":       { bg: "#FEF3C7", text: "#92400E" },
  "SEO":            { bg: "#D1FAE5", text: "#065F46" },
  "Domain Tips":    { bg: "#E0F2FE", text: "#0369A1" },
  "Tutorials":      { bg: "#F3E8FF", text: "#7C3AED" },
  "News":           { bg: "#FFE4E6", text: "#9F1239" },
  "General":        { bg: "#F3F4F6", text: "#6B7280" },
};
function catStyle(cat: string) { return CAT_COLORS[cat] || { bg: "#F3F4F6", text: "#6B7280" }; }

function RelatedPosts({ currentSlug, category }: { currentSlug: string; category: string }) {
  const { data } = useQuery<{ posts: BlogPostData[] }>({
    queryKey: ["blog-related", category],
    queryFn: () => fetch(`/api/blog?limit=3&category=${encodeURIComponent(category)}`).then(r => r.json()),
    staleTime: 120_000,
  });
  const related = (data?.posts || []).filter(p => p.slug !== currentSlug).slice(0, 3);
  if (!related.length) return null;
  return (
    <div style={{ marginTop: 48 }}>
      <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 16 }}>Related Articles</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
        {related.map(p => (
          <Link key={p.slug} to={`/blog/${p.slug}`} style={{ textDecoration: "none" }}>
            <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 14, padding: "14px 16px", transition: "box-shadow 0.2s", cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(79,70,229,0.1)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, ...catStyle(p.category) }}>{p.category}</span>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "8px 0 4px", lineHeight: 1.35 }}>{p.title}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#9CA3AF" }}>
                <Clock size={10} /> {p.read_time_mins} min read
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function BlogPost() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || "";

  const { data: post, isLoading, isError } = useQuery<BlogPostData>({
    queryKey: ["blog-post", slug],
    queryFn: () => fetch(`/api/blog/${slug}`).then(async r => {
      if (!r.ok) throw new Error("Post not found");
      return r.json();
    }),
    staleTime: 60_000,
    retry: false,
  });

  const articleSchema = post ? {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.meta_title || post.title,
    "description": post.meta_description || post.excerpt,
    "image": post.cover_image || undefined,
    "author": { "@type": "Person", "name": post.author_name },
    "publisher": {
      "@type": "Organization",
      "name": "Noehost",
      "logo": { "@type": "ImageObject", "url": `${window.location.origin}/favicon.ico` },
    },
    "datePublished": post.published_at,
    "dateModified": post.published_at,
    "mainEntityOfPage": { "@type": "WebPage", "@id": window.location.href },
    "keywords": post.focus_keyword,
    "articleSection": post.category,
  } : null;

  const cs = post ? catStyle(post.category) : { bg: "#F3F4F6", text: "#6B7280" };

  return (
    <>
      {post && articleSchema && <JsonLd id="blog-post-schema" schema={articleSchema} />}

      {/* Update document title */}
      {post && (
        <title>{post.meta_title || post.title} — Noehost Blog</title>
      )}

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px 64px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24, fontSize: 13, color: "#9CA3AF" }}>
          <Link to="/" style={{ color: "#9CA3AF", textDecoration: "none" }}>Home</Link>
          <ChevronRight size={13} />
          <Link to="/blog" style={{ color: "#9CA3AF", textDecoration: "none" }}>Blog</Link>
          {post && (
            <>
              <ChevronRight size={13} />
              <span style={{ color: "#374151" }}>{post.title.slice(0, 40)}{post.title.length > 40 ? "…" : ""}</span>
            </>
          )}
        </div>

        {isLoading && (
          <div style={{ padding: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #C7D2FE", borderTopColor: "#4F46E5", animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>Loading article…</p>
          </div>
        )}

        {isError && (
          <div style={{ padding: "64px 24px", textAlign: "center" }}>
            <AlertCircle size={48} color="#FCA5A5" style={{ margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 8px" }}>Article Not Found</h2>
            <p style={{ color: "#9CA3AF", fontSize: 14, margin: "0 0 20px" }}>This post may have been moved or deleted.</p>
            <Link to="/blog" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, background: "#4F46E5", color: "#fff", fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
              <ArrowLeft size={14} /> Back to Blog
            </Link>
          </div>
        )}

        {post && (
          <article>
            {/* Category + meta */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: cs.bg, color: cs.text }}>{post.category}</span>
              {post.focus_keyword && (
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>🎯 {post.focus_keyword}</span>
              )}
            </div>

            {/* Title */}
            <h1 style={{ fontSize: 36, fontWeight: 900, color: "#111827", margin: "0 0 16px", lineHeight: 1.25 }}>
              {post.title}
            </h1>

            {/* Author + meta row */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>{post.author_name[0]}</span>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#374151", margin: 0 }}>{post.author_name}</p>
                <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#9CA3AF" }}>
                  <span>{formatDate(post.published_at)}</span>
                  <span>·</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {post.read_time_mins} min read</span>
                </div>
              </div>
            </div>

            {/* Cover image */}
            {post.cover_image && (
              <div style={{ marginBottom: 28, borderRadius: 16, overflow: "hidden", maxHeight: 400 }}>
                <img src={post.cover_image} alt={post.title} style={{ width: "100%", objectFit: "cover", display: "block" }} />
              </div>
            )}

            {/* Excerpt */}
            {post.excerpt && (
              <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 12, padding: "14px 18px", marginBottom: 24 }}>
                <p style={{ fontSize: 15, color: "#3730A3", fontWeight: 600, margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>{post.excerpt}</p>
              </div>
            )}

            {/* Content */}
            <div
              style={{ fontSize: 15, lineHeight: 1.8, color: "#374151" }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
            />

            {/* Tags */}
            {post.focus_keyword && (
              <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 8 }}>
                <Tag size={14} color="#9CA3AF" />
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>Keywords:</span>
                {post.focus_keyword.split(",").map(kw => (
                  <span key={kw} style={{ fontSize: 12, padding: "3px 10px", background: "#EEF2FF", color: "#4F46E5", borderRadius: 20, fontWeight: 700 }}>{kw.trim()}</span>
                ))}
              </div>
            )}

            {/* Back to blog */}
            <div style={{ marginTop: 32 }}>
              <Link to="/blog" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, color: "#4F46E5", textDecoration: "none" }}>
                <ArrowLeft size={14} /> Back to Blog
              </Link>
            </div>

            {/* Related posts */}
            <RelatedPosts currentSlug={post.slug} category={post.category} />

            {/* CTA */}
            <div style={{ marginTop: 48, background: "linear-gradient(135deg,#4F46E5,#7C3AED)", borderRadius: 18, padding: "28px 28px", textAlign: "center" }}>
              <h3 style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: "0 0 8px" }}>Get Fast, Reliable Hosting</h3>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", margin: "0 0 18px" }}>Free SSL, cPanel, and 24/7 expert support. No setup fees.</p>
              <Link to="/shared-hosting" style={{ display: "inline-block", padding: "11px 24px", borderRadius: 10, background: "#fff", color: "#4F46E5", fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
                View Plans →
              </Link>
            </div>
          </article>
        )}
      </div>
    </>
  );
}
