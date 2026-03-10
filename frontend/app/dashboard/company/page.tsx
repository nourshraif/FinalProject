"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Users, Search, Bookmark, Eye } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import {
  getCandidateCount,
  getCompanyProfile,
  getSavedCandidates,
} from "@/lib/api";
import type { CompanyProfile, SavedCandidate } from "@/types";

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
  const router = useRouter();
  const [candidateCount, setCandidateCount] = useState<number | null>(null);
  const [savedCandidates, setSavedCandidates] = useState<SavedCandidate[]>([]);
  const [profileComplete, setProfileComplete] = useState<number | null>(null);
  const [quickSearchQuery, setQuickSearchQuery] = useState("");

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
        .catch(() => setSavedCandidates([]));
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

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto max-w-[1100px] px-6">
        {/* Welcome banner */}
        <div className="glass-card mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl p-8">
          <div>
            <p className="text-sm text-vertex-muted">Company Dashboard</p>
            <h1 className="text-2xl font-bold text-vertex-white sm:text-3xl">
              Welcome, {displayName} 👋
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-vertex-muted">
              Find the right talent for your team
              {profileLabel && (
                <Link
                  href="/company/profile"
                  className="font-medium transition-colors hover:text-vertex-white"
                  style={{ color: "#6366f1" }}
                >
                  {profileLabel}
                </Link>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/company/search"
              className="glow-button inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white"
              style={{ background: "#6366f1" }}
            >
              Search Candidates
            </Link>
            <Link
              href="/company/profile"
              className="ghost-button inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium"
            >
              Edit Profile
            </Link>
            <Link
              href="/company/admin"
              className="ghost-button inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium"
            >
              View All Talent
            </Link>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="glass-card relative rounded-2xl p-6">
            <Users className="absolute right-4 top-4 h-5 w-5" style={{ color: "#6366f1" }} />
            <p className="text-xs text-vertex-muted">Candidates in Pool</p>
            <p className="mt-1 text-2xl font-bold text-vertex-white">
              {candidateCount === null ? "..." : candidateCount.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-vertex-muted">Professionals ready to hire</p>
          </div>
          <div className="glass-card relative rounded-2xl p-6">
            <Search className="absolute right-4 top-4 h-5 w-5" style={{ color: "#6366f1" }} />
            <p className="text-xs text-vertex-muted">Searches Run</p>
            <p className="mt-1 text-2xl font-bold text-vertex-white">0</p>
            <p className="mt-1 text-xs text-vertex-muted">// TODO: track searches</p>
          </div>
          <div className="glass-card relative rounded-2xl p-6">
            <Bookmark className="absolute right-4 top-4 h-5 w-5" style={{ color: "#6366f1" }} />
            <p className="text-xs text-vertex-muted">Saved Candidates</p>
            <p className="mt-1 text-2xl font-bold text-vertex-white">
              {savedCandidates.length}
            </p>
            <p className="mt-1 text-xs text-vertex-muted">Bookmarked for later</p>
          </div>
        </div>

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
            <div className="grid gap-4 sm:grid-cols-3">
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

        {/* Quick search */}
        <div className="glass-card mb-8 rounded-2xl p-6">
          <h2 className="mb-4 text-lg font-bold text-vertex-white">Quick Skill Search</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Enter a skill e.g. Python, React, AWS..."
              className="vertex-input flex-1"
              value={quickSearchQuery}
              onChange={(e) => setQuickSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuickSearch()}
            />
            <button
              type="button"
              onClick={handleQuickSearch}
              className="glow-button shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium text-white"
              style={{ background: "#6366f1" }}
            >
              Search
            </button>
          </div>
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
