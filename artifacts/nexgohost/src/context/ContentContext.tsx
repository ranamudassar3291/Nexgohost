import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";

interface ContentContextType {
  content: any;
  loading: boolean;
  updateContent: (key: string, value: any) => Promise<void>;
  refreshContent: () => Promise<void>;
  firebaseConnected: boolean;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

const BROADCAST_KEY = "noehost_content_updated";

export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchContent = async () => {
    try {
      const res = await fetch("/api/content", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setContent(data);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
    pollingRef.current = setInterval(fetchContent, 30_000);

    const onFocus = () => fetchContent();
    const onStorage = (e: StorageEvent) => {
      if (e.key === BROADCAST_KEY) fetchContent();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const updateContent = async (key: string, value: any) => {
    const token = localStorage.getItem("noehost_token") || localStorage.getItem("token") || "";
    const res = await fetch("/api/admin/content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    setContent((prev: any) => ({ ...prev, [key]: value }));
    try {
      localStorage.setItem(BROADCAST_KEY, Date.now().toString());
    } catch {}
  };

  const refreshContent = async () => {
    await fetchContent();
  };

  return (
    <ContentContext.Provider value={{ content, loading, updateContent, refreshContent, firebaseConnected: false }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  const context = useContext(ContentContext);
  if (context === undefined) {
    throw new Error("useContent must be used within a ContentProvider");
  }
  return context;
}
