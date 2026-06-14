export type PlanId = "free" | "pro" | "business";

export function resolvePlan(plan?: string | null): PlanId {
  const p = (plan || "free").trim().toLowerCase();
  if (p === "pro" || p === "business") return p;
  return "free";
}

/** Human-readable plan name (Growth for company pro). */
export function getPlanLabel(
  plan?: string | null,
  userType?: string | null
): string {
  const id = resolvePlan(plan);
  if (id === "business") return "Business";
  if (id === "pro") return userType === "company" ? "Growth" : "Pro";
  return "Free";
}

/** Short badge text for compact UI. */
export function getPlanBadgeText(
  plan?: string | null,
  userType?: string | null
): string {
  const id = resolvePlan(plan);
  if (id === "business") return "BUSINESS";
  if (id === "pro") return userType === "company" ? "GROWTH" : "PRO";
  return "FREE";
}

export function getPlanBadgeClasses(
  plan?: string | null,
  userType?: string | null
): string {
  const id = resolvePlan(plan);
  if (id === "business") {
    return "bg-cyan-500/25 text-cyan-200 border-cyan-500/30";
  }
  if (id === "pro") {
    return "bg-indigo-500/30 text-indigo-200 border-indigo-500/30";
  }
  return "bg-white/5 text-slate-400 border-white/10";
}

export function isPaidPlan(plan?: string | null): boolean {
  return resolvePlan(plan) !== "free";
}
