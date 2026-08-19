import { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { setAuthToken, login as apiLogin, signup as apiSignup, fetchMe, type AuthUser } from "./api";

const TOKEN_KEY = "prospector_auth_token";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, name: string, password: string) => Promise<void>;
  completeGoogleLogin: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!storedToken) {
        setLoading(false);
        return;
      }
      setAuthToken(storedToken);
      try {
        setUser(await fetchMe());
      } catch {
        // Token expiré ou invalide — on l'efface et on renvoie vers la connexion.
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setAuthToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function applySession(token: string, sessionUser: AuthUser) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setAuthToken(token);
    setUser(sessionUser);
  }

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: sessionUser } = await apiLogin({ email, password });
    await applySession(token, sessionUser);
  }, []);

  const signup = useCallback(async (email: string, name: string, password: string) => {
    const { token, user: sessionUser } = await apiSignup({ email, name, password });
    await applySession(token, sessionUser);
  }, []);

  // Le callback Google (voir googleAuth.ts) ne renvoie que le JWT dans l'URL de redirection —
  // on récupère l'utilisateur séparément via /auth/me, comme au démarrage de l'app.
  const completeGoogleLogin = useCallback(async (token: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setAuthToken(token);
    setUser(await fetchMe());
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, completeGoogleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé sous AuthProvider");
  return ctx;
}
