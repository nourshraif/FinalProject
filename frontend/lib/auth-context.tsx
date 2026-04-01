"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export interface User {
  name: string;
  email: string;
  initials: string;
}

interface AuthContextValue {
  user: User | null;
  signIn: (name: string, email: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const signIn = useCallback((name: string, email: string) => {
    const parts = name.trim().split(/\s+/);
    const initials =
      parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase();
    setUser({ name, email, initials });
  }, []);

  const signOut = useCallback(() => setUser(null), []);

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
