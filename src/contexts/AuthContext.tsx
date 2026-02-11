import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

interface AuthContextType {
  isPinUnlocked: boolean;
  setPinUnlocked: (v: boolean) => void;
  session: Session | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPinUnlocked, setIsPinUnlocked] = useState(() => sessionStorage.getItem("isUnlocked") === "true");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const setPinUnlocked = (v: boolean) => {
    setIsPinUnlocked(v);
    if (v) sessionStorage.setItem("isUnlocked", "true");
    else sessionStorage.removeItem("isUnlocked");
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setPinUnlocked(false);
  };

  return (
    <AuthContext.Provider value={{ isPinUnlocked, setPinUnlocked, session, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
