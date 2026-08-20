"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getStoredToken, storeToken, clearToken, login as apiLogin, signupManager as apiSignupManager, fetchMe, type AuthUser } from "./api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signupManager: (email: string, name: string, password: string, organizationName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!getStoredToken()) {
        setLoading(false);
        return;
      }
      try {
        setUser(await fetchMe());
      } catch {
        clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: sessionUser } = await apiLogin({ email, password });
    storeToken(token);
    setUser(sessionUser);
  }, []);

  const signupManager = useCallback(async (email: string, name: string, password: string, organizationName: string) => {
    const { token, user: sessionUser } = await apiSignupManager({ email, name, password, organizationName });
    storeToken(token);
    setUser(sessionUser);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, signupManager, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé sous AuthProvider");
  return ctx;
}
