"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const STORAGE_TOKEN_KEY = "vertex_token";
const STORAGE_USER_KEY = "vertex_user";

export interface User {
  id: number;
  email: string;
  full_name: string;
  user_type: "jobseeker" | "company";
  is_admin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem(STORAGE_TOKEN_KEY);
      const u = localStorage.getItem(STORAGE_USER_KEY);
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u) as User);
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    try {
      localStorage.setItem(STORAGE_TOKEN_KEY, newToken);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(newUser));
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

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoggedIn: !!user && !!token,
        login,
        logout,
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
