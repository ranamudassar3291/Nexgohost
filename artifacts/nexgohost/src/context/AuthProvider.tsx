import { useState, useEffect, type ReactNode } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  const { data: user, isLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    }
  });

  useEffect(() => {
    if (error) {
      setToken(null);
      localStorage.removeItem("token");
    }
  }, [error]);

  const login = (newToken: string) => {
    setToken(newToken);
  };

  const logout = () => {
    // Capture role before clearing token so we can redirect to the right portal
    const role = user?.role;
    setToken(null);
    localStorage.removeItem("token");
    setLocation(role === "admin" ? "/admin/login" : "/client/login");
  };

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading: isLoading && !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
