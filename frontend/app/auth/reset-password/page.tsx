"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { resetPassword } from "@/lib/api";
import { toast } from "sonner";

function getPasswordStrength(password: string): {
  level: "weak" | "medium" | "strong";
  width: number;
  color: string;
  label: string;
} {
  const len = password.length;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  if (len < 6) {
    return { level: "weak", width: 33, color: "#ef4444", label: "Weak" };
  }
  if (len >= 10 && hasNumber && hasSpecial) {
    return { level: "strong", width: 100, color: "#22c55e", label: "Strong" };
  }
  return { level: "medium", width: 66, color: "#f59e0b", label: "Medium" };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const strength = getPasswordStrength(password);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => router.push("/auth/login"), 2000);
      return () => clearTimeout(t);
    }
  }, [success, router]);

  async function handleResetPassword() {
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      toast.error("Passwords do not match");
      return;
    }
    if (!token) {
      setError("Invalid or missing reset link");
      toast.error("Invalid or missing reset link");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
      toast.success("Password reset successfully. Redirecting to sign in...");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid or expired token";
      setError(msg);
      toast.error(msg);
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
        <h1 className="text-center text-2xl font-bold text-white">
          Set New Password
        </h1>
        <p className="mb-8 mt-1 text-center text-sm text-vertex-muted">
          Enter your new password below
        </p>

        {success ? (
          <div
            className="rounded-xl border px-4 py-4"
            style={{
              borderColor: "rgba(34,197,94,0.5)",
              background: "rgba(34,197,94,0.08)",
            }}
          >
            <p className="text-center font-medium text-vertex-success">
              ✓ Password reset successfully
            </p>
            <p className="mt-2 text-center text-sm text-vertex-muted">
              Redirecting to sign in...
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs text-vertex-muted">
                New password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="vertex-input w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <div
                className="mt-1.5 h-1 w-full overflow-hidden rounded-sm"
                style={{ background: "#2a2a3d" }}
              >
                <div
                  className="h-full rounded-sm transition-all duration-200"
                  style={{
                    width: `${strength.width}%`,
                    background: strength.color,
                  }}
                />
              </div>
              <p
                className="mt-0.5 text-xs"
                style={{ color: strength.color }}
              >
                {strength.label}
              </p>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs text-vertex-muted">
                Confirm password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="vertex-input w-full"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
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
              onClick={handleResetPassword}
              disabled={loading}
              className="glow-button mt-6 flex h-12 w-full items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </button>
          </>
        )}

        <p className="mt-6 text-center text-sm text-vertex-muted">
          <Link
            href="/auth/login"
            className="font-medium hover:underline"
            style={{ color: "#6366f1" }}
          >
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
