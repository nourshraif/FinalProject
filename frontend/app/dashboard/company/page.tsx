"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Users, Search, Bookmark, Eye } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  getCandidateCount,
  getCompanyProfile,
  getSavedCandidates,
  getSearchHistory,
  getSentRequests,
  getCompanyAnalytics,
  getCompanyPostedJobs,
} from "@/lib/api";
import type {
  CompanyProfile,
  SavedCandidate,
  SearchHistoryItem,
  ContactRequest,
  PostedJob,
} from "@/types";

function getInitials(fullName: string): string {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (fullName || "?").slice(0, 2).toUpperCase();
}

function profileCompleteness(p: CompanyProfile | null): number {
  if (!p) return 0;
  let n = 0;
  if (p.company_name?.trim()) n += 25;
  if (p.industry?.trim()) n += 20;
  if (p.company_size?.trim()) n += 15;
  if (p.website?.trim()) n += 15;
  if (p.description?.trim()) n += 25;
  return n;
}

function CompanyDashboardContent() {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [candidateCount, setCandidateCount] = useState<number | null>(null);
  const [savedCandidates, setSavedCandidates] = useState<SavedCandidate[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [sentRequests, setSentRequests] = useState<ContactRequest[]>([]);
  const [profileComplete, setProfileComplete] = useState<number | null>(null);
  const [quickSearchQuery, setQuickSearchQuery] = useState("");
  const [searchesChartData, setSearchesChartData] = useState<{ date: string; count: number }[]>([]);
  const [postedJobs, setPostedJobs] = useState<PostedJob[]>([]);

  const loadData = useCallback(() => {
    getCandidateCount()
      .then(setCandidateCount)
      .catch(() => setCandidateCount(0));
    if (token) {
      getCompanyProfile(token)
        .then((p) => setProfileComplete(profileCompleteness(p)))
        .catch(() => setProfileComplete(0));
      getSavedCandidates(token)
        .then((data) => setSavedCandidates(Array.isArray(data) ? data : []))
        .catch((e) => {
          setSavedCandidates([]);
          showToast(e instanceof Error ? e.message : "Failed to load saved candidates", "error");
        });
      getSearchHistory(token)
        .then((data) => setSearchHistory(Array.isArray(data) ? data : []))
        .catch((e) => {
          setSearchHistory([]);
          showToast(e instanceof Error ? e.message : "Failed to load search history", "error");
        });
      getSentRequests(token)
        .then((data) => setSentRequests(Array.isArray(data) ? data : []))
        .catch(() => setSentRequests([]));
      getCompanyAnalytics(token)
        .then((d) => {
          const overTime = d.searches_over_time || [];
          const last7 = overTime.slice(-7);
          setSearchesChartData(last7.length > 0 ? last7 : []);
        })
        .catch(() => setSearchesChartData([]));
      getCompanyPostedJobs(token)
        .then((list) => setPostedJobs(Array.isArray(list) ? list : []))
        .catch(() => setPostedJobs([]));
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const displayName = user?.full_name ?? "there";
  const profileLabel =
    profileComplete !== null ? `Profile ${profileComplete}% complete` : "";

  function handleQuickSearch() {
    const q = encodeURIComponent(quickSearchQuery.trim());
    router.push(`/company/search${q ? `?q=${q}` : ""}`);
  }

  const pipeline = useMemo(() => {
    const applied = postedJobs.reduce((s, j) => s + (j.applications_count ?? 0), 0);
    const interview = sentRequests.filter((r) => r.status === "pending").length;
    const technical = searchHistory.length;
    const offered = postedJobs.filter((j) => j.is_active).length;
    const values = [applied, interview, technical, offered];
    const max = Math.max(...values, 1);
    const pct = (n: number) => Math.min(100, Math.round((n / max) * 100));
    return [
      { label: "Applied", value: applied, barClass: "bg-v-primary", width: pct(applied) },
      { label: "Interview", value: interview, barClass: "bg-v-tertiary", width: pct(interview) },
      { label: "Technical", value: technical, barClass: "bg-v-secondary", width: pct(technical) },
      {
        label: "Open roles",
        value: offered,
        barClass: "bg-v-primaryContainer",
        width: pct(offered),
      },
    ];
  }, [postedJobs, sentRequests, searchHistory]);

  return (
    <div className="min-h-screen pb-12 pt-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Welcome banner */}
        <section className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="space-y-1">
            <p className="font-label text-xs font-medium uppercase tracking-widest text-v-onSurfaceVariant">
              Enterprise
            </p>
            <h1 className="font-headline text-4xl font-extrabold tracking-tight text-indigo-50">
              Welcome, {displayName}.
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-v-onSurfaceVariant">
              Talent pipeline and posted roles at a glance
              {profileLabel && (
                <Link
                  href="/company/profile"
                  className="font-medium text-v-primary transition-colors hover:text-v-primaryContainer"
                >
                  {profileLabel}
                </Link>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <div className="hidden text-right md:block">
              <p className="font-label text-xs uppercase tracking-widest text-v-onSurfaceVariant">Talent pool</p>
              <p className="text-sm font-semibold text-indigo-100">
                {candidateCount === null ? "—" : candidateCount.toLocaleString()} candidates
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/company/search"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-v-primary to-v-primaryContainer px-6 py-3 font-label text-sm font-bold uppercase tracking-wider text-v-onPrimaryContainer shadow-lg shadow-v-primary/20 transition hover:scale-[1.02] active:scale-95"
              >
                <Search className="h-4 w-4" />
                Search
              </Link>
              <Link
                href="/company/profile"
                className="glass-card inline-flex items-center justify-center gap-2 rounded-full border border-v-outlineVariant/20 px-6 py-3 font-label text-sm font-semibold text-v-onSurface transition hover:bg-white/5"
              >
                Edit Profile
              </Link>
              <Link
                href="/company/admin"
                className="glass-card inline-flex items-center justify-center gap-2 rounded-full border border-v-outlineVariant/20 px-6 py-3 font-label text-sm font-semibold text-v-onSurface transition hover:bg-white/5"
              >
                Talent pool
              </Link>
            </div>
          </div>
        </section>

        {/* Stitch: hero search */}
        <section className="relative mb-12 overflow-hidden rounded-full bg-gradient-to-r from-v-primary/10 via-v-surfaceContainerHighest to-v-primary/10 p-1">
          <div className="glass-panel flex flex-col items-center gap-6 rounded-full px-6 py-4 md:flex-row md:px-8">
            <div className="flex w-full flex-1 items-center gap-4">
              <span className="material-symbols-outlined text-2xl text-v-primary" aria-hidden>
                search
              </span>
              <input
                type="search"
                placeholder="Search by skills, roles, or keywords (e.g. React developer with AI experience)"
                className="w-full border-0 bg-transparent font-medium text-v-onSurface placeholder:text-v-onSurfaceVariant/50 focus:outline-none focus:ring-0"
                value={quickSearchQuery}
                onChange={(e) => setQuickSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuickSearch()}
              />
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto">
              <Link
                href="/company/search"
                className="flex items-center justify-center gap-2 rounded-full border border-v-outlineVariant/20 px-6 py-2 font-label text-sm font-semibold uppercase tracking-wider text-v-onSurfaceVariant transition hover:bg-white/5"
              >
                <span className="material-symbols-outlined text-sm">tune</span>
                Filters
              </Link>
              <button
                type="button"
                onClick={handleQuickSearch}
                className="rounded-full bg-gradient-to-br from-v-primary to-v-primaryContainer px-8 py-2 font-label font-bold uppercase tracking-widest text-v-onPrimaryContainer shadow-lg shadow-v-primary/20 transition hover:scale-105 active:scale-95"
              >
                Execute match
              </button>
            </div>
          </div>
        </section>

        {/* Stitch: bento — pipeline + posted jobs */}
        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className="relative overflow-hidden rounded-[2rem] md:col-span-8">
            <div className="glass-panel relative rounded-[2rem] p-8">
              <div className="aurora-glow pointer-events-none absolute inset-0 -z-10 opacity-80" />
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <h2 className="font-headline text-2xl font-bold text-indigo-50">Talent pipeline</h2>
                  <p className="text-sm text-v-onSurfaceVariant">Activity across your open roles and outreach</p>
                </div>
                <span className="material-symbols-outlined rounded-xl bg-v-primary/10 p-2 text-v-primaryFixedDim">
                  monitoring
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {pipeline.map((row) => (
                  <div
                    key={row.label}
                    className="rounded-[2rem] border border-v-outlineVariant/10 bg-v-surfaceContainerLowest/40 p-5"
                  >
                    <p className="mb-1 font-label text-xs uppercase tracking-widest text-v-onSurfaceVariant">
                      {row.label}
                    </p>
                    <p className="font-headline text-3xl font-bold text-indigo-200">{row.value}</p>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-v-surfaceContainerHighest">
                      <div className={`h-full ${row.barClass}`} style={{ width: `${row.width}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-[2rem] p-8 md:col-span-4">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-headline text-lg font-bold text-indigo-50">Posted jobs</h3>
              <Link href="/company/jobs" className="font-label text-xs font-bold uppercase tracking-wider text-v-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="space-y-4">
              {postedJobs.length === 0 ? (
                <p className="text-sm text-v-onSurfaceVariant">No jobs yet. Post a role to see it here.</p>
              ) : (
                postedJobs.slice(0, 5).map((j) => (
                  <Link
                    key={j.id}
                    href={`/jobs/${j.id}`}
                    className="group flex cursor-pointer items-center justify-between rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 shrink-0 rounded-full ${j.is_active ? "bg-emerald-400" : "bg-amber-400"}`}
                      />
                      <div>
                        <p className="text-sm font-semibold text-v-onSurface">{j.title}</p>
                        <p className="text-xs text-v-onSurfaceVariant">
                          {j.applications_count ?? 0} applicants · {j.is_active ? "Live" : "Paused"}
                        </p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-v-onSurfaceVariant transition group-hover:translate-x-0.5">
                      chevron_right
                    </span>
                  </Link>
                ))
              )}
            </div>
            <Link
              href="/company/post-job"
              className="mt-6 block w-full rounded-full border border-v-primary/20 py-2 text-center font-label text-xs font-bold uppercase tracking-widest text-v-primary transition hover:bg-v-primary/5"
            >
              Post a vacancy
            </Link>
          </div>
        </div>

        {/* Recent sent requests */}
        {sentRequests.length > 0 && (
          <>
            <h2 className="mb-4 text-lg font-bold text-vertex-white">
              Recent Contact Requests
            </h2>
            <div className="mb-8 flex flex-col gap-3">
              {sentRequests.slice(0, 2).map((r) => (
                <div
                  key={r.id}
                  className="glass-card flex flex-wrap items-center justify-between gap-2 rounded-xl p-4"
                >
                  <div>
                    <p className="font-medium text-vertex-white">
                      {r.candidate_name || "Candidate"}
                    </p>
                    <span
                      className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={
                        r.status === "pending"
                          ? {
                              background: "rgba(245,158,11,0.2)",
                              color: "#f59e0b",
                            }
                          : r.status === "accepted"
                            ? {
                                background: "rgba(34,197,94,0.2)",
                                color: "#22c55e",
                              }
                            : {
                                background: "rgba(239,68,68,0.2)",
                                color: "#ef4444",
                              }
                      }
                    >
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
              <Link
                href="/company/requests"
                className="text-sm font-medium transition-colors hover:underline"
                style={{ color: "#6366f1" }}
              >
                View All Requests →
              </Link>
            </div>
          </>
        )}

        {/* Recently saved candidates */}
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-vertex-white">
            Recently Saved Candidates
          </h2>
          {savedCandidates.length === 0 ? (
            <p className="text-sm text-vertex-muted">
              No saved candidates yet.{" "}
              <Link
                href="/company/search"
                className="font-medium transition-colors hover:text-vertex-white"
                style={{ color: "#6366f1" }}
              >
                Search Candidates
              </Link>
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {savedCandidates.slice(0, 3).map((c) => (
                <div
                  key={c.id}
                  className="glass-card flex items-center gap-3 rounded-xl p-4"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white"
                    aria-hidden
                  >
                    {getInitials(c.full_name ?? "")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-vertex-white truncate">
                      {c.full_name ?? "—"}
                    </p>
                    {c.headline && (
                      <p className="truncate text-xs text-vertex-muted">
                        {c.headline}
                      </p>
                    )}
                    <Link
                      href="/company/saved"
                      className="mt-1 text-xs font-medium transition-colors hover:underline"
                      style={{ color: "#6366f1" }}
                    >
                      View Notes
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent searches */}
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-vertex-white">
            Recent Searches
          </h2>
          {searchHistory.length === 0 ? (
            <p className="text-sm text-vertex-muted">No searches yet</p>
          ) : (
            <div className="space-y-2">
              {searchHistory.slice(0, 3).map((item) => {
                const skills = Array.isArray(item.required_skills)
                  ? item.required_skills
                  : [];
                return (
                  <div
                    key={item.id}
                    className="glass-card flex flex-wrap items-center justify-between gap-2 rounded-xl p-3"
                  >
                    <div className="flex flex-wrap gap-1">
                      {skills.slice(0, 5).map((s) => (
                        <span
                          key={s}
                          className="rounded-full px-2 py-0.5 text-xs"
                          style={{
                            background: "#1e1e3a",
                            color: "#94a3b8",
                            border: "1px solid #2a2a3d",
                          }}
                        >
                          {s}
                        </span>
                      ))}
                      {skills.length > 5 && (
                        <span className="text-xs text-vertex-muted">
                          +{skills.length - 5}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-vertex-muted">
                      {item.results_count ?? 0} result(s)
                    </span>
                    <Link
                      href="/company/search"
                      onClick={() => {
                        if (typeof localStorage !== "undefined") {
                          localStorage.setItem(
                            "vertex_rerun_skills",
                            JSON.stringify(skills)
                          );
                        }
                      }}
                      className="text-xs font-medium transition-colors hover:underline"
                      style={{ color: "#6366f1" }}
                    >
                      Rerun
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="glass-card rounded-2xl p-8">
            <Users className="mb-4 h-12 w-12" style={{ color: "#6366f1" }} />
            <h2 className="text-lg font-bold text-vertex-white">Search Candidates</h2>
            <p className="mb-6 mt-1 text-sm text-vertex-muted">
              Enter the skills you need and our AI finds the best matching candidates instantly
            </p>
            <Link
              href="/company/search"
              className="glow-button inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-white"
              style={{ background: "#6366f1" }}
            >
              Search Now
            </Link>
          </div>
          <div className="glass-card rounded-2xl p-8">
            <Eye className="mb-4 h-12 w-12" style={{ color: "#6366f1" }} />
            <h2 className="text-lg font-bold text-vertex-white">Browse Talent Pool</h2>
            <p className="mb-6 mt-1 text-sm text-vertex-muted">
              See all professionals who have uploaded their CVs and are open to opportunities
            </p>
            <Link
              href="/company/admin"
              className="ghost-button inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium"
            >
              Browse All
            </Link>
          </div>
        </div>
        {/* Mini analytics preview */}
        <div className="glass-card mb-12 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-vertex-white">Your Activity</h2>
            <Link
              href="/analytics"
              className="text-sm font-medium text-vertex-purple hover:underline"
            >
              View Full Analytics →
            </Link>
          </div>
          {searchesChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={100} className="mt-4">
              <AreaChart data={searchesChartData}>
                <defs>
                  <linearGradient id="miniCompany" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#06b6d4"
                  fill="url(#miniCompany)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-4 text-sm text-vertex-muted">Last 7 days search activity — run searches to see your chart.</p>
          )}
        </div>
        <div className="mb-12">
          <div className="glass-card rounded-2xl p-8">
            <Building2 className="mb-4 h-12 w-12" style={{ color: "#6366f1" }} />
            <h2 className="text-lg font-bold text-vertex-white">Company Profile</h2>
            <p className="mb-6 mt-1 text-sm text-vertex-muted">
              Complete your profile so candidates know who you are and what you stand for
            </p>
            <Link
              href="/company/profile"
              className="ghost-button inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium"
            >
              Edit Profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompanyDashboardPage() {
  return (
    <ProtectedRoute requiredRole="company">
      <CompanyDashboardContent />
    </ProtectedRoute>
  );
}
