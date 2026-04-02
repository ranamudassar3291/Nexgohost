import { createContext, useContext, useEffect, ReactNode } from "react";

interface ThemeContextValue {
  theme: "light";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Force light mode — remove any previously stored dark preference
    const root = document.documentElement;
    root.classList.remove("dark");
    localStorage.removeItem("noehost-theme");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "light", toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
