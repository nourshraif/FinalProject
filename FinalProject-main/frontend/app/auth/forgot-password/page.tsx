"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { forgotPassword } from "@/lib/api";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSendResetLink() {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Please enter your email");
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(trimmed);
      setSent(true);
      toast.success("If an account exists, you will receive a reset link.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
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
          Forgot Password
        </h1>
        <p className="mb-8 mt-1 text-center text-sm text-vertex-muted">
          Enter your email and we&apos;ll send you a reset link
        </p>

        {!sent ? (
          <>
            <div>
              <label className="mb-1 block text-xs text-vertex-muted">
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className="vertex-input w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              type="button"
              onClick={handleSendResetLink}
              disabled={loading}
              className="glow-button mt-6 flex h-12 w-full items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </>
        ) : (
          <div
            className="rounded-xl border px-4 py-4"
            style={{
              borderColor: "rgba(34,197,94,0.5)",
              background: "rgba(34,197,94,0.08)",
            }}
          >
            <p className="text-center font-medium text-vertex-success">
              ✓ Check your email for a reset link
            </p>
            <p className="mt-2 text-center text-sm text-vertex-muted">
              If you don&apos;t see it, check your spam folder.
            </p>
          </div>
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
