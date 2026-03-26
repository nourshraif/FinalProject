"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getSavedJobs, unsaveJob } from "@/lib/api";
import type { SavedJob } from "@/types";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SkeletonJobCard } from "@/components/Skeleton";

function relativeTime(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffDays > 0) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    if (diffMins > 0) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
    return "Just now";
  } catch {
    return iso;
  }
}

function SavedContent() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [unsaveTarget, setUnsaveTarget] = useState<SavedJob | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getSavedJobs(token)
      .then(setJobs)
      .catch((e) => {
        setJobs([]);
        showToast(e instanceof Error ? e.message : "Failed to load saved jobs", "error");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const sources = Array.from(
    new Set(jobs.map((j) => j.source || "Unknown").filter(Boolean))
  ).sort();

  const filtered = jobs.filter((j) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const matchTitle = (j.job_title || "").toLowerCase().includes(q);
      const matchCompany = (j.company || "").toLowerCase().includes(q);
      if (!matchTitle && !matchCompany) return false;
    }
    if (sourceFilter && sourceFilter !== "all") {
      if ((j.source || "") !== sourceFilter) return false;
    }
    return true;
  });

  const handleUnsave = (job: SavedJob) => setUnsaveTarget(job);

  const confirmUnsave = () => {
    if (!unsaveTarget || !token) return;
    const job = unsaveTarget;
    setUnsaveTarget(null);
    unsaveJob(token, job.id)
      .then(() => {
        setJobs((prev) => prev.filter((j) => j.id !== job.id));
        showToast("Job removed from saved list", "success");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to remove", "error"));
  };

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        {/* Page header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-vertex-white">
              Saved Jobs
            </h1>
            <p className="mt-1 text-sm text-vertex-muted">
              Jobs you bookmarked for later
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-3 py-1 text-sm font-medium text-white"
            style={{ background: "#6366f1" }}
          >
            {jobs.length}
          </span>
        </div>

        {/* Search / filter */}
        <div className="mb-6 flex flex-wrap gap-3">
          <input
            type="text"
            className="vertex-input flex-1 min-w-[200px] rounded-lg px-4 py-2 text-sm text-white"
            placeholder="Search saved jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="vertex-input w-40 rounded-lg px-3 py-2 text-sm text-white"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="">All Sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonJobCard />
            <SkeletonJobCard />
            <SkeletonJobCard />
            <SkeletonJobCard />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl py-16 text-center">
            <span className="text-5xl">🔖</span>
            <p className="mt-4 text-lg font-bold text-vertex-white">
              No saved jobs yet
            </p>
            <p className="mt-1 text-sm text-vertex-muted">
              Save jobs while browsing to find them here later
            </p>
            <Link
              href="/match"
              className="glow-button mt-6 rounded-lg px-6 py-2.5 text-sm font-medium text-white"
            >
              Find Jobs
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-vertex-muted">
              No jobs match your search
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSourceFilter("");
              }}
              className="mt-2 text-sm font-medium transition-colors hover:underline"
              style={{ color: "#6366f1" }}
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtered.map((job) => (
              <div
                key={job.id}
                className="glass-card rounded-xl p-6 transition-all hover:border-indigo-500/30 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs"
                    style={{
                      background: "#1e1e3a",
                      color: "#94a3b8",
                      border: "1px solid #2a2a3d",
                    }}
                  >
                    {job.source || "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUnsave(job)}
                    className="rounded p-1.5 transition-colors hover:bg-white/10"
                    title="Click to unsave"
                    aria-label="Unsave job"
                  >
                    <Bookmark
                      className="h-4 w-4 fill-current"
                      style={{ color: "#6366f1" }}
                    />
                  </button>
                </div>
                <h2 className="mt-2 font-bold text-vertex-white">
                  {job.job_title}
                </h2>
                <p className="text-sm text-vertex-muted">{job.company}</p>
                {job.location && (
                  <p className="mt-0.5 text-xs text-vertex-muted">
                    📍 {job.location}
                  </p>
                )}
                {job.description && (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-vertex-muted">
                    {job.description}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-vertex-muted">
                    Saved {relativeTime(job.saved_at)}
                  </span>
                  <a
                    href={job.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ghost-button rounded-lg px-3 py-1.5 text-xs"
                  >
                    View Job
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!unsaveTarget}
        title="Unsave job"
        message="Remove this job from your saved list?"
        confirmText="Remove"
        confirmStyle="destructive"
        onConfirm={confirmUnsave}
        onCancel={() => setUnsaveTarget(null)}
      />
    </div>
  );
}

export default function SavedPage() {
  return (
    <ProtectedRoute requiredRole="jobseeker">
      <SavedContent />
    </ProtectedRoute>
  );
}
