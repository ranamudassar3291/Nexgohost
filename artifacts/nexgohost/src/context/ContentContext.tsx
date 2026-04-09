import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";

interface ContentContextType {
  content: any;
  loading: boolean;
  updateContent: (key: string, value: any) => Promise<void>;
  refreshContent: () => Promise<void>;
  firebaseConnected: boolean;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchContent = async () => {
    try {
      const res = await fetch("/api/content");
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
    pollingRef.current = setInterval(fetchContent, 60_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const updateContent = async (key: string, value: any) => {
    try {
      await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key, value }),
      });
      setContent((prev: any) => ({ ...prev, [key]: value }));
    } catch (err) {
      console.warn("[CMS] Content update failed:", err);
    }
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
