import { useBranding } from "@/hooks/use-branding";

interface BrandingLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  subtext?: string;
  textClassName?: string;
}

export function BrandingLogo({ size = "md", showText = true, subtext, textClassName }: BrandingLogoProps) {
  const { logoUrl, siteName } = useBranding();

  const sizeMap = {
    sm: { box: "w-8 h-8", text: "text-lg", img: "w-8 h-8" },
    md: { box: "w-9 h-9", text: "text-xl", img: "w-9 h-9" },
    lg: { box: "w-16 h-16", text: "text-2xl", img: "w-16 h-16" },
  };

  const s = sizeMap[size];

  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={siteName}
          className={`${s.img} object-contain rounded-xl`}
          onError={e => {
            const img = e.target as HTMLImageElement;
            img.style.display = "none";
            const next = img.nextElementSibling as HTMLElement | null;
            if (next) next.style.display = "flex";
          }}
        />
      ) : null}
      <div
        className={`${s.box} rounded-xl items-center justify-center font-bold text-white shadow-lg shrink-0`}
        style={{
          background: "linear-gradient(135deg, #BB86FC, #7C3AED)",
          boxShadow: "0 0 14px rgba(187,134,252,0.40)",
          display: logoUrl ? "none" : "flex",
        }}
      >
        {siteName?.[0] ?? "N"}
      </div>
      {showText && (
        <div>
          <h1
            className={`font-display font-bold tracking-tight ${s.text} ${textClassName ?? ""}`}
            style={!textClassName ? { background: "linear-gradient(135deg,#BB86FC,#03DAC6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } : undefined}
          >
            {siteName}
          </h1>
          {subtext && (
            <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "#BB86FC" }}>
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

  const sizeMap = {
    sm: "w-8 h-8",
    md: "w-9 h-9",
    lg: "w-16 h-16",
  };

  const cls = sizeMap[size];

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={siteName}
        className={`${cls} object-contain rounded-xl`}
        onError={e => {
          const img = e.target as HTMLImageElement;
          img.style.display = "none";
          const next = img.nextElementSibling as HTMLElement | null;
          if (next) next.style.display = "flex";
        }}
      />
    );
  }

  return (
    <div
      className={`${cls} rounded-xl flex items-center justify-center font-bold text-white shadow-lg`}
      style={{ background: "linear-gradient(135deg, #BB86FC, #7C3AED)", boxShadow: "0 0 14px rgba(187,134,252,0.40)" }}
    >
      {siteName?.[0] ?? "N"}
    </div>
  );
}
