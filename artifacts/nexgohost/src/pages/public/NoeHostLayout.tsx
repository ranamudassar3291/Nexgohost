import React, { useState, useEffect } from 'react';
import { ContentProvider } from '@/noehost/ContentContext';
import { CurrencyProvider } from '@/noehost/CurrencyContext';
import { CartProvider } from '@/noehost/context/CartContext';
import Navbar from '@/noehost/components/Navbar';
import TopBar from '@/noehost/components/TopBar';
import Footer from '@/noehost/components/Footer';
import NoeChat from '@/components/NoeChat';
import CartSidebar from '@/noehost/components/CartSidebar';

interface NoeHostLayoutProps {
  children: React.ReactNode;
}

function NoeHostInner({ children }: NoeHostLayoutProps) {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('noehost_token') || localStorage.getItem('token');
    if (!token) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => setUser(data))
      .catch(() => localStorage.removeItem('noehost_token'));
  }, []);

  return (
    <>
      <CartSidebar />
      <header className="fixed top-0 left-0 right-0 z-[100]">
        <TopBar />
        <Navbar user={user} setUser={setUser} />
      </header>
      <main className="flex-grow pt-[116px] lg:pt-[100px]">
        {children}
      </main>
      <Footer />
      <NoeChat />
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-28 right-8 w-12 h-12 bg-slate-900/10 hover:bg-slate-900/20 backdrop-blur-md rounded-full flex items-center justify-center text-slate-600 transition-all z-[100]"
      >
        ↑
      </button>
    </>
  );
}

export default function NoeHostLayout({ children }: NoeHostLayoutProps) {
  return (
    <ContentProvider>
      <CurrencyProvider>
        <CartProvider>
          <div className="noehost-public min-h-screen flex flex-col selection:bg-primary/30 bg-[#050505]">
            <NoeHostInner>{children}</NoeHostInner>
          </div>
        </CartProvider>
      </CurrencyProvider>
    </ContentProvider>
  );
}
