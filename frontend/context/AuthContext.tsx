"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { getMe } from "@/lib/api";

const STORAGE_TOKEN_KEY = "vertex_token";
const STORAGE_USER_KEY = "vertex_user";

export interface User {
  id: number;
  email: string;
  full_name: string;
  user_type: "jobseeker" | "company";
  is_admin?: boolean;
  /** Subscription tier from backend (`users.plan`). */
  plan?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  /** False until localStorage has been read and /api/auth/me has finished (when a token exists). */
  authReady: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  /** Shallow-merge fields into the current user (and persist). */
  updateUser: (patch: Partial<User>) => void;
  /** Re-fetch the current user from the backend (and persist). */
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function normalizeUser(raw: User): User {
  return {
    ...raw,
    is_admin: Boolean(raw?.is_admin),
    plan: raw?.plan || "free",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const t = localStorage.getItem(STORAGE_TOKEN_KEY);
        const u = localStorage.getItem(STORAGE_USER_KEY);
        if (t && u) {
          setToken(t);
          setUser(normalizeUser(JSON.parse(u) as User));
          try {
            const fresh = await getMe(t);
            if (!cancelled) {
              const normalized = normalizeUser(fresh);
              setUser(normalized);
              localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(normalized));
            }
          } catch {
            if (!cancelled) {
              setToken(null);
              setUser(null);
              localStorage.removeItem(STORAGE_TOKEN_KEY);
              localStorage.removeItem(STORAGE_USER_KEY);
            }
          }
        }
      } catch {
        // ignore corrupt storage
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    const normalized = normalizeUser(newUser);
    setToken(newToken);
    setUser(normalized);
    try {
      localStorage.setItem(STORAGE_TOKEN_KEY, newToken);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(normalized));
    } catch {
      // ignore quota / private mode
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_USER_KEY);
    } catch {
      // ignore
    }
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = normalizeUser({ ...prev, ...patch } as User);
      try {
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!token) return null;
    try {
      const fresh = await getMe(token);
      const normalized = normalizeUser(fresh);
      setUser(normalized);
      try {
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(normalized));
      } catch {
        // ignore
      }
      return normalized;
    } catch {
      return null;
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoggedIn: !!user && !!token,
        authReady,
        login,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
