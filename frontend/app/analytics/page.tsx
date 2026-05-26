"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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

function CompanyAnalyticsView({ data }: { data: CompanyAnalytics }) {
  const connectionRate =
    data.contact_requests_sent > 0
      ? (data.contact_requests_accepted / data.contact_requests_sent) * 100
      : 0;
  const declined = data.contact_requests_sent - data.contact_requests_accepted;
  const maxSent = Math.max(data.contact_requests_sent, 1);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "#06b6d4" }}>
            <Search className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Total Searches</p>
            <p className="text-xl font-bold text-white">{data.total_searches}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "#06b6d4" }}>
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Avg Results per Search</p>
            <p className="text-xl font-bold text-white">{data.avg_results_per_search}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "#6366f1" }}>
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Candidates Saved</p>
            <p className="text-xl font-bold text-white">{data.saved_candidates_count}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Connection Rate</p>
            <p className="text-xl font-bold text-white">{connectionRate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="glass-card rounded-xl p-6 lg:col-span-3">
          <h3 className="text-lg font-bold text-white">Searches Over Time</h3>
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
          <h3 className="text-lg font-bold text-white">Most Searched Skills</h3>
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
          <h3 className="text-lg font-bold text-white">Outreach Funnel</h3>
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-vertex-muted">Sent</span>
                <span className="text-white">{data.contact_requests_sent}</span>
              </div>
              <div className="mt-1 h-8 w-full overflow-hidden rounded bg-white/10">
                <div
                  className="h-full rounded bg-indigo-500"
                  style={{ width: "100%" }}
                />
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
                  style={{
                    width: `${(data.contact_requests_accepted / maxSent) * 100}%`,
                  }}
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
          <h3 className="text-lg font-bold text-white">Search Performance</h3>
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
                <p className="text-vertex-muted text-sm">Top skill</p>
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
    } else {
      getCompanyAnalytics(token)
        .then(setCompanyData)
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
        .finally(() => setLoading(false));
    }
  }, [token, user]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-transparent"
          style={{ borderTopColor: "#6366f1" }}
          aria-hidden
        />
      </div>
    );
  }
  if (error) {
    return (
      <p className="text-center text-vertex-muted">
        {error}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 pt-24 pb-16">
      <h1 className="text-3xl font-bold text-white">Analytics</h1>
      <p className="mt-1 text-sm text-vertex-muted">Your activity insights</p>

      {user?.user_type === "jobseeker" && jobseekerData && (
        <div className="mt-8">
          <JobseekerAnalyticsView data={jobseekerData} />
        </div>
      )}
      {user?.user_type === "company" && companyData && (
        <div className="mt-8">
          <CompanyAnalyticsView data={companyData} />
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute requiredRole="any">
      <AnalyticsContent />
    </ProtectedRoute>
  );
}
