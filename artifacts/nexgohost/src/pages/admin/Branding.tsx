import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, Image, CheckCircle2, AlertCircle, Loader2, RefreshCw, Palette, Globe, Phone, MapPin, Mail, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BrandingSettings {
  logoUrl: string | null;
  faviconUrl: string | null;
  siteName: string;
  primaryColor: string;
  brandWebsite: string;
  brandWhatsapp: string;
  brandAddress: string;
  brandSupportEmail: string;
  brandSocialTwitter: string;
  brandSocialFacebook: string;
  brandSocialLinkedin: string;
  invoiceFooterText: string;
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
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [brandColor, setBrandColor] = useState("#701AFE");
  const [website, setWebsite] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [socialTwitter, setSocialTwitter] = useState("");
  const [socialFacebook, setSocialFacebook] = useState("");
  const [socialLinkedin, setSocialLinkedin] = useState("");
  const [invoiceFooter, setInvoiceFooter] = useState("");

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

  useEffect(() => {
    if (!branding) return;
    setBrandColor(branding.primaryColor || "#701AFE");
    setWebsite(branding.brandWebsite || "");
    setWhatsapp(branding.brandWhatsapp || "");
    setAddress(branding.brandAddress || "");
    setSupportEmail(branding.brandSupportEmail || "");
    setSocialTwitter(branding.brandSocialTwitter || "");
    setSocialFacebook(branding.brandSocialFacebook || "");
    setSocialLinkedin(branding.brandSocialLinkedin || "");
    setInvoiceFooter(branding.invoiceFooterText || "");
  }, [branding]);

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

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      const res = await fetch("/api/admin/branding/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          brand_primary_color: brandColor,
          brand_website: website,
          brand_whatsapp: whatsapp,
          brand_address: address,
          brand_support_email: supportEmail,
          brand_social_twitter: socialTwitter,
          brand_social_facebook: socialFacebook,
          brand_social_linkedin: socialLinkedin,
          invoice_footer_text: invoiceFooter,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      showToast("success", "Brand settings saved");
      invalidate();
    } catch (err: any) {
      showToast("error", err.message || "Save failed");
    } finally {
      setSettingsSaving(false);
    }
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
          {/* Sidebar preview — white bg matches real sidebar */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-semibold">Sidebar header</p>
            <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3" style={{ minHeight: 60 }}>
                {isLoading ? (
                  <div className="h-9 w-32 rounded-lg bg-gray-100 animate-pulse" />
                ) : activeLogoUrl ? (
                  <img
                    src={activeLogoUrl}
                    alt={siteName}
                    className="brand-logo-img"
                    style={{ maxHeight: 40, width: "auto", maxWidth: "100%" }}
                  />
                ) : (
                  <>
                    <div
                      className="brand-logo-container w-9 h-9 rounded-xl font-bold text-white text-base shadow-lg shrink-0"
                      style={{ background: "linear-gradient(135deg, #5B5FEF, #7A6BFF)" }}
                    >
                      {siteName[0]}
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                      <h1 className="font-bold text-base tracking-tight leading-none text-gray-900">{siteName}</h1>
                      <p className="text-[9px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: "#5B5FEF" }}>NoePanel</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* White background — pure white preview */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-semibold">White background</p>
            <div className="p-5 rounded-lg bg-white border border-gray-100 flex items-center justify-center" style={{ minHeight: 60 }}>
              {isLoading ? (
                <div className="h-9 w-32 rounded-lg bg-gray-100 animate-pulse" />
              ) : activeLogoUrl ? (
                <img
                  src={activeLogoUrl}
                  alt={siteName}
                  className="brand-logo-img"
                  style={{ maxHeight: 44, width: "auto", maxWidth: "100%" }}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <div
                    className="brand-logo-container w-9 h-9 rounded-xl font-bold text-white text-sm"
                    style={{ background: "linear-gradient(135deg, #5B5FEF, #7A6BFF)" }}
                  >
                    {siteName[0]}
                  </div>
                  <span className="font-bold text-lg text-gray-900 tracking-tight">{siteName}</span>
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
          <div className="h-12 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden shrink-0 px-3" style={{ minWidth: 120, maxWidth: 180 }}>
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Current logo"
                className="brand-logo-img"
                style={{ maxHeight: 40, width: "auto", maxWidth: "100%", objectFit: "contain" }}
              />
            ) : (
              <div className="w-10 h-10 flex items-center justify-center rounded-xl font-bold text-white text-xl"
                style={{ background: "linear-gradient(135deg, #5B5FEF, #7A6BFF)" }}>
                {branding?.siteName?.[0] ?? "N"}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {branding?.logoUrl ? "Logo uploaded" : "Default (gradient icon)"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {branding?.logoUrl ? branding.logoUrl.split("/").pop() : "Upload a PNG, SVG, or JPEG logo"}
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
                <img src={logoPreview} alt="Preview" className="object-contain rounded-lg border border-border bg-white brand-logo-img" style={{ maxHeight: 40, width: "auto", maxWidth: 160, padding: "4px" }} />
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

      {/* Brand Settings — color, contact, social, footer */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold text-foreground">Brand Settings</h3>
          <p className="text-sm text-muted-foreground mt-1">Used in emails, invoices, and the client portal footer.</p>
        </div>

        {/* Color */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Palette size={14} className="text-muted-foreground" /> Brand Color
          </Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={e => setBrandColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-background p-0.5"
            />
            <Input
              value={brandColor}
              onChange={e => setBrandColor(e.target.value)}
              placeholder="#701AFE"
              className="font-mono w-36"
            />
            <div className="h-9 w-9 rounded-lg shrink-0 border border-border" style={{ background: brandColor }} />
            <span className="text-xs text-muted-foreground">Used in email headers &amp; invoice banners</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Website */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Globe size={14} className="text-muted-foreground" /> Website URL
            </Label>
            <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://noehost.com" />
          </div>
          {/* Support email */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Mail size={14} className="text-muted-foreground" /> Support Email
            </Label>
            <Input value={supportEmail} onChange={e => setSupportEmail(e.target.value)} placeholder="support@noehost.com" type="email" />
          </div>
          {/* WhatsApp */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Phone size={14} className="text-muted-foreground" /> WhatsApp Number
            </Label>
            <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+92 300 0000000" />
          </div>
          {/* Address */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MapPin size={14} className="text-muted-foreground" /> Business Address
            </Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Street, City, Country" />
          </div>
        </div>

        {/* Social links */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Share2 size={14} className="text-muted-foreground" /> Social Links
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input value={socialTwitter} onChange={e => setSocialTwitter(e.target.value)} placeholder="https://twitter.com/…" />
            <Input value={socialFacebook} onChange={e => setSocialFacebook(e.target.value)} placeholder="https://facebook.com/…" />
            <Input value={socialLinkedin} onChange={e => setSocialLinkedin(e.target.value)} placeholder="https://linkedin.com/…" />
          </div>
          <p className="text-xs text-muted-foreground">Twitter / X · Facebook · LinkedIn</p>
        </div>

        {/* Invoice / email footer */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Invoice &amp; Email Footer Text</Label>
          <Textarea
            value={invoiceFooter}
            onChange={e => setInvoiceFooter(e.target.value)}
            rows={3}
            placeholder="e.g. All prices are in PKR. Prices are subject to change without notice."
          />
          <p className="text-xs text-muted-foreground">Displayed at the bottom of PDF invoices and email footers.</p>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSaveSettings} disabled={settingsSaving}>
            {settingsSaving ? <><Loader2 size={15} className="animate-spin mr-2" />Saving…</> : "Save Brand Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
