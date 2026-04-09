import TopBar from "./noehost/components/TopBar";
import Navbar from "./noehost/components/Navbar";
import Hero from "./noehost/components/Hero";
import Pricing from "./noehost/components/Pricing";
import ControlEfficiency from "./noehost/components/ControlEfficiency";
import FeatureShowcase from "./noehost/components/FeatureShowcase";
import Promo from "./noehost/components/Promo";
import Services from "./noehost/components/Services";
import Features from "./noehost/components/Features";
import CTA from "./noehost/components/CTA";
import FAQ from "./noehost/components/FAQ";
import Testimonials from "./noehost/components/Testimonials";
import Footer from "./noehost/components/Footer";
import WhatsAppWidget from "./noehost/components/WhatsAppWidget";
import ChatBot from "./noehost/components/ChatBot";

const Homepage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <header className="fixed top-0 left-0 right-0 z-[100]">
        <TopBar />
        <Navbar user={null} setUser={() => {}} />
      </header>
      <main className="flex-grow pt-[116px] lg:pt-[100px]">
        <Hero />
        <Pricing />
        <ControlEfficiency />
        <FeatureShowcase />
        <Promo />
        <Services />
        <Features />
        <CTA />
        <FAQ />
        <Testimonials />
      </main>
      <Footer />
      <WhatsAppWidget />
      <ChatBot />
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-28 right-8 w-12 h-12 bg-slate-900/10 hover:bg-slate-900/20 backdrop-blur-md rounded-full flex items-center justify-center text-slate-600 transition-all z-[100]"
      >
        ↑
      </button>
    </div>
  );
};

export default Homepage;
