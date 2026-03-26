"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getPostedJobById } from "@/lib/api";
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

export default function JobDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? parseInt(params.id, 10) : NaN;
  const [job, setJob] = useState<PostedJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (Number.isNaN(id)) {
      setLoading(false);
      setError(true);
      return;
    }
    setLoading(true);
    getPostedJobById(id)
      .then(setJob)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center pt-24">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-transparent"
          style={{ borderTopColor: "#6366f1" }}
          aria-hidden
        />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen pt-24 pb-12">
        <div className="mx-auto max-w-[900px] px-6 text-center">
          <p className="text-vertex-muted">Job not found</p>
          <Link href="/jobs" className="mt-4 inline-block text-indigo-400 hover:underline">
            Back to jobs
          </Link>
        </div>
      </div>
    );
  }

  const initial = (job.company_name || "?")[0].toUpperCase();
  const skills = Array.isArray(job.skills_required) ? job.skills_required : [];
  const applyUrl = job.application_url?.trim();
  const applyEmail = job.application_email?.trim();

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto max-w-[900px] px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          {/* Left column — Job details */}
          <div>
            <div className="glass-card mb-4 rounded-2xl p-8">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white"
                  style={{
                    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  }}
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-bold text-white">{job.title}</h1>
                  <p className="gradient-text text-lg font-medium">{job.company_name}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-vertex-muted">
                    {job.location && <span>📍 {job.location}</span>}
                    <span>{job.job_type.replace(/-/g, " ")}</span>
                    <span>{job.experience_level.replace(/-/g, " ")}</span>
                  </div>
                  <p className="mt-2 text-sm text-green-400">{formatSalary(job)}</p>
                  <p className="mt-1 text-xs text-vertex-muted">
                    Posted {daysAgo(job.created_at)}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-card mb-4 rounded-2xl p-8">
              <h2 className="mb-4 text-lg font-bold text-white">About this role</h2>
              <div
                className="whitespace-pre-wrap text-vertex-muted leading-relaxed"
                style={{ lineHeight: "1.7" }}
              >
                {job.description}
              </div>
            </div>

            {job.requirements?.trim() && (
              <div className="glass-card mb-4 rounded-2xl p-8">
                <h2 className="mb-4 text-lg font-bold text-white">Requirements</h2>
                <div className="whitespace-pre-wrap text-vertex-muted leading-relaxed">
                  {job.requirements}
                </div>
              </div>
            )}

            {job.benefits?.trim() && (
              <div className="glass-card mb-4 rounded-2xl p-8">
                <h2 className="mb-4 text-lg font-bold text-white">Benefits & Perks</h2>
                <div className="whitespace-pre-wrap text-vertex-muted leading-relaxed">
                  {job.benefits}
                </div>
              </div>
            )}
          </div>

          {/* Right column — Apply & Company */}
          <div>
            <div className="glass-card mb-4 rounded-2xl p-6">
              <h2 className="mb-4 text-lg font-bold text-white">Apply for this role</h2>
              {skills.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs text-vertex-muted">Skills needed:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-vertex-card px-2 py-0.5 text-xs text-vertex-muted"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {applyUrl ? (
                <a
                  href={applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glow-button mb-4 flex w-full items-center justify-center rounded-lg py-3 font-medium text-white"
                >
                  Apply Now →
                </a>
              ) : applyEmail ? (
                <a
                  href={`mailto:${applyEmail}`}
                  className="glow-button mb-4 flex w-full items-center justify-center rounded-lg py-3 font-medium text-white"
                >
                  Apply via Email
                </a>
              ) : (
                <p className="mb-4 text-sm text-vertex-muted">
                  Contact company for application details.
                </p>
              )}
              <p className="text-xs text-vertex-muted">
                👁 {job.views_count ?? 0} people viewed this
              </p>
            </div>

            <div className="glass-card rounded-2xl p-6">
              <h2 className="mb-4 text-lg font-bold text-white">
                About {job.company_name}
              </h2>
              {job.company_desc?.trim() ? (
                <p className="mb-4 text-sm leading-relaxed text-vertex-muted">
                  {job.company_desc}
                </p>
              ) : null}
              <div className="mb-4 flex flex-wrap gap-2">
                {job.industry && (
                  <span className="rounded-full bg-vertex-card px-2.5 py-0.5 text-xs text-vertex-muted">
                    {job.industry}
                  </span>
                )}
                {job.company_size && (
                  <span className="rounded-full bg-vertex-card px-2.5 py-0.5 text-xs text-vertex-muted">
                    {job.company_size}
                  </span>
                )}
              </div>
              {job.company_website?.trim() && (
                <a
                  href={job.company_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-4 block text-sm text-indigo-400 hover:underline"
                >
                  {job.company_website}
                </a>
              )}
              <Link
                href={`/jobs?company=${encodeURIComponent(job.company_name || "")}`}
                className="ghost-button block w-full rounded-lg py-2.5 text-center text-sm font-medium"
              >
                View all jobs from {job.company_name}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
