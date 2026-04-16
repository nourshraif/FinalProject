"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Job, MatchJobsResult, UserProfile } from "@/types";
import { CVUploader } from "@/components/CVUploader";
import { JobCardFromJob } from "@/components/JobCard";
import { SkeletonJobCard } from "@/components/SkeletonJobCard";
import { EmptyState } from "@/components/EmptyState";
import { PlanGate } from "@/components/PlanGate";
import { CheckCircle2, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { getProfile, matchJobsWithSkills } from "@/lib/api";
import { cn } from "@/lib/utils";

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

export default function MatchPage() {
  const { token, user } = useAuth();
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
    setJobs(result.jobs ?? []);
    setMatchTotal(typeof result.total_matched === "number" ? result.total_matched : (result.jobs?.length ?? 0));
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
      const n = result.jobs?.length ?? 0;
      toast.success(`Loaded ${n} matching job${n !== 1 ? "s" : ""} from your profile`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load matches";
      handleMatchError(message);
    } finally {
      setJobsLoading(false);
    }
  }, [token, profile, handleMatchComplete, handleMatchError]);

  const filteredJobs = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();
    const loc = appliedLocation.trim().toLowerCase();
    const srcNorm = appliedSource.trim().toLowerCase();

    let list = (jobs || []).filter((job) => {
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
  }, [jobs, appliedSearch, appliedLocation, appliedSource, appliedSort]);

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
  const noJobsMatched = !jobsLoading && hasSearched && jobs.length === 0;
  const awaitingSavedSearch =
    savedReady && !showOneOffUpload && !hasSearched && !jobsLoading && jobs.length === 0 && !error;
  const showFilterEmpty = filteredJobs.length === 0 && jobs.length > 0;

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="container py-8">
        <PlanGate feature="view_matches" requiredPlan="pro" soft>
          <h1 className="mb-6 text-2xl font-bold text-white">Match Jobs</h1>

          {!token && (
            <div id="cv-upload-zone" className="mb-8 scroll-mt-4">
              <CVUploader
                onMatchComplete={handleMatchComplete}
                onSkillsExtracted={() => setError(null)}
                onError={handleMatchError}
                onLoadingChange={setJobsLoading}
              />
            </div>
          )}

          {token && profileLoading && (
            <div className="glass-card mb-8 h-36 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.04]" />
          )}

          {token && !profileLoading && savedReady && (
            <>
              <div
                className={cn(
                  "glass-card mb-6 rounded-2xl border border-white/[0.06] p-6",
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
                className="mb-6 block text-left text-xs text-indigo-300 underline-offset-2 hover:text-indigo-200 hover:underline"
              >
                {showOneOffUpload
                  ? "Use saved profile for this search"
                  : "Upload a different CV for this search"}
              </button>

              {showOneOffUpload && (
                <div id="cv-upload-zone" className="mb-8 scroll-mt-4">
                  <p className="mb-3 text-xs text-slate-400">
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
            <div id="cv-upload-zone" className="mb-8 scroll-mt-4">
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

          {error && <p className="mb-4 text-sm text-vertex-danger">{error}</p>}

          {hasSearched && jobs.length > 0 && (
            <div className="mb-6 space-y-3">
              <div className="flex flex-wrap items-end gap-4">
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
              <p className="text-sm text-slate-400">
                Showing {filteredJobs.length} of {jobs.length} matches
              </p>
              {showFilterEmpty && (
                <p className="text-sm text-slate-400">
                  No matches found for your filters.{" "}
                  <button type="button" onClick={clearFilters} className="font-medium text-indigo-400 hover:text-indigo-300">
                    Clear filters
                  </button>
                </p>
              )}
            </div>
          )}

          <div className="min-w-0">
            {awaitingSavedSearch && (
              <p className="mb-4 text-sm text-slate-400">
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
                  {filteredJobs.map((job) => (
                    <JobCardFromJob
                      key={job.id}
                      job={job}
                      token={token}
                      initialSaved={false}
                      showAnalyzeGap={user?.user_type === "jobseeker"}
                      isProUser={user?.plan === "pro" || user?.plan === "business"}
                    />
                  ))}
                </div>
                {matchUpgradeMessage && !user?.is_admin && (
                  <div className="glass-card relative mt-6 flex flex-col items-center gap-4 overflow-hidden rounded-2xl border border-indigo-500/25 bg-indigo-950/40 p-8 text-center md:flex-row md:text-left">
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-transparent" aria-hidden />
                    <Lock className="relative h-10 w-10 shrink-0 text-indigo-300" aria-hidden />
                    <div className="relative flex-1">
                      <p className="text-sm font-semibold text-white">
                        You are seeing {jobs.length} of {matchTotal} matches
                      </p>
                      <p className="mt-1 text-sm text-slate-400">{matchUpgradeMessage}</p>
                    </div>
                    <Link
                      href="/pricing"
                      className="relative glow-button shrink-0 rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
                    >
                      Upgrade to Pro
                    </Link>
                  </div>
                )}
              </>
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
