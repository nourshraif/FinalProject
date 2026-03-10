"use client";

import { useState } from "react";
import type { Candidate } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SkillChip } from "@/components/SkillChip";
import { SaveCandidateButton } from "@/components/SaveCandidateButton";
import { ChevronDown, ChevronUp, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CandidateCardProps {
  rank: number;
  full_name: string;
  email: string;
  matched_skills: string[];
  skills: string[];
  keyword_score: number;
  vector_score: number;
  combined_score: number;
  cv_filename?: string;
  created_at?: string;
  headerRight?: React.ReactNode;
}

function ScoreBadge({ score }: { score: number }) {
  const variant =
    score >= 70 ? "green" : score >= 40 ? "yellow" : "red";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "green" && "bg-vertex-success/20 text-vertex-success",
        variant === "yellow" && "bg-vertex-warning/20 text-vertex-warning",
        variant === "red" && "bg-vertex-danger/20 text-vertex-danger"
      )}
    >
      {score}%
    </span>
  );
}

export function CandidateCard(props: CandidateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    rank,
    full_name,
    email,
    matched_skills,
    skills,
    keyword_score,
    vector_score,
    combined_score,
    cv_filename,
    created_at,
    headerRight,
  } = props;

  const matchedSet = new Set(matched_skills.map((s) => s.toLowerCase()));

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-vertex-muted">
                #{rank}
              </span>
              <h3 className="font-semibold leading-tight">{full_name}</h3>
            </div>
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-1.5 text-sm text-vertex-muted hover:text-vertex-white"
            >
              <Mail className="h-3.5 w-3.5" />
              {email}
            </a>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ScoreBadge score={Math.round(combined_score)} />
            {headerRight}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-vertex-muted">Keyword:</span>
          <span className="text-sm font-medium">{keyword_score}%</span>
          <span className="text-xs text-vertex-muted">Semantic:</span>
          <span className="text-sm font-medium">{vector_score}%</span>
        </div>

        <div>
          <p className="text-xs font-medium text-vertex-muted mb-1.5">
            Matched skills
          </p>
          <div className="flex flex-wrap gap-1.5">
            {matched_skills.length > 0 ? (
              matched_skills.map((s) => (
                <SkillChip key={s} skill={s} variant="matched" />
              ))
            ) : (
              <span className="text-xs text-vertex-muted">—</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-xs font-medium text-vertex-purple hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Hide all skills
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Show all skills
            </>
          )}
        </button>

        {expanded && (
          <div className="pt-2 border-t border-vertex-border">
            <p className="text-xs font-medium text-vertex-muted mb-1.5">
              All skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(skills || []).map((s) => (
                <SkillChip
                  key={s}
                  skill={s}
                  variant={matchedSet.has(s.toLowerCase()) ? "matched" : "default"}
                />
              ))}
            </div>
            {cv_filename && (
              <p className="mt-2 text-xs text-vertex-muted">
                CV: {cv_filename}
              </p>
            )}
            {created_at && (
              <p className="text-xs text-vertex-muted">
                Registered: {new Date(created_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Convenience wrapper for API Candidate */
export function CandidateCardFromApi({
  candidate,
  token = null,
  candidateUserId,
  initialSaved = false,
}: {
  candidate: Candidate;
  token?: string | null;
  candidateUserId?: number;
  initialSaved?: boolean;
}) {
  const headerRight =
    candidateUserId != null && token ? (
      <SaveCandidateButton
        candidateUserId={candidateUserId}
        token={token}
        initialSaved={initialSaved}
        showLabel={true}
      />
    ) : undefined;
  return (
    <CandidateCard
      rank={candidate.rank}
      full_name={candidate.full_name}
      email={candidate.email}
      matched_skills={candidate.matched_skills}
      skills={candidate.skills}
      keyword_score={candidate.keyword_score}
      vector_score={candidate.vector_score}
      combined_score={candidate.combined_score}
      cv_filename={candidate.cv_filename}
      created_at={candidate.created_at}
      headerRight={headerRight}
    />
  );
}
