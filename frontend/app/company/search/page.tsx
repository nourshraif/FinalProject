"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { searchCandidates, getCandidateCount } from "@/lib/api";
import type { Candidate } from "@/types";
import { CandidateCardFromApi } from "@/components/CandidateCard";
import ContactRequestModal from "@/components/ContactRequestModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Loader2, Search, Users, TrendingUp, Award, ChevronDown, ChevronUp, X } from "lucide-react";
import { PlanGate } from "@/components/PlanGate";
import { SkeletonCandidateCard } from "@/components/Skeleton";

export default function CompanySearchPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [skillsText, setSkillsText] = useState("");
  const [topK, setTopK] = useState(20);
  const [minMatches, setMinMatches] = useState(1);
  const [locationFilter, setLocationFilter] = useState("");
  const [minExperience, setMinExperience] = useState<number | "">("");
  const [maxExperience, setMaxExperience] = useState<number | "">("");
  const [minMatchScore, setMinMatchScore] = useState(0);
  const [sortBy, setSortBy] = useState<"score" | "experience" | "recent">("score");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<{
    userId: number;
    name: string;
  } | null>(null);

  const loadCount = useCallback(() => {
    getCandidateCount()
      .then(setCount)
      .catch(() => setCount(0));
  }, []);

  if (count === null) loadCount();

  const requiredSkills = Array.from(
    new Set(
      skillsText
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );

  const removeSkill = (skill: string) => {
    setSkillsText((prev) =>
      prev
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter((s) => s && s !== skill)
        .join("\n")
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requiredSkills.length === 0) {
      showToast("Add at least one skill.", "error");
      return;
    }
    if (!token) {
      showToast("Please log in to search.", "error");
      return;
    }
    setLoading(true);
    try {
      const results = await searchCandidates(
        {
          required_skills: requiredSkills,
          top_k: topK,
          min_keyword_matches: minMatches,
          use_semantic: false,
          location_filter: locationFilter.trim() || undefined,
          min_experience: minExperience === "" ? undefined : Number(minExperience),
          max_experience: maxExperience === "" ? undefined : Number(maxExperience),
          min_match_score: minMatchScore > 0 ? minMatchScore : undefined,
          sort_by: sortBy,
        },
        token
      );
      setCandidates(results);
      setHasSearched(true);
      showToast(`Found ${results.length} candidate(s).`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Search failed";
      showToast(msg, "error");
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  const avgScore =
    candidates.length > 0
      ? candidates.reduce((a, c) => a + c.combined_score, 0) / candidates.length
      : 0;
  const bestScore =
    candidates.length > 0 ? Math.max(...candidates.map((c) => c.combined_score)) : 0;

  const hasAdvancedFilters =
    locationFilter || minExperience !== "" || maxExperience !== "" || minMatchScore > 0;

  return (
    <PlanGate feature="search_candidates" requiredPlan="business">
      <div className="container px-4 pb-10 pt-24 sm:px-6">
        <header className="mb-8">
          <h1 className="font-headline text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Find talent
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-sm text-vertex-muted sm:text-base">
            Search the pool by skills, location, and more. Results are ranked by match.
          </p>
          {count !== null && (
            <p className="mt-3 text-sm font-medium text-indigo-200/90">
              {count} candidate{count !== 1 ? "s" : ""} in pool
            </p>
          )}
        </header>

        {/* ── Main search bar ── */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Card className="border border-white/[0.07] bg-white/[0.03]">
            <CardContent className="p-4">

              {/* Row 1: skills input + location + sort + button */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-[2]">
                  <label className="mb-1 block text-xs font-medium text-vertex-muted">
                    Required skills
                  </label>
                  <input
                    type="text"
                    value={skillsText}
                    onChange={(e) => setSkillsText(e.target.value)}
                    placeholder="e.g. React, Python, SQL"
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div className="min-w-[140px] flex-1">
                  <label className="mb-1 block text-xs font-medium text-vertex-muted">
                    Location
                  </label>
                  <input
                    type="text"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    placeholder="Any location"
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div className="min-w-[140px] flex-1">
                  <label className="mb-1 block text-xs font-medium text-vertex-muted">
                    Sort by
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "score" | "experience" | "recent")}
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="score">Best Match</option>
                    <option value="experience">Most Experience</option>
                    <option value="recent">Recently Joined</option>
                  </select>
                </div>

                <Button type="submit" disabled={loading} className="gap-2 self-end shrink-0">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </Button>
              </div>

              {/* Selected skills display */}
              {requiredSkills.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-vertex-muted">Skills:</span>
                  {requiredSkills.map((s) => (
                    <span
                      key={s}
                      className="flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs text-indigo-200"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => removeSkill(s)}
                        className="ml-0.5 rounded-full text-indigo-400 hover:text-white"
                        aria-label={`Remove ${s}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Advanced filters toggle */}
              <button
                type="button"
                onClick={() => setAdvancedOpen((o) => !o)}
                className="mt-3 flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300"
              >
                {advancedOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Advanced filters
                {hasAdvancedFilters && !advancedOpen && (
                  <span className="ml-1 rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300">
                    active
                  </span>
                )}
              </button>

              {/* Advanced filters row */}
              {advancedOpen && (
                <div className="mt-3 flex flex-wrap items-end gap-4 border-t border-white/[0.06] pt-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-vertex-muted">
                      Max candidates: {topK}
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={50}
                      step={5}
                      value={topK}
                      onChange={(e) => setTopK(Number(e.target.value))}
                      className="w-36"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-vertex-muted">
                      Min skill matches: {minMatches}
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={minMatches}
                      onChange={(e) => setMinMatches(Number(e.target.value))}
                      className="w-36"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-vertex-muted">
                      Min match score: {minMatchScore}%
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={minMatchScore}
                      onChange={(e) => setMinMatchScore(Number(e.target.value))}
                      className="w-36"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-vertex-muted">
                      Years of experience
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={minExperience === "" ? "" : minExperience}
                        onChange={(e) => setMinExperience(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="Min"
                        className="vertex-input w-16 rounded-lg px-2 py-2 text-sm"
                      />
                      <span className="text-xs text-vertex-muted">to</span>
                      <input
                        type="number"
                        min={0}
                        value={maxExperience === "" ? "" : maxExperience}
                        onChange={(e) => setMaxExperience(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="Max"
                        className="vertex-input w-16 rounded-lg px-2 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </form>

        {/* ── Stats row ── */}
        {candidates.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
              <Users className="h-4 w-4 text-vertex-muted" />
              <span className="text-sm font-medium">{candidates.length} candidates</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
              <TrendingUp className="h-4 w-4 text-vertex-muted" />
              <span className="text-sm font-medium">Avg {avgScore.toFixed(1)}% match</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
              <Award className="h-4 w-4 text-vertex-muted" />
              <span className="text-sm font-medium">Best {bestScore.toFixed(1)}%</span>
            </div>
            <p className="ml-auto text-xs text-vertex-muted">
              Search saved to{" "}
              <Link href="/company/history" className="font-medium text-indigo-400 hover:underline">
                history →
              </Link>
            </p>
          </div>
        )}

        {/* ── Results ── */}
        <div className="mt-6">
          {loading ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              <SkeletonCandidateCard />
              <SkeletonCandidateCard />
              <SkeletonCandidateCard />
            </div>
          ) : candidates.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {candidates.map((c) => {
                const candidateId = c.user_id ?? (c as { id?: number }).id;
                return (
                  <CandidateCardFromApi
                    key={`${c.email}-${c.rank}`}
                    candidate={c}
                    token={token}
                    candidateUserId={candidateId}
                    initialSaved={false}
                    onContactClick={
                      candidateId != null
                        ? (userId, name) => {
                            setSelectedCandidate({ userId, name });
                            setShowContactModal(true);
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          ) : hasSearched ? (
            <Card>
              <CardContent className="py-12 text-center text-vertex-muted">
                No candidates found. Try broadening your skill search or removing filters.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-vertex-muted">
                Enter skills above and click Search to find candidates.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {showContactModal && selectedCandidate && token && (
        <ContactRequestModal
          key={selectedCandidate.userId}
          isOpen={showContactModal}
          onClose={() => {
            setShowContactModal(false);
            setSelectedCandidate(null);
          }}
          candidateUserId={selectedCandidate.userId}
          candidateName={selectedCandidate.name}
          token={token}
        />
      )}
    </PlanGate>
  );
}
