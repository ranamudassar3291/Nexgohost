import React, { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { RefreshCw, AlertCircle, ArrowRight } from "lucide-react";
import NoeHostLayout from "@/pages/public/NoeHostLayout";

interface PageData {
  pageTitle: string;
  metaDescription: string;
  sectionsJson: string;
  isVisible: boolean;
}

interface HeroSection {
  badge?: string;
  title?: string;
  titleHighlight?: string;
  description?: string;
  btnText?: string;
  btnUrl?: string;
}

interface TextSection {
  heading?: string;
  content?: string;
}

interface FaqItem {
  q: string;
  a: string;
}

function HeroBlock({ data }: { data: HeroSection }) {
  const href = data.btnUrl || "/register";
  return (
    <section className="bg-black pt-32 pb-20 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
      </div>
      <div className="container mx-auto px-6 relative z-10 text-center max-w-4xl">
        {data.badge && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-black mb-8 border border-primary/20 uppercase tracking-widest">
            {data.badge}
          </div>
        )}
        <h1 className="text-4xl lg:text-6xl font-black text-white leading-[1.1] mb-6 tracking-tighter">
          {data.title || "Page Title"}
          {data.titleHighlight && (
            <> <span className="text-primary">{data.titleHighlight}</span></>
          )}
        </h1>
        {data.description && (
          <p className="text-lg text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto">{data.description}</p>
        )}
        {data.btnText && (
          <Link
            href={href}
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold transition-all shadow-xl shadow-primary/30 text-base"
          >
            {data.btnText} <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </section>
  );
}

function TextBlock({ data }: { data: TextSection }) {
  if (!data.heading && !data.content) return null;
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-6 max-w-4xl">
        {data.heading && (
          <h2 className="text-3xl font-black mb-8 text-foreground">{data.heading}</h2>
        )}
        {data.content && (
          <div
            className="prose prose-invert max-w-none text-muted-foreground leading-relaxed text-base"
            dangerouslySetInnerHTML={{ __html: data.content.replace(/\n/g, "<br/>") }}
          />
        )}
      </div>
    </section>
  );
}

function FaqBlock({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!items || items.length === 0) return null;
  return (
    <section className="py-20 bg-secondary/10 border-t border-border/40">
      <div className="container mx-auto px-6 max-w-3xl">
        <h2 className="text-3xl font-black mb-10 text-center">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-secondary/20 overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <span className="font-semibold text-foreground">{item.q}</span>
                <span className={`text-primary transition-transform ${open === i ? "rotate-45" : ""}`}>+</span>
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-muted-foreground text-sm leading-relaxed">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function CustomPage() {
  const [params] = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const [page, setPage] = useState<PageData | null>(null);
  const [sections, setSections] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/pages/${slug}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        if (!data.isVisible) { setNotFound(true); return; }
        setPage(data);
        try { setSections(JSON.parse(data.sectionsJson ?? "{}")); } catch { setSections({}); }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <NoeHostLayout>
        <div className="min-h-screen flex items-center justify-center">
          <RefreshCw size={24} className="animate-spin text-primary" />
        </div>
      </NoeHostLayout>
    );
  }

  if (notFound || !page) {
    return (
      <NoeHostLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 pt-24">
          <AlertCircle size={40} className="text-muted-foreground" />
          <h1 className="text-2xl font-bold">Page Not Found</h1>
          <p className="text-muted-foreground">This page doesn't exist or has been removed.</p>
          <Link href="/" className="text-primary hover:underline text-sm">← Back to Home</Link>
        </div>
      </NoeHostLayout>
    );
  }

  return (
    <NoeHostLayout>
      <HeroBlock data={sections.hero ?? {}} />
      <TextBlock data={sections.text ?? {}} />
      <FaqBlock items={sections.faq ?? []} />
    </NoeHostLayout>
  );
}
