/**
 * CaptchaWidget — Cloudflare Turnstile / Google reCAPTCHA v2 checkbox
 *
 * Loads the relevant SDK on first mount, renders the checkbox widget, and
 * calls onVerify(token) when the user checks the box.  Invisible-safe: if
 * no siteKey is configured it renders nothing.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CaptchaWidgetProps {
  siteKey: string;
  provider: "turnstile" | "recaptcha";
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
}

// ── Script loader (idempotent) ────────────────────────────────────────────────
function ensureScript(src: string, id: string): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement("script");
    s.id = id;
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: object) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
    grecaptcha?: {
      render: (el: HTMLElement, opts: object) => number;
      reset: (id: number) => void;
    };
  }
}

export default function CaptchaWidget({
  siteKey,
  provider,
  onVerify,
  onExpire,
  onError,
  className,
}: CaptchaWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!siteKey) return;

    let cancelled = false;

    async function init() {
      if (provider === "turnstile") {
        await ensureScript(
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
          "cf-turnstile-script",
        );
        // Wait for turnstile object to be available
        let tries = 0;
        while (!window.turnstile && tries < 30) {
          await new Promise(r => setTimeout(r, 200));
          tries++;
        }
        if (cancelled || !containerRef.current || !window.turnstile) return;
        if (widgetIdRef.current !== null) return; // already rendered

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "light",
          callback: (token: string) => onVerify(token),
          "expired-callback": () => { onExpire?.(); },
          "error-callback": () => { onError?.(); },
        });
        setLoaded(true);
      } else {
        // Google reCAPTCHA v2
        await ensureScript(
          `https://www.google.com/recaptcha/api.js?render=explicit&hl=en`,
          "g-recaptcha-script",
        );
        let tries = 0;
        while (!window.grecaptcha && tries < 30) {
          await new Promise(r => setTimeout(r, 200));
          tries++;
        }
        if (cancelled || !containerRef.current || !window.grecaptcha) return;
        if (widgetIdRef.current !== null) return;

        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onVerify(token),
          "expired-callback": () => { onExpire?.(); },
          "error-callback": () => { onError?.(); },
        });
        setLoaded(true);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [siteKey, provider]);

  if (!siteKey) return null;

  return (
    <div className={cn("flex justify-center", className)}>
      <div ref={containerRef} />
      {!loaded && (
        <div className="h-16 w-full max-w-xs bg-muted/40 border border-border rounded-lg animate-pulse flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading security check…
        </div>
      )}
    </div>
  );
}
