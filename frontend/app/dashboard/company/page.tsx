"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Briefcase, Users, Clock, TrendingUp, Eye, MapPin, ChevronRight } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import {
  getCompanyProfile,
  getSearchHistory,
  getSentRequests,
  getCompanyAnalytics,
  getCompanyPostedJobs,
} from "@/lib/api";
import type {
  CompanyProfile,
  SearchHistoryItem,
  ContactRequest,
  PostedJob,
} from "@/types";

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

function today(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function CompanyDashboardContent() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [sentRequests, setSentRequests] = useState<ContactRequest[]>([]);
  const [profileComplete, setProfileComplete] = useState<number | null>(null);
  const [searchesChartData, setSearchesChartData] = useState<{ date: string; count: number }[]>([]);
  const [postedJobs, setPostedJobs] = useState<PostedJob[]>([]);

  useEffect(() => {
    if (user?.is_admin) router.push("/admin");
  }, [user?.is_admin, router]);

  if (user?.is_admin) return null;

  const loadData = useCallback(() => {
    if (token) {
      getCompanyProfile(token)
        .then((p) => setProfileComplete(profileCompleteness(p)))
        .catch(() => setProfileComplete(0));
      getSearchHistory(token)
        .then((data) => setSearchHistory(Array.isArray(data) ? data : []))
        .catch(() => setSearchHistory([]));
      getSentRequests(token)
        .then((data) => setSentRequests(Array.isArray(data) ? data : []))
        .catch(() => setSentRequests([]));
      getCompanyAnalytics(token)
        .then((d) => {
          const last7 = (d.searches_over_time || []).slice(-7);
          setSearchesChartData(last7);
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
    profileComplete !== null && profileComplete < 100
      ? `Profile ${profileComplete}% complete`
      : null;

  const kpis = useMemo(() => {
    const totalApplicants = postedJobs.reduce((s, j) => s + (j.applications_count ?? 0), 0);
    const openRoles = postedJobs.filter((j) => j.is_active).length;
    const pendingRequests = sentRequests.filter((r) => r.status === "pending").length;
    const searchesThisWeek = searchesChartData.reduce((s, d) => s + d.count, 0);
    return { totalApplicants, openRoles, pendingRequests, searchesThisWeek };
  }, [postedJobs, sentRequests, searchesChartData]);

  const pendingRequests = useMemo(
    () => sentRequests.filter((r) => r.status === "pending"),
    [sentRequests]
  );

  const activeJobs = useMemo(
    () => [...postedJobs].sort((a, b) => (b.applications_count ?? 0) - (a.applications_count ?? 0)),
    [postedJobs]
  );

  return (
    <div className="min-h-screen pb-16 pt-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">

        {/* ── Header ── */}
        <section className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs text-v-onSurfaceVariant">{today()}</p>
            <h1 className="font-headline text-2xl font-bold text-indigo-50">
              Welcome back, {displayName}
            </h1>
            {profileLabel && (
              <Link
                href="/company/profile"
                className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-amber-400 transition hover:text-amber-300"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                {profileLabel} — finish your profile
              </Link>
            )}
          </div>
          <Link
            href="/company/post-job"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-indigo-500 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Post a job
          </Link>
        </section>

        {/* ── KPI Strip ── */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: "Total applicants",
              value: kpis.totalApplicants,
              icon: Users,
              color: "text-indigo-400",
              bg: "bg-indigo-500/10",
              href: "/company/jobs",
            },
            {
              label: "Open positions",
              value: kpis.openRoles,
              icon: Briefcase,
              color: "text-emerald-400",
              bg: "bg-emerald-500/10",
              href: "/company/jobs",
            },
            {
              label: "Pending requests",
              value: kpis.pendingRequests,
              icon: Clock,
              color: "text-amber-400",
              bg: "bg-amber-500/10",
              href: "/company/requests",
            },
            {
              label: "Searches this week",
              value: kpis.searchesThisWeek,
              icon: TrendingUp,
              color: "text-sky-400",
              bg: "bg-sky-500/10",
              href: "/company/search",
            },
          ].map(({ label, value, icon: Icon, color, bg, href }) => (
            <Link
              key={label}
              href={href}
              className="glass-card group flex items-center gap-4 rounded-2xl p-5 transition hover:border-white/10 hover:bg-white/5"
            >
              <div className={`rounded-xl p-3 ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-v-onSurfaceVariant">{label}</p>
                <p className="text-2xl font-bold text-indigo-50">{value}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Main content: jobs table + pending requests ── */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Jobs table */}
          <div className="glass-card rounded-2xl lg:col-span-2">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <h2 className="font-semibold text-indigo-50">Active openings</h2>
              <Link href="/company/jobs" className="text-xs font-medium text-indigo-400 hover:underline">
                Manage all jobs
              </Link>
            </div>
            {activeJobs.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-center">
                <Briefcase className="h-10 w-10 text-v-onSurfaceVariant/40" />
                <p className="text-sm text-v-onSurfaceVariant">No jobs posted yet.</p>
                <Link
                  href="/company/post-job"
                  className="text-sm font-medium text-indigo-400 hover:underline"
                >
                  Post your first role →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {activeJobs.map((j) => (
                  <Link
                    key={j.id}
                    href={`/company/jobs/${j.id}/applicants`}
                    className="group flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-white/5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                            j.is_active ? "bg-emerald-400" : "bg-amber-400"
                          }`}
                        />
                        <p className="truncate text-sm font-semibold text-indigo-50">
                          {j.title}
                        </p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {j.location && (
                          <span className="flex items-center gap-1 text-xs text-v-onSurfaceVariant">
                            <MapPin className="h-3 w-3" />
                            {j.location}
                          </span>
                        )}
                        <span className="text-xs text-v-onSurfaceVariant capitalize">
                          {j.job_type?.replace("_", " ")}
                        </span>
                        <span className="text-xs text-v-onSurfaceVariant">
                          {j.experience_level}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-5 text-right">
                      <div className="hidden sm:block">
                        <p className="text-sm font-semibold text-indigo-50">
                          {j.applications_count ?? 0}
                        </p>
                        <p className="text-xs text-v-onSurfaceVariant">applicants</p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="flex items-center gap-1 text-sm font-semibold text-indigo-50">
                          <Eye className="h-3.5 w-3.5 text-v-onSurfaceVariant" />
                          {j.views_count ?? 0}
                        </p>
                        <p className="text-xs text-v-onSurfaceVariant">views</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          j.is_active
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {j.is_active ? "Live" : "Paused"}
                      </span>
                      <ChevronRight className="h-4 w-4 text-v-onSurfaceVariant transition group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Pending contact requests */}
          <div className="glass-card rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <h2 className="font-semibold text-indigo-50">Awaiting reply</h2>
              <Link href="/company/requests" className="text-xs font-medium text-indigo-400 hover:underline">
                All requests
              </Link>
            </div>
            {pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <Clock className="h-8 w-8 text-v-onSurfaceVariant/40" />
                <p className="text-sm text-v-onSurfaceVariant">No pending requests.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {pendingRequests.slice(0, 6).map((r) => (
                  <div key={r.id} className="px-6 py-4">
                    <p className="truncate text-sm font-medium text-indigo-50">
                      {r.candidate_name || "Candidate"}
                    </p>
                    {r.headline && (
                      <p className="truncate text-xs text-v-onSurfaceVariant">{r.headline}</p>
                    )}
                    <p className="mt-1 text-xs text-v-onSurfaceVariant/60">
                      {new Date(r.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                ))}
                {pendingRequests.length > 6 && (
                  <div className="px-6 py-3">
                    <Link href="/company/requests" className="text-xs font-medium text-indigo-400 hover:underline">
                      +{pendingRequests.length - 6} more →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Search activity chart ── */}
        <div className="glass-card rounded-2xl">
          <div className="border-b border-white/5 px-6 py-4">
            <h2 className="font-semibold text-indigo-50">Candidate search activity</h2>
            <p className="text-xs text-v-onSurfaceVariant">Searches performed over the last 7 days</p>
          </div>
          <div className="px-6 py-5">
            {searchesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={searchesChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="searchGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString("en-US", { weekday: "short" })
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1e1e3a",
                      border: "1px solid #2a2a3d",
                      borderRadius: 8,
                      color: "#e2e8f0",
                      fontSize: 12,
                    }}
                    labelFormatter={(v) =>
                      new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#6366f1"
                    fill="url(#searchGradient)"
                    strokeWidth={2}
                    dot={{ fill: "#6366f1", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-v-onSurfaceVariant">
                Run a candidate search to start tracking activity.
              </p>
            )}
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
