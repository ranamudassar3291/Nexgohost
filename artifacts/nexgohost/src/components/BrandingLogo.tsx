import { useBranding } from "@/hooks/use-branding";

interface BrandingLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  subtext?: string;
  textClassName?: string;
}

const sizeMap = {
  sm: { container: "w-8 h-8",  text: "text-lg",  fallbackText: "text-sm"  },
  md: { container: "w-10 h-10", text: "text-xl",  fallbackText: "text-base" },
  lg: { container: "w-16 h-16", text: "text-2xl", fallbackText: "text-xl"  },
};

export function BrandingLogo({ size = "md", showText = true, subtext, textClassName }: BrandingLogoProps) {
  const { logoUrl, siteName } = useBranding();
  const s = sizeMap[size];

  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        <div className={`brand-logo-container ${s.container} rounded-xl`}>
          <img
            src={logoUrl}
            alt={siteName}
            className="brand-logo-img rounded-xl"
            onError={e => {
              const img = e.target as HTMLImageElement;
              img.style.display = "none";
              const fallback = img.parentElement?.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = "flex";
            }}
          />
        </div>
      ) : null}
      <div
        className={`${s.container} rounded-xl items-center justify-center font-bold text-white shadow-lg shrink-0 ${s.fallbackText}`}
        style={{
          background: "linear-gradient(135deg, #BB86FC, #7C3AED)",
          boxShadow: "0 0 14px rgba(187,134,252,0.40)",
          display: logoUrl ? "none" : "flex",
        }}
      >
        {siteName?.[0] ?? "N"}
      </div>
      {showText && (
        <div className="flex flex-col justify-center">
          <h1
            className={`font-display font-bold tracking-tight leading-none ${s.text} ${textClassName ?? ""}`}
            style={!textClassName ? { background: "linear-gradient(135deg,#BB86FC,#03DAC6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } : undefined}
          >
            {siteName}
          </h1>
          {subtext && (
            <p className="text-[10px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: "#BB86FC" }}>
              {subtext}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function BrandingLogoIcon({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const { logoUrl, siteName } = useBranding();
  const s = sizeMap[size];

  if (logoUrl) {
    return (
      <div className={`brand-logo-container ${s.container} rounded-xl`}>
        <img
          src={logoUrl}
          alt={siteName}
          className="brand-logo-img rounded-xl"
        />
      </div>
    );
  }

  return (
    <div
      className={`${s.container} rounded-xl flex items-center justify-center font-bold text-white shadow-lg shrink-0 ${s.fallbackText}`}
      style={{ background: "linear-gradient(135deg, #BB86FC, #7C3AED)", boxShadow: "0 0 14px rgba(187,134,252,0.40)" }}
    >
      {siteName?.[0] ?? "N"}
    </div>
  );
}
