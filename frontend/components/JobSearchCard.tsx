"use client";

import type { ScrapedJob } from "@/types";
import { SaveButton } from "@/components/SaveButton";

function daysAgo(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
    if (diff === 0) return "Today";
    if (diff === 1) return "1 day ago";
    if (diff < 30) return `${diff} days ago`;
    if (diff < 60) return "1 month ago";
    return `${Math.floor(diff / 30)} months ago`;
  } catch {
    return "";
  }
}

export interface JobSearchCardProps {
  job: ScrapedJob;
  isSaved: boolean;
  token: string | null;
}

export function JobSearchCard({ job, isSaved, token }: JobSearchCardProps) {
  const title = job.job_title || "Job";
  const company = job.company || "Company";
  const location = job.location || "";
  const description = job.description || "";
  const url = job.job_url || "#";

  return (
    <div
      className="glass-card rounded-2xl p-6 transition-all duration-200 hover:border-[rgba(99,102,241,0.3)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-vertex-card px-2.5 py-0.5 text-xs text-vertex-muted">
            {job.source}
          </span>
          <span className="text-xs text-vertex-muted">
            {daysAgo(job.scraped_at)}
          </span>
        </div>
        <SaveButton
          jobId={job.id}
          token={token}
          initialSaved={isSaved}
          size="sm"
          showLabel={false}
        />
      </div>
      <h3 className="mt-2 text-lg font-bold text-white">{title}</h3>
      <p className="text-base text-vertex-muted">{company}</p>
      {location && (
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-vertex-muted">
          <span aria-hidden>📍</span> {location}
        </p>
      )}
      {description && (
        <p className="mt-2 line-clamp-3 text-sm text-vertex-muted">
          {description}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ghost-button rounded-lg px-4 py-2 text-sm font-medium"
        >
          View Job
        </a>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="glow-button rounded-lg px-4 py-2 text-sm font-medium text-white"
        >
          Quick Apply
        </a>
      </div>
    </div>
  );
}
