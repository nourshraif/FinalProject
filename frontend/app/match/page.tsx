"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Job, MatchJobsResult, UserProfile } from "@/types";
import { CVUploader } from "@/components/CVUploader";
import { JobCardFromJob } from "@/components/JobCard";
import { SkeletonJobCard } from "@/components/SkeletonJobCard";
import { EmptyState } from "@/components/EmptyState";
import { PlanGate } from "@/components/PlanGate";
import { CheckCircle2, Lock, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { getProfile, matchJobsWithSkills, updateSkills } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  matchLoginUrl,
  matchRegisterUrl,
  peekPendingMatchSkills,
  takePendingMatchSkills,
} from "@/lib/match-auth";

function GuestMatchCountTeaser({ total }: { total: number }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="glass-card rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.06] px-8 py-8 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-indigo-300/90">
          Matches found
        </p>
        <p className="mt-2 font-headline text-5xl font-bold text-white sm:text-6xl">
          {total.toLocaleString()}
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
          Your CV matches <span className="font-semibold text-white">{total}</span> open role
          {total !== 1 ? "s" : ""}. Create a free account to preview your top 3 — upgrade to Pro to
          unlock them all.
        </p>
        <Link
          href={matchRegisterUrl()}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-v-primary to-v-primaryContainer px-7 py-2.5 text-sm font-bold text-white shadow-lg shadow-v-primary/25 transition-all hover:shadow-v-primary/40"
        >
          <Sparkles className="h-4 w-4" />
          Sign up free to preview matches
        </Link>
      </div>

      <div className="relative">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 select-none pointer-events-none">
          {Array.from({ length: Math.min(total, 6) }).map((_, i) => (
            <div key={i} className="blur-md opacity-50">
              <SkeletonJobCard />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="glass-card rounded-2xl border border-indigo-500/30 bg-[#0e182c]/85 px-8 py-7 text-center shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-md max-w-sm w-full mx-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/15 ring-1 ring-indigo-500/30">
              <Lock className="h-6 w-6 text-indigo-300" aria-hidden />
            </div>
            <p className="text-base font-bold text-white">Your matches are ready</p>
            <p className="mt-1.5 text-sm text-slate-400">
              Sign up to reveal your top 3 best-fit roles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LockedResultsSection({
  shown,
  total,
  isGuest,
}: {
  shown: number;
  total: number;
  isGuest: boolean;
}) {
  const remaining = Math.max(0, total - shown);
  const label = remaining > 0 ? `${remaining} more match${remaining !== 1 ? "es" : ""}` : "more matches";
  const href = isGuest ? matchRegisterUrl() : "/pricing";
  const cta = isGuest ? "Sign up free to preview matches" : "Upgrade to Pro to see all";
  const sub = isGuest
    ? "Create a free account to preview your top 3 matches."
    : "Upgrade to Pro and see every role that fits your skills.";

  return (
    <div className="mt-4 space-y-3">
      {/* Blurred ghost cards */}
      <div className="relative">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 select-none pointer-events-none">
          {Array.from({ length: Math.min(remaining, 3) }).map((_, i) => (
            <div key={i} className="blur-sm opacity-60">
              <SkeletonJobCard />
            </div>
          ))}
        </div>

        {/* Lock overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="glass-card rounded-2xl border border-indigo-500/30 bg-[#0e182c]/80 px-8 py-7 text-center shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-md max-w-sm w-full mx-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/15 ring-1 ring-indigo-500/30">
              <Lock className="h-6 w-6 text-indigo-300" aria-hidden />
            </div>
            <p className="text-base font-bold text-white">
              {label} waiting
            </p>
            <p className="mt-1.5 text-sm text-slate-400">{sub}</p>
            <Link
              href={href}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-v-primary to-v-primaryContainer px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-v-primary/25 transition-all hover:shadow-v-primary/40"
            >
              <Sparkles className="h-4 w-4" />
              {cta}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const SKELETON_COUNT = 6;

const LOCATION_OPTIONS = [
  { value: "", label: "All Locations" },
  { value: "lebanon", label: "Lebanon" },
  { value: "remote", label: "Remote" },
  { value: "beirut", label: "Beirut" },
  { value: "uae", label: "UAE" },
  { value: "saudi", label: "Saudi Arabia" },
  { value: "kuwait", label: "Kuwait" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "All Sources" },
  { value: "hirelebanese", label: "HireLebanese" },
  { value: "bayt", label: "Bayt" },
  { value: "weworkremotely", label: "WeWorkRemotely" },
  { value: "remoteok", label: "RemoteOK" },
  { value: "remotive", label: "Remotive" },
  { value: "himalayas", label: "Himalayas" },
  { value: "linkedin", label: "LinkedIn" },
];

function hasProfileSkills(p: UserProfile | null): boolean {
  const skills = p?.skills;
  return Array.isArray(skills) && skills.length > 0;
}

function hasProfileCvAndSkills(p: UserProfile | null): boolean {
  if (!p) return false;
  const skills = p.skills;
  const hasSkills = Array.isArray(skills) && skills.length > 0;
  const fn = p.cv_filename;
  const hasCv = fn != null && String(fn).trim() !== "";
  return hasSkills && hasCv;
}

function normalizeSource(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/[\s_-]+/g, "");
}

function isVertexSource(s: string | null | undefined): boolean {
  return normalizeSource(s) === "companyposted";
}

function normalizeJobArray(value: unknown): Job[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const raw = item as Record<string, unknown>;
      const url = (raw.url as string) || (raw.job_url as string) || "";
      const id = typeof raw.id === "number" ? raw.id : Number(raw.job_id ?? raw.id ?? -1);
      const tags = Array.isArray(raw.tags)
        ? raw.tags.filter((tag): tag is string => typeof tag === "string")
        : typeof raw.tags === "string"
        ? [raw.tags]
        : [];

      return {
        id,
        title: String(raw.title ?? ""),
        company: String(raw.company ?? ""),
        location: String(raw.location ?? ""),
        description: (raw.description as string) ?? null,
        url,
        match_score: Number(raw.match_score ?? raw.combined_score ?? raw.similarity_score ?? 0),
        tags,
        source: (raw.source as string) ?? null,
      } as Job;
    })
    .filter((job): job is Job => job !== null && Number.isFinite(job.id));
}

function MatchPage() {
  const searchParams = useSearchParams();
  const justUnlocked = searchParams.get("unlocked") === "1";
  const previewAfterAuth = searchParams.get("preview") === "1";
  const autoMatchStarted = useRef(false);
  const { token, user, refreshUser } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [matchTotal, setMatchTotal] = useState(0);
  const [matchUpgradeMessage, setMatchUpgradeMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(Boolean(token));
  const [showOneOffUpload, setShowOneOffUpload] = useState(false);

  const [draftSearch, setDraftSearch] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftSource, setDraftSource] = useState("");
  const [draftSort, setDraftSort] = useState<"match" | "recent">("match");

  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedLocation, setAppliedLocation] = useState("");
  const [appliedSource, setAppliedSource] = useState("");
  const [appliedSort, setAppliedSort] = useState<"match" | "recent">("match");
  const [resultGroup, setResultGroup] = useState<"boards" | "vertex">("boards");

  const loadProfile = useCallback(async () => {
    if (!token) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      const p = await getProfile(token);
      setProfile(p);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const savedReady = Boolean(token) && !profileLoading && hasProfileCvAndSkills(profile);
const handleMatchComplete = useCallback((result: MatchJobsResult) => {
    const jobsResult = normalizeJobArray(result.jobs)
    setJobs(jobsResult);
    setMatchTotal(typeof result.total_matched === "number" ? result.total_matched : jobsResult.length);
    setMatchUpgradeMessage(result.upgrade_message ?? null);
    setError(null);
    setHasSearched(true);
  }, []);

  const handleMatchError = useCallback((message: string) => {
    setError(message);
    setJobs([]);
    setMatchTotal(0);
    setMatchUpgradeMessage(null);
    setHasSearched(true);
    toast.error(message);
  }, []);

  const runMatchWithSavedSkills = useCallback(async () => {
    if (!token || !profile?.skills?.length) return;
    setJobsLoading(true);
    setError(null);
    try {
      const result = await matchJobsWithSkills(token, profile.skills);
      handleMatchComplete(result);
      const shown = result.jobs?.length ?? 0;
      const total = result.total_matched ?? shown;
      if (result.upgrade_message && total > shown) {
        toast.success(`Showing ${shown} of ${total} matches — upgrade to Pro for the rest`);
      } else {
        toast.success(`Loaded ${shown} matching job${shown !== 1 ? "s" : ""} from your profile`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load matches";
      handleMatchError(message);
    } finally {
      setJobsLoading(false);
    }
  }, [token, profile, handleMatchComplete, handleMatchError]);

  useEffect(() => {
    if (!token || autoMatchStarted.current) return;

    const pending = peekPendingMatchSkills();
    const shouldRun =
      justUnlocked ||
      previewAfterAuth ||
      pending != null;

    if (!shouldRun) return;

    if (justUnlocked) {
      if (profileLoading) return;
      if (!pending?.length && !hasProfileSkills(profile)) return;
    } else if (!pending) {
      if (profileLoading) return;
      if (!profile?.skills?.length) return;
    }

    autoMatchStarted.current = true;

    async function runAutoMatch() {
      setJobsLoading(true);
      setError(null);
      try {
        let skills = takePendingMatchSkills();
        if (skills?.length) {
          await updateSkills(token!, skills).catch(() => undefined);
          const p = await getProfile(token!);
          setProfile(p);
        } else if (profile?.skills?.length) {
          skills = profile.skills;
        }
        if (!skills?.length) {
          autoMatchStarted.current = false;
          return;
        }

        if (justUnlocked) {
          await refreshUser().catch(() => undefined);
          toast.success("Pro unlocked — loading all your matches");
        } else {
          toast.success("Loading your job matches…");
        }

        const result = await matchJobsWithSkills(token!, skills);
        handleMatchComplete(result);
        const shown = result.jobs?.length ?? 0;
        const total = result.total_matched ?? shown;
        if (justUnlocked && shown > 0) {
          toast.success(`All ${total} match${total !== 1 ? "es" : ""} unlocked`);
        } else if (result.upgrade_message && total > shown) {
          toast.success(`Showing ${shown} of ${total} matches — upgrade to Pro for the rest`);
        } else if (!justUnlocked) {
          toast.success(`Loaded ${shown} matching job${shown !== 1 ? "s" : ""}`);
        }
      } catch (e) {
        autoMatchStarted.current = false;
        const message = e instanceof Error ? e.message : "Could not load matches";
        handleMatchError(message);
      } finally {
        setJobsLoading(false);
      }
    }

    void runAutoMatch();
  }, [
    token,
    justUnlocked,
    previewAfterAuth,
    profileLoading,
    savedReady,
    profile,
    handleMatchComplete,
    handleMatchError,
    refreshUser,
  ]);

  const filteredJobs = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();
    const loc = appliedLocation.trim().toLowerCase();
    const srcNorm = appliedSource.trim().toLowerCase();

    const jobsList = Array.isArray(jobs) ? jobs : [];
    let list = jobsList.filter((job) => {
      if (resultGroup === "vertex" && !isVertexSource(job.source)) return false;
      if (resultGroup === "boards" && isVertexSource(job.source)) return false;
      const matchesSearch =
        !q ||
        (job.title || "").toLowerCase().includes(q) ||
        (job.company || "").toLowerCase().includes(q);
      const locStr = (job.location || "").toLowerCase();
      const matchesLocation =
        !loc ||
        locStr.includes(loc) ||
        (loc === "remote" && /\bremote\b/i.test(job.location || ""));
      const jobSrc = normalizeSource(job.source);
      const want = normalizeSource(srcNorm);
      const matchesSource = !srcNorm || !want || jobSrc === want || jobSrc.includes(want) || want.includes(jobSrc);
      return matchesSearch && matchesLocation && matchesSource;
    });

    if (appliedSort === "match") {
      list = [...list].sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
    } else {
      list = [...list].sort((a, b) => b.id - a.id);
    }
    return list;
  }, [jobs, appliedSearch, appliedLocation, appliedSource, appliedSort, resultGroup]);

  const groupCounts = useMemo(() => {
    const boards = jobs.filter((j) => !isVertexSource(j.source)).length;
    const vertex = jobs.filter((j) => isVertexSource(j.source)).length;
    return { boards, vertex };
  }, [jobs]);

  const applyFilters = useCallback(() => {
    setAppliedSearch(draftSearch);
    setAppliedLocation(draftLocation);
    setAppliedSource(draftSource);
    setAppliedSort(draftSort);
  }, [draftSearch, draftLocation, draftSource, draftSort]);

  const clearFilters = useCallback(() => {
    setDraftSearch("");
    setDraftLocation("");
    setDraftSource("");
    setDraftSort("match");
    setAppliedSearch("");
    setAppliedLocation("");
    setAppliedSource("");
    setAppliedSort("match");
  }, []);

  const noCVYet =
    !jobsLoading &&
    jobs.length === 0 &&
    !hasSearched &&
    !error &&
    !savedReady &&
    !showOneOffUpload;
  const guestCountOnly =
    !token && hasSearched && matchTotal > 0 && jobs.length === 0 && !error;
  const noJobsMatched = !jobsLoading && hasSearched && matchTotal === 0 && !error;
  const awaitingSavedSearch =
    savedReady && !showOneOffUpload && !hasSearched && !jobsLoading && jobs.length === 0 && !error;
  const showFilterEmpty = filteredJobs.length === 0 && jobs.length > 0;

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <PlanGate feature="view_matches" requiredPlan="pro" soft>
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Match Jobs</h1>
            <p className="mt-3 text-sm text-slate-400">
              Upload your CV and we&apos;ll match you to roles using your skills.
            </p>
          </div>

          {!token && !hasSearched && (
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <div className="glass-card rounded-3xl border border-indigo-400/20 bg-indigo-500/[0.04] px-8 py-10 shadow-[0_16px_48px_rgba(99,102,241,0.12)]">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/15 ring-1 ring-indigo-500/30">
                  <Sparkles className="h-7 w-7 text-indigo-300" aria-hidden />
                </div>
                <h2 className="font-headline text-xl font-bold text-white sm:text-2xl">
                  See your personalized job matches
                </h2>
                <p className="mx-auto mt-3 max-w-sm text-sm text-slate-400">
                  Upload your CV to see how many jobs match your skills — then sign up free to preview
                  your top 3.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link
                    href={matchRegisterUrl()}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-v-primary to-v-primaryContainer px-7 py-2.5 text-sm font-bold text-white shadow-lg shadow-v-primary/25 transition-all hover:shadow-v-primary/40"
                  >
                    Sign up free
                  </Link>
                  <Link
                    href={matchLoginUrl()}
                    className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-7 py-2.5 text-sm font-medium text-white transition-colors hover:border-white/25 hover:bg-white/[0.08]"
                  >
                    Already have an account?
                  </Link>
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-500">Or try a quick preview by uploading your CV below ↓</p>
            </div>
          )}

          {!token && (
            <div id="cv-upload-zone" className="mx-auto mb-8 max-w-2xl scroll-mt-4">
              <CVUploader
                onMatchComplete={handleMatchComplete}
                onSkillsExtracted={() => setError(null)}
                onError={handleMatchError}
                onLoadingChange={setJobsLoading}
              />
            </div>
          )}

          {token && profileLoading && (
            <div className="glass-card mx-auto mb-8 h-36 max-w-4xl animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.04]" />
          )}

          {token && !profileLoading && savedReady && (
            <>
              <div
                className={cn(
                  "glass-card mx-auto mb-6 max-w-4xl rounded-2xl border border-white/[0.06] p-6",
                  "shadow-[0_16px_40px_rgba(0,0,0,0.25)]"
                )}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" aria-hidden />
                    <div>
                      <p className="text-sm font-bold text-white">Using your saved profile</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {(profile?.skills?.length ?? 0).toLocaleString()} skills from your CV
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(profile?.skills ?? []).slice(0, 8).map((s) => (
                          <span
                            key={s}
                            className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-100"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <Link
                      href="/profile"
                      className="ghost-button inline-flex items-center justify-center rounded-lg px-4 py-2 text-center text-sm font-medium"
                    >
                      Update CV
                    </Link>
                    <button
                      type="button"
                      onClick={runMatchWithSavedSkills}
                      disabled={jobsLoading}
                      className="glow-button rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Find Matching Jobs
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowOneOffUpload((o) => !o)}
                className="mx-auto mb-6 block text-center text-xs text-indigo-300 underline-offset-2 hover:text-indigo-200 hover:underline"
              >
                {showOneOffUpload
                  ? "Use saved profile for this search"
                  : "Upload a different CV for this search"}
              </button>

              {showOneOffUpload && (
                <div id="cv-upload-zone" className="mx-auto mb-8 max-w-2xl scroll-mt-4">
                  <p className="mb-3 text-center text-xs text-slate-400">
                    This upload is only used for this search and does not replace your saved profile.
                  </p>
                  <CVUploader
                    token={token}
                    persistToProfile={false}
                    onMatchComplete={handleMatchComplete}
                    onSkillsExtracted={() => setError(null)}
                    onError={handleMatchError}
                    onLoadingChange={setJobsLoading}
                  />
                </div>
              )}
            </>
          )}

          {token && !profileLoading && !savedReady && (
            <div id="cv-upload-zone" className="mx-auto mb-8 max-w-2xl scroll-mt-4">
              <CVUploader
                token={token}
                persistToProfile
                onMatchComplete={handleMatchComplete}
                onSkillsExtracted={() => setError(null)}
                onError={handleMatchError}
                onLoadingChange={setJobsLoading}
                onPersistedToProfile={loadProfile}
              />
            </div>
          )}

          {error && (
            <p className="mx-auto mb-4 max-w-2xl text-center text-sm text-vertex-danger">{error}</p>
          )}

          {hasSearched && (jobs.length > 0 || guestCountOnly) && (
            <div className="mx-auto mb-6 max-w-5xl space-y-3">
              {guestCountOnly ? (
                <p className="text-center text-sm text-slate-400">
                  {matchTotal.toLocaleString()} role{matchTotal !== 1 ? "s" : ""} match your CV
                </p>
              ) : (
                <>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setResultGroup("boards")}
                  className={cn(
                    "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    resultGroup === "boards" ? "bg-indigo-600 text-white" : "ghost-button"
                  )}
                >
                  Job Boards ({groupCounts.boards})
                </button>
                <button
                  type="button"
                  onClick={() => setResultGroup("vertex")}
                  className={cn(
                    "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    resultGroup === "vertex" ? "bg-indigo-600 text-white" : "ghost-button"
                  )}
                >
                  Vertex Jobs ({groupCounts.vertex})
                </button>
              </div>
              <div className="flex flex-wrap items-end justify-center gap-4">
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-400">Search</label>
                  <input
                    type="search"
                    placeholder="Search by title or keyword..."
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                    value={draftSearch}
                    onChange={(e) => setDraftSearch(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-[160px]">
                  <label className="mb-1 block text-xs font-medium text-slate-400">Location</label>
                  <select
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={draftLocation}
                    onChange={(e) => setDraftLocation(e.target.value)}
                  >
                    {LOCATION_OPTIONS.map((o) => (
                      <option key={o.label} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:w-[160px]">
                  <label className="mb-1 block text-xs font-medium text-slate-400">Source</label>
                  <select
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={draftSource}
                    onChange={(e) => setDraftSource(e.target.value)}
                    disabled={resultGroup === "vertex"}
                  >
                    {SOURCE_OPTIONS.map((o) => (
                      <option key={o.label} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:w-[150px]">
                  <label className="mb-1 block text-xs font-medium text-slate-400">Sort by</label>
                  <select
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={draftSort}
                    onChange={(e) => setDraftSort(e.target.value === "recent" ? "recent" : "match")}
                  >
                    <option value="match">Best Match</option>
                    <option value="recent">Most Recent</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={applyFilters}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  Filter
                </button>
              </div>
              <p className="text-center text-sm text-slate-400">
                {matchUpgradeMessage
                  ? `Showing ${filteredJobs.length} of ${matchTotal.toLocaleString()} matches`
                  : `Showing ${filteredJobs.length} of ${jobs.length} matches`}
              </p>
              {showFilterEmpty && (
                <p className="text-center text-sm text-slate-400">
                  No matches found for your filters.{" "}
                  <button type="button" onClick={clearFilters} className="font-medium text-indigo-400 hover:text-indigo-300">
                    Clear filters
                  </button>
                </p>
              )}
                </>
              )}
            </div>
          )}

          <div className="mx-auto min-w-0 max-w-7xl">
            {awaitingSavedSearch && (
              <p className="mx-auto mb-4 max-w-2xl text-center text-sm text-slate-400">
                Run a match with your saved skills using &quot;Find Matching Jobs&quot; above, or upload a one-off CV for this search only.
              </p>
            )}
            {jobsLoading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                  <SkeletonJobCard key={i} />
                ))}
              </div>
            ) : jobs.length > 0 ? (
              <>
                <div className="relative grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredJobs.map((job, index) => (
                    <JobCardFromJob
                      key={`match-${job.id ?? index}-${index}`}
                      job={job}
                      token={token}
                      initialSaved={false}
                      showAnalyzeGap={user?.user_type === "jobseeker"}
                      isProUser={user?.plan === "pro" || user?.plan === "business"}
                    />
                  ))}
                </div>
                {matchUpgradeMessage && !user?.is_admin && (
                  <LockedResultsSection
                    shown={jobs.length}
                    total={matchTotal}
                    isGuest={!token}
                  />
                )}
              </>
            ) : guestCountOnly ? (
              <GuestMatchCountTeaser total={matchTotal} />
            ) : noCVYet ? (
              <EmptyState variant="no-cv" uploadZoneId="cv-upload-zone" />
            ) : noJobsMatched ? (
              <EmptyState variant="no-jobs" />
            ) : null}
          </div>
        </PlanGate>
      </div>
    </div>
  );
}

export default function MatchPageWrapper() {
  return (
    <Suspense fallback={null}>
      <MatchPage />
    </Suspense>
  );
}
