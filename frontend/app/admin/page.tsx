"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  User,
  Building2,
  Briefcase,
  ClipboardList,
  Mail,
  TrendingUp,
  Clock3,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getAdminStats,
  getAdminHealth,
  getAdminScraperLastRun,
  getAdminActivity,
  type AdminStats as AdminStatsType,
  type AdminActivityItem,
} from "@/lib/api";
import { AdminForbidden } from "./AdminForbidden";
import { useToast } from "@/context/ToastContext";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { AdminUsersSection } from "@/components/admin/AdminUsersSection";
import { AdminJobsSection } from "@/components/admin/AdminJobsSection";
import { AdminAnnouncementsSection } from "@/components/admin/AdminAnnouncementsSection";
import { AdminEmailsSection } from "@/components/admin/AdminEmailsSection";
import { AdminSettingsSection } from "@/components/admin/AdminSettingsSection";
import { AdminAnalyticsSection } from "@/components/admin/AdminAnalyticsSection";
import { AdminSourcesSection } from "@/components/admin/AdminSourcesSection";

type AdminTab =
  | "overview"
  | "analytics"
  | "users"
  | "jobs"
  | "sources"
  | "announcements"
  | "emails"
  | "settings";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "users", label: "Users" },
  { id: "jobs", label: "Jobs" },
  { id: "sources", label: "Job Boards" },
  { id: "announcements", label: "Announcements" },
  { id: "emails", label: "Emails" },
  { id: "settings", label: "Settings" },
];

function isAdminTab(value: string | null): value is AdminTab {
  return value !== null && TABS.some((t) => t.id === value);
}

function timeAgo(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days === 1 ? "" : "s"} ago`;
    if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    if (mins < 1) return "Just now";
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  } catch {
    return "";
  }
}

function AdminPage() {
  const searchParams = useSearchParams();
  const { user, token, isLoggedIn } = useAuth();
  const { showToast } = useToast();
  const [stats, setStats] = useState<AdminStatsType | null>(null);
  const [activity, setActivity] = useState<AdminActivityItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [lastScraperRun, setLastScraperRun] = useState<string | null>(null);
  const [emailConfigured, setEmailConfigured] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (isAdminTab(tab)) setActiveTab(tab);
  }, [searchParams]);

  function selectTab(tab: AdminTab) {
    setActiveTab(tab);
    const url = tab === "overview" ? "/admin" : `/admin?tab=${tab}`;
    window.history.replaceState(null, "", url);
  }

  const loadStats = useCallback(() => {
    if (!token) return;
    setLoadingStats(true);
    getAdminStats(token)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [token]);

  const loadActivity = useCallback(() => {
    if (!token) return;
    setLoadingActivity(true);
    getAdminActivity(token, 10)
      .then(setActivity)
      .catch(() => setActivity([]))
      .finally(() => setLoadingActivity(false));
  }, [token]);

  const loadLastScraperRun = useCallback(() => {
    if (!token) return;
    getAdminScraperLastRun(token)
      .then((r) => setLastScraperRun(r.last_run))
      .catch(() => setLastScraperRun(null));
  }, [token]);

  const loadHealth = useCallback(() => {
    if (!token) return;
    getAdminHealth(token)
      .then((h) => {
        setEmailConfigured(Boolean(h.email_configured));
        if (h.last_scraper_run) setLastScraperRun(h.last_scraper_run);
      })
      .catch(() => {
        setEmailConfigured(false);
      });
  }, [token]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);
  useEffect(() => {
    loadActivity();
  }, [loadActivity]);
  useEffect(() => {
    loadLastScraperRun();
    loadHealth();
  }, [loadLastScraperRun, loadHealth]);

  if (!isLoggedIn || !user) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 pt-24">
        <div className="text-center text-white">Please sign in to continue.</div>
        <div className="mt-4 text-center">
          <Link href="/auth/login" className="glow-button rounded-lg px-4 py-2 text-sm text-white">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!user.is_admin) {
    return <AdminForbidden />;
  }

  return (
    <div className="relative mx-auto max-w-[1200px] px-6 pb-16 pt-24">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
        <p className="mt-1 text-sm text-vertex-muted">
          Platform overview and management
        </p>
      </div>

      <nav className="mb-8 flex flex-wrap gap-1 border-b border-white/10 pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition",
              activeTab === t.id
                ? "border-b-2 border-white text-white"
                : "text-slate-400 hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <>
      {/* Stats grid 1: 2 cols on mobile */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-white">
                {loadingStats ? "—" : stats?.total_users ?? 0}
              </p>
              <p className="text-xs text-green-400">
                [{stats?.new_users_week ?? 0}] this week
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-1 text-xs text-vertex-muted">Total Users</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-white">
              {loadingStats ? "—" : stats?.total_jobseekers ?? 0}
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <User className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-1 text-xs text-vertex-muted">Job Seekers</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-white">
              {loadingStats ? "—" : stats?.total_companies ?? 0}
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-1 text-xs text-vertex-muted">Companies</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-white">
                {loadingStats ? "—" : stats?.total_jobs ?? 0}
              </p>
              <p className="text-xs text-green-400">
                [{stats?.jobs_scraped_today ?? 0}] today
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-1 text-xs text-vertex-muted">Total Jobs</p>
        </div>
      </div>

      {/* Stats grid 2: 2 cols on mobile */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-white">
              {loadingStats ? "—" : stats?.total_applications ?? 0}
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <ClipboardList className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-1 text-xs text-vertex-muted">Applications Tracked</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-white">
              {loadingStats ? "—" : stats?.total_contact_requests ?? 0}
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <Mail className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-1 text-xs text-vertex-muted">Contact Requests</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p
              className={`text-2xl font-bold ${
                (stats?.new_users_today ?? 0) > 0 ? "text-green-400" : "text-white"
              }`}
            >
              {loadingStats ? "—" : stats?.new_users_today ?? 0}
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-1 text-xs text-vertex-muted">New Users Today</p>
        </div>
      </div>

      <div className="glass-card mb-8 rounded-xl p-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">Recent Activity</h2>
          <p className="mt-1 text-xs text-vertex-muted">Last 10 platform events</p>
        </div>
        <div className="space-y-0">
          {loadingActivity ? (
            <p className="py-6 text-center text-sm text-vertex-muted">Loading…</p>
          ) : activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-vertex-muted">
              No recent activity
            </p>
          ) : (
            activity.map((a, i) => (
              <div
                key={i}
                className="flex items-start gap-3 border-b border-[#1e1e3a] py-3 last:border-0"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                    a.type === "registration"
                      ? "bg-indigo-500/30"
                      : a.type === "contact_request"
                        ? "bg-purple-500/30"
                        : "bg-amber-500/30"
                  }`}
                >
                  {a.type === "registration"
                    ? "👤"
                    : a.type === "contact_request"
                      ? "✉"
                      : "📋"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">{a.description}</p>
                  <p className="text-xs text-vertex-muted">{timeAgo(a.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="mb-4 text-lg font-bold text-white">Platform Health</h2>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${stats !== null ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-sm text-white">
              {stats !== null ? "Database Connected" : "Database Unavailable"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${emailConfigured ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-sm text-vertex-muted">
              Email Service: {emailConfigured ? "Configured" : "Not configured"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-vertex-muted" />
            <span className="text-sm text-vertex-muted">
              {lastScraperRun
                ? `Last scraper run: ${timeAgo(lastScraperRun)}`
                : "Scraper has not run yet"}
            </span>
          </div>
        </div>
      </div>
        </>
      )}

      {activeTab === "analytics" && token && (
        <AdminAnalyticsSection token={token} showToast={showToast} />
      )}

      {activeTab === "users" && token && (
        <AdminUsersSection token={token} showToast={showToast} />
      )}

      {activeTab === "jobs" && token && (
        <AdminJobsSection token={token} showToast={showToast} />
      )}
      {activeTab === "sources" && token && (
        <AdminSourcesSection token={token} showToast={showToast} />
      )}
      {activeTab === "announcements" && token && (
        <AdminAnnouncementsSection token={token} showToast={showToast} />
      )}
      {activeTab === "emails" && token && (
        <AdminEmailsSection token={token} showToast={showToast} />
      )}
      {activeTab === "settings" && token && (
        <AdminSettingsSection token={token} showToast={showToast} />
      )}

    </div>
  );
}

export default function AdminPageWrapper() {
  return (
    <Suspense fallback={null}>
      <AdminPage />
    </Suspense>
  );
}
