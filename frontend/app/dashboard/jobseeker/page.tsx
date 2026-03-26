"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Bookmark, Bell, Building2, ClipboardList, Mail, Target } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  getStats,
  getProfile,
  getApplications,
  getSavedJobs,
  getReceivedRequests,
  respondToRequest,
  getJobseekerAnalytics,
  getAlertSettings,
} from "@/lib/api";
import type { UserProfile, SavedJob, ContactRequest } from "@/types";

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
  const { showToast } = useToast();
  const [totalJobs, setTotalJobs] = useState<number | null>(null);
  const [profileComplete, setProfileComplete] = useState<number | null>(null);
  const [applicationsCount, setApplicationsCount] = useState<number | null>(null);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [applicationsChartData, setApplicationsChartData] = useState<{ date: string; count: number }[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState<boolean | null>(null);

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
      getReceivedRequests(token)
        .then((list) => setContactRequests(Array.isArray(list) ? list : []))
        .catch(() => setContactRequests([]));
      getJobseekerAnalytics(token)
        .then((d) => {
          const overTime = d.applications_over_time || [];
          const last7 = overTime.slice(-7);
          setApplicationsChartData(last7.length > 0 ? last7 : []);
        })
        .catch(() => setApplicationsChartData([]));
      getAlertSettings(token)
        .then((s) => setAlertsEnabled(s.is_enabled ?? false))
        .catch(() => setAlertsEnabled(false));
    }
  }, [token]);

  const handleRespond = (requestId: number, status: "accepted" | "declined") => {
    if (!token) return;
    setRespondingId(requestId);
    respondToRequest(token, requestId, status)
      .then(() => {
        setContactRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status } : r))
        );
        showToast(status === "accepted" ? "Request accepted" : "Request declined", "success");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to update", "error"))
      .finally(() => setRespondingId(null));
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const displayName = user?.full_name ?? "there";
  const profileLabel =
    profileComplete !== null ? `Profile ${profileComplete}%` : "Profile —";

  return (
    <div className="min-h-screen pb-24 pt-28 md:pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Welcome banner */}
        <section className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="space-y-1">
            <p className="font-label text-xs font-medium uppercase tracking-widest text-v-primary">Overview</p>
            <h1 className="font-headline text-4xl font-extrabold tracking-tight text-indigo-50">
              Welcome back, {displayName}.
            </h1>
            <p className="mt-1 max-w-lg flex flex-wrap items-center gap-2 text-sm text-v-onSurfaceVariant">
              Here&apos;s your job search snapshot
              {profileComplete !== null && (
                <Link
                  href="/profile"
                  className="font-medium text-v-primary transition-colors hover:text-v-primaryContainer"
                >
                  {profileLabel}
                </Link>
              )}
              {alertsEnabled === true && (
                <span className="flex items-center gap-1.5 text-xs text-green-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  Alerts On
                </span>
              )}
              {alertsEnabled === false && (
                <span className="flex items-center gap-1.5 text-xs text-vertex-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-vertex-muted" />
                  Alerts Off
                  <Link
                    href="/settings/alerts"
                    className="font-medium text-indigo-400 hover:underline"
                  >
                    Enable
                  </Link>
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="glass-card flex items-center gap-3 rounded-full px-6 py-3">
              <span className="font-label text-xs font-bold uppercase tracking-tighter text-slate-400">
                Profile strength
              </span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-v-surfaceContainerHighest">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-v-primary to-v-primaryContainer"
                  style={{ width: `${profileComplete ?? 0}%` }}
                />
              </div>
              <span className="font-bold text-indigo-300">
                {profileComplete !== null ? `${profileComplete}%` : "—"}
              </span>
            </div>
            <Link
              href="/match"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-v-primary to-v-primaryContainer px-6 py-3 font-label text-sm font-bold uppercase tracking-wider text-v-onPrimaryFixed shadow-lg shadow-v-primary/20 transition-all hover:shadow-v-primary/40"
            >
              <Briefcase className="h-4 w-4" />
              Find Jobs
            </Link>
            <Link
              href="/profile"
              className="glass-card inline-flex items-center justify-center gap-2 rounded-full border border-v-outlineVariant/30 px-6 py-3 font-label text-sm font-semibold text-v-onSurface transition-colors hover:bg-white/5"
            >
              Update CV
            </Link>
          </div>
        </section>

        {/* Stat cards: 2 cols on mobile, 4 on lg */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="glass-card relative rounded-2xl p-6">
            <Mail className="absolute right-4 top-4 h-5 w-5" style={{ color: "#6366f1" }} />
            <p className="text-xs text-vertex-muted">Companies Interested</p>
            <p className="mt-1 text-2xl font-bold text-vertex-white">
              {contactRequests.filter((r) => r.status === "pending").length}
            </p>
            <p className="mt-1 text-xs text-vertex-muted">Pending requests</p>
          </div>
        </div>

        {/* Action cards: single column on mobile */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <div className="glass-card rounded-2xl p-8">
            <Bell className="mb-4 h-12 w-12" style={{ color: "#6366f1" }} />
            <h2 className="text-lg font-bold text-vertex-white">Job Alerts</h2>
            <p className="mb-6 mt-1 text-sm text-vertex-muted">
              Get notified when new jobs matching your skills are posted
            </p>
            <Link
              href="/settings/alerts"
              className="glow-button inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-white"
            >
              Configure Alerts
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

        {/* Contact requests preview */}
        {contactRequests.filter((r) => r.status === "pending").length > 0 && (
          <>
            <h2 className="mb-4 text-lg font-bold text-vertex-white">
              Pending Contact Requests
            </h2>
            <div className="mb-8 flex flex-col gap-3">
              {contactRequests
                .filter((r) => r.status === "pending")
                .slice(0, 2)
                .map((r) => {
                  const companyName =
                    r.company_name || r.contact_name || "A company";
                  return (
                    <div
                      key={r.id}
                      className="glass-card flex flex-wrap items-center justify-between gap-2 rounded-xl p-4"
                    >
                      <p className="font-medium text-vertex-white">
                        {companyName} wants to connect
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRespond(r.id, "accepted")}
                          disabled={respondingId === r.id}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-green-500 transition-colors hover:bg-green-500/10 disabled:opacity-60"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespond(r.id, "declined")}
                          disabled={respondingId === r.id}
                          className="ghost-button rounded-lg px-3 py-1.5 text-xs"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              <Link
                href="/requests"
                className="text-sm font-medium transition-colors hover:underline"
                style={{ color: "#6366f1" }}
              >
                View All Requests →
              </Link>
            </div>
          </>
        )}

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

        {/* Mini analytics preview */}
        <div className="glass-card mt-8 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-vertex-white">Your Activity</h2>
            <Link
              href="/analytics"
              className="text-sm font-medium text-vertex-purple hover:underline"
            >
              View Full Analytics →
            </Link>
          </div>
          {applicationsChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={100} className="mt-4">
              <AreaChart data={applicationsChartData}>
                <defs>
                  <linearGradient id="miniJobseeker" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#6366f1"
                  fill="url(#miniJobseeker)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-4 text-sm text-vertex-muted">Last 7 days application activity — add applications to see your chart.</p>
          )}
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
