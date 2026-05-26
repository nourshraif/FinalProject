"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Building2,
  ExternalLink,
  Briefcase,
} from "lucide-react";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  adminGetJobs,
  adminDeleteJob,
  adminDeletePostedJob,
  getJobSources,
} from "@/lib/api";
import type { AdminJobListingType } from "@/lib/api";
import type { AdminJobListingKind, AdminJobRow } from "@/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

type ListingTab = { id: AdminJobListingType; label: string };

const LISTING_TABS: ListingTab[] = [
  { id: "all", label: "All listings" },
  { id: "job_boards", label: "Job boards" },
  { id: "vertex", label: "Vertex jobs" },
];

type Props = {
  token: string;
  showToast: (msg: string, type: "success" | "error") => void;
};

type DeleteTarget = { id: number; kind: AdminJobListingKind } | null;

function listingLabel(kind: AdminJobListingKind): string {
  return kind === "vertex" ? "Vertex job" : "Job board";
}

function sourceLabel(job: AdminJobRow): string {
  if (job.listing_kind === "vertex") return "Vertex";
  return job.source || "Unknown";
}

function AdminJobCard({
  job,
  onDelete,
}: {
  job: AdminJobRow;
  onDelete: () => void;
}) {
  const postedLabel = job.listed_at
    ? new Date(job.listed_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  return (
    <article className="rounded-xl border border-[#1e1e3a] bg-[#0f0f1a]/80 p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                job.listing_kind === "vertex"
                  ? "bg-indigo-500/20 text-indigo-300"
                  : "bg-cyan-500/15 text-cyan-300"
              )}
            >
              {listingLabel(job.listing_kind)}
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-slate-300">
              {sourceLabel(job)}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-vertex-muted">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  job.is_active ? "bg-green-500" : "bg-red-500"
                )}
              />
              {job.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <h3 className="text-lg font-semibold leading-snug text-white">{job.job_title}</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-vertex-muted">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {job.company}
            </span>
            {job.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {job.location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 shrink-0" />
              {postedLabel}
            </span>
          </div>
          {(job.job_type || job.experience_level) && (
            <p className="text-xs text-vertex-muted">
              {[job.job_type, job.experience_level].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="ghost-button shrink-0 rounded-lg p-2 text-slate-400 hover:text-red-400"
          aria-label="Delete job"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {job.description ? (
        <div className="mb-4 max-h-[min(24rem,50vh)] overflow-y-auto rounded-lg border border-white/5 bg-black/20 p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
            {job.description}
          </p>
        </div>
      ) : (
        <p className="mb-4 text-sm italic text-vertex-muted">No description provided.</p>
      )}

      {job.job_url && (
        <a
          href={job.job_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400 hover:text-indigo-300"
        >
          View listing
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </article>
  );
}

export function AdminJobsSection({ token, showToast }: Props) {
  const [jobs, setJobs] = useState<AdminJobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [listingType, setListingType] = useState<AdminJobListingType>("all");
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    adminGetJobs(token, {
      limit: PAGE_SIZE,
      offset,
      search: search || undefined,
      source: listingType !== "vertex" ? source || undefined : undefined,
      listing_type: listingType,
    })
      .then((r) => {
        setJobs(r.jobs);
        setTotal(r.total);
      })
      .catch((e) =>
        showToast(e instanceof Error ? e.message : "Failed to load jobs", "error")
      )
      .finally(() => setLoading(false));
  }, [token, offset, search, source, listingType, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getJobSources()
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return;
    try {
      if (deleteTarget.kind === "vertex") {
        await adminDeletePostedJob(token, deleteTarget.id);
      } else {
        await adminDeleteJob(token, deleteTarget.id);
      }
      showToast("Job deleted", "success");
      setJobs((prev) =>
        prev.filter(
          (j) => !(j.id === deleteTarget.id && j.listing_kind === deleteTarget.kind)
        )
      );
      setTotal((t) => Math.max(0, t - 1));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + PAGE_SIZE, total);
  const showSourceFilter = listingType !== "vertex";

  return (
    <div className="glass-card mt-6 rounded-xl p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">Job listings</h2>
        <p className="mt-1 text-xs text-vertex-muted">
          Full job details — filter by Vertex postings or external job boards. Remove only; content
          is not editable here.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-[#1e1e3a] pb-4">
        {LISTING_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setListingType(tab.id);
              setOffset(0);
              if (tab.id === "vertex") setSource("");
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              listingType === tab.id
                ? "bg-vertex-accent text-white"
                : "text-vertex-muted hover:bg-white/5 hover:text-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <input
          type="search"
          className="vertex-input min-w-[200px] flex-1 px-3 py-2 text-sm"
          placeholder="Search title, company, description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (setOffset(0), load())}
        />
        {showSourceFilter && (
          <select
            className="vertex-input px-3 py-2 text-sm"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All job board sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => {
            setOffset(0);
            load();
          }}
          className="ghost-button rounded-lg px-3 py-2 text-sm"
        >
          Search
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      ) : jobs.length === 0 ? (
        <p className="py-12 text-center text-sm text-vertex-muted">No jobs found</p>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <AdminJobCard
              key={`${job.listing_kind}-${job.id}`}
              job={job}
              onDelete={() => setDeleteTarget({ id: job.id, kind: job.listing_kind })}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-vertex-muted">
          Showing {start}-{end} of {total} jobs
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            className="ghost-button flex items-center rounded px-2 py-1 text-xs disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            className="ghost-button flex items-center rounded px-2 py-1 text-xs disabled:opacity-50"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete job"
        message="Delete this job listing? This cannot be undone."
        confirmText="Delete"
        confirmStyle="destructive"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
