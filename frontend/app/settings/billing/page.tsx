"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ConfirmModal } from "@/components/ConfirmModal";
import { getSubscription, cancelSubscription } from "@/lib/api";
import type { Subscription } from "@/types";
import { Check } from "lucide-react";

function BillingContent() {
  const router = useRouter();
  const { token } = useAuth();
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
      .then(setSub)
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
  }, [token, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  function handleCancelConfirm() {
    if (!token) return;
    setCanceling(true);
    cancelSubscription(token)
      .then(() => {
        setSub({ plan: "free", status: "active" });
        setCancelModalOpen(false);
        showToast("Subscription canceled. Access until period end.", "success");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to cancel", "error"))
      .finally(() => setCanceling(false));
  }

  const planLabel =
    sub?.plan === "business"
      ? "Business Plan"
      : sub?.plan === "pro"
        ? "Pro Plan"
        : "Free Plan";
  const planIcon =
    sub?.plan === "business"
      ? "🏢"
      : sub?.plan === "pro"
        ? "🚀"
        : "⚡";
  const planNameClass =
    sub?.plan === "business"
      ? "text-cyan-400"
      : sub?.plan === "pro"
        ? "gradient-text"
        : "text-white";
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const statusBadge = () => {
    const s = sub?.status || "active";
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
    "See top 10 job matches",
    "Basic profile page",
    "Application tracker",
  ];
  const proFeatures = [
    "Unlimited CV uploads",
    "Unlimited job matches",
    "Daily job alerts",
    "Priority matching",
    "Profile boost",
  ];
  const businessFeatures = [
    "Everything in Pro",
    "Unlimited candidate searches",
    "Unlimited contact requests",
    "Saved candidates & history",
    "Priority support",
  ];
  const features =
    sub?.plan === "business"
      ? businessFeatures
      : sub?.plan === "pro"
        ? proFeatures
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
                <h2 className={`text-xl font-bold ${planNameClass}`}>
                  {planLabel}
                </h2>
                {statusBadge()}
              </div>
            </div>
            {periodEnd && (sub?.plan === "pro" || sub?.plan === "business") && (
              <p className="mt-3 text-sm text-vertex-muted">
                Current period ends: {periodEnd}
              </p>
            )}
            {sub?.plan === "free" && (
              <p className="mt-3 text-sm text-vertex-muted">
                Upgrade to unlock more features
              </p>
            )}
            <div className="mt-6 flex gap-3">
              {sub?.plan === "free" ? (
                <Link
                  href="/pricing"
                  className="glow-button rounded-lg px-4 py-2.5 text-sm font-medium text-white"
                >
                  Upgrade Now
                </Link>
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
              {sub?.plan === "free"
                ? "Upgrade"
                : sub?.plan === "pro"
                  ? "Upgrade to Business"
                  : "You're on our best plan"}
            </h3>
            {sub?.plan === "free" && (
              <p className="mt-2 text-sm text-vertex-muted">
                Pro and Business plans available on the pricing page.
              </p>
            )}
            {sub?.plan === "pro" && (
              <Link
                href="/pricing"
                className="mt-4 inline-block rounded-lg bg-cyan-500/20 px-4 py-2.5 text-sm font-medium text-cyan-400 hover:bg-cyan-500/30"
              >
                Upgrade to Business
              </Link>
            )}
            {sub?.plan === "free" && (
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
