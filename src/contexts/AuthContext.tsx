import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, storedSession, SESSION_KEY, SESSION_EXPIRED_EVENT, type RegistrySession } from "@/lib/appsScriptApi";

interface AuthContextType { session: RegistrySession | null; login: (pin: string) => Promise<void>; logout: () => void }
const AuthContext = createContext<AuthContextType | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<RegistrySession | null>(storedSession);
  const clear = useCallback(() => { sessionStorage.removeItem(SESSION_KEY); setSession(null); }, []);
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, clear);
    const timeout = session ? window.setTimeout(clear, Math.max(0, session.expiresAt - Date.now())) : undefined;
    return () => { window.removeEventListener(SESSION_EXPIRED_EVENT, clear); window.clearTimeout(timeout); };
  }, [session, clear]);
  const login = async (pin: string) => {
    const next = await api.login(pin);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  };
  const logout = () => {
    const token = session?.token;
    clear();
    if (token) void api.logout(token).catch(() => { /* Local logout always succeeds; server token expires. */ });
  };
  return <AuthContext.Provider value={{ session, login, logout }}>{children}</AuthContext.Provider>;
}
