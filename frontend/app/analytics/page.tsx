"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PlanGate } from "@/components/PlanGate";
import {
  getJobseekerAnalytics,
  getCompanyAnalytics,
  type JobseekerAnalytics,
  type CompanyAnalytics,
} from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  ClipboardList,
  TrendingUp,
  Award,
  Mail,
  Bookmark,
  Search,
  Users,
  Send,
  CheckCircle,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  applied: "#6366f1",
  interviewing: "#f59e0b",
  offer: "#22c55e",
  rejected: "#ef4444",
};

const EMPTY_COMPANY_ANALYTICS: CompanyAnalytics = {
  applications_by_status: {
    applied: 0,
    reviewing: 0,
    interviewing: 0,
    offer: 0,
    rejected: 0,
    withdrawn: 0,
  },
  applications_over_time: [],
  total_applications: 0,
  total_job_views: 0,
  active_jobs: 0,
  application_rate: 0,
  interview_rate: 0,
  offer_rate: 0,
  top_jobs: [],
  includes_outreach_analytics: false,
  searches_over_time: [],
  top_searched_skills: [],
  saved_candidates_count: 0,
  contact_requests_sent: 0,
  contact_requests_accepted: 0,
  avg_results_per_search: 0,
  total_searches: 0,
};

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmtPct(value: unknown): string {
  return toNumber(value).toFixed(1);
}

function normalizeCompanyAnalytics(
  data: Partial<CompanyAnalytics> | null | undefined
): CompanyAnalytics {
  const status = data?.applications_by_status;
  return {
    ...EMPTY_COMPANY_ANALYTICS,
    ...data,
    applications_by_status: {
      applied: toNumber(status?.applied),
      reviewing: toNumber(status?.reviewing),
      interviewing: toNumber(status?.interviewing),
      offer: toNumber(status?.offer),
      rejected: toNumber(status?.rejected),
      withdrawn: toNumber(status?.withdrawn),
    },
    applications_over_time: Array.isArray(data?.applications_over_time)
      ? data!.applications_over_time
      : [],
    total_applications: toNumber(data?.total_applications),
    total_job_views: toNumber(data?.total_job_views),
    active_jobs: toNumber(data?.active_jobs),
    application_rate: toNumber(data?.application_rate),
    interview_rate: toNumber(data?.interview_rate),
    offer_rate: toNumber(data?.offer_rate),
    top_jobs: Array.isArray(data?.top_jobs)
      ? data!.top_jobs.map((job) => ({
          posted_job_id: toNumber(job.posted_job_id),
          job_title: job.job_title || "Untitled role",
          applications_count: toNumber(job.applications_count),
          views_count: toNumber(job.views_count),
          conversion_rate: toNumber(job.conversion_rate),
        }))
      : [],
    includes_outreach_analytics: Boolean(data?.includes_outreach_analytics),
    searches_over_time: Array.isArray(data?.searches_over_time)
      ? data!.searches_over_time
      : [],
    top_searched_skills: Array.isArray(data?.top_searched_skills)
      ? data!.top_searched_skills
      : [],
    saved_candidates_count: toNumber(data?.saved_candidates_count),
    contact_requests_sent: toNumber(data?.contact_requests_sent),
    contact_requests_accepted: toNumber(data?.contact_requests_accepted),
    avg_results_per_search: toNumber(data?.avg_results_per_search),
    total_searches: toNumber(data?.total_searches),
  };
}

function JobseekerAnalyticsView({ data }: { data: JobseekerAnalytics }) {
  const totalApps =
    data.applications_by_status.applied +
    data.applications_by_status.interviewing +
    data.applications_by_status.offer +
    data.applications_by_status.rejected;
  const interviewRate =
    totalApps > 0
      ? ((data.applications_by_status.interviewing + data.applications_by_status.offer) / totalApps) * 100
      : 0;
  const offerRate =
    totalApps > 0
      ? (data.applications_by_status.offer / totalApps) * 100
      : 0;
  const responseRate =
    data.contact_requests_received > 0
      ? (data.contact_requests_accepted / data.contact_requests_received) * 100
      : 0;

  const pieData = [
    { name: "Applied", value: data.applications_by_status.applied, color: STATUS_COLORS.applied },
    { name: "Interviewing", value: data.applications_by_status.interviewing, color: STATUS_COLORS.interviewing },
    { name: "Offer", value: data.applications_by_status.offer, color: STATUS_COLORS.offer },
    { name: "Rejected", value: data.applications_by_status.rejected, color: STATUS_COLORS.rejected },
  ].filter((d) => d.value > 0);

  const maxCompanyCount = Math.max(
    ...data.top_companies_applied.map((c) => c.count),
    1
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "#6366f1" }}>
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Total Applications</p>
            <p className="text-xl font-bold text-white">{totalApps}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
            style={{
              background:
                interviewRate > 20 ? "#22c55e" : interviewRate > 10 ? "#f59e0b" : "#ef4444",
            }}
          >
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Interview Rate</p>
            <p className="text-xl font-bold text-white">{interviewRate.toFixed(1)}%</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Offer Rate</p>
            <p className="text-xl font-bold text-white">{offerRate.toFixed(1)}%</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "#6366f1" }}>
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Response Rate</p>
            <p className="text-xl font-bold text-white">{responseRate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="glass-card rounded-xl p-6 lg:col-span-3">
          <h3 className="text-lg font-bold text-white">Applications Over Time</h3>
          <p className="text-xs text-vertex-muted">Last 30 days</p>
          {data.applications_over_time.length > 0 ? (
            <ResponsiveContainer width="100%" height={250} className="mt-4">
              <AreaChart data={data.applications_over_time}>
                <defs>
                  <linearGradient id="jobseekerArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,15,25,0.9)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                  formatter={(value: number) => [value, "Applications"]}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#6366f1"
                  fill="url(#jobseekerArea)"
                  strokeWidth={2}
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-8 text-center text-sm text-vertex-muted">
              No applications in the last 30 days
            </p>
          )}
        </div>
        <div className="glass-card rounded-xl p-6 lg:col-span-2">
          <h3 className="text-lg font-bold text-white">Status Breakdown</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250} className="mt-4">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15,15,25,0.9)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number, name: string) => {
                      const pct = totalApps > 0 ? ((value / totalApps) * 100).toFixed(1) : "0";
                      return [`${value} (${pct}%)`, name];
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </>
          ) : (
            <p className="mt-8 text-center text-sm text-vertex-muted">
              No applications yet
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-bold text-white">Top Companies Applied</h3>
          {data.top_companies_applied.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {data.top_companies_applied.map((c, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-white">
                    {c.company}
                  </span>
                  <div className="h-2 flex-1 min-w-[60px] max-w-[120px] overflow-hidden rounded bg-white/10">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${(c.count / maxCompanyCount) * 100}%`,
                        background: "#6366f1",
                      }}
                    />
                  </div>
                  <span className="text-xs text-vertex-muted w-6 text-right">{c.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-vertex-muted">No applications yet</p>
          )}
        </div>
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-bold text-white">Profile Summary</h3>
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-vertex-muted">Skills on Profile</span>
                <span className="font-medium text-white">{data.skills_count} / 50</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded bg-white/10">
                <div
                  className="h-full rounded bg-indigo-500"
                  style={{ width: `${Math.min(100, (data.skills_count / 50) * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-vertex-muted">Profile Completeness</span>
                <span className="font-medium text-white">{data.profile_completeness}%</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded bg-white/10">
                <div
                  className="h-full rounded bg-indigo-500"
                  style={{ width: `${data.profile_completeness}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-vertex-muted">Saved Jobs</span>
              <span className="flex items-center gap-1 font-medium text-white">
                <Bookmark className="h-4 w-4" />
                {data.saved_jobs_count}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-vertex-muted">Contact Requests</span>
              <span className="font-medium text-white">
                {data.contact_requests_received} received → {data.contact_requests_accepted} accepted
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const PIPELINE_COLORS: Record<string, string> = {
  applied: "#6366f1",
  reviewing: "#8b5cf6",
  interviewing: "#f59e0b",
  offer: "#22c55e",
  rejected: "#ef4444",
  withdrawn: "#64748b",
};

function CompanyHiringAnalyticsSection({ data }: { data: CompanyAnalytics }) {
  const status = data.applications_by_status;
  const pipelineTotal =
    status.applied +
    status.reviewing +
    status.interviewing +
    status.offer +
    status.rejected;

  const pieData = [
    { name: "Applied", value: status.applied, color: PIPELINE_COLORS.applied },
    { name: "Reviewing", value: status.reviewing, color: PIPELINE_COLORS.reviewing },
    { name: "Interviewing", value: status.interviewing, color: PIPELINE_COLORS.interviewing },
    { name: "Offer", value: status.offer, color: PIPELINE_COLORS.offer },
    { name: "Rejected", value: status.rejected, color: PIPELINE_COLORS.rejected },
  ].filter((d) => d.value > 0);

  return (
    <>
      <div className="mb-2">
        <h2 className="text-lg font-bold text-white">Hiring funnel</h2>
        <p className="text-xs text-vertex-muted">
          Performance across your job postings and applicant pipeline
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Total applicants</p>
            <p className="text-xl font-bold text-white">{data.total_applications}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-600 text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">View → apply rate</p>
            <p className="text-xl font-bold text-white">{fmtPct(data.application_rate)}%</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Interview rate</p>
            <p className="text-xl font-bold text-white">{fmtPct(data.interview_rate)}%</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Offer rate</p>
            <p className="text-xl font-bold text-white">{fmtPct(data.offer_rate)}%</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="glass-card rounded-xl p-6 lg:col-span-3">
          <h3 className="text-lg font-bold text-white">Applications over time</h3>
          <p className="text-xs text-vertex-muted">Last 30 days</p>
          {data.applications_over_time.length > 0 ? (
            <ResponsiveContainer width="100%" height={250} className="mt-4">
              <AreaChart data={data.applications_over_time}>
                <defs>
                  <linearGradient id="hiringArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,15,25,0.9)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [value, "Applications"]}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#6366f1"
                  fill="url(#hiringArea)"
                  strokeWidth={2}
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-8 text-center text-sm text-vertex-muted">
              No applications in the last 30 days
            </p>
          )}
        </div>

        <div className="glass-card rounded-xl p-6 lg:col-span-2">
          <h3 className="text-lg font-bold text-white">Pipeline breakdown</h3>
          <p className="text-xs text-vertex-muted">{pipelineTotal} active in pipeline</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250} className="mt-4">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,15,25,0.9)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-8 text-center text-sm text-vertex-muted">
              Post a job to start receiving applicants
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 glass-card rounded-xl p-6">
        <h3 className="text-lg font-bold text-white">Top performing jobs</h3>
        <p className="text-xs text-vertex-muted">
          {data.active_jobs} active posting{data.active_jobs === 1 ? "" : "s"} ·{" "}
          {data.total_job_views.toLocaleString()} total views
        </p>
        {data.top_jobs.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-vertex-muted">
                  <th className="pb-3 pr-4 font-medium">Role</th>
                  <th className="pb-3 pr-4 font-medium text-right">Views</th>
                  <th className="pb-3 pr-4 font-medium text-right">Applicants</th>
                  <th className="pb-3 font-medium text-right">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {data.top_jobs.map((job) => (
                  <tr key={job.posted_job_id} className="border-b border-white/5">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/company/jobs/${job.posted_job_id}/applicants`}
                        className="font-medium text-white hover:text-indigo-300"
                      >
                        {job.job_title}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-right text-vertex-muted">
                      {job.views_count}
                    </td>
                    <td className="py-3 pr-4 text-right text-white">
                      {job.applications_count}
                    </td>
                    <td className="py-3 text-right text-indigo-300">
                      {fmtPct(job.conversion_rate)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-vertex-muted">
            No job postings yet —{" "}
            <Link href="/company/post-job" className="text-indigo-400 hover:underline">
              post your first role
            </Link>
          </p>
        )}
      </div>
    </>
  );
}

function CompanyOutreachAnalyticsSection({ data }: { data: CompanyAnalytics }) {
  const connectionRate =
    data.contact_requests_sent > 0
      ? (data.contact_requests_accepted / data.contact_requests_sent) * 100
      : 0;
  const declined = data.contact_requests_sent - data.contact_requests_accepted;
  const maxSent = Math.max(data.contact_requests_sent, 1);

  return (
    <>
      <div className="mb-2 mt-10 border-t border-white/10 pt-10">
        <h2 className="text-lg font-bold text-white">Recruiting outreach</h2>
        <p className="text-xs text-vertex-muted">
          Candidate search, saved talent pool, and contact request performance
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-600 text-white">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Total searches</p>
            <p className="text-xl font-bold text-white">{data.total_searches}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-600 text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Avg results per search</p>
            <p className="text-xl font-bold text-white">{data.avg_results_per_search}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Bookmark className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Candidates saved</p>
            <p className="text-xl font-bold text-white">{data.saved_candidates_count}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Connection rate</p>
            <p className="text-xl font-bold text-white">{connectionRate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="glass-card rounded-xl p-6 lg:col-span-3">
          <h3 className="text-lg font-bold text-white">Searches over time</h3>
          <p className="text-xs text-vertex-muted">Last 30 days</p>
          {data.searches_over_time.length > 0 ? (
            <ResponsiveContainer width="100%" height={250} className="mt-4">
              <AreaChart data={data.searches_over_time}>
                <defs>
                  <linearGradient id="companyArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,15,25,0.9)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [value, "Searches"]}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#06b6d4"
                  fill="url(#companyArea)"
                  strokeWidth={2}
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-8 text-center text-sm text-vertex-muted">
              No searches in the last 30 days
            </p>
          )}
        </div>
        <div className="glass-card rounded-xl p-6 lg:col-span-2">
          <h3 className="text-lg font-bold text-white">Most searched skills</h3>
          {data.top_searched_skills.length > 0 ? (
            <ResponsiveContainer width="100%" height={250} className="mt-4">
              <BarChart
                data={[...data.top_searched_skills].reverse()}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="skill"
                  width={80}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,15,25,0.9)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [value, "Searches"]}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-8 text-center text-sm text-vertex-muted">
              No search history yet
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-bold text-white">Outreach funnel</h3>
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-vertex-muted">Sent</span>
                <span className="text-white">{data.contact_requests_sent}</span>
              </div>
              <div className="mt-1 h-8 w-full overflow-hidden rounded bg-white/10">
                <div className="h-full rounded bg-indigo-500" style={{ width: "100%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-vertex-muted">Accepted</span>
                <span className="text-white">
                  {data.contact_requests_accepted} (
                  {data.contact_requests_sent > 0
                    ? ((data.contact_requests_accepted / data.contact_requests_sent) * 100).toFixed(0)
                    : 0}
                  %)
                </span>
              </div>
              <div className="mt-1 h-8 w-full overflow-hidden rounded bg-white/10">
                <div
                  className="h-full rounded bg-green-500"
                  style={{ width: `${(data.contact_requests_accepted / maxSent) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-vertex-muted">Declined</span>
                <span className="text-white">{declined}</span>
              </div>
              <div className="mt-1 h-8 w-full overflow-hidden rounded bg-white/10">
                <div
                  className="h-full rounded bg-red-500"
                  style={{ width: `${(declined / maxSent) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-bold text-white">Search performance</h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-white/5 p-4">
              <span className="text-vertex-muted">Total searches</span>
              <span className="text-xl font-bold text-white">{data.total_searches}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/5 p-4">
              <span className="text-vertex-muted">Avg candidates per search</span>
              <span className="text-xl font-bold text-white">{data.avg_results_per_search}</span>
            </div>
            {data.top_searched_skills.length > 0 && (
              <div className="rounded-lg bg-white/5 p-4">
                <p className="text-sm text-vertex-muted">Top skill</p>
                <p className="mt-1 font-medium text-white">
                  {data.top_searched_skills[0].skill} ({data.top_searched_skills[0].count} searches)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function CompanyAnalyticsView({ data }: { data: CompanyAnalytics }) {
  return (
    <>
      <CompanyHiringAnalyticsSection data={data} />
      {data.includes_outreach_analytics ? (
        <CompanyOutreachAnalyticsSection data={data} />
      ) : (
        <div
          className="mt-10 rounded-xl border p-6 text-center"
          style={{
            borderColor: "rgba(99,102,241,0.25)",
            background: "rgba(99,102,241,0.06)",
          }}
        >
          <h3 className="text-base font-bold text-white">Recruiting outreach analytics</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-vertex-muted">
            Search activity, saved candidates, and contact request metrics are available on
            Business — alongside unlimited proactive recruiting.
          </p>
          <Link
            href="/pricing"
            className="glow-button mt-4 inline-block rounded-lg px-5 py-2.5 text-sm font-medium text-white"
          >
            Upgrade to Business
          </Link>
        </div>
      )}
    </>
  );
}

function AnalyticsContent() {
  const { user, token } = useAuth();
  const [jobseekerData, setJobseekerData] = useState<JobseekerAnalytics | null>(null);
  const [companyData, setCompanyData] = useState<CompanyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    if (user.user_type === "jobseeker") {
      getJobseekerAnalytics(token)
        .then(setJobseekerData)
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
        .finally(() => setLoading(false));
    } else if (user.user_type === "company") {
      getCompanyAnalytics(token)
        .then((data) => setCompanyData(normalizeCompanyAnalytics(data)))
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    load();
  }, [load]);

  const isCompany = user?.user_type === "company";

  return (
    <div className="mx-auto max-w-[1100px] px-6 pt-24 pb-16">
      <h1 className="text-3xl font-bold text-white">Analytics</h1>
      <p className="mt-1 text-sm text-vertex-muted">
        {isCompany
          ? "Hiring funnel and recruiting performance"
          : "Your activity insights"}
      </p>

      {loading && (
        <div className="mt-16 flex justify-center">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-transparent"
            style={{ borderTopColor: "#6366f1" }}
            aria-hidden
          />
        </div>
      )}

      {!loading && error && (
        <p className="mt-8 text-center text-vertex-muted">{error}</p>
      )}

      {!loading && !error && user?.user_type === "jobseeker" && jobseekerData && (
        <div className="mt-8">
          <JobseekerAnalyticsView data={jobseekerData} />
        </div>
      )}

      {!loading && !error && isCompany && (
        <div className="mt-8">
          <CompanyAnalyticsView data={normalizeCompanyAnalytics(companyData)} />
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute requiredRole="any">
      <AnalyticsPageGate />
    </ProtectedRoute>
  );
}

function AnalyticsPageGate() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex min-h-[300px] items-center justify-center pt-24">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-transparent"
          style={{ borderTopColor: "#6366f1" }}
          aria-hidden
        />
      </div>
    );
  }

  if (user.user_type === "company") {
    return (
      <PlanGate feature="company_analytics" requiredPlan="pro">
        <AnalyticsContent />
      </PlanGate>
    );
  }

  return <AnalyticsContent />;
}
