"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Brain,
  Globe,
  Shield,
  Users,
  Search,
  Zap,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getStats } from "@/lib/api";
import type { Stats } from "@/types";
import { HeroMatchPanel } from "@/components/HeroMatchPanel";

export default function HomePage() {
  const router = useRouter();
  const { isLoggedIn, user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getStats()
      .then((s) => setStats(s))
      .catch(() => setStats(null));
  }, []);

  const rolesLabel =
    stats !== null
      ? stats.total_jobs >= 10000
        ? "10K+"
        : stats.total_jobs.toLocaleString()
      : "2,194";

  const heroStats = useMemo(
    () => [
      {
        key: "boards" as const,
        label: "Job boards",
        value:
          stats?.job_board_count != null
            ? String(stats.job_board_count)
            : "…",
      },
      { key: "pricing" as const, label: "To get started", value: "Free" },
      { key: "updates" as const, label: "Fresh updates", value: "Daily" },
    ],
    [stats?.job_board_count]
  );

  const dashboardHref =
    user?.user_type === "company" ? "/dashboard/company" : "/dashboard/jobseeker";

  return (
    <div className="aurora-bg relative min-h-screen overflow-hidden pb-16">
      {/* Hero */}
      <section className="hero-section relative pt-28 pb-0">
        <div
          className="pointer-events-none absolute -right-24 top-[12%] h-[min(480px,55vw)] w-[min(480px,55vw)] rounded-full bg-indigo-500/25 blur-[100px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/2 top-[35%] h-64 w-[min(720px,90vw)] -translate-x-1/2 rounded-full bg-v-primary/10 blur-[80px]"
          aria-hidden
        />

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14 xl:gap-16">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-v-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-v-primary" />
                </span>
                <span className="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-white/90">
                  Precision matching
                </span>
              </div>

              <h1 className="text-balance font-headline text-5xl font-extrabold leading-[1.06] tracking-tight text-white sm:text-6xl lg:text-[4.25rem] lg:leading-[1.05]">
                Where talent{" "}
                <br className="hidden sm:block" />
                meets{" "}
                <span className="bg-gradient-to-r from-white via-indigo-100 to-v-primaryContainer bg-clip-text text-transparent">
                  opportunity.
                </span>
              </h1>

              {isLoggedIn && (
                <button
                  type="button"
                  onClick={() => router.push(dashboardHref)}
                  className="mt-10 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-v-primary to-v-primaryContainer px-8 py-4 font-label text-sm font-bold uppercase tracking-wider text-v-onPrimaryContainer shadow-lg shadow-v-primary/25 transition-all hover:shadow-v-primary/40 active:scale-[0.98]"
                >
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-v-primary/30 via-indigo-500/15 to-transparent opacity-80 blur-2xl"
                aria-hidden
              />
              <HeroMatchPanel rolesIndexedLabel={rolesLabel} />
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="relative mt-8 sm:mt-10">
        <div className="section-divider mx-auto max-w-7xl px-6" />
        <div className="mx-auto max-w-7xl px-6 pt-5 sm:pt-6">
          <div className="overflow-hidden rounded-t-2xl border border-b-0 border-white/[0.08] bg-gradient-to-b from-[#0f1a30]/95 to-[#0e182c]/60 shadow-[0_-6px_28px_rgba(99,102,241,0.06)]">
            <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
              {heroStats.map(({ key, label, value }) => (
                <div
                  key={key}
                  className="flex min-h-[72px] flex-col items-center justify-center gap-0.5 px-3 py-4 sm:min-h-[76px] sm:py-5"
                >
                  <p className="font-headline text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
                    {value}
                  </p>
                  <p className="font-label text-[10px] font-medium uppercase tracking-widest text-v-onSurfaceVariant/80 sm:text-[11px]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Job seekers */}
      <section className="py-14 sm:py-24">
        <div className="container px-4 sm:px-6">
          <p className="mb-3 font-label text-xs font-semibold uppercase tracking-[0.25em] text-v-primary">
            For job seekers
          </p>
          <h2 className="mb-3 max-w-2xl text-balance font-headline text-3xl font-bold text-white sm:text-4xl">
            Land your next role faster
          </h2>
          <p className="mb-10 max-w-xl text-pretty text-v-onSurfaceVariant sm:mb-14">
            Three steps from upload to matches that actually fit your story.
          </p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                icon: Briefcase,
                title: "Drop in your CV",
                body: "PDF, any format, any length. We handle the rest automatically.",
              },
              {
                step: "02",
                icon: Brain,
                title: "We read it properly",
                body: "We surface what you're strong at—not just buzzwords.",
              },
              {
                step: "03",
                icon: Zap,
                title: "See only what fits",
                body: "Ranked matches worth your time. Less spray-and-pray.",
              },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.step}
                  className="glass-card glass-card-interactive group relative overflow-hidden rounded-2xl p-8"
                >
                  <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-v-primary/5 blur-2xl transition-opacity group-hover:opacity-100" />
                  <p className="bg-gradient-to-br from-v-primary to-v-primaryContainer bg-clip-text font-headline text-4xl font-bold text-transparent">
                    {c.step}
                  </p>
                  <Icon className="mt-4 h-8 w-8 text-v-primary" aria-hidden />
                  <h3 className="mt-4 font-headline text-lg font-bold text-white">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-v-onSurfaceVariant">{c.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="section-divider mx-auto max-w-5xl px-6" />

      {/* Companies */}
      <section className="py-14 sm:py-24">
        <div className="container px-4 sm:px-6">
          <div className="glass-card glass-card-interactive relative overflow-hidden rounded-3xl border-v-outlineVariant/15 p-6 sm:p-10 md:p-14">
            <div className="pointer-events-none absolute -left-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-v-tertiaryContainer/10 blur-3xl" />
            <p className="mb-3 font-label text-xs font-semibold uppercase tracking-[0.25em] text-v-tertiary">
              For companies
            </p>
            <h2 className="mb-3 max-w-2xl text-balance font-headline text-3xl font-bold text-white sm:text-4xl">
              Find the right talent—not just any talent
            </h2>
            <p className="mb-10 max-w-xl text-pretty text-v-onSurfaceVariant sm:mb-12">
              Stop sifting through irrelevant applications. Start with signal.
            </p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {[
                {
                  step: "01",
                  icon: Search,
                  title: "Enter what you need",
                  body: "Skills and seniority in plain language—no rigid forms.",
                },
                {
                  step: "02",
                  icon: Brain,
                  title: "Search intelligently",
                  body: "Profiles read the way a strong recruiter would read them.",
                },
                {
                  step: "03",
                  icon: Users,
                  title: "See ranked candidates",
                  body: "Relevance-first ordering. The best fit rises naturally.",
                },
              ].map((c) => {
                const Icon = c.icon;
                return (
                  <div
                    key={c.step}
                    className="rounded-2xl border border-v-outlineVariant/10 bg-v-surfaceContainerLowest/30 p-6 transition-colors hover:border-v-outlineVariant/25"
                  >
                    <p className="bg-gradient-to-br from-v-tertiary to-v-primary bg-clip-text font-headline text-3xl font-bold text-transparent">
                      {c.step}
                    </p>
                    <Icon className="mt-3 h-8 w-8 text-v-primary" aria-hidden />
                    <h3 className="mt-3 font-headline text-lg font-bold text-white">{c.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-v-onSurfaceVariant">{c.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-14 sm:py-24">
        <div className="container px-4 sm:px-6">
          <h2 className="text-center font-headline text-3xl font-bold text-white sm:text-4xl">Built different</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-pretty text-v-onSurfaceVariant">
            Everything you need to move faster—without the clutter of a typical job site.
          </p>
          <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                icon: Shield,
                title: "Matches that make sense",
                body: "Beyond keywords—context from your real experience.",
              },
              {
                icon: Globe,
                title: "One place for everything",
                body: "Search and ranking across sources, in one calm view.",
              },
              {
                icon: Users,
                title: "Built for both sides",
                body: "Candidates and teams each get clarity—not noise.",
              },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="glass-card glass-card-interactive rounded-2xl p-8">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-v-primary/10 ring-1 ring-v-primary/20">
                    <Icon className="h-6 w-6 text-v-primary" aria-hidden />
                  </div>
                  <h3 className="font-headline text-lg font-bold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-v-onSurfaceVariant">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
