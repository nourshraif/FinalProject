"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  getCompanyPostedJobs,
  toggleJobActive,
  deletePostedJob,
} from "@/lib/api";
import type { PostedJob } from "@/types";

function daysAgo(createdAt: string): string {
  try {
    const d = new Date(createdAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
    if (diff === 0) return "Today";
    if (diff === 1) return "1 day ago";
    if (diff < 30) return `${diff} days ago`;
    if (diff < 60) return "1 month ago";
    return `${Math.floor(diff / 30)} months ago`;
  } catch {
    return "";
  }
}

function CompanyJobsContent() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<PostedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getCompanyPostedJobs(token)
      .then((list) => setJobs(Array.isArray(list) ? list : []))
      .catch((e) => {
        setJobs([]);
        showToast(e instanceof Error ? e.message : "Failed to load jobs", "error");
      })
      .finally(() => setLoading(false));
  }, [token, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount = jobs.filter((j) => j.is_active).length;
  const totalViews = jobs.reduce((s, j) => s + (j.views_count || 0), 0);

  const handleToggle = (id: number) => {
    if (!token) return;
    setTogglingId(id);
    toggleJobActive(token, id)
      .then(() => {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === id ? { ...j, is_active: !j.is_active } : j
          )
        );
        showToast("Job status updated", "success");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to update", "error"))
      .finally(() => setTogglingId(null));
  };

  const handleDelete = (id: number) => {
    if (!token) return;
    deletePostedJob(token, id)
      .then(() => {
        setJobs((prev) => prev.filter((j) => j.id !== id));
        setDeleteId(null);
        showToast("Job deleted", "success");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to delete", "error"));
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center pt-24">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-transparent"
          style={{ borderTopColor: "#6366f1" }}
          aria-hidden
        />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="min-h-screen pt-24 pb-12">
        <div className="mx-auto max-w-[1000px] px-6">
          <div className="flex flex-col items-center justify-center rounded-2xl py-20 text-center">
            <span className="mb-4 text-6xl" aria-hidden>📋</span>
            <h2 className="text-xl font-bold text-white">No jobs posted yet</h2>
            <p className="mt-2 max-w-md text-sm text-vertex-muted">
              Start attracting talent by posting your first job
            </p>
            <Link
              href="/company/post-job"
              className="glow-button mt-6 rounded-lg px-6 py-3 font-medium text-white"
            >
              Post Your First Job
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto max-w-[1000px] px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold text-white">My Job Postings</h1>
          <Link
            href="/company/post-job"
            className="glow-button shrink-0 rounded-lg px-5 py-2.5 font-medium text-white"
          >
            Post New Job
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="glass-card rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{jobs.length}</p>
            <p className="text-sm text-vertex-muted">Total Posted</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{activeCount}</p>
            <p className="text-sm text-vertex-muted">Active</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{totalViews}</p>
            <p className="text-sm text-vertex-muted">Total Views</p>
          </div>
        </div>

        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="glass-card rounded-2xl p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{job.title}</h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        job.is_active
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {job.is_active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-vertex-muted">
                    <span className="rounded-full bg-vertex-card px-2 py-0.5">
                      {job.job_type.replace(/-/g, " ")}
                    </span>
                    <span className="rounded-full bg-vertex-card px-2 py-0.5">
                      {job.experience_level.replace(/-/g, " ")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-vertex-muted">
                {job.location && (
                  <span>
                    <span aria-hidden>📍</span> {job.location}
                  </span>
                )}
                {(job.salary_min != null || job.salary_max != null) && (
                  <span>
                    {job.salary_min ?? "?"} - {job.salary_max ?? "?"} {job.salary_currency}
                  </span>
                )}
                <span>Posted {daysAgo(job.created_at)}</span>
              </div>

              {Array.isArray(job.skills_required) && job.skills_required.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {job.skills_required.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      className="rounded-md bg-vertex-card px-2 py-0.5 text-xs text-vertex-muted"
                    >
                      {s}
                    </span>
                  ))}
                  {job.skills_required.length > 4 && (
                    <span className="text-xs text-vertex-muted">
                      +{job.skills_required.length - 4} more
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 text-xs text-vertex-muted">
                <span>👁 {job.views_count ?? 0} views</span>
                <span>📅 {daysAgo(job.created_at)} posted</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/company/post-job/${job.id}`}
                  className="ghost-button rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => handleToggle(job.id)}
                  disabled={togglingId === job.id}
                  className="ghost-button rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {togglingId === job.id
                    ? "..."
                    : job.is_active
                      ? "Pause"
                      : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(job.id)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteId !== null}
        title="Delete job posting?"
        message="This cannot be undone."
        confirmText="Delete"
        confirmStyle="destructive"
        onConfirm={() => deleteId != null && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

export default function CompanyJobsPage() {
  return (
    <ProtectedRoute requiredRole="company">
      <CompanyJobsContent />
    </ProtectedRoute>
  );
}
