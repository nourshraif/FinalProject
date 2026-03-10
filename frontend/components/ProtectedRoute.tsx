"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type RequiredRole = "jobseeker" | "company" | "any";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole: RequiredRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isLoggedIn, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn || !user) {
      router.push("/auth/login");
      return;
    }
    if (requiredRole === "jobseeker" && user.user_type === "company") {
      router.push("/dashboard/company");
      return;
    }
    if (requiredRole === "company" && user.user_type === "jobseeker") {
      router.push("/dashboard/jobseeker");
      return;
    }
  }, [isLoggedIn, user, requiredRole, router]);

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-transparent"
          style={{
            borderTopColor: "#6366f1",
          }}
          aria-hidden
        />
        <p className="text-sm text-vertex-muted">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
