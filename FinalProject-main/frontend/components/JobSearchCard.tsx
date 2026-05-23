"use client";

import type { ScrapedJob } from "@/types";
import { SaveButton } from "@/components/SaveButton";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";

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
  showAnalyzeGap?: boolean;
  isProUser?: boolean;
}

export function JobSearchCard({
  job,
  isSaved,
  token,
  showAnalyzeGap = false,
  isProUser = false,
}: JobSearchCardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const title = job.job_title || "Job";
  const company = job.company || "Company";
  const location = job.location || "";
  const description = job.description || "";
  const url = job.job_url || "#";

  return (
    <div className="glass-card rounded-2xl p-6 transition-all duration-200 hover:border-[rgba(99,102,241,0.3)]">
      <div className="flex items-center justify-between gap-2">
        <span
          className="rounded-full border px-2 py-1 text-xs"
          style={{
            background: "#1e1e3a",
            color: "#94a3b8",
            borderColor: "#2a2a3d",
          }}
        >
          {job.source}
        </span>
        <SaveButton
          jobId={job.id}
          token={token}
          initialSaved={isSaved}
          size="sm"
          showLabel={false}
        />
      </div>
      <h3 className="mt-3 text-base font-bold text-white">{title}</h3>
      <p className="mt-1 text-sm text-vertex-muted">{company}</p>
      {location && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-vertex-muted">
          <span aria-hidden>📍</span> {location}
        </p>
      )}
      {description && (
        <p className="mt-2 line-clamp-3 text-sm text-vertex-muted">
          {description}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-vertex-border pt-4">
        <span className="text-xs text-vertex-muted">{daysAgo(job.scraped_at)}</span>
        <div className="flex items-center gap-2">
          {showAnalyzeGap && (
            <button
              type="button"
              className="ghost-button rounded-lg px-3 py-1.5 text-xs font-medium"
              onClick={() => {
                if (isProUser) {
                  router.push(`/skills-gap?job_id=${job.id}`);
                  return;
                }
                showToast("Skills Gap Analyzer requires Pro plan", "info");
                router.push("/pricing");
              }}
            >
              📊 Analyze My Gap
            </button>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="ghost-button rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            View Job
          </a>
        </div>
      </div>
    </div>
  );
}
