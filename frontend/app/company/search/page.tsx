"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { searchCandidates, getCandidateCount } from "@/lib/api";
import type { Candidate } from "@/types";
import { CandidateCardFromApi } from "@/components/CandidateCard";
import ContactRequestModal from "@/components/ContactRequestModal";
import { QuickSkillSelector } from "@/components/QuickSkillSelector";
import { SkillChip } from "@/components/SkillChip";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Loader2, Search, Users, TrendingUp, Award, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlanGate } from "@/components/PlanGate";
import { SkeletonCandidateCard } from "@/components/Skeleton";

export default function CompanySearchPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [quickSkills, setQuickSkills] = useState<string[]>([]);
  const [topK, setTopK] = useState(20);
  const [minMatches, setMinMatches] = useState(1);
  const [useSemantic, setUseSemantic] = useState(true);
  const [locationFilter, setLocationFilter] = useState("");
  const [minExperience, setMinExperience] = useState<number | "">("");
  const [maxExperience, setMaxExperience] = useState<number | "">("");
  const [minMatchScore, setMinMatchScore] = useState(0);
  const [sortBy, setSortBy] = useState<"score" | "experience" | "recent">("score");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);
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
    new Set([
      ...quickSkills,
      ...skillsText
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ])
  );

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
          company_name: companyName || undefined,
          required_skills: requiredSkills,
          top_k: topK,
          min_keyword_matches: minMatches,
          use_semantic: useSemantic,
          location_filter: locationFilter.trim() || undefined,
          min_experience: minExperience === "" ? undefined : Number(minExperience),
          max_experience: maxExperience === "" ? undefined : Number(maxExperience),
          min_match_score: minMatchScore > 0 ? minMatchScore : undefined,
          sort_by: sortBy,
        },
        token
      );
      setCandidates(results);
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

  return (
    <PlanGate feature="search_candidates" requiredPlan="business">
    <div className="container px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-vertex-white">Search Talent</h1>
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="ghost-button flex items-center gap-2 rounded-lg px-3 py-2 text-sm lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </button>
      </div>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[320px_1fr]">
        <Card className={cn("w-full", filtersOpen ? "block" : "hidden", "lg:block")}>
          <CardHeader>
            <CardTitle className="text-lg">Search</CardTitle>
            {count !== null && (
              <p className="text-sm text-vertex-muted">
                {count} candidate{count !== 1 ? "s" : ""} in pool
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company name (optional)</Label>
                <input
                  id="company"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Inc"
                  className="w-full vertex-input px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="skills">Required skills (one per line or comma-separated)</Label>
                <textarea
                  id="skills"
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  placeholder="Python&#10;React&#10;PostgreSQL"
                  rows={4}
                  className="w-full vertex-input px-3 py-2 text-sm"
                />
              </div>

              <QuickSkillSelector selected={quickSkills} onChange={setQuickSkills} />

              <div className="space-y-2">
                <Label>Max candidates: {topK}</Label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Min skill matches: {minMatches}</Label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={minMatches}
                  onChange={(e) => setMinMatches(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase text-vertex-muted">Candidate Location</Label>
                <input
                  type="text"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="Any location"
                  className="w-full vertex-input px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase text-vertex-muted">Years of Experience</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={minExperience === "" ? "" : minExperience}
                    onChange={(e) => setMinExperience(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0"
                    className="vertex-input w-20 rounded-lg px-2 py-2 text-sm"
                  />
                  <span className="text-sm text-vertex-muted">to</span>
                  <input
                    type="number"
                    min={0}
                    value={maxExperience === "" ? "" : maxExperience}
                    onChange={(e) => setMaxExperience(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="20+"
                    className="vertex-input w-20 rounded-lg px-2 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase text-vertex-muted">Minimum Match Score: {minMatchScore}%</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={minMatchScore}
                  onChange={(e) => setMinMatchScore(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase text-vertex-muted">Sort Results By</Label>
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

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={useSemantic}
                  onChange={(e) => setUseSemantic(e.target.checked)}
                  className="rounded border-vertex-border"
                />
                <span className="text-sm">Use semantic matching (AI)</span>
              </label>

              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          {requiredSkills.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-vertex-muted">
                Required skills:
              </span>
              {requiredSkills.map((s) => (
                <SkillChip key={s} skill={s} variant="required" />
              ))}
            </div>
          )}

          {candidates.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-vertex-muted">
                    <Users className="h-4 w-4" />
                    <span className="text-sm font-medium">Candidates</span>
                  </div>
                  <p className="text-2xl font-bold">{candidates.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-vertex-muted">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">Avg match</span>
                  </div>
                  <p className="text-2xl font-bold">{avgScore.toFixed(1)}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-vertex-muted">
                    <Award className="h-4 w-4" />
                    <span className="text-sm font-medium">Best match</span>
                  </div>
                  <p className="text-2xl font-bold">{bestScore.toFixed(1)}%</p>
                </CardContent>
              </Card>
            </div>
          )}

          {candidates.length > 0 && (
            <p className="text-xs text-vertex-muted">
              This search has been saved to your history.{" "}
              <Link
                href="/company/history"
                className="font-medium transition-colors hover:underline"
                style={{ color: "#6366f1" }}
              >
                View History →
              </Link>
            </p>
          )}

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
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-vertex-muted">
                Run a search to see candidates.
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
    </div>
    </PlanGate>
  );
}
