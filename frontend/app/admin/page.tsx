"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  User,
  Building2,
  Briefcase,
  ClipboardList,
  Mail,
  TrendingUp,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getAdminStats,
  getAdminUsers,
  getAdminActivity,
  runScraper,
  toggleUserActive,
  makeUserAdmin,
  type AdminStats as AdminStatsType,
  type AdminUserRow,
  type AdminActivityItem,
} from "@/lib/api";
import { AdminForbidden } from "./AdminForbidden";
import { useToast } from "@/context/ToastContext";

const PAGE_SIZE = 50;

function getInitials(fullName: string): string {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (fullName || "?").slice(0, 2).toUpperCase();
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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function AdminPage() {
  const { user, token, isLoggedIn } = useAuth();
  const { showToast } = useToast();
  const [stats, setStats] = useState<AdminStatsType | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activity, setActivity] = useState<AdminActivityItem[]>([]);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [scraperLoading, setScraperLoading] = useState(false);
  const [scraperSuccess, setScraperSuccess] = useState(false);

  const loadStats = useCallback(() => {
    if (!token) return;
    setLoadingStats(true);
    getAdminStats(token)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [token]);

  const loadUsers = useCallback(() => {
    if (!token) return;
    setLoadingUsers(true);
    getAdminUsers(token, { limit: PAGE_SIZE, offset, search: search || undefined })
      .then(({ users: u, total }) => {
        setUsers(u);
        setTotalUsers(total);
      })
      .catch(() => {
        setUsers([]);
        setTotalUsers(0);
      })
      .finally(() => setLoadingUsers(false));
  }, [token, offset, search]);

  const loadActivity = useCallback(() => {
    if (!token) return;
    setLoadingActivity(true);
    getAdminActivity(token)
      .then(setActivity)
      .catch(() => setActivity([]))
      .finally(() => setLoadingActivity(false));
  }, [token]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setOffset(0);
  }, [search]);
  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const handleRunScraper = useCallback(() => {
    if (!token) return;
    setScraperLoading(true);
    setScraperSuccess(false);
    runScraper(token)
      .then(() => {
        setScraperSuccess(true);
        showToast("Scraper started", "success");
        loadStats();
      })
      .catch((e) => {
        showToast(e instanceof Error ? e.message : "Failed to start scraper", "error");
      })
      .finally(() => setScraperLoading(false));
  }, [token, loadStats]);

  const handleToggleActive = useCallback(
    (userId: number) => {
      if (!token) return;
      toggleUserActive(token, userId)
        .then(() => {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId ? { ...u, is_active: !u.is_active } : u
            )
          );
          showToast("User status updated", "success");
        })
        .catch((e) => showToast(e instanceof Error ? e.message : "Failed", "error"))
    },
    [token]
  );

  const handleMakeAdmin = useCallback(
    (userId: number) => {
      if (!token) return;
      makeUserAdmin(token, userId)
        .then(() => {
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, is_admin: true } : u))
          );
          showToast("User is now admin", "success");
        })
        .catch((e) => showToast(e instanceof Error ? e.message : "Failed", "error"))
    },
    [token]
  );

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

  const start = offset + 1;
  const end = Math.min(offset + PAGE_SIZE, totalUsers);
  const totalPages = Math.ceil(totalUsers / PAGE_SIZE) || 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-24">
      {/* Page header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          <p className="mt-1 text-sm text-vertex-muted">
            Platform overview and management
          </p>
        </div>
        <button
          type="button"
          onClick={handleRunScraper}
          disabled={scraperLoading}
          className="glow-button flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-70"
        >
          {scraperLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Run Scraper
        </button>
        {scraperSuccess && !scraperLoading && (
          <span className="text-sm text-green-400">Scraper started</span>
        )}
      </div>

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

      {/* Two columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_0.4fr]">
        {/* User Management */}
        <div className="glass-card rounded-xl p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-white">Users</h2>
            <input
              type="text"
              className="vertex-input w-[200px] px-3 py-2 text-sm"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadUsers()}
            />
          </div>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase text-vertex-muted">
                  <th className="pb-2 pr-2">User</th>
                  <th className="pb-2 pr-2">Type</th>
                  <th className="pb-2 pr-2">Status</th>
                  <th className="pb-2 pr-2">Joined</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-vertex-muted">
                      Loading…
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-vertex-muted">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-[#1e1e3a]"
                    >
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/30 text-xs font-semibold text-white"
                          >
                            {getInitials(u.full_name)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">
                              {u.full_name || "—"}
                            </p>
                            <p className="text-xs text-vertex-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                            u.user_type === "jobseeker"
                              ? "bg-indigo-500/30 text-indigo-300"
                              : "bg-cyan-500/30 text-cyan-300"
                          }`}
                        >
                          {u.user_type}
                        </span>
                      </td>
                      <td className="py-3 pr-2">
                        <span className="flex items-center gap-1.5 text-xs">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              u.is_active ? "bg-green-500" : "bg-red-500"
                            }`}
                          />
                          <span
                            className={
                              u.is_active ? "text-green-400" : "text-red-400"
                            }
                          >
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 pr-2 text-xs text-vertex-muted">
                        {u.created_at ? formatDate(u.created_at) : "—"}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u.id)}
                            className={`ghost-button rounded px-2 py-1 text-xs ${
                              u.is_active
                                ? "border-red-500/50 text-red-400 hover:bg-red-500/10"
                                : "border-green-500/50 text-green-400 hover:bg-green-500/10"
                            }`}
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </button>
                          {!u.is_admin && (
                            <button
                              type="button"
                              onClick={() => handleMakeAdmin(u.id)}
                              className="ghost-button rounded px-2 py-1 text-xs text-vertex-muted hover:text-white"
                            >
                              Make Admin
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-vertex-muted">
              Showing {totalUsers === 0 ? 0 : start}-{end} of {totalUsers} users
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
                className="ghost-button flex items-center rounded px-2 py-1 text-xs disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                type="button"
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= totalUsers}
                className="ghost-button flex items-center rounded px-2 py-1 text-xs disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Recent Activity</h2>
          <div className="space-y-0">
            {loadingActivity ? (
              <p className="py-6 text-center text-sm text-vertex-muted">
                Loading…
              </p>
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
                    <p className="text-xs text-vertex-muted">
                      {timeAgo(a.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Platform Health */}
      <div className="glass-card mt-6 rounded-xl p-6">
        <h2 className="mb-4 text-lg font-bold text-white">Platform Health</h2>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm text-white">
              {stats !== null ? "Database Connected" : "Database —"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm text-vertex-muted">
              Last run: TODO track last scraper run
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm text-vertex-muted">Resend Active (TODO)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
