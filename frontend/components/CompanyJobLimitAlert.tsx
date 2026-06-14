"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { createCheckoutSession, getCompanyPlanUsage } from "@/lib/api";
import type { CompanyPlanUsage } from "@/types";
import {
  isJobPostingLimitReached,
  jobPostingLimitMessage,
  jobPostingUpgradeLabel,
  jobPostingUpgradePlan,
} from "@/lib/company-plan";

export function useCompanyPlanUsage() {
  const { token } = useAuth();
  const [usage, setUsage] = useState<CompanyPlanUsage | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setUsage(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCompanyPlanUsage(token)
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch(() => {
        if (!cancelled) setUsage(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return {
    usage,
    loading,
    atLimit: usage ? isJobPostingLimitReached(usage) : false,
  };
}

export function useCompanyJobUpgrade() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [checkingOut, setCheckingOut] = useState(false);

  const startUpgrade = useCallback(
    async (usage: CompanyPlanUsage) => {
      if (!token) {
        showToast("Please sign in to upgrade", "error");
        return;
      }
      setCheckingOut(true);
      try {
        const plan = jobPostingUpgradePlan(usage);
        const url = await createCheckoutSession(token, plan, "monthly");
        window.location.href = url;
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to start checkout", "error");
      } finally {
        setCheckingOut(false);
      }
    },
    [token, showToast]
  );

  return { startUpgrade, checkingOut };
}

interface CompanyJobLimitAlertProps {
  className?: string;
  /** When true, only render if the job posting limit is reached. */
  onlyWhenLimited?: boolean;
}

export function CompanyJobLimitAlert({
  className,
  onlyWhenLimited = true,
}: CompanyJobLimitAlertProps) {
  const { usage, loading, atLimit } = useCompanyPlanUsage();
  const { startUpgrade, checkingOut } = useCompanyJobUpgrade();

  if (loading || !usage) return null;

  if (usage.cancel_at_period_end) {
    if (onlyWhenLimited && !atLimit) return null;
    const periodEnd = usage.current_period_end
      ? new Date(usage.current_period_end).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;
    return (
      <div
        className={cn(
          "rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-6",
          className
        )}
        role="status"
      >
        <p className="text-sm font-bold text-white">Cancellation scheduled</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">
          Your {usage.plan_label} access continues{periodEnd ? ` until ${periodEnd}` : " until the end of your billing period"}.
          {usage.max_active_jobs != null && atLimit
            ? ` You can keep your ${usage.active_jobs} active posting${usage.active_jobs !== 1 ? "s" : ""} until then.`
            : usage.max_active_jobs == null
              ? " Unlimited job postings remain available until then."
              : ""}
        </p>
      </div>
    );
  }

  if (onlyWhenLimited && !atLimit) return null;

  const upgradeLabel = jobPostingUpgradeLabel(usage);

  return (
    <div
      className={cn(
        "rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-6",
        className
      )}
      role="alert"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/25">
            <Lock className="h-5 w-5 text-amber-300" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Job posting limit reached</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              {jobPostingLimitMessage(usage)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {usage.active_jobs} of {usage.max_active_jobs} active posting
              {usage.max_active_jobs !== 1 ? "s" : ""} used on {usage.plan_label}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={() => startUpgrade(usage)}
            disabled={checkingOut}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-v-primary to-v-primaryContainer px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-v-primary/20 transition hover:shadow-v-primary/35 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {checkingOut ? "Redirecting…" : `Upgrade to ${upgradeLabel}`}
          </button>
          <Link
            href="/pricing"
            className="text-center text-xs font-medium text-indigo-300 hover:text-indigo-200"
          >
            Compare plans
          </Link>
        </div>
      </div>
    </div>
  );
}

interface CompanyPostJobButtonProps {
  className?: string;
  children: React.ReactNode;
}

/** Link to post-job; hidden when the active job limit is reached (see CompanyJobLimitAlert). */
export function CompanyPostJobButton({
  className,
  children,
}: CompanyPostJobButtonProps) {
  const { usage, loading, atLimit } = useCompanyPlanUsage();

  if (loading) {
    return (
      <span
        className={cn(
          "inline-flex animate-pulse rounded-lg bg-white/10 px-5 py-2.5 text-sm",
          className
        )}
      >
        …
      </span>
    );
  }

  if (usage && atLimit) {
    return null;
  }

  return (
    <Link href="/company/post-job" className={className}>
      {children}
    </Link>
  );
}
