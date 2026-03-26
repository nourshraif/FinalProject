"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { loginUser } from "@/lib/api";
import type { User } from "@/context/AuthContext";
import GoogleButton from "@/components/GoogleButton";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const googleError = searchParams.get("error");
  useEffect(() => {
    if (googleError === "google_failed") {
      showToast(
        "Google sign in failed. Please try again or use email and password.",
        "error"
      );
    }
  }, [googleError, showToast]);

  async function handleLogin() {
    setLoading(true);
    setError("");
    try {
      const res = await loginUser(emailInput.trim(), passwordInput);
      const user: User = {
        id: res.user_id,
        email: res.email,
        full_name: res.full_name,
        user_type: res.user_type as "jobseeker" | "company",
        is_admin: res.is_admin ?? false,
      };
      login(res.access_token, user);
      showToast("Signed in successfully", "success");
      if (user.user_type === "jobseeker") {
        router.push("/dashboard/jobseeker");
      } else {
        router.push("/dashboard/company");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign in failed";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-[420px] rounded-2xl p-10">
        <div className="mb-2 flex justify-center">
          <Logo size="lg" href="/" />
        </div>
        <h1 className="text-center text-2xl font-bold text-vertex-white">
          Welcome back
        </h1>
        <p
          className="mb-8 text-center text-sm"
          style={{ color: "#94a3b8" }}
        >
          Sign in to your Vertex account
        </p>

        <GoogleButton userType="jobseeker" label="Continue with Google" />

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-vertex-border" />
          <span className="text-sm text-vertex-muted">or</span>
          <div className="h-px flex-1 bg-vertex-border" />
        </div>

        <div>
          <label className="mb-1 block text-xs text-vertex-muted">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            className="vertex-input w-full"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-vertex-muted">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="vertex-input w-full pr-10"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-vertex-muted hover:text-vertex-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-1.5 flex justify-end">
            <Link
              href="/auth/forgot-password"
              className="text-xs font-medium hover:underline"
              style={{ color: "#6366f1" }}
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <div
            className="mt-4 rounded-lg border px-3 py-3"
            style={{
              background: "rgba(239,68,68,0.1)",
              borderColor: "rgba(239,68,68,0.3)",
              color: "#ef4444",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="glow-button mt-6 flex h-12 w-full items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </button>

        <p className="mt-6 text-center text-sm text-vertex-muted">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/register"
            className="font-medium hover:underline"
            style={{ color: "#6366f1" }}
          >
            Get started
          </Link>
        </p>
      </div>
    </div>
  );
}
