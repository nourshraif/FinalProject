"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ConfirmModal } from "@/components/ConfirmModal";
import { getPlanLabel } from "@/lib/plan";
import { getSubscription, cancelSubscription } from "@/lib/api";
import type { Subscription } from "@/types";
import { Check } from "lucide-react";

function BillingContent() {
  const router = useRouter();
  const { token, user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const load = useCallback(() => {
    if (!token) {
      setSub({ plan: "free", status: "active" });
      setLoading(false);
      return;
    }
    setLoading(true);
    getSubscription(token)
      .then((s) => {
        setSub(s);
        if (s.plan && s.plan !== "free") {
          refreshUser().catch(() => undefined);
        }
      })
      .catch((e) => {
        setSub({ plan: "free", status: "active" });
        const msg =
          e?.message === "Failed to fetch"
            ? "Couldn't reach the server. Is the backend running?"
            : e instanceof Error
              ? e.message
              : "Couldn't load subscription.";
        showToast(msg, "error");
      })
      .finally(() => setLoading(false));
  }, [token, showToast, refreshUser]);

  useEffect(() => {
    load();
  }, [load]);

  function handleCancelConfirm() {
    if (!token) return;
    setCanceling(true);
    cancelSubscription(token)
      .then((result) => {
        setSub({
          plan: (result.plan as Subscription["plan"]) || effectivePlan,
          status: (result.status as Subscription["status"]) || "active",
          cancel_at_period_end: true,
          current_period_end: result.current_period_end || sub?.current_period_end,
        });
        setCancelModalOpen(false);
        showToast(
          result.current_period_end
            ? `Subscription canceled. Your ${planLabel} access continues until ${new Date(result.current_period_end).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}.`
            : "Subscription canceled. Your plan stays active until the end of the billing period.",
          "success"
        );
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to cancel", "error"))
      .finally(() => setCanceling(false));
  }

  const effectivePlan = sub?.plan || user?.plan || "free";
  const planLabel = getPlanLabel(effectivePlan, user?.user_type);
  const planIcon =
    effectivePlan === "business"
      ? "🏢"
      : effectivePlan === "pro"
        ? "🚀"
        : "⚡";
  const planNameClass =
    effectivePlan === "business"
      ? "text-cyan-400"
      : effectivePlan === "pro"
        ? "gradient-text"
        : "text-white";
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const isPaid = effectivePlan === "pro" || effectivePlan === "business";
  const cancelScheduled = Boolean(sub?.cancel_at_period_end);

  const statusBadge = () => {
    const s = sub?.status || "active";
    if (cancelScheduled && s === "active")
      return (
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
          Cancels{periodEnd ? ` ${periodEnd}` : " at period end"}
        </span>
      );
    if (s === "active")
      return (
        <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
          Active
        </span>
      );
    if (s === "canceled")
      return (
        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
          Canceled
        </span>
      );
    if (s === "past_due")
      return (
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
          Past Due
        </span>
      );
    return (
      <span className="rounded-full bg-vertex-muted/30 px-2 py-0.5 text-xs font-medium text-vertex-muted">
        {s}
      </span>
    );
  };

  const freeFeatures = [
    "Upload 1 CV",
    "See top 3 job matches",
    "Save unlimited jobs",
    "Basic profile page",
  ];
  const proFeatures = [
    "Unlimited CV uploads",
    "Unlimited job matches",
    "Skills Gap Analyzer",
    "Application tracker",
    "Daily job alerts",
    "Priority matching",
    "Profile boost",
  ];
  const businessFeatures = [
    "Everything in Growth",
    "Unlimited candidate searches",
    "Save candidates from search",
    "Unlimited contact requests",
    "Unlimited saved candidates",
    "Outreach & advanced analytics",
    "Unlimited job postings",
    "Priority support",
  ];
  const growthFeatures = [
    "Up to 5 active job postings",
    "Full hiring pipeline",
    "Featured job boost",
    "Hiring funnel analytics",
  ];
  const features =
    effectivePlan === "business"
      ? businessFeatures
      : effectivePlan === "pro"
        ? user?.user_type === "company"
          ? growthFeatures
          : proFeatures
        : freeFeatures;

  return (
    <div className="mx-auto max-w-[700px] px-4 pt-24 pb-16">
      <h1 className="text-3xl font-bold text-white">
        Billing & Subscription
      </h1>
      <p className="mt-1 text-vertex-muted">
        Manage your Vertex subscription
      </p>

      {loading ? (
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <>
          {/* Current plan card */}
          <div className="glass-card mt-8 rounded-2xl p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{planIcon}</span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={`text-xl font-bold ${planNameClass}`}>
                      {planLabel} Plan
                    </h2>
                  </div>
                </div>
                {statusBadge()}
              </div>
            </div>
            {periodEnd && isPaid && (
              <p className="mt-3 text-sm text-vertex-muted">
                {cancelScheduled
                  ? `Your plan stays active until ${periodEnd}, then reverts to Free.`
                  : `Current period ends: ${periodEnd}`}
              </p>
            )}
            {effectivePlan === "free" && (
              <p className="mt-3 text-sm text-vertex-muted">
                Upgrade to unlock more features
              </p>
            )}
            <div className="mt-6 flex gap-3">
              {effectivePlan === "free" ? (
                <Link
                  href="/pricing"
                  className="glow-button rounded-lg px-4 py-2.5 text-sm font-medium text-white"
                >
                  Upgrade Now
                </Link>
              ) : cancelScheduled ? (
                <p className="text-sm text-amber-400/90">
                  Cancellation scheduled — you keep {planLabel} access until{" "}
                  {periodEnd || "the end of your billing period"}.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(true)}
                  className="ghost-button rounded-lg px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10"
                >
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>

          {/* Plan features card */}
          <div className="glass-card mt-6 rounded-2xl p-8">
            <h3 className="text-lg font-bold text-white">
              Your plan includes
            </h3>
            <ul className="mt-4 space-y-2">
              {features.map((f, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-5 w-5 shrink-0 text-green-500" />
                  <span className="text-sm text-vertex-white">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Upgrade / downgrade card */}
          <div className="glass-card mt-6 rounded-2xl p-8">
            <h3 className="text-lg font-bold text-white">
              {effectivePlan === "free"
                ? "Upgrade"
                : effectivePlan === "pro" && user?.user_type === "company"
                  ? "Upgrade to Business"
                  : "You're on our best plan"}
            </h3>
            {effectivePlan === "free" && (
              <p className="mt-2 text-sm text-vertex-muted">
                {user?.user_type === "company"
                  ? "Growth and Business plans are available on the pricing page."
                  : "Pro plan is available on the pricing page."}
              </p>
            )}
            {effectivePlan === "pro" && user?.user_type === "company" && (
              <Link
                href="/pricing"
                className="mt-4 inline-block rounded-lg bg-cyan-500/20 px-4 py-2.5 text-sm font-medium text-cyan-400 hover:bg-cyan-500/30"
              >
                Upgrade to Business
              </Link>
            )}
            {effectivePlan === "free" && (
              <Link
                href="/pricing"
                className="mt-4 inline-block rounded-lg px-4 py-2.5 text-sm font-medium text-vertex-muted hover:text-vertex-white"
              >
                View pricing
              </Link>
            )}
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={cancelModalOpen}
        title="Cancel subscription?"
        message={
          periodEnd
            ? `Are you sure you want to cancel? Your plan stays active until ${periodEnd}.`
            : "Are you sure you want to cancel?"
        }
        confirmText={canceling ? "Canceling…" : "Cancel subscription"}
        cancelText="Keep plan"
        confirmStyle="destructive"
        onConfirm={handleCancelConfirm}
        onCancel={() => !canceling && setCancelModalOpen(false)}
      />
    </div>
  );
}

export default function BillingPage() {
  return (
    <ProtectedRoute requiredRole="any">
      <BillingContent />
    </ProtectedRoute>
  );
}
