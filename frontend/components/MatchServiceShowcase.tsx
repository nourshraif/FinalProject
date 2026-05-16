"use client";

import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Sparkles,
  Target,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_SKILLS = ["Python", "React", "PostgreSQL", "FastAPI", "Docker"];

const DEMO_JOBS = [
  {
    title: "Senior Backend Engineer",
    company: "TechFlow",
    match: 94,
    skills: ["Python", "FastAPI", "PostgreSQL"],
  },
  {
    title: "Full Stack Developer",
    company: "Nova Labs",
    match: 91,
    skills: ["React", "Python", "Docker"],
  },
  {
    title: "Platform Engineer",
    company: "CloudBase",
    match: 87,
    skills: ["Docker", "PostgreSQL", "Python"],
  },
];

const BENEFITS = [
  "Reads your real experience—not just keyword spam",
  "Hybrid AI + vector matching across scraped job boards",
  "Ranked by fit score so you apply where it matters",
  "Free preview: see your top matches instantly",
];

type MatchServiceShowcaseProps = {
  isLoggedIn?: boolean;
  totalJobsLabel?: string;
};

export function MatchServiceShowcase({
  isLoggedIn = false,
  totalJobsLabel = "10K+",
}: MatchServiceShowcaseProps) {
  const matchHref = "/match";
  const ctaLabel = isLoggedIn ? "Match my CV now" : "Try matching free";

  return (
    <section className="relative py-10 sm:py-16" aria-labelledby="match-showcase-heading">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-v-primary/8 blur-[100px]"
        aria-hidden
      />

      <div className="container relative px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Copy */}
          <div>
            <p className="mb-3 font-label text-xs font-semibold uppercase tracking-[0.25em] text-v-primary">
              CV → Skills → Matches
            </p>
            <h2
              id="match-showcase-heading"
              className="text-balance font-headline text-3xl font-bold text-white sm:text-4xl lg:text-[2.75rem]"
            >
              Upload your CV.{" "}
              <span className="bg-gradient-to-r from-v-primary via-v-primaryContainer to-cyan-400 bg-clip-text text-transparent">
                Get ranked jobs in seconds.
              </span>
            </h2>
            <p className="mt-4 max-w-lg text-pretty leading-relaxed text-v-onSurfaceVariant">
              Vertex extracts skills from your PDF, compares them semantically against{" "}
              <span className="font-medium text-white">{totalJobsLabel}</span> live roles, and
              surfaces matches with a clear fit score—so you stop scrolling and start applying.
            </p>

            <ul className="mt-8 space-y-3">
              {BENEFITS.map((b) => (
                <li key={b} className="flex gap-3 text-sm text-v-onSurfaceVariant">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={matchHref}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-v-primary to-v-primaryContainer px-8 py-4 font-label text-sm font-bold uppercase tracking-wider text-v-onPrimaryContainer shadow-lg shadow-v-primary/25 transition hover:shadow-v-primary/40 active:scale-[0.98]"
              >
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {!isLoggedIn && (
                <Link
                  href="/auth/register?type=jobseeker"
                  className="text-center text-sm font-medium text-v-onSurfaceVariant transition hover:text-white sm:text-left"
                >
                  Create free account
                </Link>
              )}
              <Link
                href="/pricing"
                className="text-center text-sm font-medium text-v-primary transition hover:text-v-primaryContainer sm:text-left"
              >
                See Pro benefits →
              </Link>
            </div>
          </div>

          {/* Visual demo */}
          <div className="glass-card glass-card-interactive relative overflow-hidden rounded-3xl border border-v-outlineVariant/15 p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-v-primary/15 blur-3xl" aria-hidden />

            {/* Step 1 — CV */}
            <div className="rounded-2xl border border-dashed border-v-primary/30 bg-v-surfaceContainerLowest/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-v-primary/15">
                  <FileText className="h-5 w-5 text-v-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-v-onSurfaceVariant">
                    Step 1
                  </p>
                  <p className="text-sm font-semibold text-white">Upload your CV (PDF)</p>
                </div>
              </div>
            </div>

            <div className="my-3 flex justify-center" aria-hidden>
              <div className="h-6 w-px bg-gradient-to-b from-v-primary/50 to-transparent" />
            </div>

            {/* Step 2 — Skills */}
            <div className="rounded-2xl border border-v-outlineVariant/15 bg-v-surfaceContainerLowest/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <p className="text-xs font-medium text-v-onSurfaceVariant">
                  AI extracts <span className="text-white">47 skills</span> from your profile
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {DEMO_SKILLS.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-100"
                  >
                    {s}
                  </span>
                ))}
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-v-onSurfaceVariant">
                  +42 more
                </span>
              </div>
            </div>

            <div className="my-3 flex justify-center" aria-hidden>
              <div className="h-6 w-px bg-gradient-to-b from-v-primary/50 to-transparent" />
            </div>

            {/* Step 3 — Matches */}
            <div className="rounded-2xl border border-v-outlineVariant/15 bg-v-surfaceContainerLowest/30 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-v-primary" />
                  <p className="text-sm font-semibold text-white">47 jobs matched</p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                  Live
                </span>
              </div>

              <div className="space-y-2.5">
                {DEMO_JOBS.map((job) => (
                  <div
                    key={job.title}
                    className="flex items-start justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{job.title}</p>
                      <p className="text-xs text-v-onSurfaceVariant">{job.company}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {job.skills.slice(0, 2).map((s) => (
                          <span
                            key={s}
                            className="rounded bg-v-surfaceContainerHighest px-1.5 py-0.5 text-[10px] text-v-onSurfaceVariant"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          job.match >= 90 ? "text-emerald-400" : "text-v-primary"
                        )}
                      >
                        {job.match}%
                      </p>
                      <p className="text-[10px] text-v-onSurfaceVariant">Match</p>
                    </div>
                  </div>
                ))}

                {/* Blurred teaser */}
                <div className="relative overflow-hidden rounded-xl border border-indigo-500/20 bg-indigo-950/30 p-3">
                  <div className="space-y-2 blur-sm select-none" aria-hidden>
                    <div className="h-3 w-3/4 rounded bg-white/10" />
                    <div className="h-2 w-1/2 rounded bg-white/8" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/60 backdrop-blur-[1px]">
                    <Lock className="h-3.5 w-3.5 text-indigo-300" />
                    <span className="text-xs font-medium text-indigo-200">
                      +44 more on Pro
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
