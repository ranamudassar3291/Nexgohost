import React from 'react';
import Navbar from '../Navbar';
import TopBar from '../TopBar';
import Footer from '../Footer';
import WhatsAppWidget from '../WhatsAppWidget';
import ChatBot from '../ChatBot';

interface HostingPageLayoutProps {
  user: any;
  setUser: (u: any) => void;
  children: React.ReactNode;
}

const HostingPageLayout: React.FC<HostingPageLayoutProps> = ({ user, setUser, children }) => {
  return (
    <div className="noehost-public min-h-screen flex flex-col bg-black">
      <header className="fixed top-0 left-0 right-0 z-[100]">
        <TopBar />
        <Navbar user={user} setUser={setUser} />
      </header>
      <main className="flex-grow pt-[116px] lg:pt-[100px]">
        {children}
      </main>
      <Footer />
      <WhatsAppWidget />
      <ChatBot />
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-28 right-8 w-12 h-12 bg-slate-900/10 hover:bg-slate-900/20 backdrop-blur-md rounded-full flex items-center justify-center text-slate-600 transition-all z-[100]"
      >
        ↑
      </button>
    </div>
  );
};

export default HostingPageLayout;
