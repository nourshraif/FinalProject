"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Bookmark, Building2, ClipboardList, Target } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { getStats, getProfile, getApplications, getSavedJobs } from "@/lib/api";
import type { UserProfile, SavedJob } from "@/types";

function profileCompleteness(p: UserProfile | null): number {
  if (!p) return 0;
  let n = 0;
  if (p.full_name?.trim()) n += 15;
  if (p.headline?.trim()) n += 15;
  if (p.bio?.trim()) n += 20;
  if (p.location?.trim()) n += 10;
  if (p.linkedin_url?.trim()) n += 10;
  if ((p.skills ?? []).length >= 3) n += 20;
  if (p.cv_filename) n += 10;
  return n;
}

function JobseekerDashboardContent() {
  const { user, token } = useAuth();
  const [totalJobs, setTotalJobs] = useState<number | null>(null);
  const [profileComplete, setProfileComplete] = useState<number | null>(null);
  const [applicationsCount, setApplicationsCount] = useState<number | null>(null);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);

  const loadData = useCallback(() => {
    getStats()
      .then((s) => setTotalJobs(s.total_jobs))
      .catch(() => setTotalJobs(0));
    if (token) {
      getProfile(token)
        .then((p) => setProfileComplete(profileCompleteness(p)))
        .catch(() => setProfileComplete(0));
      getApplications(token)
        .then((list) => setApplicationsCount(list.length))
        .catch(() => setApplicationsCount(0));
      getSavedJobs(token)
        .then(setSavedJobs)
        .catch(() => setSavedJobs([]));
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const displayName = user?.full_name ?? "there";
  const profileLabel =
    profileComplete !== null ? `Profile ${profileComplete}%` : "Profile —";

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto max-w-[1100px] px-6">
        {/* Welcome banner */}
        <div className="glass-card mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl p-8">
          <div>
            <p className="text-sm text-vertex-muted">Job Seeker Dashboard</p>
            <h1 className="text-2xl font-bold text-vertex-white sm:text-3xl">
              Welcome back, {displayName} 👋
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-vertex-muted">
              Here&apos;s your job search overview
              {profileComplete !== null && (
                <Link
                  href="/profile"
                  className="font-medium transition-colors hover:text-vertex-white"
                  style={{ color: "#6366f1" }}
                >
                  {profileLabel}
                </Link>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/match"
              className="glow-button inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white"
            >
              <Briefcase className="h-4 w-4" />
              Find Jobs
            </Link>
            <Link
              href="/profile"
              className="ghost-button inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium"
            >
              Update CV
            </Link>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="glass-card relative rounded-2xl p-6">
            <Briefcase className="absolute right-4 top-4 h-5 w-5" style={{ color: "#6366f1" }} />
            <p className="text-xs text-vertex-muted">Jobs Available</p>
            <p className="mt-1 text-2xl font-bold text-vertex-white">
              {totalJobs === null ? "..." : totalJobs.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-vertex-muted">Across all job boards</p>
          </div>
          <div className="glass-card relative rounded-2xl p-6">
            <ClipboardList className="absolute right-4 top-4 h-5 w-5" style={{ color: "#6366f1" }} />
            <p className="text-xs text-vertex-muted">Applications Tracked</p>
            <p className="mt-1 text-2xl font-bold text-vertex-white">
              {applicationsCount === null ? "..." : applicationsCount}
            </p>
            <p className="mt-1 text-xs text-vertex-muted">In your tracker</p>
          </div>
          <div className="glass-card relative rounded-2xl p-6">
            <Target className="absolute right-4 top-4 h-5 w-5" style={{ color: "#6366f1" }} />
            <p className="text-xs text-vertex-muted">Avg Match Score</p>
            <p className="mt-1 text-2xl font-bold text-vertex-white">—</p>
            <p className="mt-1 text-xs text-vertex-muted">Upload CV to see matches</p>
          </div>
          <div className="glass-card relative rounded-2xl p-6">
            <Bookmark className="absolute right-4 top-4 h-5 w-5" style={{ color: "#6366f1" }} />
            <p className="text-xs text-vertex-muted">Saved Jobs</p>
            <p className="mt-1 text-2xl font-bold text-vertex-white">
              {savedJobs.length}
            </p>
            <p className="mt-1 text-xs text-vertex-muted">Bookmarked</p>
          </div>
        </div>

        {/* Action cards */}
        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          <div className="glass-card rounded-2xl p-8">
            <Briefcase className="mb-4 h-12 w-12" style={{ color: "#6366f1" }} />
            <h2 className="text-lg font-bold text-vertex-white">Find Matching Jobs</h2>
            <p className="mb-6 mt-1 text-sm text-vertex-muted">
              Upload your CV and get instantly matched to the best opportunities available
            </p>
            <Link
              href="/match"
              className="glow-button inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-white"
            >
              Go to Job Matcher
            </Link>
          </div>
          <div className="glass-card rounded-2xl p-8">
            <Building2 className="mb-4 h-12 w-12" style={{ color: "#6366f1" }} />
            <h2 className="text-lg font-bold text-vertex-white">Looking to hire?</h2>
            <p className="mb-6 mt-1 text-sm text-vertex-muted">
              Switch to our company portal to find candidates for your team
            </p>
            <Link
              href="/company/search"
              className="ghost-button inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium"
            >
              Company Portal
            </Link>
          </div>
        </div>
        <div className="mb-12">
          <div className="glass-card rounded-2xl p-8">
            <ClipboardList className="mb-4 h-12 w-12" style={{ color: "#6366f1" }} />
            <h2 className="text-lg font-bold text-vertex-white">Track Applications</h2>
            <p className="mb-6 mt-1 text-sm text-vertex-muted">
              Keep track of every job you apply to in one organized place
            </p>
            <Link
              href="/tracker"
              className="ghost-button inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium"
            >
              Open Tracker
            </Link>
          </div>
        </div>

        {/* Recently Saved */}
        <h2 className="mb-4 text-lg font-bold text-vertex-white">Recently Saved</h2>
        <div className="mb-8 flex flex-col gap-3">
          {savedJobs.length === 0 ? (
            <div className="glass-card rounded-xl p-6">
              <p className="text-sm text-vertex-muted">No saved jobs yet</p>
              <Link
                href="/match"
                className="mt-2 inline-block text-sm font-medium transition-colors hover:underline"
                style={{ color: "#6366f1" }}
              >
                Browse Jobs
              </Link>
            </div>
          ) : (
            savedJobs.slice(0, 3).map((job) => (
              <div
                key={job.id}
                className="glass-card flex flex-wrap items-center justify-between gap-2 rounded-xl p-4"
              >
                <div>
                  <p className="font-medium text-vertex-white">{job.job_title}</p>
                  <p className="text-sm text-vertex-muted">{job.company}</p>
                </div>
                <a
                  href={job.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ghost-button rounded-lg px-3 py-1.5 text-xs"
                >
                  View
                </a>
              </div>
            ))
          )}
        </div>

        {/* Tips */}
        <h2 className="mb-4 text-lg font-bold text-vertex-white">💡 Tips to get better matches</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="glass-card rounded-xl p-4">
            <p className="text-sm font-bold text-vertex-white">📄 Upload a detailed CV</p>
            <p className="mt-1 text-xs text-vertex-muted">The more detail, the better your matches</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-sm font-bold text-vertex-white">🔄 Check back daily</p>
            <p className="mt-1 text-xs text-vertex-muted">New jobs are added every single day</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-sm font-bold text-vertex-white">🎯 Be specific with skills</p>
            <p className="mt-1 text-xs text-vertex-muted">Specific skills get more precise matches</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JobseekerDashboardPage() {
  return (
    <ProtectedRoute requiredRole="jobseeker">
      <JobseekerDashboardContent />
    </ProtectedRoute>
  );
}
