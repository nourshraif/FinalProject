"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
  searchJobs,
  getJobSources,
  getSavedJobs,
} from "@/lib/api";
import type { ScrapedJob } from "@/types";
import { JobSearchCard } from "@/components/JobSearchCard";
import { SkeletonJobCard } from "@/components/SkeletonJobCard";
import { useAuth } from "@/context/AuthContext";

const LIMIT = 20;
const DEBOUNCE_MS = 500;

export default function FindJobsPage() {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [queryDebounced, setQueryDebounced] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState("");
  const [locationDebounced, setLocationDebounced] = useState("");
  const [datePosted, setDatePosted] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [jobs, setJobs] = useState<ScrapedJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getJobSources().then(setSources).catch(() => setSources([]));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQueryDebounced(query);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLocationDebounced(locationFilter);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [locationFilter]);

  const runSearch = useCallback(() => {
    setLoading(true);
    const offset = (page - 1) * LIMIT;
    searchJobs({
      q: queryDebounced.trim() || undefined,
      source: sourceFilter || undefined,
      location: locationDebounced.trim() || undefined,
      date_posted: datePosted === "all" ? undefined : datePosted,
      sort_by: sortBy,
      limit: LIMIT,
      offset,
    })
      .then((res) => {
        setJobs(res.jobs);
        setTotal(res.total);
        setPage(res.page);
        setTotalPages(res.total_pages);
      })
      .catch(() => {
        setJobs([]);
        setTotal(0);
        setTotalPages(0);
      })
      .finally(() => setLoading(false));
  }, [queryDebounced, sourceFilter, locationDebounced, datePosted, sortBy, page]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  useEffect(() => {
    if (!token) {
      setSavedIds(new Set());
      return;
    }
    getSavedJobs(token)
      .then((list) => setSavedIds(new Set((list || []).map((s) => s.id))))
      .catch(() => setSavedIds(new Set()));
  }, [token]);

  const clearFilters = () => {
    setQuery("");
    setQueryDebounced("");
    setSourceFilter("");
    setLocationFilter("");
    setLocationDebounced("");
    setDatePosted("all");
    setSortBy("recent");
    setPage(1);
  };

  const activeFilters: { key: string; label: string }[] = [];
  if (sourceFilter) activeFilters.push({ key: "source", label: `Source: ${sourceFilter}` });
  if (locationDebounced.trim()) activeFilters.push({ key: "location", label: `Location: ${locationDebounced.trim()}` });
  if (datePosted !== "all") {
    const labels: Record<string, string> = {
      "24h": "Last 24 hours",
      "7d": "Last 7 days",
      "30d": "Last 30 days",
    };
    activeFilters.push({ key: "date", label: labels[datePosted] || datePosted });
  }

  const removeFilter = (key: string) => {
    if (key === "source") setSourceFilter("");
    if (key === "location") {
      setLocationFilter("");
      setLocationDebounced("");
    }
    if (key === "date") setDatePosted("all");
    setPage(1);
  };

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto flex max-w-[1400px] flex-col px-4 lg:flex-row lg:gap-8 lg:px-6">
        {/* Sidebar */}
        <aside
          className={`w-full shrink-0 lg:sticky lg:top-24 lg:w-[280px] ${filtersOpen ? "block" : "hidden lg:block"}`}
        >
          <div className="glass-card rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Filters</h2>
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-medium"
                style={{ color: "#6366f1" }}
              >
                Clear All
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="search"
                className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                placeholder="Job title, company, keyword..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div>
                <label className="mb-1 block text-xs uppercase text-vertex-muted">
                  Job Board
                </label>
                <select
                  className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {sources.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase text-vertex-muted">
                  Location
                </label>
                <input
                  type="text"
                  className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                  placeholder="Any location"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase text-vertex-muted">
                  Date Posted
                </label>
                <div className="space-y-1">
                  {[
                    { value: "all", label: "Any time" },
                    { value: "24h", label: "Last 24 hours" },
                    { value: "7d", label: "Last 7 days" },
                    { value: "30d", label: "Last 30 days" },
                  ].map((opt) => (
                    <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-white">
                      <input
                        type="radio"
                        name="datePosted"
                        checked={datePosted === opt.value}
                        onChange={() => setDatePosted(opt.value)}
                        className="rounded-full"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase text-vertex-muted">
                  Sort By
                </label>
                <div className="space-y-1">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                    <input
                      type="radio"
                      name="sortBy"
                      checked={sortBy === "recent"}
                      onChange={() => setSortBy("recent")}
                      className="rounded-full"
                    />
                    Most Recent
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                    <input
                      type="radio"
                      name="sortBy"
                      checked={sortBy === "relevant"}
                      onChange={() => setSortBy("relevant")}
                      className="rounded-full"
                    />
                    Most Relevant
                  </label>
                </div>
              </div>
              <button
                type="button"
                onClick={() => runSearch()}
                className="glow-button w-full rounded-lg py-2.5 font-medium text-white"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 pt-6 lg:pt-0">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="ghost-button mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm lg:hidden"
          >
            Show Filters
          </button>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-white">
              {total} job{total !== 1 ? "s" : ""} found
            </h3>
            <select
              className="vertex-input w-[160px] rounded-lg px-3 py-2 text-sm text-white lg:hidden"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="recent">Most Recent</option>
              <option value="relevant">Most Relevant</option>
            </select>
          </div>
          {activeFilters.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {activeFilters.map((f) => (
                <span
                  key={f.key}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
                  style={{
                    background: "rgba(99, 102, 241, 0.2)",
                    border: "1px solid rgba(99, 102, 241, 0.5)",
                    color: "white",
                  }}
                >
                  {f.label}
                  <button
                    type="button"
                    onClick={() => removeFilter(f.key)}
                    className="ml-1 hover:opacity-80"
                    aria-label={`Remove ${f.label}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <SkeletonJobCard key={i} />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl py-16 text-center">
              <p className="font-bold text-white">No jobs found</p>
              <p className="mt-2 text-sm text-vertex-muted">
                Try adjusting your filters or search with different keywords
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="ghost-button mt-4 rounded-lg px-4 py-2 text-sm font-medium"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {jobs.map((job) => (
                  <JobSearchCard
                    key={job.id}
                    job={job}
                    isSaved={savedIds.has(job.id)}
                    token={token}
                  />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="ghost-button rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-vertex-muted">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="ghost-button rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
