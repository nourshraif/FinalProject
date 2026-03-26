"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { getReceivedRequests, respondToRequest } from "@/lib/api";
import type { ContactRequest } from "@/types";
import { toast } from "sonner";

function relativeTime(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return "Just now";
  } catch {
    return iso;
  }
}

type FilterTab = "all" | "pending" | "accepted" | "declined";

function RequestsContent() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [respondingId, setRespondingId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getReceivedRequests(token)
      .then((list) => setRequests(Array.isArray(list) ? list : []))
      .catch((e) => {
        setRequests([]);
        toast.error(e instanceof Error ? e.message : "Failed to load requests");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    filter === "all"
      ? requests
      : requests.filter((r) => r.status === filter);

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const counts = {
    all: requests.length,
    pending: pendingCount,
    accepted: requests.filter((r) => r.status === "accepted").length,
    declined: requests.filter((r) => r.status === "declined").length,
  };

  const handleRespond = (requestId: number, status: "accepted" | "declined") => {
    if (!token) return;
    setRespondingId(requestId);
    respondToRequest(token, requestId, status)
      .then(() => {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === requestId ? { ...r, status } : r
          )
        );
        toast.success(status === "accepted" ? "Request accepted" : "Request declined");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to update"))
      .finally(() => setRespondingId(null));
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "accepted", label: "Accepted" },
    { key: "declined", label: "Declined" },
  ];

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto max-w-[900px] px-6">
        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-white">Contact Requests</h1>
          <p className="w-full text-sm text-vertex-muted sm:w-auto">
            Companies interested in your profile
          </p>
          {pendingCount > 0 && (
            <span
              className="rounded-full px-3 py-1 text-xs font-medium text-white"
              style={{ background: "#6366f1" }}
            >
              {pendingCount} pending
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={
                  active
                    ? { background: "#6366f1", color: "white" }
                    : { color: "#94a3b8" }
                }
              >
                {label} <span className="ml-1 opacity-80">({counts[key]})</span>
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
              style={{ borderTopColor: "#6366f1" }}
              aria-hidden
            />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl py-16 text-center">
            <span className="text-5xl">📬</span>
            <p className="mt-4 text-lg font-bold text-white">
              No contact requests yet
            </p>
            <p className="mt-1 text-sm text-vertex-muted">
              Complete your profile to get noticed by companies
            </p>
            <Link
              href="/profile"
              className="glow-button mt-6 rounded-lg px-6 py-2.5 text-sm font-medium text-white"
            >
              Complete Profile
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-vertex-muted">
            No {filter === "all" ? "" : filter} requests
          </p>
        ) : (
          <div className="space-y-4">
            {filtered.map((r) => {
              const companyName = r.company_name || r.contact_name || "A company";
              const contactName = r.contact_name || "";
              return (
                <div
                  key={r.id}
                  className="glass-card rounded-xl p-6"
                  style={{ marginBottom: "1rem" }}
                >
                  {/* Top row */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                        style={{
                          background:
                            "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                        }}
                      >
                        {(companyName || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-white">{companyName}</p>
                        <p className="text-xs text-vertex-muted">
                          Sent {relativeTime(r.created_at)}
                          {contactName ? ` · ${contactName}` : ""}
                        </p>
                      </div>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-3 py-1 text-xs font-medium"
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
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </div>

                  {/* Message */}
                  <div
                    className="mt-4 rounded-lg border-l-4 p-4"
                    style={{
                      background: "#0d0d1a",
                      borderLeftColor: "#6366f1",
                    }}
                  >
                    <p
                      className="text-sm italic leading-relaxed"
                      style={{ color: "#94a3b8" }}
                    >
                      &ldquo;{r.message}&rdquo;
                    </p>
                  </div>

                  {/* Actions (pending only) */}
                  {r.status === "pending" && (
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleRespond(r.id, "accepted")}
                        disabled={respondingId === r.id}
                        className="rounded-lg px-5 py-2 text-sm font-medium transition-colors disabled:opacity-60"
                        style={{
                          background: "rgba(34,197,94,0.15)",
                          border: "1px solid rgba(34,197,94,0.3)",
                          color: "#22c55e",
                        }}
                      >
                        {respondingId === r.id ? "…" : "Accept"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespond(r.id, "declined")}
                        disabled={respondingId === r.id}
                        className="rounded-lg px-5 py-2 text-sm font-medium transition-colors disabled:opacity-60"
                        style={{
                          background: "rgba(239,68,68,0.1)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          color: "#ef4444",
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {/* Accepted state */}
                  {r.status === "accepted" && (
                    <div
                      className="mt-4 rounded-lg border p-3 text-sm"
                      style={{
                        background: "rgba(34,197,94,0.08)",
                        borderColor: "rgba(34,197,94,0.2)",
                        color: "#22c55e",
                      }}
                    >
                      ✓ You accepted this request. The company can now contact
                      you directly.
                    </div>
                  )}

                  {/* Declined state */}
                  {r.status === "declined" && (
                    <p className="mt-4 text-sm text-vertex-muted">
                      You declined this request.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RequestsPage() {
  return (
    <ProtectedRoute requiredRole="jobseeker">
      <RequestsContent />
    </ProtectedRoute>
  );
}
