import type { Job } from "@/types";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/SaveButton";
import { ExternalLink, MapPin, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface JobCardProps {
  title: string;
  company: string;
  location: string;
  matchScore: number;
  tags: string[];
  url: string;
  description: string | null;
  /** Optional: wire up save action later */
  onSave?: (jobId: number) => void;
  jobId?: number;
  /** If provided, SaveButton is shown with token and initialSaved */
  token?: string | null;
  initialSaved?: boolean;
}

function MatchScoreBadge({ score }: { score: number }) {
  const variant =
    score > 80 ? "green" : score >= 60 ? "yellow" : "red";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "green" && "bg-vertex-success/20 text-vertex-success",
        variant === "yellow" && "bg-vertex-warning/20 text-vertex-warning",
        variant === "red" && "bg-vertex-danger/20 text-vertex-danger"
      )}
      title="Match score"
    >
      {score}%
    </span>
  );
}

export function JobCard(props: JobCardProps) {
  const {
    title,
    company,
    location,
    matchScore,
    tags,
    url,
    description,
    onSave,
    jobId,
    token,
    initialSaved = false,
  } = props;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h3 className="font-semibold leading-tight">{title}</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-vertex-muted">
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {company}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {location}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MatchScoreBadge score={matchScore} />
            {jobId != null && (
              <SaveButton
                jobId={jobId}
                token={token ?? null}
                initialSaved={initialSaved ?? false}
                size="sm"
                showLabel={true}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        {description && (
          <p className="line-clamp-3 text-sm text-vertex-muted">
            {description}
          </p>
        )}
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-vertex-card px-2 py-0.5 text-xs text-vertex-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-2">
        <Button variant="default" size="sm" className="gap-1.5" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            View Job
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

/** Convenience wrapper that accepts a Job from API */
export function JobCardFromJob({
  job,
  onSave,
  token,
  initialSaved,
}: {
  job: Job;
  onSave?: (jobId: number) => void;
  token?: string | null;
  initialSaved?: boolean;
}) {
  return (
    <JobCard
      title={job.title}
      company={job.company}
      location={job.location}
      matchScore={job.match_score}
      tags={job.tags}
      url={job.url}
      description={job.description}
      jobId={job.id}
      onSave={onSave}
      token={token}
      initialSaved={initialSaved}
    />
  );
}
