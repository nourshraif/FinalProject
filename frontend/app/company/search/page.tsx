"use client";

import { useState, useCallback } from "react";
import { searchCandidates, getCandidateCount } from "@/lib/api";
import type { Candidate } from "@/types";
import { CandidateCardFromApi } from "@/components/CandidateCard";
import { QuickSkillSelector } from "@/components/QuickSkillSelector";
import { SkillChip } from "@/components/SkillChip";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Search, Users, TrendingUp, Award } from "lucide-react";
import { toast } from "sonner";

export default function CompanySearchPage() {
  const { token } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [quickSkills, setQuickSkills] = useState<string[]>([]);
  const [topK, setTopK] = useState(15);
  const [minMatches, setMinMatches] = useState(1);
  const [useSemantic, setUseSemantic] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const loadCount = useCallback(() => {
    getCandidateCount()
      .then(setCount)
      .catch(() => setCount(0));
  }, []);

  if (count === null) loadCount();

  const requiredSkills = [
    ...new Set([
      ...quickSkills,
      ...skillsText
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ]),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requiredSkills.length === 0) {
      toast.error("Add at least one skill.");
      return;
    }
    setLoading(true);
    try {
      const results = await searchCandidates({
        company_name: companyName || undefined,
        required_skills: requiredSkills,
        top_k: topK,
        min_matches: minMatches,
        use_semantic: useSemantic,
      });
      setCandidates(results);
      toast.success(`Found ${results.length} candidate(s).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Search failed";
      toast.error(msg);
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
    <div className="container py-8">
      <h1 className="mb-6 text-2xl font-bold">Search Talent</h1>

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <Card>
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

          {loading ? (
            <div className="flex items-center gap-2 text-vertex-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              Searching…
            </div>
          ) : candidates.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {candidates.map((c) => (
                <CandidateCardFromApi
                  key={`${c.email}-${c.rank}`}
                  candidate={c}
                  token={token}
                  candidateUserId={c.user_id}
                  initialSaved={false}
                />
              ))}
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
    </div>
  );
}
