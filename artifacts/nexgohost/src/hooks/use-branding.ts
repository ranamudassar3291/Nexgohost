import { useQuery } from "@tanstack/react-query";

export interface BrandingConfig {
  logoUrl: string | null;
  faviconUrl: string | null;
  siteName: string;
  siteTagline: string;
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

export function useBranding(): BrandingConfig {
  const { data } = useQuery<BrandingConfig>({
    queryKey: ["branding-config"],
    queryFn: async () => {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Failed to load config");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    logoUrl:             data?.logoUrl             ?? null,
    faviconUrl:          data?.faviconUrl          ?? null,
    siteName:            data?.siteName            ?? "Noehost",
    siteTagline:         data?.siteTagline         ?? "Professional Hosting Solutions",
    primaryColor:        data?.primaryColor        ?? "#701AFE",
    brandWebsite:        data?.brandWebsite        ?? "",
    brandWhatsapp:       data?.brandWhatsapp       ?? "",
    brandAddress:        data?.brandAddress        ?? "",
    brandSupportEmail:   data?.brandSupportEmail   ?? "",
    brandSocialTwitter:  data?.brandSocialTwitter  ?? "",
    brandSocialFacebook: data?.brandSocialFacebook ?? "",
    brandSocialLinkedin: data?.brandSocialLinkedin ?? "",
    invoiceFooterText:   data?.invoiceFooterText   ?? "",
  };
}
