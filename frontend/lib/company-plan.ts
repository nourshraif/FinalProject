import type { CompanyPlanUsage } from "@/types";

/** True when the company cannot add another active job posting. */
export function isJobPostingLimitReached(
  usage: CompanyPlanUsage | null | undefined
): boolean {
  if (!usage || usage.max_active_jobs == null) return false;
  return usage.active_jobs >= usage.max_active_jobs;
}

/** Stripe checkout plan id for the next tier that raises job limits. */
export function jobPostingUpgradePlan(usage: CompanyPlanUsage): "pro" | "business" {
  return usage.plan === "free" ? "pro" : "business";
}

export function jobPostingUpgradeLabel(usage: CompanyPlanUsage): string {
  return usage.plan === "free" ? "Growth" : "Business";
}

export function jobPostingLimitMessage(usage: CompanyPlanUsage): string {
  const limit = usage.max_active_jobs ?? 1;
  const label = jobPostingUpgradeLabel(usage);
  if (usage.plan === "free") {
    return `Your Free plan includes ${limit} active job posting. Upgrade to ${label} to post up to 5 roles and unlock the full hiring pipeline.`;
  }
  return `You've reached ${limit} active job postings on ${usage.plan_label}. Upgrade to ${label} for unlimited job postings.`;
}

/** Outbound contact requests — Business only. */
export function canSendContactRequests(
  usage: CompanyPlanUsage | null | undefined
): boolean {
  return Boolean(usage?.can_send_contact_requests);
}
