"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    const user_type = searchParams.get("user_type");
    const full_name = searchParams.get("full_name");
    const user_id = searchParams.get("user_id");
    const email = searchParams.get("email");
    const error = searchParams.get("error");

    if (error) {
      router.push("/auth/login?error=google_failed");
      return;
    }

    if (token && user_type && full_name && user_id && email) {
      login(token, {
        id: parseInt(user_id, 10),
        email: decodeURIComponent(email),
        full_name: decodeURIComponent(full_name),
        user_type: user_type as "jobseeker" | "company",
        is_admin: false,
      });
      if (user_type === "company") {
        router.push("/dashboard/company");
      } else {
        router.push("/dashboard/jobseeker");
      }
    } else {
      router.push("/auth/login");
    }
  }, [searchParams, router, login]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div
        className="h-10 w-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"
        aria-hidden
      />
      <p className="text-sm text-vertex-muted">Signing you in...</p>
    </div>
  );
}
