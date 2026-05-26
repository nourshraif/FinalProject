"use client";

import Link from "next/link";
import type { PostedJob } from "@/types";

function formatSalary(job: PostedJob): string {
  if (job.salary_min != null || job.salary_max != null) {
    const min = job.salary_min != null ? `${Math.round(job.salary_min / 1000)}k` : "?";
    const max = job.salary_max != null ? `${Math.round(job.salary_max / 1000)}k` : "?";
    return `${min} - ${max} ${job.salary_currency || "USD"}/year`;
  }
  return "Competitive salary";
}

function daysAgo(createdAt: string): string {
  try {
    const d = new Date(createdAt);
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

export interface PostedJobCardProps {
  job: PostedJob;
  showCompany?: boolean;
}

export function PostedJobCard({ job, showCompany = true }: PostedJobCardProps) {
  const initial = (job.company_name || "?")[0].toUpperCase();
  const skills = Array.isArray(job.skills_required) ? job.skills_required : [];
  const displaySkills = skills.slice(0, 4);
  const moreCount = skills.length - 4;
  const descPreview = (job.description || "").replace(/\s+/g, " ").slice(0, 120);
  const hasSalary = job.salary_min != null || job.salary_max != null;

  return (
    <div
      className="glass-card rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(99,102,241,0.3)]"
    >
      {/* Top row: avatar, title, company, featured, job type */}
      <div className="mb-4 flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          }}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight text-white">{job.title}</h3>
          {showCompany && (
            <p className="mt-0.5 text-sm text-vertex-muted">{job.company_name}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {job.is_featured && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
              ⭐ Featured
            </span>
          )}
          <span className="rounded-full px-2 py-0.5 text-xs text-indigo-300" style={{ background: "rgba(99, 102, 241, 0.2)" }}>
            {job.job_type.replace(/-/g, " ")}
          </span>
        </div>
      </div>

      {/* Middle: location, salary, experience, skills, description */}
      <div className="space-y-2">
        {job.location && (
          <p className="flex items-center gap-1.5 text-sm text-vertex-muted">
            <span aria-hidden>📍</span> {job.location}
          </p>
        )}
        <p className={`text-sm ${hasSalary ? "text-green-400" : "text-vertex-muted"}`}>
          {formatSalary(job)}
        </p>
        <p className="text-xs text-vertex-muted">
          {job.experience_level.replace(/-/g, " ")}
        </p>
        {displaySkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {displaySkills.map((s) => (
              <span
                key={s}
                className="rounded-md px-2 py-0.5 text-xs text-vertex-muted"
                style={{ background: "rgba(42, 42, 61, 0.8)" }}
              >
                {s}
              </span>
            ))}
            {moreCount > 0 && (
              <span className="text-xs text-vertex-muted">+{moreCount} more</span>
            )}
          </div>
        )}
        {descPreview && (
          <p className="line-clamp-2 text-sm text-vertex-muted">{descPreview}</p>
        )}
      </div>

      {/* Bottom: posted date, View Details */}
      <div className="mt-4 flex items-center justify-between border-t border-vertex-border pt-4">
        <span className="text-xs text-vertex-muted">
          Posted {daysAgo(job.created_at)}
        </span>
        <Link
          href={`/jobs/${job.id}`}
          className="ghost-button rounded-lg px-3 py-1.5 text-sm font-medium"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
