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
  Star,
} from "lucide-react";
import { Logo } from "@/components/Logo";
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

  useEffect(() => {
    getStats()
      .then((s) => setStats(s))
      .catch(() => setStats(null));
  }, []);

  const stat1Value = stats !== null ? stats.total_jobs >= 10000 ? "10K+" : stats.total_jobs.toLocaleString() : "10K+";
  const dashboardHref = user?.user_type === "company" ? "/dashboard/company" : "/dashboard/jobseeker";

  return (
    <div className="relative">
      {/* SECTION 1 — HERO */}
      <section className="min-h-screen pt-20">
        <div className="container flex flex-col gap-12 px-6 py-12 lg:flex-row lg:items-center lg:gap-8">
          <div className="flex-1 lg:pr-12">
            <p className="mb-6 text-sm text-vertex-muted">
              ✦ Trusted by professionals worldwide
            </p>
            <h1 className="mb-6 text-3xl font-bold leading-tight lg:text-5xl">
              <span className="text-vertex-white">Hit the</span>
              <br />
              <span className="gradient-text">exact point.</span>
            </h1>
            <p
              className="mb-10 max-w-[480px] text-base leading-relaxed"
              style={{ color: "#94a3b8" }}
            >
              Upload your CV and instantly discover the roles you were made for. No guesswork. No noise. Just the right match.
            </p>
            {isLoggedIn ? (
              <button
                type="button"
                onClick={() => router.push(dashboardHref)}
                className="glow-button inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium text-white"
                style={{ background: "#6366f1" }}
              >
                Go to Dashboard →
              </button>
            ) : (
              <>
                <div className="flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => router.push("/auth/register?type=jobseeker")}
                    className="glow-button inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium text-white"
                  >
                    <Search className="h-4 w-4" />
                    Find My Match
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/auth/register?type=company")}
                    className="ghost-button inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium"
                  >
                    <Users className="h-4 w-4" />
                    Hire Talent
                  </button>
                </div>
                <p className="mt-4 text-xs" style={{ color: "#64748b" }}>
                  Free to use  ·  Updated daily  ·  No credit card
                </p>
              </>
            )}
          </div>

          <div className="flex-1 lg:block">
            <div className="relative p-6">
              <div
                className="absolute -inset-5 -z-10 rounded-2xl blur-[30px]"
                style={{
                  background: "radial-gradient(circle, #7c3aed15 0%, transparent 70%)",
                }}
                aria-hidden
              />
              <div className="glass-card animate-float-hero rounded-2xl p-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-vertex-muted">AI Match Results</span>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" style={{ background: "#22c55e" }} />
                  <span className="text-xs text-vertex-muted">Live</span>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  {JOB_CARDS.map((card) => (
                    <div
                      key={card.initials}
                      className="glass-card rounded-xl p-4"
                      style={{
                        borderTop: `2px solid ${card.borderColor}`,
                        padding: card.highlight ? "1.25rem" : "1rem",
                      }}
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
                            <p className="text-sm font-bold text-vertex-white">{card.job}</p>
                            <p className="text-xs text-vertex-muted">{card.company}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold" style={{ color: card.matchColor }}>{card.match}</p>
                          <p className="text-xs text-vertex-muted">Match</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {card.skills.map((s) => (
                          <span
                            key={s}
                            className="rounded px-2 py-0.5 text-xs"
                            style={{
                              background: "#1e1e3a",
                              color: "#94a3b8",
                              border: "1px solid #2a2a3d",
                            }}
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

      {/* SECTION 2 — STATS ROW */}
      <section className="mt-20 py-12">
        <div className="container px-6">
          <div className="grid grid-cols-2 justify-items-center gap-8 md:flex md:flex-wrap md:items-center md:justify-center md:gap-0">
            <div className="text-center md:flex md:items-center">
              <div className="px-4 text-center md:px-10">
                <p className="text-3xl font-bold text-vertex-white">{stat1Value}</p>
                <p className="mt-0.5 text-sm text-vertex-muted">Jobs Available</p>
              </div>
              <div className="hidden h-10 w-px md:block" style={{ background: "#2a2a3d" }} />
            </div>
            <div className="text-center md:flex md:items-center">
              <div className="px-4 text-center md:px-10">
                <p className="text-3xl font-bold text-vertex-white">8</p>
                <p className="mt-0.5 text-sm text-vertex-muted">Job Boards</p>
              </div>
              <div className="hidden h-10 w-px md:block" style={{ background: "#2a2a3d" }} />
            </div>
            <div className="text-center md:flex md:items-center">
              <div className="px-4 text-center md:px-10">
                <p className="text-3xl font-bold text-vertex-white">Free</p>
                <p className="mt-0.5 text-sm text-vertex-muted">To Get Started</p>
              </div>
              <div className="hidden h-10 w-px md:block" style={{ background: "#2a2a3d" }} />
            </div>
            <div className="text-center md:flex md:items-center">
              <div className="px-4 text-center md:px-10">
                <p className="text-3xl font-bold text-vertex-white">Daily</p>
                <p className="mt-0.5 text-sm text-vertex-muted">Fresh Updates</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 — HOW IT WORKS JOB SEEKERS */}
      <section className="py-20">
        <div className="container px-6">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest gradient-text">FOR JOB SEEKERS</p>
          <h2 className="mb-4 text-3xl font-bold text-vertex-white">Land your next role faster</h2>
          <p className="mb-12 text-base text-vertex-muted">Three steps to your perfect match</p>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="glass-card rounded-2xl p-8">
              <p className="text-4xl font-bold gradient-text">01</p>
              <Briefcase className="mt-4 h-8 w-8" style={{ color: "#6366f1" }} />
              <h3 className="mt-4 text-lg font-bold text-vertex-white">Drop in your CV</h3>
              <p className="mt-2 text-sm leading-relaxed text-vertex-muted">
                PDF, any format, any length. We handle the rest automatically.
              </p>
            </div>
            <div className="glass-card rounded-2xl p-8">
              <p className="text-4xl font-bold gradient-text">02</p>
              <Brain className="mt-4 h-8 w-8" style={{ color: "#6366f1" }} />
              <h3 className="mt-4 text-lg font-bold text-vertex-white">We read it properly</h3>
              <p className="mt-2 text-sm leading-relaxed text-vertex-muted">
                We understand your experience and identify what you&apos;re actually good at.
              </p>
            </div>
            <div className="glass-card rounded-2xl p-8">
              <p className="text-4xl font-bold gradient-text">03</p>
              <Zap className="mt-4 h-8 w-8" style={{ color: "#6366f1" }} />
              <h3 className="mt-4 text-lg font-bold text-vertex-white">See only what fits</h3>
              <p className="mt-2 text-sm leading-relaxed text-vertex-muted">
                Jobs ranked by how well they match your background. Worth applying to, every one.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — HOW IT WORKS COMPANIES */}
      <section className="py-20">
        <div className="container px-6">
          <div className="glass-card rounded-2xl p-8 md:p-12">
            <p className="mb-4 text-xs font-medium uppercase tracking-widest gradient-text">FOR COMPANIES</p>
            <h2 className="mb-4 text-3xl font-bold text-vertex-white">
              Find the right talent, not just any talent
            </h2>
            <p className="mb-12 text-base text-vertex-muted">
              Stop sifting through irrelevant applications
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="glass-card rounded-xl p-6">
                <p className="text-4xl font-bold gradient-text">01</p>
                <Search className="mt-4 h-8 w-8" style={{ color: "#6366f1" }} />
                <h3 className="mt-4 text-lg font-bold text-vertex-white">Enter what you need</h3>
                <p className="mt-2 text-sm leading-relaxed text-vertex-muted">
                  Tell us the skills and experience level you are looking for in simple terms.
                </p>
              </div>
              <div className="glass-card rounded-xl p-6">
                <p className="text-4xl font-bold gradient-text">02</p>
                <Brain className="mt-4 h-8 w-8" style={{ color: "#6366f1" }} />
                <h3 className="mt-4 text-lg font-bold text-vertex-white">We search intelligently</h3>
                <p className="mt-2 text-sm leading-relaxed text-vertex-muted">
                  Our system reads candidate profiles the same way a human recruiter would.
                </p>
              </div>
              <div className="glass-card rounded-xl p-6">
                <p className="text-4xl font-bold gradient-text">03</p>
                <Users className="mt-4 h-8 w-8" style={{ color: "#6366f1" }} />
                <h3 className="mt-4 text-lg font-bold text-vertex-white">See ranked candidates</h3>
                <p className="mt-2 text-sm leading-relaxed text-vertex-muted">
                  Every candidate scored by relevance. The best fit always rises to the top.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 — FEATURES */}
      <section className="py-20">
        <div className="container px-6">
          <h2 className="text-center text-3xl font-bold text-vertex-white">Built different</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-base text-vertex-muted">
            Everything you&apos;d expect. Nothing you don&apos;t need.
          </p>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            <div className="glass-card rounded-2xl p-8 transition-colors hover:border-indigo-500/40">
              <Shield className="mb-4 h-10 w-10" style={{ color: "#6366f1" }} />
              <h3 className="text-lg font-bold text-vertex-white">Matches that make sense</h3>
              <p className="mt-2 text-sm leading-relaxed text-vertex-muted">
                Not just keyword matching. Vertex understands your experience and finds roles that genuinely fit your background.
              </p>
            </div>
            <div className="glass-card rounded-2xl p-8 transition-colors hover:border-indigo-500/40">
              <Globe className="mb-4 h-10 w-10" style={{ color: "#6366f1" }} />
              <h3 className="text-lg font-bold text-vertex-white">One place for everything</h3>
              <p className="mt-2 text-sm leading-relaxed text-vertex-muted">
                Stop jumping between job boards. Every major platform searched and ranked for you automatically.
              </p>
            </div>
            <div className="glass-card rounded-2xl p-8 transition-colors hover:border-indigo-500/40">
              <Users className="mb-4 h-10 w-10" style={{ color: "#6366f1" }} />
              <h3 className="text-lg font-bold text-vertex-white">Built for both sides</h3>
              <p className="mt-2 text-sm leading-relaxed text-vertex-muted">
                Job seekers find better roles. Companies find better people. Everyone gets what they came for.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — CTA BANNER */}
      <section className="my-20">
        <div className="container px-6">
          <div
            className="glass-card rounded-2xl py-16 px-6 text-center md:py-20 md:px-12"
            style={{
              border: "1px solid rgba(99,102,241,0.3)",
              background: "rgba(99,102,241,0.05)",
              boxShadow: "0 0 60px rgba(124,58,237,0.1)",
            }}
          >
            <h2 className="mb-4 text-3xl font-bold text-vertex-white">Ready to find your match?</h2>
            <p className="mb-8 text-base text-vertex-muted">Join Vertex today. Free to get started.</p>
            <button
              type="button"
              onClick={() => router.push("/auth/register")}
              className="glow-button mx-auto inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium text-white"
            >
              Create Free Account
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-6 text-sm text-vertex-muted">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-medium hover:underline" style={{ color: "#6366f1" }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 7 — FOOTER */}
      <footer className="border-t py-12" style={{ borderColor: "#1e1e3a" }}>
        <div className="container px-6">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div>
              <Logo size="sm" href="/" />
              <p className="mt-0.5 text-xs text-vertex-muted">© 2026 Vertex. All rights reserved.</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-vertex-muted">
              {/* TODO: replace # with real routes */}
              <Link href="#" className="transition-colors hover:text-vertex-white">
                Privacy Policy
              </Link>
              <Link href="#" className="transition-colors hover:text-vertex-white">
                Terms
              </Link>
              <Link href="#" className="transition-colors hover:text-vertex-white">
                Contact
              </Link>
              <Link href="#" className="transition-colors hover:text-vertex-white">
                About
              </Link>
            </div>
            <p className="text-right text-sm text-vertex-muted md:text-right">
              Made with ♥ for job seekers everywhere
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
