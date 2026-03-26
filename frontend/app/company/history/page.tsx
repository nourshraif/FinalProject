"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  getSearchHistory,
  deleteSearchHistoryItem,
  clearSearchHistory,
} from "@/lib/api";
import type { SearchHistoryItem } from "@/types";
import { ConfirmModal } from "@/components/ConfirmModal";

function relativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays > 0) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
    if (diffHours > 0)
      return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    if (diffMins > 0)
      return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
    return "Just now";
  } catch {
    return iso;
  }
}

function getGroupLabel(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (itemDate.getTime() === today.getTime()) return "Today";
    if (itemDate.getTime() === yesterday.getTime()) return "Yesterday";
    if (itemDate.getTime() >= weekAgo.getTime()) return "This Week";
    return "Earlier";
  } catch {
    return "Earlier";
  }
}

function resultsCountColor(count: number): string {
  if (count === 0) return "#ef4444";
  if (count <= 5) return "#f59e0b";
  return "#22c55e";
}

function mostSearchedSkill(items: SearchHistoryItem[]): string {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const skills = Array.isArray(item.required_skills)
      ? item.required_skills
      : [];
    for (const s of skills) {
      const key = String(s).trim().toLowerCase();
      if (key) counts[key] = (counts[key] || 0) + 1;
    }
  }
  let max = 0;
  let skill = "";
  for (const [k, v] of Object.entries(counts)) {
    if (v > max) {
      max = v;
      skill = k;
    }
  }
  return skill || "—";
}

function HistoryContent() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getSearchHistory(token)
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch((e) => {
        setHistory([]);
        showToast(e instanceof Error ? e.message : "Failed to load search history", "error");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleClearAll = () => setShowClearConfirm(true);

  const confirmClearAll = () => {
    if (!token) return;
    setShowClearConfirm(false);
    clearSearchHistory(token)
      .then(() => {
        setHistory([]);
        showToast("Search history cleared", "success");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to clear", "error"));
  };

  const handleDelete = (id: number) => {
    if (!token) return;
    deleteSearchHistoryItem(token, id)
      .then(() => {
        setHistory((prev) => prev.filter((h) => h.id !== id));
        showToast("Search removed from history", "success");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to delete", "error"));
  };

  const handleRerun = (item: SearchHistoryItem) => {
    const skills = Array.isArray(item.required_skills)
      ? item.required_skills
      : [];
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("vertex_rerun_skills", JSON.stringify(skills));
    }
    router.push("/company/search");
  };

  const grouped = (() => {
    const groups: Record<string, SearchHistoryItem[]> = {};
    const order = ["Today", "Yesterday", "This Week", "Earlier"];
    for (const item of history) {
      const label = getGroupLabel(item.searched_at);
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    }
    return order.filter((k) => groups[k]?.length).map((k) => ({ label: k, items: groups[k] }));
  })();

  const totalSearches = history.length;
  const avgResults =
    history.length > 0
      ? Math.round(
          history.reduce((a, h) => a + (h.results_count ?? 0), 0) / history.length
        )
      : 0;
  const mostSkill = mostSearchedSkill(history);

  return (
    <div className="min-h-screen pt-[6rem] pb-12">
      <div className="mx-auto max-w-[900px] px-4 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Search History</h1>
            <p className="mt-1 text-sm text-vertex-muted">
              Your recent candidate searches
            </p>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="ghost-button shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10 hover:text-red-400"
            >
              Clear All
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
              style={{ borderTopColor: "#6366f1" }}
              aria-hidden
            />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl py-16 text-center">
            <span className="text-5xl">🔍</span>
            <p className="mt-4 text-lg font-bold text-white">
              No search history yet
            </p>
            <p className="mt-1 text-sm text-vertex-muted">
              Your candidate searches will appear here
            </p>
            <Link
              href="/company/search"
              className="glow-button mt-6 rounded-lg px-6 py-2.5 text-sm font-medium text-white"
            >
              Search Candidates
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs text-vertex-muted">Total Searches</p>
                <p className="mt-1 text-xl font-bold text-white">
                  {totalSearches}
                </p>
              </div>
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs text-vertex-muted">Avg Results</p>
                <p className="mt-1 text-xl font-bold text-white">
                  {avgResults}
                </p>
              </div>
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs text-vertex-muted">Most Searched Skill</p>
                <p className="mt-1 text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                  {mostSkill === "—" ? "—" : mostSkill}
                </p>
              </div>
            </div>

            {grouped.map(({ label, items }, groupIndex) => (
              <div key={label}>
                <p
                  className="mb-2 text-xs font-medium uppercase tracking-wider text-vertex-muted"
                  style={{ marginTop: groupIndex === 0 ? 0 : "1rem" }}
                >
                  {label}
                </p>
                {items.map((item) => {
                  const skills = Array.isArray(item.required_skills)
                    ? item.required_skills
                    : [];
                  const count = item.results_count ?? 0;
                  return (
                    <div
                      key={item.id}
                      className="glass-card mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-transparent p-5 transition-colors hover:border-[rgba(99,102,241,0.2)]"
                      style={{ padding: "1.25rem" }}
                    >
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                        <Search
                          className="h-5 w-5 shrink-0"
                          style={{ color: "#6366f1" }}
                          aria-hidden
                        />
                        <div className="flex flex-wrap gap-1">
                          {skills.slice(0, 6).map((s) => (
                            <span
                              key={s}
                              className="rounded-full px-2 py-1 text-xs"
                              style={{
                                background: "#1e1e3a",
                                color: "#94a3b8",
                                border: "1px solid #2a2a3d",
                              }}
                            >
                              {s}
                            </span>
                          ))}
                          {skills.length > 6 && (
                            <span className="text-xs text-vertex-muted">
                              +{skills.length - 6} more
                            </span>
                          )}
                        </div>
                        <p
                          className="w-full text-xs"
                          style={{ color: resultsCountColor(count) }}
                        >
                          Found {count} candidate(s)
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-vertex-muted">
                          {relativeTime(item.searched_at)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRerun(item)}
                          className="ghost-button rounded px-2 py-1 text-xs"
                        >
                          Rerun
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="rounded p-1.5 text-vertex-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                          title="Delete"
                          aria-label="Delete"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear search history"
        message="Remove all items from your search history? This cannot be undone."
        confirmText="Clear All"
        confirmStyle="destructive"
        onConfirm={confirmClearAll}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}

export default function CompanyHistoryPage() {
  return (
    <ProtectedRoute requiredRole="company">
      <HistoryContent />
    </ProtectedRoute>
  );
}
