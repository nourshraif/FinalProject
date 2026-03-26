"use client";

import Link from "next/link";
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

const JOB_CARDS = [
  {
    initials: "TC",
    avatarBg: "#6366f1",
    job: "Senior Frontend Engineer",
    company: "TechCorp",
    match: "94%",
    matchColor: "#22c55e",
    borderColor: "#22c55e",
    skills: ["React", "TypeScript", "Node.js"],
  },
  {
    initials: "DF",
    avatarBg: "#7c3aed",
    job: "ML Engineer",
    company: "Dataflow",
    match: "89%",
    matchColor: "#6366f1",
    borderColor: "#6366f1",
    skills: ["Python", "TensorFlow", "Docker"],
    highlight: true,
  },
  {
    initials: "DO",
    avatarBg: "#f59e0b",
    job: "DevOps Engineer",
    company: "DevOps Inc",
    match: "81%",
    matchColor: "#f59e0b",
    borderColor: "#f59e0b",
    skills: ["AWS", "Kubernetes", "Docker"],
  },
];

export default function HomePage() {
  const router = useRouter();
  const { isLoggedIn, user } = useAuth();
  const [stats, setStats] = useState<{ total_jobs: number } | null>(null);
  const [heroSearchQuery, setHeroSearchQuery] = useState("");

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
      <section className="relative pt-28 pb-16">
        <div className="absolute -right-20 -top-40 h-96 w-96 rounded-full bg-v-primary/10 blur-[120px]" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
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
              <p className="mb-10 max-w-xl text-pretty font-light leading-relaxed text-v-onSurfaceVariant">
                Experience a career ecosystem built for clarity. Upload your CV, explore aligned roles, and cut through the noise of typical job boards.
              </p>
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={() => router.push(dashboardHref)}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-v-primary to-v-primaryContainer px-8 py-4 font-label text-sm font-bold uppercase tracking-wider text-v-onPrimaryContainer shadow-lg shadow-v-primary/20 transition-all hover:shadow-v-primary/40 active:scale-95"
                >
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex flex-col gap-6 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => router.push("/auth/register?type=jobseeker")}
                    className="rounded-full bg-gradient-to-br from-v-primary to-v-primaryContainer px-8 py-4 font-label text-sm font-bold uppercase tracking-wider text-v-onPrimaryContainer shadow-lg shadow-v-primary/20 transition-all hover:shadow-v-primary/40 active:scale-95"
                  >
                    Job Seeker
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/auth/register?type=company")}
                    className="glass-card rounded-full border border-v-outlineVariant/20 px-8 py-4 font-label text-sm font-bold uppercase tracking-wider text-v-onSurface transition-all hover:bg-white/5 active:scale-95"
                  >
                    Company
                  </button>
                </div>
              )}
              <div className="mx-auto mt-10 w-full max-w-xl">
                <form
                  className="glass-card flex overflow-hidden rounded-stitch border-v-outlineVariant/20"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const q = heroSearchQuery.trim();
                    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
                  }}
                >
                  <input
                    type="search"
                    placeholder="Search roles, skills, or companies…"
                    value={heroSearchQuery}
                    onChange={(e) => setHeroSearchQuery(e.target.value)}
                    className="h-[52px] flex-1 rounded-none border-0 bg-v-surfaceContainerLowest/50 px-4 text-base text-v-onSurface placeholder:text-v-onSurfaceVariant/50 focus:outline-none focus:ring-2 focus:ring-v-primary/40"
                  />
                  <button
                    type="submit"
                    className="shrink-0 bg-gradient-to-br from-v-primary to-v-primaryContainer px-6 font-label text-sm font-semibold text-v-onPrimaryContainer transition hover:opacity-95"
                  >
                    Search
                  </button>
                </form>
              </div>
              {!isLoggedIn && (
                <Link
                  href="/pricing"
                  className="mt-3 block text-sm text-v-onSurfaceVariant transition-colors hover:text-v-primary"
                >
                  View pricing →
                </Link>
              )}
            </div>

            <div className="relative lg:col-span-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card glass-card-interactive flex aspect-square flex-col items-center justify-center rounded-[2rem] p-6 text-center">
                  <span className="material-symbols-outlined mb-4 text-4xl text-v-primary" aria-hidden>
                    rocket_launch
                  </span>
                  <h3 className="font-headline text-2xl font-bold text-indigo-50">{stat1Value}</h3>
                  <p className="text-xs uppercase tracking-widest text-v-onSurfaceVariant">Roles indexed</p>
                </div>
                <div className="glass-card glass-card-interactive mt-12 flex aspect-square flex-col items-center justify-center rounded-[2rem] p-6 text-center">
                  <span className="material-symbols-outlined mb-4 text-4xl text-v-tertiary" aria-hidden>
                    target
                  </span>
                  <h3 className="font-headline text-2xl font-bold text-indigo-50">Smart</h3>
                  <p className="text-xs uppercase tracking-widest text-v-onSurfaceVariant">Match focus</p>
                </div>
              </div>
              <div className="glass-card glass-card-interactive mt-6 hidden rounded-[2rem] p-6 lg:block">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs text-v-onSurfaceVariant">AI match preview</span>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  <span className="text-xs text-v-onSurfaceVariant">Live</span>
                </div>
                <div className="flex flex-col gap-3">
                  {JOB_CARDS.map((card) => (
                    <div
                      key={card.initials}
                      className="rounded-xl border border-v-outlineVariant/15 bg-v-surfaceContainerLowest/40 p-4"
                      style={{ borderTopWidth: 2, borderTopColor: card.borderColor }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ background: card.avatarBg }}
                          >
                            {card.initials}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-indigo-50">{card.job}</p>
                            <p className="text-xs text-v-onSurfaceVariant">{card.company}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold" style={{ color: card.matchColor }}>
                            {card.match}
                          </p>
                          <p className="text-xs text-v-onSurfaceVariant">Match</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {card.skills.map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-v-surfaceContainerHighest px-2 py-0.5 text-xs text-v-onSurfaceVariant"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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

      {/* SECTION 6 — CTA */}
      <section className="my-14 sm:my-24">
        <div className="container px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-v-primary/25 bg-gradient-to-br from-v-primary/[0.09] via-v-surfaceContainerLow/80 to-transparent px-4 py-14 text-center shadow-[0_0_80px_-20px_rgba(128,131,255,0.45)] sm:px-8 sm:py-16 md:py-20">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(192,193,255,0.2),transparent_50%)]" />
            <div className="relative">
              <h2 className="text-balance font-headline text-3xl font-bold text-white sm:text-4xl">
                Ready to find your match?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-pretty text-v-onSurfaceVariant">
                Join Vertex today—free to start, no credit card required.
              </p>
              <button
                type="button"
                onClick={() => router.push("/auth/register")}
                className="btn-stitch-primary mx-auto mt-8 inline-flex items-center gap-2 px-8 py-3.5"
              >
                Create free account
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-8 text-sm text-v-onSurfaceVariant">
                Already have an account?{" "}
                <Link href="/auth/login" className="font-semibold text-v-primary transition hover:text-v-primaryContainer">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
