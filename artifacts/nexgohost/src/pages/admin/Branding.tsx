import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, Image, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BrandingSettings {
  logoUrl: string | null;
  faviconUrl: string | null;
  siteName: string;
}

export default function Branding() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const queryClient = useQueryClient();

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState<"logo" | "favicon" | null>(null);
  const [removing, setRemoving] = useState<"logo" | "favicon" | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const { data: branding, isLoading } = useQuery<BrandingSettings>({
    queryKey: ["branding-config"],
    queryFn: async () => {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    staleTime: 0,
  });

  const activeFaviconUrl = faviconPreview ?? branding?.faviconUrl ?? null;
  const activeLogoUrl = logoPreview ?? branding?.logoUrl ?? null;
  const siteName = branding?.siteName ?? "NoeHost";

  useEffect(() => {
    if (!activeFaviconUrl) return;
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (link) link.href = activeFaviconUrl;
  }, [activeFaviconUrl]);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["branding-config"] });
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "favicon",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (type === "logo") { setLogoFile(file); setLogoPreview(preview); }
    else { setFaviconFile(file); setFaviconPreview(preview); }
  };

  const handleUpload = async (type: "logo" | "favicon") => {
    const file = type === "logo" ? logoFile : faviconFile;
    if (!file) return;

    setSaving(type);
    try {
      const form = new FormData();
      form.append(type, file);

      const res = await fetch(`/api/admin/branding/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      showToast("success", `${type === "logo" ? "Logo" : "Favicon"} updated successfully`);
      if (type === "logo") { setLogoFile(null); setLogoPreview(null); }
      else { setFaviconFile(null); setFaviconPreview(null); }
      invalidate();
    } catch (err: any) {
      showToast("error", err.message || "Upload failed");
    } finally {
      setSaving(null);
    }
  };

  const handleRemove = async (type: "logo" | "favicon") => {
    setRemoving(type);
    try {
      const res = await fetch(`/api/admin/branding/${type}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove");
      showToast("success", `${type === "logo" ? "Logo" : "Favicon"} removed — default restored`);
      invalidate();
    } catch (err: any) {
      showToast("error", err.message || "Remove failed");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${
          toast.type === "success"
            ? "bg-green-500/10 border-green-500/30 text-green-400"
            : "bg-red-500/10 border-red-500/30 text-red-400"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Live Preview */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Live Preview</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Exactly how it appears in the sidebar and login pages</p>
          </div>
          <button onClick={invalidate} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Sidebar preview — matches AppLayout sidebar header exactly */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-semibold">Sidebar</p>
            <div className="rounded-lg bg-card border border-border/50 overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-3 border-b border-border/50" style={{ minHeight: 64 }}>
                {isLoading ? (
                  <div className="w-10 h-10 rounded-xl bg-muted animate-pulse shrink-0" />
                ) : activeLogoUrl ? (
                  <div className="flex items-center min-w-0 max-w-full">
                    <img
                      src={activeLogoUrl}
                      alt={siteName}
                      className="brand-logo-img"
                      style={{ maxHeight: 44, width: "auto", maxWidth: "100%" }}
                    />
                  </div>
                ) : (
                  <>
                    <div
                      className="brand-logo-container w-10 h-10 rounded-xl font-bold text-white text-base shadow-lg shrink-0"
                      style={{ background: "linear-gradient(135deg, #BB86FC, #7C3AED)", boxShadow: "0 0 14px rgba(187,134,252,0.40)" }}
                    >
                      {siteName[0]}
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                      <h1 className="font-display font-bold text-xl tracking-tight leading-none" style={{ background: "linear-gradient(135deg,#BB86FC,#03DAC6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        {siteName}
                      </h1>
                      <p className="text-[10px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: "#BB86FC" }}>NoePanel</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Login page preview */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-semibold">Login page (light)</p>
            <div className="p-4 rounded-lg bg-white border border-gray-200">
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-gray-200 animate-pulse" />
                  <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
                </div>
              ) : activeLogoUrl ? (
                <div className="flex items-center">
                  <img
                    src={activeLogoUrl}
                    alt={siteName}
                    className="brand-logo-img"
                    style={{ maxHeight: 44, width: "auto", maxWidth: "100%" }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    className="brand-logo-container w-10 h-10 rounded-xl font-bold text-white text-base shadow-lg"
                    style={{ background: "linear-gradient(135deg, #BB86FC, #7C3AED)", boxShadow: "0 0 14px rgba(187,134,252,0.40)" }}
                  >
                    {siteName[0]}
                  </div>
                  <div className="flex flex-col justify-center">
                    <h1 className="font-display font-bold text-xl tracking-tight leading-none text-gray-900">{siteName}</h1>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Logo Upload */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">Main Logo</h3>
          <p className="text-sm text-muted-foreground mt-1">Shown in the sidebar, login pages, and PDF invoices. For best results: PNG or SVG, wide/horizontal format (e.g. 400×80px), transparent background.</p>
        </div>

        {/* Current logo */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/40 border border-border/50">
          <div className="w-16 h-16 rounded-xl bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Current logo"
                className="brand-logo-img rounded-xl"
                style={{ width: "100%", height: "100%", padding: "4px" }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center rounded-xl font-bold text-white text-xl"
                style={{ background: "linear-gradient(135deg, #BB86FC, #7C3AED)" }}>
                {branding?.siteName?.[0] ?? "N"}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {branding?.logoUrl ? "Custom logo active" : "Default (gradient icon)"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {branding?.logoUrl ? branding.logoUrl.split("/").pop() : "No custom logo uploaded"}
            </p>
          </div>
          {branding?.logoUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemove("logo")}
              disabled={removing === "logo"}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
            >
              {removing === "logo" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            </Button>
          )}
        </div>

        {/* Upload area */}
        <div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg,image/webp"
            className="hidden"
            onChange={e => handleFileChange(e, "logo")}
          />

          {logoPreview ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
                <img src={logoPreview} alt="Preview" className="w-12 h-12 object-contain rounded-lg border border-border bg-white p-1 brand-logo-img" style={{ width: 48, height: 48 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{logoFile?.name}</p>
                  <p className="text-xs text-muted-foreground">{logoFile ? `${(logoFile.size / 1024).toFixed(1)} KB` : ""}</p>
                </div>
                <button onClick={() => { setLogoFile(null); setLogoPreview(null); }} className="text-muted-foreground hover:text-foreground p-1">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleUpload("logo")} disabled={saving === "logo"} className="flex-1">
                  {saving === "logo" ? <><Loader2 size={15} className="animate-spin mr-2" /> Saving…</> : <><Upload size={15} className="mr-2" /> Save Logo</>}
                </Button>
                <Button variant="outline" onClick={() => logoInputRef.current?.click()}>Change</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => logoInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Image size={20} className="text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Click to upload logo</p>
                <p className="text-xs text-muted-foreground mt-0.5">PNG, SVG, JPG, WEBP • Max 5MB</p>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Favicon Upload */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">Favicon</h3>
          <p className="text-sm text-muted-foreground mt-1">The browser tab icon. Recommended: PNG or ICO, 32×32px or 64×64px.</p>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/40 border border-border/50">
          <div className="w-12 h-12 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
            {branding?.faviconUrl ? (
              <img src={branding.faviconUrl} alt="Current favicon" className="brand-logo-img" style={{ width: 32, height: 32 }} />
            ) : (
              <Image size={20} className="text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {branding?.faviconUrl ? "Custom favicon active" : "Default (favicon.svg)"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {branding?.faviconUrl ? branding.faviconUrl.split("/").pop() : "Using the default favicon"}
            </p>
          </div>
          {branding?.faviconUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemove("favicon")}
              disabled={removing === "favicon"}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
            >
              {removing === "favicon" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            </Button>
          )}
        </div>

        <div>
          <input
            ref={faviconInputRef}
            type="file"
            accept="image/png,image/x-icon,image/svg+xml,image/jpeg"
            className="hidden"
            onChange={e => handleFileChange(e, "favicon")}
          />

          {faviconPreview ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
                <img src={faviconPreview} alt="Preview" className="brand-logo-img rounded-lg border border-border bg-white p-1" style={{ width: 40, height: 40 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{faviconFile?.name}</p>
                  <p className="text-xs text-muted-foreground">{faviconFile ? `${(faviconFile.size / 1024).toFixed(1)} KB` : ""}</p>
                </div>
                <button onClick={() => { setFaviconFile(null); setFaviconPreview(null); }} className="text-muted-foreground hover:text-foreground p-1">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleUpload("favicon")} disabled={saving === "favicon"} className="flex-1">
                  {saving === "favicon" ? <><Loader2 size={15} className="animate-spin mr-2" /> Saving…</> : <><Upload size={15} className="mr-2" /> Save Favicon</>}
                </Button>
                <Button variant="outline" onClick={() => faviconInputRef.current?.click()}>Change</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => faviconInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload size={20} className="text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Click to upload favicon</p>
                <p className="text-xs text-muted-foreground mt-0.5">PNG, ICO, SVG • Max 1MB</p>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
