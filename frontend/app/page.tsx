"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Search,
  Users,
  Briefcase,
  Brain,
  Zap,
  Shield,
  Globe,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getStats } from "@/lib/api";
import { HeroMatchPanel } from "@/components/HeroMatchPanel";

export default function HomePage() {
  const router = useRouter();
  const { isLoggedIn, user } = useAuth();
  const [stats, setStats] = useState<{ total_jobs: number } | null>(null);

  useEffect(() => {
    getStats()
      .then((s) => setStats(s))
      .catch(() => setStats(null));
  }, []);

  const stat1Value = stats !== null ? stats.total_jobs >= 10000 ? "10K+" : stats.total_jobs.toLocaleString() : "10K+";
  const dashboardHref = user?.user_type === "company" ? "/dashboard/company" : "/dashboard/jobseeker";

  return (
    <div className="aurora-bg relative min-h-screen overflow-hidden pb-16">
      {/* SECTION 1 — HERO (Stitch: primary → primary-container, on-surface copy) */}
      <section className="hero-section relative pt-28 pb-16">
        <div className="absolute -right-20 -top-40 h-96 w-96 rounded-full bg-v-primary/10 blur-[120px]" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-v-tertiaryContainer/20 bg-v-tertiaryContainer/10 px-3 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-v-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-v-primary" />
                </span>
                <span className="font-label text-xs font-bold uppercase italic tracking-widest text-v-primary">
                  Precision matching
                </span>
              </div>
              <h1 className="mb-8 text-balance font-headline text-5xl font-extrabold leading-[1.08] tracking-tight text-white md:text-6xl lg:text-7xl">
                Where talent <br />
                <span className="bg-gradient-to-r from-v-primary via-v-primary to-v-primaryContainer bg-clip-text text-transparent">
                  meets opportunity.
                </span>
              </h1>
              {isLoggedIn && (
                <button
                  type="button"
                  onClick={() => router.push(dashboardHref)}
                  className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-v-primary to-v-primaryContainer px-8 py-4 font-label text-sm font-bold uppercase tracking-wider text-v-onPrimaryContainer shadow-lg shadow-v-primary/20 transition-all hover:shadow-v-primary/40 active:scale-95"
                >
                  Go to dashboard
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="relative lg:col-span-6">
              <HeroMatchPanel rolesIndexedLabel={stat1Value} />
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider mx-auto max-w-5xl px-6" />

      {/* SECTION 2 — STATS */}
      <section className="mt-12 py-10 sm:mt-16 sm:py-14">
        <div className="container px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { value: stat1Value, label: "Jobs available" },
              { value: "8", label: "Job boards" },
              { value: "Free", label: "To get started" },
              { value: "Daily", label: "Fresh updates" },
            ].map((s) => (
              <div
                key={s.label}
                className="glass-card glass-card-interactive rounded-2xl px-4 py-6 text-center md:px-6"
              >
                <p className="font-headline text-3xl font-bold tabular-nums text-white md:text-4xl">{s.value}</p>
                <p className="mt-1.5 font-label text-xs font-medium uppercase tracking-widest text-v-onSurfaceVariant">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider mx-auto max-w-5xl px-6" />

      {/* SECTION 3 — JOB SEEKERS */}
      <section className="py-14 sm:py-24">
        <div className="container px-4 sm:px-6">
          <p className="mb-3 font-label text-xs font-semibold uppercase tracking-[0.25em] text-v-primary">
            For job seekers
          </p>
          <h2 className="mb-3 max-w-2xl text-balance font-headline text-3xl font-bold text-white sm:text-4xl">
            Land your next role faster
          </h2>
          <p className="mb-10 max-w-xl text-pretty text-v-onSurfaceVariant sm:mb-14">
            From upload to offer—everything you need in one flow.
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

      {/* SECTION 4 — COMPANIES */}
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

      {/* SECTION 5 — FEATURES */}
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
                <div
                  key={f.title}
                  className="glass-card glass-card-interactive rounded-2xl p-8"
                >
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
