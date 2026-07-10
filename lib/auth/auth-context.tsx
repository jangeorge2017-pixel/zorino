"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@/lib/types";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithFacebook: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSupabaseUser(sessionUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  created_at?: string;
}): User {
  const meta = sessionUser.user_metadata ?? {};
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    sessionUser.email?.split("@")[0] ||
    "User";
  const avatar =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    undefined;

  return {
    id: sessionUser.id,
    email: sessionUser.email ?? "",
    name,
    avatar,
    role: "user",
    isVerified: Boolean(sessionUser.email),
    createdAt: sessionUser.created_at ? new Date(sessionUser.created_at) : new Date(),
    updatedAt: new Date(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const boot = async () => {
      try {
        if (!isSupabaseConfigured()) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        const supabase = createSupabaseBrowserClient();
        if (!supabase) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          setUser(data.session?.user ? mapSupabaseUser(data.session.user) : null);
        }

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ? mapSupabaseUser(session.user) : null);
        });
        unsubscribe = () => sub.subscription.unsubscribe();
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error("Authentication is not configured");
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Authentication is not configured");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setUser(data.user ? mapSupabaseUser(data.user) : null);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error("Authentication is not configured");
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Authentication is not configured");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, name } },
    });
    if (error) throw error;
    setUser(data.user ? mapSupabaseUser(data.user) : null);
  }, []);

  const logout = useCallback(() => {
    void (async () => {
      if (isSupabaseConfigured()) {
        const supabase = createSupabaseBrowserClient();
        await supabase?.auth.signOut();
      }
      setUser(null);
    })();
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      throw new Error("Authentication is not configured");
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Authentication is not configured");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/profile`,
      },
    });
    if (error) throw error;
  }, []);

  const loginWithFacebook = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      throw new Error("Authentication is not configured");
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Authentication is not configured");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/profile`,
      },
    });
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login,
      register,
      logout,
      loginWithGoogle,
      loginWithFacebook,
    }),
    [user, isLoading, login, register, logout, loginWithGoogle, loginWithFacebook]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
