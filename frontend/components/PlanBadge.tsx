"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  getPlanBadgeClasses,
  getPlanBadgeText,
  isPaidPlan,
} from "@/lib/plan";

export interface PlanBadgeProps {
  plan?: string | null;
  userType?: string | null;
  size?: "sm" | "md";
  className?: string;
}

export function PlanBadge({
  plan,
  userType,
  size = "sm",
  className,
}: PlanBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold uppercase tracking-wide",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        getPlanBadgeClasses(plan, userType),
        className
      )}
    >
      {getPlanBadgeText(plan, userType)}
    </span>
  );
}

export interface CurrentPlanBannerProps {
  plan?: string | null;
  userType?: string | null;
  subscriptionStatus?: string | null;
  cancelAtPeriodEnd?: boolean;
  className?: string;
}

/** Dashboard / settings strip showing the active plan. */
export function CurrentPlanBanner({
  plan,
  userType,
  subscriptionStatus,
  cancelAtPeriodEnd,
  className,
}: CurrentPlanBannerProps) {
  const paid = isPaidPlan(plan);
  const status = (subscriptionStatus || "active").toLowerCase();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-400">Your plan</span>
        <PlanBadge plan={plan} userType={userType} size="md" />
        {paid && status === "active" && !cancelAtPeriodEnd && (
          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400">
            Active
          </span>
        )}
        {paid && cancelAtPeriodEnd && status === "active" && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            Canceling
          </span>
        )}
        {status === "canceled" && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            Canceled
          </span>
        )}
      </div>
      <Link
        href="/settings/billing"
        className="text-xs font-medium text-indigo-300 transition-colors hover:text-indigo-200"
      >
        {paid ? "Manage billing" : "Upgrade plan"}
      </Link>
    </div>
  );
}
