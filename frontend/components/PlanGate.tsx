"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getSubscription } from "@/lib/api";
import type { Subscription } from "@/types";

export type PlanGateFeature =
  | "view_matches"
  | "skills_gap"
  | "save_jobs"
  | "application_tracker"
  | "search_candidates"
  | "contact_requests";

const FEATURE_COPY: Record<
  PlanGateFeature,
  { title: string; description: string; requiredPlan: "pro" | "business" }
> = {
  view_matches: {
    title: "Pro feature",
    description:
      "Upgrade to Pro to see all your job matches and find your perfect role.",
    requiredPlan: "pro",
  },
  skills_gap: {
    title: "Pro feature",
    description:
      "Upgrade to Pro to analyze your skills gap and get a personalized learning path.",
    requiredPlan: "pro",
  },
  save_jobs: {
    title: "Pro feature",
    description:
      "Upgrade to Pro to save unlimited jobs and never miss an opportunity.",
    requiredPlan: "pro",
  },
  application_tracker: {
    title: "Pro feature",
    description:
      "Upgrade to Pro to track all your job applications in one place.",
    requiredPlan: "pro",
  },
  search_candidates: {
    title: "Business feature",
    description:
      "Upgrade to Business to search our talent pool and find candidates.",
    requiredPlan: "business",
  },
  contact_requests: {
    title: "Business feature",
    description:
      "Upgrade to Business to send unlimited contact requests to candidates.",
    requiredPlan: "business",
  },
};

function planMeetsRequired(
  plan: string | undefined,
  required: "pro" | "business",
  userType: string | undefined
): boolean {
  const p = (plan || "free").toLowerCase();
  if (required === "business") return p === "business";
  if (userType === "company") return p === "business";
  return p === "pro" || p === "business";
}

export interface PlanGateProps {
  feature: PlanGateFeature;
  /** Ignored if `soft` is true — use `requiredPlan` from feature map unless overridden */
  requiredPlan?: "pro" | "business";
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** When true, always render children (limits still enforced by API). */
  soft?: boolean;
}

export function PlanGate({
  feature,
  requiredPlan: requiredPlanOverride,
  children,
  fallback,
  soft = false,
}: PlanGateProps) {
  const { token, user } = useAuth();
  const meta = FEATURE_COPY[feature];
  const requiredPlan = requiredPlanOverride ?? meta.requiredPlan;
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  if (user?.is_admin) {
    return <>{children}</>;
  }

  useEffect(() => {
    if (!token) {
      setSub(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getSubscription(token)
      .then((s) => {
        if (!cancelled) setSub(s);
      })
      .catch(() => {
        if (!cancelled) setSub({ plan: "free", status: "active" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (soft) {
    return <>{children}</>;
  }

  if (!token) {
    return (
      <div className="px-4 pt-28 pb-16 md:pt-32">
        <div className="glass-card mx-auto max-w-lg rounded-2xl border border-white/[0.08] p-8 text-center">
          <Lock className="mx-auto h-12 w-12 text-indigo-400" aria-hidden />
          <p className="mt-4 text-lg font-bold text-white">Sign in required</p>
          <p className="mt-2 text-sm text-slate-400">Please sign in to use this feature.</p>
          <Link href="/auth/login" className="glow-button mt-6 inline-block rounded-lg px-6 py-2.5 text-sm font-semibold text-white">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 pt-28 pb-16 md:pt-32">
        <div className="mx-auto max-w-lg animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.04] p-12" />
      </div>
    );
  }

  const effectivePlan = (user?.plan as string | undefined) || sub?.plan || "free";
  const allowed = planMeetsRequired(effectivePlan, requiredPlan, user?.user_type);

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const planLabel =
    requiredPlan === "business" ? "Business feature" : "Pro feature";

  return (
    <div className="px-4 pt-28 pb-16 md:pt-32">
      <div className="glass-card mx-auto max-w-md rounded-2xl border border-white/[0.08] p-8 text-center shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
        <Lock className="mx-auto h-12 w-12 text-indigo-400" aria-hidden />
        <h2 className="mt-4 text-lg font-bold text-white">{planLabel}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">{meta.description}</p>
        <p className="mt-4 text-xs text-slate-500">
          You are on the {effectivePlan === "free" ? "Free" : effectivePlan.charAt(0).toUpperCase() + effectivePlan.slice(1)} plan
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/pricing" className="glow-button inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white">
            Upgrade Now
          </Link>
          <Link
            href="/pricing"
            className="ghost-button inline-flex items-center justify-center rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-white"
          >
            See all plans
          </Link>
        </div>
      </div>
    </div>
  );
}
