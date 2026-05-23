"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { verifyCheckoutSession } from "@/lib/api";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, updateUser, refreshUser } = useAuth();
  const sessionId = searchParams.get("session_id") || "";
  const planParam = (searchParams.get("plan") || "pro").toLowerCase();

  const [verifying, setVerifying] = useState<boolean>(Boolean(sessionId && token));
  const [error, setError] = useState<string | null>(null);
  const [verifiedPlan, setVerifiedPlan] = useState<string>(planParam);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!sessionId || !token) {
        setVerifying(false);
        return;
      }
      try {
        const res = await verifyCheckoutSession(token, sessionId);
        if (cancelled) return;
        setVerifiedPlan(res.plan || planParam);
        updateUser({ plan: res.plan });
        refreshUser().catch(() => undefined);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error
            ? e.message
            : "We could not confirm your payment. Please contact support."
        );
      } finally {
        if (!cancelled) setVerifying(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [sessionId, token, planParam, updateUser, refreshUser]);

  useEffect(() => {
    if (verifying || error) return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          router.push("/dashboard");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [router, verifying, error]);

  const subtext =
    verifiedPlan === "business"
      ? "You now have unlimited candidate searches and contact requests."
      : "You now have access to unlimited matches, daily job alerts, and priority matching.";

  if (verifying) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-16">
        <div className="glass-card w-full max-w-md rounded-2xl border border-white/[0.08] p-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-indigo-400" />
          <h1 className="text-xl font-semibold text-white">Confirming your payment…</h1>
          <p className="mt-2 text-sm text-slate-400">
            Please wait while we activate your subscription.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-16">
        <div className="glass-card w-full max-w-md rounded-2xl border border-white/[0.08] p-8 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl text-white"
            style={{ background: "linear-gradient(135deg, #ef4444, #b91c1c)" }}
          >
            !
          </div>
          <h1 className="text-xl font-semibold text-white">Payment verification failed</h1>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/settings/billing"
              className="glow-button rounded-lg px-6 py-2.5 text-center text-sm font-medium text-white"
            >
              View Billing
            </Link>
            <Link
              href="/pricing"
              className="ghost-button rounded-lg px-6 py-2.5 text-center text-sm font-medium text-white"
            >
              Back to Pricing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-16">
      <div
        className="animate-scale-in mb-6 flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-4xl text-white"
        style={{
          background: "linear-gradient(135deg, #22c55e, #16a34a)",
          boxShadow: "0 0 40px rgba(34,197,94,0.4)",
        }}
      >
        ✓
      </div>
      <h1 className="text-center text-3xl font-bold text-white">
        Payment Successful!
      </h1>
      <p className="gradient-text mt-2 text-center text-xl font-medium">
        Welcome to Vertex {verifiedPlan === "business" ? "Business" : "Pro"}!
      </p>
      <p className="mt-3 max-w-md text-center text-sm" style={{ color: "var(--text-secondary)" }}>
        {subtext}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/dashboard"
          className="glow-button rounded-lg px-6 py-2.5 text-center text-sm font-medium text-white"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/settings/billing"
          className="ghost-button rounded-lg px-6 py-2.5 text-center text-sm font-medium text-white"
        >
          View Billing
        </Link>
      </div>
      <p className="mt-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Redirecting in {countdown} seconds...
      </p>
    </div>
  );
}
