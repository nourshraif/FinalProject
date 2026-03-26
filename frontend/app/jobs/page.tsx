"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getPostedJobs } from "@/lib/api";
import { PostedJobCard } from "@/components/PostedJobCard";
import type { PostedJob } from "@/types";

const JOB_TYPES = ["", "full-time", "part-time", "contract", "internship", "remote"];
const EXPERIENCE_LEVELS = ["", "junior", "mid", "senior", "lead", "any"];

export default function JobsBoardPage() {
  const [jobs, setJobs] = useState<PostedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [jobType, setJobType] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    getPostedJobs({
      limit: 50,
      offset: 0,
      job_type: jobType || undefined,
      experience_level: experienceLevel || undefined,
      search: search.trim() || undefined,
    })
      .then((list) => setJobs(Array.isArray(list) ? list : []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [search, jobType, experienceLevel]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto max-w-[1100px] px-6">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Browse Jobs</h1>
            <p className="mt-1 text-sm text-vertex-muted">
              Jobs posted directly by companies on Vertex
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-vertex-card px-4 py-1.5 text-sm font-medium text-white">
            {jobs.length} open position{jobs.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Search jobs..."
            className="vertex-input flex-1 rounded-lg px-4 py-2.5 text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <select
              className="vertex-input w-[140px] rounded-lg px-3 py-2.5 text-white"
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
            >
              <option value="">All types</option>
              {JOB_TYPES.filter(Boolean).map((t) => (
                <option key={t} value={t}>
                  {t.replace(/-/g, " ")}
                </option>
              ))}
            </select>
            <select
              className="vertex-input w-[140px] rounded-lg px-3 py-2.5 text-white"
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
            >
              <option value="">All levels</option>
              {EXPERIENCE_LEVELS.filter(Boolean).map((l) => (
                <option key={l} value={l}>
                  {l === "mid" ? "Mid" : l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-transparent"
              style={{ borderTopColor: "#6366f1" }}
              aria-hidden
            />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl py-16 text-center">
            <p className="text-vertex-muted">No jobs posted yet</p>
            <p className="mt-2 text-sm text-vertex-muted">
              Be the first to post a job —{" "}
              <Link
                href="/auth/register?type=company"
                className="font-medium text-indigo-400 hover:underline"
              >
                Register as a company
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {jobs.map((job) => (
              <PostedJobCard key={job.id} job={job} showCompany />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
