"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Layers,
  MapPin,
  Search,
  X,
} from "lucide-react";

const PAGE_SIZE = 20;
/** "All jobs": fetch this many from each source per page (merge up to 40). */
const ALL_TAB_PER_SOURCE = 20;
const DEBOUNCE_MS = 500;

type Tab = "all" | "posted" | "boards";

type UnifiedItem =
  | { type: "scraped"; job: ScrapedJob; sortDate: string }
  | { type: "posted"; job: PostedJob; sortDate: string };

export default function SearchPage() {
  const searchParams = useSearchParams();
  const { token, user } = useAuth();
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
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [retryNonce, setRetryNonce] = useState(0);
  const debounceQueryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceLocationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFilterDataRef = useRef("");

  const filterKeyData = useMemo(
    () =>
      `${tab}|${queryDebounced}|${sourceFilter}|${locationDebounced}|${datePosted}|${sortBy}`,
    [tab, queryDebounced, sourceFilter, locationDebounced, datePosted, sortBy]
  );

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
    if (debounceQueryRef.current) clearTimeout(debounceQueryRef.current);
    debounceQueryRef.current = setTimeout(() => {
      setQueryDebounced(query);
      debounceQueryRef.current = null;
    }, DEBOUNCE_MS);
    return () => {
      if (debounceQueryRef.current) clearTimeout(debounceQueryRef.current);
    };
  }, [query]);

  useEffect(() => {
    if (debounceLocationRef.current) clearTimeout(debounceLocationRef.current);
    debounceLocationRef.current = setTimeout(() => {
      setLocationDebounced(locationFilter);
      debounceLocationRef.current = null;
    }, DEBOUNCE_MS);
    return () => {
      if (debounceLocationRef.current) clearTimeout(debounceLocationRef.current);
    };
  }, [locationFilter]);

  useEffect(() => {
    const filtersChanged = prevFilterDataRef.current !== filterKeyData;
    if (filtersChanged) {
      prevFilterDataRef.current = filterKeyData;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }

    const effPage = page;
    const q = queryDebounced.trim() || undefined;
    const loc = locationDebounced.trim() || undefined;
    const offset = (effPage - 1) * PAGE_SIZE;
    const allOffset = (effPage - 1) * ALL_TAB_PER_SOURCE;
    let cancelled = false;

    const mapPosted = (job: PostedJob): UnifiedItem => ({
      type: "posted" as const,
      job,
      sortDate: job.created_at || "",
    });
    const mapScraped = (job: ScrapedJob): UnifiedItem => ({
      type: "scraped" as const,
      job,
      sortDate: job.scraped_at || "",
    });

    setLoading(true);
    setLoadError(null);

    if (tab === "all") {
      Promise.all([
        getPostedJobs({ limit: ALL_TAB_PER_SOURCE, offset: allOffset, search: q }),
        searchJobs({
          q,
          source: sourceFilter || undefined,
          location: loc,
          date_posted: datePosted === "all" ? undefined : datePosted,
          sort_by: sortBy,
          limit: ALL_TAB_PER_SOURCE,
          offset: allOffset,
        }),
      ])
        .then(([postedRes, scrapedRes]) => {
          if (cancelled) return;
          const combined: UnifiedItem[] = [
            ...(postedRes.jobs || []).map(mapPosted),
            ...(scrapedRes.jobs || []).map(mapScraped),
          ];
          combined.sort((a, b) => (a.sortDate > b.sortDate ? -1 : 1));
          setItems(combined);
          const pTotal = postedRes.total ?? 0;
          const sTotal = scrapedRes.total ?? 0;
          setTotalResults(pTotal + sTotal);
          const tp = Math.max(
            1,
            Math.max(Math.ceil(pTotal / ALL_TAB_PER_SOURCE), Math.ceil(sTotal / ALL_TAB_PER_SOURCE))
          );
          setTotalPages(tp);
        })
        .catch(() => {
          if (!cancelled) {
            setItems([]);
            setTotalResults(0);
            setTotalPages(1);
            setLoadError("Could not load jobs. Please try again.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    if (tab === "posted") {
      getPostedJobs({
        limit: PAGE_SIZE,
        offset,
        search: q,
      })
        .then((res) => {
          if (cancelled) return;
          const list = res.jobs || [];
          const sorted = [...list].sort((a, b) => {
            const da = a.created_at || "";
            const db = b.created_at || "";
            return sortBy === "recent" ? (da > db ? -1 : 1) : da < db ? -1 : 1;
          });
          setItems(sorted.map(mapPosted));
          const t = res.total ?? sorted.length;
          setTotalResults(t);
          setTotalPages(Math.max(1, res.total_pages ?? Math.ceil(t / PAGE_SIZE)));
        })
        .catch(() => {
          if (!cancelled) {
            setItems([]);
            setTotalResults(0);
            setTotalPages(1);
            setLoadError("Could not load jobs. Please try again.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    searchJobs({
      q,
      source: sourceFilter || undefined,
      location: loc,
      date_posted: datePosted === "all" ? undefined : datePosted,
      sort_by: sortBy,
      limit: PAGE_SIZE,
      offset,
    })
      .then((res) => {
        if (cancelled) return;
        setItems((res.jobs || []).map(mapScraped));
        const t = res.total ?? (res.jobs || []).length;
        setTotalResults(t);
        setTotalPages(Math.max(1, res.total_pages ?? Math.ceil(t / PAGE_SIZE)));
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setTotalResults(0);
          setTotalPages(1);
          setLoadError("Could not load jobs. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filterKeyData, page, retryNonce]);

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
    setLoadError(null);
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
    setPage(1);
    setLoadError(null);
  };

  const applyFiltersNow = () => {
    setQueryDebounced(query.trim());
    setLocationDebounced(locationFilter.trim());
    setPage(1);
    setLoadError(null);
  };

  const retryLoad = () => {
    setLoadError(null);
    setRetryNonce((n) => n + 1);
  };

  const pillInactive =
    "border border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-indigo-500/30 hover:bg-indigo-500/[0.07] hover:text-indigo-100";
  const pillActive =
    "border border-indigo-500/50 bg-indigo-500/15 text-indigo-100 shadow-[0_0_0_1px_rgba(99,102,241,0.2)]";

  const rangeStart = totalResults === 0 || tab === "all" ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd =
    tab === "all" ? items.length : totalResults === 0 ? 0 : Math.min(page * PAGE_SIZE, totalResults);

  const goPage = useCallback(
    (p: number) => {
      setPage(Math.min(Math.max(1, p), totalPages));
    },
    [totalPages]
  );

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto max-w-[1400px] px-4 lg:px-6">
        <div className="glass-card mb-6 overflow-hidden rounded-2xl border border-white/[0.06] shadow-[0_24px_48px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-3 border-b border-white/[0.06] bg-gradient-to-br from-indigo-500/[0.08] to-transparent px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg">Search & filters</h1>
              <p className="mt-0.5 text-xs text-slate-400">
                Filters apply after a {DEBOUNCE_MS / 1000}s pause in keyword or location, or tap Update for an
                immediate refresh.
              </p>
            </div>
            <button
              type="button"
              onClick={clearFilters}
              className="shrink-0 self-start rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-white/5 hover:text-indigo-200 sm:self-auto"
            >
              Reset all
            </button>
          </div>

          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
              <div className="min-w-0 flex-1 basis-[220px]">
                <label className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Search className="h-3 w-3 text-indigo-400/90" aria-hidden />
                  Keywords
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    aria-hidden
                  />
                  <input
                    type="search"
                    className="vertex-input w-full rounded-xl py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500"
                    placeholder="Title, company, stack…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="w-full shrink-0 basis-[160px] sm:w-auto sm:min-w-[150px]">
                <label className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Layers className="h-3 w-3 text-indigo-400/90" aria-hidden />
                  Source
                </label>
                <div className="relative">
                  <select
                    className="vertex-input h-[42px] w-full cursor-pointer appearance-none rounded-xl py-2 pl-3 pr-9 text-sm text-white"
                    value={sourceFilter}
                    onChange={(e) => {
                      setSourceFilter(e.target.value);
                      setPage(1);
                      setLoadError(null);
                    }}
                    aria-label="Filter by job board"
                  >
                    <option value="">All boards</option>
                    {sources.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <span
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                    aria-hidden
                  >
                    ▾
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1 basis-[180px]">
                <label className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <MapPin className="h-3 w-3 text-indigo-400/90" aria-hidden />
                  Location
                </label>
                <div className="relative">
                  <MapPin
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    aria-hidden
                  />
                  <input
                    type="text"
                    className="vertex-input w-full rounded-xl py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500"
                    placeholder="City, remote…"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1">
                <label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <CalendarDays className="h-3 w-3 text-indigo-400/90" aria-hidden />
                  Date posted
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "all", label: "Any time" },
                    { value: "24h", label: "24h" },
                    { value: "7d", label: "7d" },
                    { value: "30d", label: "30d" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setDatePosted(opt.value);
                        setPage(1);
                        setLoadError(null);
                      }}
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
                        datePosted === opt.value ? pillActive : pillInactive
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-w-0 lg:max-w-[340px]">
                <label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <ArrowUpDown className="h-3 w-3 text-indigo-400/90" aria-hidden />
                  Sort
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "recent", label: "Newest first" },
                    { value: "relevant", label: "Best match" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSortBy(opt.value);
                        setPage(1);
                        setLoadError(null);
                      }}
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
                        sortBy === opt.value ? pillActive : pillInactive
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={applyFiltersNow}
                  className="glow-button rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/10"
                >
                  Update results
                </button>
                <p className="text-center text-[10px] leading-snug text-slate-500 sm:max-w-[140px] sm:text-left">
                  Applies keyword and location immediately.
                </p>
              </div>
            </div>
          </div>
        </div>

        <main className="min-w-0">
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { id: "all" as Tab, label: "All jobs" },
              { id: "posted" as Tab, label: "Posted on Vertex" },
              { id: "boards" as Tab, label: "Job boards" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setPage(1);
                  setLoadError(null);
                }}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  tab === t.id ? "bg-indigo-600 text-white" : "ghost-button"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-white sm:text-base">
              {!loading && loadError ? (
                <span className="text-slate-400">Could not load results</span>
              ) : tab === "all" ? (
                <>
                  {totalResults.toLocaleString()} total listing{totalResults === 1 ? "" : "s"} indexed
                  {items.length > 0 && (
                    <span className="ml-2 font-normal text-slate-400">
                      · {items.length} on this page · page {page} of {totalPages}
                    </span>
                  )}
                </>
              ) : (
                <>
                  {totalResults.toLocaleString()} result{totalResults !== 1 ? "s" : ""}
                  {totalResults > 0 && (
                    <span className="ml-2 font-normal text-slate-400">
                      ({rangeStart}–{rangeEnd})
                    </span>
                  )}
                </>
              )}
            </h2>
            <select
              className="vertex-input rounded-lg px-3 py-2 text-sm text-white sm:hidden"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
                setLoadError(null);
              }}
            >
              <option value="recent">Newest first</option>
              <option value="relevant">Best match</option>
            </select>
          </div>

          {tab === "all" && (
            <p className="mb-3 text-xs text-slate-500">
              All jobs loads {ALL_TAB_PER_SOURCE} posted and {ALL_TAB_PER_SOURCE} board listings per page, merged by
              date.
            </p>
          )}

          {activeFilters.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Active</span>
              {activeFilters.map((f) => (
                <span
                  key={f.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/35 bg-indigo-500/15 px-3 py-1 text-sm text-indigo-50"
                >
                  {f.label}
                  <button
                    type="button"
                    onClick={() => removeFilter(f.key)}
                    className="rounded-full p-0.5 text-indigo-200/80 transition hover:bg-white/10 hover:text-white"
                    aria-label={`Remove ${f.label}`}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {!loading && loadError && (
            <div
              className="mb-6 flex flex-col items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 px-6 py-10 text-center"
              role="alert"
            >
              <p className="font-medium text-red-100">{loadError}</p>
              <button
                type="button"
                onClick={retryLoad}
                className="glow-button mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              >
                Try again
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading jobs">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <SkeletonJobCard key={i} />
              ))}
            </div>
          ) : loadError ? null : items.length === 0 ? (
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
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {items.map((item) => {
                  if (item.type === "scraped") {
                    return (
                      <div key={`s-${item.job.id}-${item.job.source}`}>
                        <JobSearchCard
                          job={item.job}
                          isSaved={savedIds.has(item.job.id)}
                          token={token}
                          showAnalyzeGap={false}
                          isProUser={user?.plan === "pro" || user?.plan === "business"}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={`p-${item.job.id}`} className="relative">
                      <span className="absolute right-4 top-4 z-10 rounded-full border border-indigo-500/30 bg-indigo-500/25 px-2.5 py-0.5 text-xs font-medium text-indigo-100">
                        Posted on Vertex
                      </span>
                      <PostedJobCard job={item.job} showCompany />
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <nav
                  className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-6 sm:flex-row"
                  aria-label="Pagination"
                >
                  <p className="order-2 text-sm text-slate-400 sm:order-1">
                    Page {page} of {totalPages}
                  </p>
                  <div className="order-1 flex items-center gap-2 sm:order-2">
                    <button
                      type="button"
                      onClick={() => goPage(page - 1)}
                      disabled={page <= 1}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition",
                        page <= 1
                          ? "cursor-not-allowed border-white/5 text-slate-600"
                          : "border-white/10 text-slate-200 hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-white"
                      )}
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => goPage(page + 1)}
                      disabled={page >= totalPages}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition",
                        page >= totalPages
                          ? "cursor-not-allowed border-white/5 text-slate-600"
                          : "border-white/10 text-slate-200 hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-white"
                      )}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </nav>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
