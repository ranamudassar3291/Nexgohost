import { useQuery } from "@tanstack/react-query";

export interface BrandingConfig {
  logoUrl: string | null;
  faviconUrl: string | null;
  siteName: string;
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
    logoUrl: data?.logoUrl ?? null,
    faviconUrl: data?.faviconUrl ?? null,
    siteName: data?.siteName ?? "Noehost",
  };
}
