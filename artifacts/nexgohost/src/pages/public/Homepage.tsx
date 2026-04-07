import { SiteTopBar } from "@/components/layout/SiteTopBar";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHero } from "@/components/site/SiteHero";
import { SitePricing } from "@/components/site/SitePricing";
import { SitePromo } from "@/components/site/SitePromo";
import { SiteServices } from "@/components/site/SiteServices";
import { SiteTestimonials } from "@/components/site/SiteTestimonials";

export default function Homepage() {
  return (
    <div className="min-h-screen flex flex-col selection:bg-primary/30">
      {/* Fixed header: TopBar + Navbar */}
      <header className="fixed top-0 left-0 right-0 z-[100]">
        <SiteTopBar />
        <SiteNavbar />
      </header>

      {/* Main content — offset for fixed header (~40px topbar + ~80px navbar) */}
      <main className="flex-grow pt-[120px] lg:pt-[104px]">
        <SiteHero />
        <SitePricing />
        <SitePromo />
        <SiteServices />
        <SiteTestimonials />
      </main>

      <SiteFooter />

      {/* Scroll to top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-8 right-8 w-12 h-12 bg-slate-900/70 hover:bg-primary backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all z-[100] shadow-lg"
      >
        ↑
      </button>
    </div>
  );
}
