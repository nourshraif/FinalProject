"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Loader2 } from "lucide-react";
import {
  getAdminUsers,
  toggleUserActive,
  makeUserAdmin,
  type AdminUserRow,
  type AdminUserCounts,
  type AdminUserTypeFilter,
  type AdminUserStatusFilter,
} from "@/lib/api";
import { UserDetailModal } from "@/components/admin/UserDetailModal";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type TypeTab = "all" | "jobseeker" | "company" | "admin";

const TYPE_TABS: { id: TypeTab; label: string; countKey: keyof AdminUserCounts | null }[] = [
  { id: "all", label: "All users", countKey: "all" },
  { id: "jobseeker", label: "Job seekers", countKey: "jobseekers" },
  { id: "company", label: "Companies", countKey: "companies" },
  { id: "admin", label: "Admins", countKey: "admins" },
];

type Props = {
  token: string;
  showToast: (msg: string, type: "success" | "error") => void;
};

function getInitials(fullName: string): string {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (fullName || "?").slice(0, 2).toUpperCase();
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

function typeLabel(u: AdminUserRow): string {
  if (u.is_admin) return "Admin";
  return u.user_type === "company" ? "Company" : "Job seeker";
}

export function AdminUsersSection({ token, showToast }: Props) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<AdminUserCounts | null>(null);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [typeTab, setTypeTab] = useState<TypeTab>("all");
  const [statusFilter, setStatusFilter] = useState<AdminUserStatusFilter>("");
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const userType: AdminUserTypeFilter =
      typeTab === "all" ? "" : typeTab;
    getAdminUsers(token, {
      limit: PAGE_SIZE,
      offset,
      search: search.trim() || undefined,
      user_type: userType,
      status: statusFilter || undefined,
      joined_from: joinedFrom || undefined,
      joined_to: joinedTo || undefined,
    })
      .then(({ users: u, total: t, counts: c }) => {
        setUsers(u);
        setTotal(t);
        setCounts(c);
      })
      .catch((e) => {
        showToast(e instanceof Error ? e.message : "Failed to load users", "error");
        setUsers([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [
    token,
    offset,
    search,
    typeTab,
    statusFilter,
    joinedFrom,
    joinedTo,
    showToast,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [search, typeTab, statusFilter, joinedFrom, joinedTo]);

  const handleToggleActive = (userId: number) => {
    toggleUserActive(token, userId)
      .then(() => {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, is_active: !u.is_active } : u
          )
        );
        showToast("User status updated", "success");
      })
      .catch((e) =>
        showToast(e instanceof Error ? e.message : "Failed", "error")
      );
  };

  const handleMakeAdmin = (userId: number) => {
    makeUserAdmin(token, userId)
      .then(() => {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, is_admin: true } : u))
        );
        showToast("User is now admin", "success");
        load();
      })
      .catch((e) =>
        showToast(e instanceof Error ? e.message : "Failed", "error")
      );
  };

  const clearDateFilters = () => {
    setJoinedFrom("");
    setJoinedTo("");
  };

  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + PAGE_SIZE, total);

  return (
    <>
      <div className="glass-card rounded-xl p-6">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white">User management</h2>
          <p className="mt-1 text-xs text-vertex-muted">
            Browse job seekers, companies, and admins with filters
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {TYPE_TABS.map((tab) => {
            const count =
              counts && tab.countKey ? counts[tab.countKey] : null;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setTypeTab(tab.id);
                  setOffset(0);
                }}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition",
                  typeTab === tab.id
                    ? "bg-indigo-500/30 text-white ring-1 ring-indigo-400/50"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                )}
              >
                {tab.label}
                {count != null && (
                  <span className="ml-2 text-xs opacity-80">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-3">
          <input
            type="search"
            className="vertex-input min-w-[200px] flex-1 px-3 py-2 text-sm"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <select
            className="vertex-input px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as AdminUserStatusFilter)
            }
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <label className="flex flex-col gap-1 text-xs text-vertex-muted">
            Joined from
            <input
              type="date"
              className="vertex-input px-3 py-2 text-sm text-white"
              value={joinedFrom}
              onChange={(e) => setJoinedFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-vertex-muted">
            Joined to
            <input
              type="date"
              className="vertex-input px-3 py-2 text-sm text-white"
              value={joinedTo}
              onChange={(e) => setJoinedTo(e.target.value)}
            />
          </label>
          {(joinedFrom || joinedTo) && (
            <button
              type="button"
              onClick={clearDateFilters}
              className="ghost-button rounded-lg px-3 py-2 text-sm"
            >
              Clear dates
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOffset(0);
              load();
            }}
            className="glow-button rounded-lg px-4 py-2 text-sm"
          >
            Apply
          </button>
        </div>

        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full min-w-[640px] border-collapse">
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
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-400" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-vertex-muted">
                    No users match these filters
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-[#1e1e3a]">
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/30 text-xs font-semibold text-white">
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
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-xs",
                          u.is_admin
                            ? "bg-amber-500/30 text-amber-300"
                            : u.user_type === "company"
                              ? "bg-cyan-500/30 text-cyan-300"
                              : "bg-indigo-500/30 text-indigo-300"
                        )}
                      >
                        {typeLabel(u)}
                      </span>
                    </td>
                    <td className="py-3 pr-2">
                      <span className="flex items-center gap-1.5 text-xs">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            u.is_active ? "bg-green-500" : "bg-red-500"
                          )}
                        />
                        <span
                          className={u.is_active ? "text-green-400" : "text-red-400"}
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
                          onClick={() => {
                            setSelectedUser(u);
                            setUserModalOpen(true);
                          }}
                          className="ghost-button rounded p-1.5 text-slate-400 hover:text-indigo-300"
                          aria-label="View user"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(u.id)}
                          className={cn(
                            "ghost-button rounded px-2 py-1 text-xs",
                            u.is_active
                              ? "border-red-500/50 text-red-400 hover:bg-red-500/10"
                              : "border-green-500/50 text-green-400 hover:bg-green-500/10"
                          )}
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
            Showing {start}-{end} of {total} matching users
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              disabled={offset === 0}
              className="ghost-button flex items-center rounded px-2 py-1 text-xs disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              type="button"
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="ghost-button flex items-center rounded px-2 py-1 text-xs disabled:opacity-50"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <UserDetailModal
        token={token}
        userRow={selectedUser}
        open={userModalOpen}
        onClose={() => {
          setUserModalOpen(false);
          setSelectedUser(null);
        }}
        onDeleted={(id) => {
          setUsers((prev) => prev.filter((u) => u.id !== id));
          setTotal((t) => Math.max(0, t - 1));
          load();
        }}
        showToast={showToast}
      />
    </>
  );
}
