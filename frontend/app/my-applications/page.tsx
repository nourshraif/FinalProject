"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  getMyVertexApplications,
  withdrawVertexApplication,
} from "@/lib/api";
import type { VertexApplicationStatus, VertexJobApplication } from "@/types";
import { ConfirmModal } from "@/components/ConfirmModal";

const STATUS_LABELS: Record<VertexApplicationStatus, string> = {
  applied: "Applied",
  reviewing: "Under review",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  applied: { bg: "rgba(99,102,241,0.2)", text: "#a5b4fc" },
  reviewing: { bg: "rgba(245,158,11,0.2)", text: "#fcd34d" },
  interviewing: { bg: "rgba(245,158,11,0.2)", text: "#fcd34d" },
  offer: { bg: "rgba(34,197,94,0.2)", text: "#86efac" },
  rejected: { bg: "rgba(239,68,68,0.2)", text: "#fca5a5" },
  withdrawn: { bg: "rgba(100,116,139,0.2)", text: "#94a3b8" },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function MyApplicationsContent() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [apps, setApps] = useState<VertexJobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawId, setWithdrawId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getMyVertexApplications(token)
      .then(setApps)
      .catch((e) => {
        setApps([]);
        showToast(e instanceof Error ? e.message : "Failed to load", "error");
      })
      .finally(() => setLoading(false));
  }, [token, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmWithdraw = () => {
    if (!withdrawId || !token) return;
    const id = withdrawId;
    setWithdrawId(null);
    withdrawVertexApplication(token, id)
      .then(() => {
        setApps((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "withdrawn" } : a))
        );
        showToast("Application withdrawn", "success");
      })
      .catch((e) =>
        showToast(e instanceof Error ? e.message : "Failed to withdraw", "error")
      );
  };

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto max-w-[900px] px-4 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">My Applications</h1>
          <p className="mt-1 text-sm text-vertex-muted">
            Jobs you applied to on Vertex — status updates from companies appear here
          </p>
          <p className="mt-2 text-xs text-vertex-muted">
            For jobs from external boards, use the{" "}
            <Link href="/tracker" className="text-indigo-300 hover:underline">
              Application Tracker
            </Link>{" "}
            (Pro).
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
              style={{ borderTopColor: "#6366f1" }}
            />
          </div>
        ) : apps.length === 0 ? (
          <div className="glass-card rounded-2xl py-16 text-center">
            <p className="text-lg font-bold text-white">No Vertex applications yet</p>
            <p className="mt-2 text-sm text-vertex-muted">
              Browse company jobs and apply directly on Vertex
            </p>
            <Link
              href="/jobs"
              className="glow-button mt-6 inline-block rounded-lg px-6 py-2.5 text-sm font-medium text-white"
            >
              Browse Vertex Jobs
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {apps.map((app) => {
              const st = STATUS_STYLES[app.status] || STATUS_STYLES.applied;
              return (
                <div key={app.id} className="glass-card rounded-xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/jobs/${app.posted_job_id}`}
                        className="font-bold text-white hover:text-indigo-300"
                      >
                        {app.job_title}
                      </Link>
                      <p className="text-sm text-vertex-muted">{app.company_name}</p>
                      {app.job_location && (
                        <p className="text-xs text-vertex-muted">📍 {app.job_location}</p>
                      )}
                      <p className="mt-1 text-xs text-vertex-muted">
                        Applied {formatDate(app.applied_at)}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-3 py-1 text-xs font-medium"
                      style={{ background: st.bg, color: st.text }}
                    >
                      {STATUS_LABELS[app.status] || app.status}
                    </span>
                  </div>
                  {app.company_notes && (
                    <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-sm text-vertex-muted">
                      <span className="font-medium text-slate-300">Company note: </span>
                      {app.company_notes}
                    </p>
                  )}
                  {app.status !== "withdrawn" &&
                    app.status !== "rejected" &&
                    app.status !== "offer" && (
                      <button
                        type="button"
                        onClick={() => setWithdrawId(app.id)}
                        className="mt-3 text-xs text-red-400 hover:underline"
                      >
                        Withdraw application
                      </button>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={withdrawId !== null}
        title="Withdraw application?"
        message="The company will no longer see you as an active applicant for this role."
        confirmText="Withdraw"
        confirmStyle="destructive"
        onConfirm={confirmWithdraw}
        onCancel={() => setWithdrawId(null)}
      />
    </div>
  );
}

export default function MyApplicationsPage() {
  return (
    <ProtectedRoute requiredRole="jobseeker">
      <MyApplicationsContent />
    </ProtectedRoute>
  );
}
