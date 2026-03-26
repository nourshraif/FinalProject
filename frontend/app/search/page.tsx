"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  searchJobs,
  getPostedJobs,
  getJobSources,
  getSavedJobs,
} from "@/lib/api";
import type { ScrapedJob, PostedJob } from "@/types";
import { JobSearchCard } from "@/components/JobSearchCard";
import { PostedJobCard } from "@/components/PostedJobCard";
import { SkeletonJobCard } from "@/components/SkeletonJobCard";
import { useAuth } from "@/context/AuthContext";

const LIMIT = 20;
const DEBOUNCE_MS = 500;

type Tab = "all" | "posted" | "boards";

type UnifiedItem =
  | { type: "scraped"; job: ScrapedJob; sortDate: string }
  | { type: "posted"; job: PostedJob; sortDate: string };

export default function SearchPage() {
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [queryDebounced, setQueryDebounced] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState("");
  const [locationDebounced, setLocationDebounced] = useState("");
  const [datePosted, setDatePosted] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const qParam = searchParams.get("q");
  useEffect(() => {
    if (qParam != null && qParam.trim()) {
      setQuery(qParam.trim());
      setQueryDebounced(qParam.trim());
    }
  }, [qParam]);

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
    const q = queryDebounced.trim() || undefined;
    const loc = locationDebounced.trim() || undefined;

    if (tab === "posted") {
      getPostedJobs({
        limit: LIMIT * 2,
        offset: 0,
        search: q,
      })
        .then((list) => {
          const sorted = [...(list || [])].sort((a, b) => {
            const da = a.created_at || "";
            const db = b.created_at || "";
            return sortBy === "recent" ? (da > db ? -1 : 1) : (da < db ? -1 : 1);
          });
          setItems(
            sorted.map((job) => ({
              type: "posted" as const,
              job,
              sortDate: job.created_at || "",
            }))
          );
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
      return;
    }

    if (tab === "boards") {
      searchJobs({
        q,
        source: sourceFilter || undefined,
        location: loc,
        date_posted: datePosted === "all" ? undefined : datePosted,
        sort_by: sortBy,
        limit: LIMIT * 2,
        offset: 0,
      })
        .then((res) => {
          setItems(
            (res.jobs || []).map((job) => ({
              type: "scraped" as const,
              job,
              sortDate: job.scraped_at || "",
            }))
          );
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
      return;
    }

    Promise.all([
      getPostedJobs({ limit: 50, offset: 0, search: q }),
      searchJobs({
        q,
        source: sourceFilter || undefined,
        location: loc,
        date_posted: datePosted === "all" ? undefined : datePosted,
        sort_by: sortBy,
        limit: 50,
        offset: 0,
      }),
    ])
      .then(([postedList, scrapedRes]) => {
        const combined: UnifiedItem[] = [
          ...(postedList || []).map((job) => ({
            type: "posted" as const,
            job,
            sortDate: job.created_at || "",
          })),
          ...(scrapedRes.jobs || []).map((job) => ({
            type: "scraped" as const,
            job,
            sortDate: job.scraped_at || "",
          })),
        ];
        combined.sort((a, b) => (a.sortDate > b.sortDate ? -1 : 1));
        setItems(combined);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [tab, queryDebounced, sourceFilter, locationDebounced, datePosted, sortBy]);

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
  };

  const activeFilters: { key: string; label: string }[] = [];
  if (sourceFilter) activeFilters.push({ key: "source", label: `Source: ${sourceFilter}` });
  if (locationDebounced.trim()) activeFilters.push({ key: "location", label: `Location: ${locationDebounced.trim()}` });
  if (datePosted !== "all") {
    const labels: Record<string, string> = { "24h": "Last 24 hours", "7d": "Last 7 days", "30d": "Last 30 days" };
    activeFilters.push({ key: "date", label: labels[datePosted] || datePosted });
  }

  const removeFilter = (key: string) => {
    if (key === "source") setSourceFilter("");
    if (key === "location") {
      setLocationFilter("");
      setLocationDebounced("");
    }
    if (key === "date") setDatePosted("all");
  };

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto flex max-w-[1400px] flex-col px-4 lg:flex-row lg:gap-8 lg:px-6">
        <aside className={`w-full shrink-0 lg:sticky lg:top-24 lg:w-[280px] ${filtersOpen ? "block" : "hidden lg:block"}`}>
          <div className="glass-card rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Filters</h2>
              <button type="button" onClick={clearFilters} className="text-sm font-medium" style={{ color: "#6366f1" }}>
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
                <label className="mb-1 block text-xs uppercase text-vertex-muted">Job Board</label>
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
                <label className="mb-1 block text-xs uppercase text-vertex-muted">Location</label>
                <input
                  type="text"
                  className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                  placeholder="Any location"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase text-vertex-muted">Date Posted</label>
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
                <label className="mb-1 block text-xs uppercase text-vertex-muted">Sort By</label>
                <div className="space-y-1">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                    <input type="radio" name="sortBy" checked={sortBy === "recent"} onChange={() => setSortBy("recent")} className="rounded-full" />
                    Most Recent
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                    <input type="radio" name="sortBy" checked={sortBy === "relevant"} onChange={() => setSortBy("relevant")} className="rounded-full" />
                    Most Relevant
                  </label>
                </div>
              </div>
              <button type="button" onClick={() => runSearch()} className="glow-button w-full rounded-lg py-2.5 font-medium text-white">
                Apply Filters
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pt-6 lg:pt-0">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="ghost-button mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm lg:hidden"
          >
            Show Filters
          </button>

          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { id: "all" as Tab, label: "All Jobs" },
              { id: "posted" as Tab, label: "Posted by Companies" },
              { id: "boards" as Tab, label: "From Job Boards" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  tab === t.id ? "bg-indigo-600 text-white" : "ghost-button"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-white">{items.length} job{items.length !== 1 ? "s" : ""} found</h3>
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
                  style={{ background: "rgba(99, 102, 241, 0.2)", border: "1px solid rgba(99, 102, 241, 0.5)", color: "white" }}
                >
                  {f.label}
                  <button type="button" onClick={() => removeFilter(f.key)} className="ml-1 hover:opacity-80" aria-label={`Remove ${f.label}`}>×</button>
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
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl py-16 text-center">
              <p className="font-bold text-white">No jobs found</p>
              <p className="mt-2 text-sm text-vertex-muted">Try adjusting your filters or search with different keywords</p>
              <button type="button" onClick={clearFilters} className="ghost-button mt-4 rounded-lg px-4 py-2 text-sm font-medium">
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, idx) => {
                if (item.type === "scraped") {
                  return (
                    <div key={`s-${item.job.id}`} className="relative">
                      <span className="absolute right-4 top-4 z-10 rounded-full bg-vertex-card px-2.5 py-0.5 text-xs text-vertex-muted">
                        From {item.job.source}
                      </span>
                      <JobSearchCard job={item.job} isSaved={savedIds.has(item.job.id)} token={token} />
                    </div>
                  );
                }
                return (
                  <div key={`p-${item.job.id}`} className="relative">
                    <span className="absolute right-4 top-4 z-10 rounded-full px-2.5 py-0.5 text-xs font-medium text-indigo-300" style={{ background: "rgba(99, 102, 241, 0.3)" }}>
                      Posted on Vertex
                    </span>
                    <PostedJobCard job={item.job} showCompany />
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
