import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface ContentContextType {
  content: any;
  loading: boolean;
  updateContent: (key: string, value: any) => Promise<void>;
  refreshContent: () => Promise<void>;
  firebaseConnected: boolean;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

const CACHE_KEY = 'noehost_cms_v4';

const saveToCache = (data: any) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
};

const loadFromCache = (): any | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const getToken = () => localStorage.getItem('noehost_token') || '';

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [content, setContent] = useState<any>(() => loadFromCache());
  const [loading, setLoading] = useState(true);

  const setAndCache = (data: any) => {
    setContent(data);
    saveToCache(data);
  };

  const fetchContent = useCallback(async () => {
    try {
      const res = await fetch('/api/content', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAndCache(data);
    } catch (err) {
      console.warn('[CMS] Failed to fetch content from backend:', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const res = await fetch('/api/content', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setAndCache(data);
          console.log('[CMS] Backend DB content loaded ✓');
        }
      } catch (err) {
        console.warn('[CMS] Content fetch failed, using cached data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const updateContent = async (key: string, value: any) => {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const optimistic = { ...content, [key]: value };
    setAndCache(optimistic);

    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers,
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      console.error('[CMS] Failed to save content:', err);
      throw err;
    }
  };

  const refreshContent = fetchContent;

  return (
    <ContentContext.Provider value={{ content, loading, updateContent, refreshContent, firebaseConnected: true }}>
      {children}
    </ContentContext.Provider>
  );
};

export const useContent = () => {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used within a ContentProvider');
  return ctx;
};
