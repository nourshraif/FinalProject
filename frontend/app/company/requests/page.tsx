"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { getSentRequests } from "@/lib/api";
import type { ContactRequest } from "@/types";
import { toast } from "sonner";

type FilterTab = "all" | "pending" | "accepted" | "declined";

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name || "?").slice(0, 2).toUpperCase();
}

function SentRequestsContent() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getSentRequests(token)
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

  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    accepted: requests.filter((r) => r.status === "accepted").length,
    declined: requests.filter((r) => r.status === "declined").length,
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Sent Requests</h1>
          <p className="mt-1 text-sm text-vertex-muted">
            Contact requests you sent to candidates
          </p>
        </div>

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
            <span className="text-5xl">📤</span>
            <p className="mt-4 text-lg font-bold text-white">
              No requests sent yet
            </p>
            <Link
              href="/company/search"
              className="glow-button mt-6 rounded-lg px-6 py-2.5 text-sm font-medium text-white"
            >
              Search Candidates
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-vertex-muted">
            No {filter === "all" ? "" : filter} requests
          </p>
        ) : (
          <div className="space-y-4">
            {filtered.map((r) => {
              const candidateName = r.candidate_name || "Candidate";
              const headline = r.headline || "";
              const messagePreview =
                r.message.length > 120
                  ? r.message.slice(0, 120) + "…"
                  : r.message;
              return (
                <div
                  key={r.id}
                  className="glass-card rounded-xl p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                        style={{
                          background:
                            "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                        }}
                      >
                        {getInitials(candidateName)}
                      </div>
                      <div>
                        <p className="font-bold text-white">{candidateName}</p>
                        {headline && (
                          <p className="text-sm text-vertex-muted">
                            {headline}
                          </p>
                        )}
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

                  <p
                    className="mt-3 text-sm italic"
                    style={{ color: "#94a3b8" }}
                  >
                    &ldquo;{messagePreview}&rdquo;
                  </p>

                  {r.status === "accepted" && r.candidate_email && (
                    <div
                      className="mt-4 rounded-lg border p-3"
                      style={{
                        background: "rgba(34,197,94,0.08)",
                        borderColor: "rgba(34,197,94,0.2)",
                      }}
                    >
                      <p
                        className="text-sm font-medium"
                        style={{ color: "#22c55e" }}
                      >
                        ✓ Candidate accepted! You can now contact them:
                      </p>
                      <a
                        href={`mailto:${r.candidate_email}`}
                        className="mt-1 block text-sm transition-colors hover:underline"
                        style={{ color: "#6366f1" }}
                      >
                        {r.candidate_email}
                      </a>
                    </div>
                  )}

                  {r.status === "pending" && (
                    <p
                      className="mt-3 text-sm"
                      style={{ color: "#f59e0b", opacity: 0.9 }}
                    >
                      Waiting for candidate to respond…
                    </p>
                  )}

                  {r.status === "declined" && (
                    <p className="mt-3 text-sm text-vertex-muted">
                      Candidate declined this request
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

export default function CompanyRequestsPage() {
  return (
    <ProtectedRoute requiredRole="company">
      <SentRequestsContent />
    </ProtectedRoute>
  );
}
