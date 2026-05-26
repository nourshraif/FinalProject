"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  adminGetUserDetails,
  adminDeleteUser,
  adminUpdateUserPlan,
} from "@/lib/api";
import type { AdminUserDetail } from "@/types";
import type { AdminUserRow } from "@/lib/api";

type TabId = "profile" | "subscription" | "activity" | "cv";

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name || "?").slice(0, 2).toUpperCase();
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

const PLANS = ["free", "pro", "business"] as const;

type Props = {
  token: string;
  userRow: AdminUserRow | null;
  open: boolean;
  onClose: () => void;
  onDeleted: (userId: number) => void;
  onPlanUpdated?: () => void;
  showToast: (msg: string, type: "success" | "error") => void;
};

export function UserDetailModal({
  token,
  userRow,
  open,
  onClose,
  onDeleted,
  onPlanUpdated,
  showToast,
}: Props) {
  const [tab, setTab] = useState<TabId>("profile");
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    if (!token || !userRow?.id) return;
    setLoading(true);
    adminGetUserDetails(token, userRow.id)
      .then(setDetail)
      .catch((e) => {
        showToast(e instanceof Error ? e.message : "Failed to load user", "error");
        setDetail(null);
      })
      .finally(() => setLoading(false));
  }, [token, userRow?.id, showToast]);

  useEffect(() => {
    if (open && userRow) {
      setTab("profile");
      load();
    } else {
      setDetail(null);
    }
  }, [open, userRow, load]);

  const applyPlan = async (plan: string) => {
    if (!token || !userRow) return;
    setPlanLoading(true);
    try {
      await adminUpdateUserPlan(token, userRow.id, plan);
      showToast(`Plan updated to ${plan}`, "success");
      load();
      onPlanUpdated?.();
      setConfirmPlan(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to update plan", "error");
    } finally {
      setPlanLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !userRow) return;
    try {
      await adminDeleteUser(token, userRow.id);
      showToast("Account deleted", "success");
      onDeleted(userRow.id);
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setConfirmDelete(false);
    }
  };

  if (!open || !userRow) return null;

  const plan = (detail?.plan || "free").toLowerCase();
  const cvPreview = detail?.cv_text
    ? detail.cv_text.length > 2000
      ? `${detail.cv_text.slice(0, 2000)}\n\n... (truncated)`
      : detail.cv_text
    : "";

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
      >
        <div className="glass-card relative max-h-[90vh] w-full max-w-[700px] overflow-y-auto rounded-2xl border border-white/10 p-8 shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-6 flex items-center gap-4 pr-8">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-500/30 text-lg font-bold text-white">
              {getInitials(detail?.full_name || userRow.full_name)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {detail?.full_name || userRow.full_name}
              </h2>
              <p className="text-sm text-vertex-muted">{detail?.email || userRow.email}</p>
            </div>
          </div>

          <div className="mb-6 flex gap-4 border-b border-white/10">
            {(
              [
                ["profile", "Profile"],
                ["subscription", "Subscription"],
                ["activity", "Activity"],
                ...(detail?.user_type === "jobseeker" || userRow.user_type === "jobseeker"
                  ? ([["cv", "CV"]] as const)
                  : []),
              ] as [TabId, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "pb-2 text-sm font-medium transition",
                  tab === id
                    ? "border-b-2 border-indigo-400 text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            </div>
          ) : !detail ? (
            <p className="py-8 text-center text-sm text-vertex-muted">User not found</p>
          ) : (
            <>
              {tab === "profile" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-vertex-muted">User type</p>
                    <span
                      className={cn(
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                        detail.user_type === "jobseeker"
                          ? "bg-indigo-500/30 text-indigo-200"
                          : "bg-cyan-500/30 text-cyan-200"
                      )}
                    >
                      {detail.user_type}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-vertex-muted">Account status</p>
                    <span
                      className={cn(
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                        detail.is_active
                          ? "bg-green-500/20 text-green-300"
                          : "bg-red-500/20 text-red-300"
                      )}
                    >
                      {detail.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-vertex-muted">Member since</p>
                    <p className="text-sm text-white">{formatDate(detail.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-vertex-muted">Last updated</p>
                    <p className="text-sm text-white">{formatDate(detail.updated_at)}</p>
                  </div>
                  {detail.user_type === "jobseeker" && (
                    <>
                      {detail.headline && (
                        <div className="sm:col-span-2">
                          <p className="text-xs text-vertex-muted">Headline</p>
                          <p className="text-sm text-white">{detail.headline}</p>
                        </div>
                      )}
                      {detail.bio && (
                        <div className="sm:col-span-2">
                          <p className="text-xs text-vertex-muted">Bio</p>
                          <p className="text-sm text-white">{detail.bio}</p>
                        </div>
                      )}
                      {detail.location && (
                        <div>
                          <p className="text-xs text-vertex-muted">Location</p>
                          <p className="text-sm text-white">{detail.location}</p>
                        </div>
                      )}
                      {detail.linkedin_url && (
                        <div>
                          <p className="text-xs text-vertex-muted">LinkedIn</p>
                          <p className="text-sm text-indigo-300">{detail.linkedin_url}</p>
                        </div>
                      )}
                      {detail.years_experience != null && (
                        <div>
                          <p className="text-xs text-vertex-muted">Experience</p>
                          <p className="text-sm text-white">{detail.years_experience} years</p>
                        </div>
                      )}
                      {detail.skills && detail.skills.length > 0 && (
                        <div className="sm:col-span-2">
                          <p className="mb-2 text-xs text-vertex-muted">Skills</p>
                          <div className="flex flex-wrap gap-1.5">
                            {detail.skills.map((s) => (
                              <span
                                key={s}
                                className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {detail.user_type === "company" && (
                    <>
                      {detail.company_name && (
                        <div>
                          <p className="text-xs text-vertex-muted">Company</p>
                          <p className="text-sm text-white">{detail.company_name}</p>
                        </div>
                      )}
                      {detail.website && (
                        <div>
                          <p className="text-xs text-vertex-muted">Website</p>
                          <p className="text-sm text-indigo-300">{detail.website}</p>
                        </div>
                      )}
                      {detail.industry && (
                        <div>
                          <p className="text-xs text-vertex-muted">Industry</p>
                          <p className="text-sm text-white">{detail.industry}</p>
                        </div>
                      )}
                      {detail.company_size && (
                        <div>
                          <p className="text-xs text-vertex-muted">Size</p>
                          <p className="text-sm text-white">{detail.company_size}</p>
                        </div>
                      )}
                      {detail.company_description && (
                        <div className="sm:col-span-2">
                          <p className="text-xs text-vertex-muted">Description</p>
                          <p className="text-sm text-white">{detail.company_description}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {tab === "subscription" && (
                <div className="space-y-6">
                  <div>
                    <p className="text-xs text-vertex-muted">Current plan</p>
                    <span
                      className={cn(
                        "mt-2 inline-block rounded-full px-3 py-1 text-sm font-bold uppercase",
                        plan === "pro" && "bg-indigo-500/30 text-indigo-200",
                        plan === "business" && "bg-cyan-500/30 text-cyan-200",
                        plan === "free" && "bg-slate-500/30 text-slate-200"
                      )}
                    >
                      {plan}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-vertex-muted">Status</p>
                      <p className="text-sm text-white">
                        {detail.subscription_status || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-vertex-muted">Period end</p>
                      <p className="text-sm text-white">
                        {formatDate(detail.current_period_end)}
                      </p>
                    </div>
                  </div>
                  {detail.stripe_subscription_id && (
                    <div>
                      <p className="text-xs text-vertex-muted">Stripe ID</p>
                      <p className="font-mono text-xs text-slate-400">
                        {detail.stripe_subscription_id}
                      </p>
                    </div>
                  )}
                  <div>
                    <h3 className="mb-3 font-bold text-white">Change plan</h3>
                    <div className="flex flex-wrap gap-2">
                      {PLANS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          disabled={planLoading}
                          onClick={() => setConfirmPlan(p)}
                          className={cn(
                            "rounded-lg px-4 py-2 text-sm font-medium capitalize transition",
                            p === "free" && "ghost-button",
                            p === "pro" &&
                              (plan === p
                                ? "bg-indigo-600 text-white"
                                : "ghost-button border-indigo-500/50 text-indigo-200"),
                            p === "business" &&
                              (plan === p
                                ? "bg-cyan-600 text-white"
                                : "ghost-button border-cyan-500/50 text-cyan-200")
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === "activity" && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white">
                      {detail.applications_count ?? 0}
                    </p>
                    <p className="text-xs text-vertex-muted">Applications</p>
                  </div>
                  <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white">
                      {detail.saved_jobs_count ?? 0}
                    </p>
                    <p className="text-xs text-vertex-muted">Saved jobs</p>
                  </div>
                  <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white">
                      {detail.requests_count ?? 0}
                    </p>
                    <p className="text-xs text-vertex-muted">Requests</p>
                  </div>
                </div>
              )}

              {tab === "cv" && detail.user_type === "jobseeker" && (
                <div>
                  {detail.cv_filename ? (
                    <>
                      <p className="text-sm text-white">
                        CV file: <span className="text-indigo-300">{detail.cv_filename}</span>
                      </p>
                      {detail.skills && detail.skills.length > 0 && (
                        <div className="mt-4">
                          <p className="mb-2 text-xs text-vertex-muted">Skills extracted</p>
                          <div className="flex flex-wrap gap-1.5">
                            {detail.skills.map((s) => (
                              <span
                                key={s}
                                className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-200"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {cvPreview && (
                        <div className="mt-4 max-h-[300px] overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-3">
                          <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300">
                            {cvPreview}
                          </pre>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="py-8 text-center text-sm text-vertex-muted">
                      No CV uploaded yet
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ghost-button rounded-lg border-red-500/40 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
            >
              Delete account
            </button>
            <button type="button" onClick={onClose} className="ghost-button rounded-lg px-4 py-2 text-sm">
              Close
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmPlan !== null}
        title="Change plan"
        message={`Change ${userRow.full_name}'s plan to ${confirmPlan}?`}
        confirmText="Change plan"
        onConfirm={() => confirmPlan && applyPlan(confirmPlan)}
        onCancel={() => setConfirmPlan(null)}
      />

      <ConfirmModal
        isOpen={confirmDelete}
        title="Delete account"
        message={`Are you sure you want to delete ${userRow.full_name}'s account? This cannot be undone.`}
        confirmText="Delete"
        confirmStyle="destructive"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
