import type { ReactNode } from "react";
import { SiteTopBar } from "./SiteTopBar";
import { SiteNavbar } from "./SiteNavbar";
import { SiteFooter } from "./SiteFooter";

interface PublicLayoutProps {
  children: ReactNode;
  /** Set true for pages that need full-screen treatment (no extra padding-top offset) */
  noOffset?: boolean;
}

/**
 * Shared wrapper for all public-facing pages.
 * Provides the original SiteTopBar + SiteNavbar (fixed header) and SiteFooter.
 * Content is padded below the fixed header (~104px).
 */
export function PublicLayout({ children, noOffset }: PublicLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-[100]">
        <SiteTopBar />
        <SiteNavbar />
      </header>
      <main className={`flex-grow ${noOffset ? "" : "pt-[104px]"}`}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
