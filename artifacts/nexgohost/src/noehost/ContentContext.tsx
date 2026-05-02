import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { database, ref, set, onValue, get, off } from './firebase';

interface ContentContextType {
  content: any;
  loading: boolean;
  updateContent: (key: string, value: any) => Promise<void>;
  refreshContent: () => Promise<void>;
  firebaseConnected: boolean;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

const CACHE_KEY = 'noehost_cms_v3';

const saveToCache = (data: any) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
};

const loadFromCache = (): any | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const fetchFromExpress = async () => {
  const res = await fetch('/api/content', {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' },
  });
  return await res.json();
};

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [content, setContent] = useState<any>(() => loadFromCache());
  const [loading, setLoading] = useState(true);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const seededRef = useRef(false);

  const setAndCache = (data: any) => {
    setContent(data);
    saveToCache(data);
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Step 1: Try Firebase FIRST — it's the source of truth
      try {
        const fbRef = ref(database, 'siteContent');
        const snapshot = await get(fbRef);

        if (!cancelled) {
          if (snapshot.exists()) {
            // Firebase has data — use it immediately
            setAndCache(snapshot.val());
            setLoading(false);
            setFirebaseConnected(true);
            console.log('[CMS] Firebase data loaded ✓');
          } else {
            // Firebase empty — seed from Express
            setLoading(false);
            if (!seededRef.current) {
              seededRef.current = true;
              try {
                const expressData = await fetchFromExpress();
                if (!cancelled) {
                  await set(fbRef, expressData);
                  setAndCache(expressData);
                  console.log('[CMS] Firebase seeded from Express ✓');
                }
              } catch (seedErr) {
                console.warn('[CMS] Firebase seed failed, using Express as fallback');
                try {
                  const expressData = await fetchFromExpress();
                  if (!cancelled) setAndCache(expressData);
                } catch {}
              }
            }
            if (!cancelled) setFirebaseConnected(true);
          }
        }
      } catch (fbErr: any) {
        console.warn('[CMS] Firebase unavailable, falling back to Express:', fbErr?.message);
        // Firebase failed — fall back to Express API
        try {
          const expressData = await fetchFromExpress();
          if (!cancelled) {
            setAndCache(expressData);
            setLoading(false);
          }
        } catch {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      if (cancelled) return;

      // Step 2: Subscribe to real-time updates — Firebase always wins
      const fbRef = ref(database, 'siteContent');
      const unsub = onValue(
        fbRef,
        (snap) => {
          if (!cancelled && snap.exists()) {
            setAndCache(snap.val());
          }
        },
        (err) => {
          console.warn('[CMS] Firebase listener error:', err.message);
        }
      );

      unsubscribeRef.current = () => off(fbRef);
      console.log('[CMS] Firebase real-time sync active');
    };

    init();

    return () => {
      cancelled = true;
      if (unsubscribeRef.current) {
        try { unsubscribeRef.current(); } catch {}
      }
    };
  }, []);

  const updateContent = async (key: string, value: any) => {
    // Write to Firebase first (real-time propagation everywhere)
    try {
      const fbRef = ref(database, `siteContent/${key}`);
      await set(fbRef, value);
      // Firebase listener will update content automatically
    } catch (err) {
      console.warn('[CMS] Firebase write failed, updating locally:', err);
      setAndCache({ ...content, [key]: value });
    }

    // Also backup to SQL (non-blocking)
    try {
      const token = localStorage.getItem('noehost_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch('/api/admin/content', {
        method: 'POST',
        headers,
        body: JSON.stringify({ key, value }),
      });
    } catch {}
  };

  const refreshContent = async () => {
    try {
      const fbRef = ref(database, 'siteContent');
      const snapshot = await get(fbRef);
      if (snapshot.exists()) {
        setAndCache(snapshot.val());
        return;
      }
    } catch {}
    try {
      const data = await fetchFromExpress();
      setAndCache(data);
    } catch {}
  };

  return (
    <ContentContext.Provider value={{ content, loading, updateContent, refreshContent, firebaseConnected }}>
      {children}
    </ContentContext.Provider>
  );
};

export const useContent = () => {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used within a ContentProvider');
  return ctx;
};
