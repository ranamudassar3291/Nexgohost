import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
});

async function persistThemeToDB(theme: Theme) {
  const token = localStorage.getItem("token");
  if (!token) return;
  try {
    await fetch("/api/my/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ theme }),
    });
  } catch { /* non-fatal — localStorage is source of truth */ }
}

async function loadThemeFromDB(): Promise<Theme | null> {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const res = await fetch("/api/my/preferences", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.theme === "dark" ? "dark" : "light";
  } catch { return null; }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("noehost-theme-v2");
    return (stored === "light" || stored === "dark") ? stored : "light";
  });

  // On first render, load theme from DB (only when logged in)
  useEffect(() => {
    loadThemeFromDB().then(dbTheme => {
      if (dbTheme && dbTheme !== theme) {
        setThemeState(dbTheme);
      }
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("noehost-theme-v2", theme);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    persistThemeToDB(t);
  };

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
