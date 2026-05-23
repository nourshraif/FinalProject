"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Brain, Target, Zap, Shield, Eye, Globe } from "lucide-react";
import { getStats } from "@/lib/api";

type TeamMember = {
  name: string;
  role: string;
  bio: string;
  initials: string;
  linkedIn?: string;
};

const TEAM: TeamMember[] = [
  {
    name: "Nour Shreif",
    role: "Founder",
    bio: "Built Vertex from scratch to make hiring simpler, faster, and fairer for everyone.",
    initials: "NS",
  },
  {
    name: "Rayan Tleis",
    role: "Founder",
    bio: "Built Vertex from scratch to make hiring simpler, faster, and fairer for everyone.",
    initials: "RT",
  },
  {
    name: "Rima Msheik",
    role: "Founder",
    bio: "Built Vertex from scratch to make hiring simpler, faster, and fairer for everyone.",
    initials: "RM",
  },
];

export default function AboutPageClient() {
  const [totalJobs, setTotalJobs] = useState<number | null>(null);

  useEffect(() => {
    getStats()
      .then((s) => setTotalJobs(s.total_jobs))
      .catch(() => setTotalJobs(null));
  }, []);

  const statJobs = useMemo(() => {
    if (typeof totalJobs !== "number") return "988+";
    return `${totalJobs}+`;
  }, [totalJobs]);

  return (
    <div className="aurora-bg min-h-screen bg-transparent pb-20">
      <section className="px-6 pb-20 pt-32">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-1 text-xs font-semibold text-indigo-200">
            Our Story
          </span>
          <h1 className="mt-6 text-5xl font-bold leading-tight">
            <span className="block text-white">Built for the people</span>
            <span className="block bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-transparent">
              who build things
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-[600px] text-center text-base leading-relaxed text-slate-300">
            A better way to connect talent with opportunity.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-[700px] text-center">
          <div className="glass-card rounded-2xl p-12 shadow-[0_0_60px_-20px_rgba(99,102,241,0.35)]">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Why we exist
            </p>
            <p className="mt-6 text-xl font-medium leading-relaxed text-white">
              Finding the right job — or the right person — should not feel like searching for a needle in a haystack.
            </p>
            <div className="my-8" aria-hidden />
            <p className="mx-auto max-w-[500px] text-base leading-relaxed text-slate-400">
              We built Vertex because we believed there was a smarter way. One that actually understands people, not just their keywords.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-[800px]">
          <div className="glass-card relative rounded-3xl border border-indigo-500/30 bg-indigo-500/[0.03] p-16 text-center">
            <span className="absolute left-6 top-4 text-6xl text-indigo-400/80">&quot;</span>
            <p className="mx-auto max-w-2xl text-2xl font-medium leading-relaxed text-white">
              To make sure the right person always finds the right opportunity — based on what they can actually do, not just the words on their CV.
            </p>
            <p className="mt-6 text-sm text-slate-400">— The Vertex Team</p>
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-[1000px]">
          <h2 className="text-center text-3xl font-bold text-white">How Vertex works differently</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-300">
            We built something smarter than keyword search. Here is how it works in plain terms.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <div className="glass-card rounded-2xl p-6">
              <Brain className="h-10 w-10 text-indigo-300" />
              <h3 className="mt-4 text-lg font-bold text-white">We actually read your CV</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Most platforms scan for keywords and move on. We understand your experience the same way a recruiter would — looking at the full picture, not just matching words.
              </p>
            </div>
            <div className="glass-card rounded-2xl p-6">
              <Target className="h-10 w-10 text-indigo-300" />
              <h3 className="mt-4 text-lg font-bold text-white">Only relevant matches</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                You stop seeing jobs that have nothing to do with your background. Companies stop seeing candidates who don&apos;t fit. Everyone saves time.
              </p>
            </div>
            <div className="glass-card rounded-2xl p-6">
              <Zap className="h-10 w-10 text-indigo-300" />
              <h3 className="mt-4 text-lg font-bold text-white">Always fresh opportunities</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                We check 8+ job boards automatically every day so you never miss a new opportunity — and never see the same stale listing twice.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-[900px]">
          <h2 className="mb-12 text-center text-3xl font-bold text-white">Who built this</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {TEAM.map((member) => (
              <div key={member.name} className="glass-card rounded-2xl p-8 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-2xl font-bold text-white">
                  {member.initials}
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">{member.name}</h3>
                <p className="mt-1 bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-sm text-transparent">
                  {member.role}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{member.bio}</p>
                {member.linkedIn && (
                  <a
                    href={member.linkedIn}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-xs text-indigo-300 hover:text-indigo-200"
                  >
                    LinkedIn →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-5 md:grid-cols-4">
            {[
              { value: statJobs, label: "Jobs Available" },
              { value: "8", label: "Job Boards Integrated" },
              { value: "2", label: "User Types Served" },
              { value: "1", label: "Platform, Built Different" },
            ].map((stat, idx) => (
              <div
                key={stat.label}
                className={`text-center ${idx < 3 ? "md:border-r md:border-white/15" : ""}`}
              >
                <p className="bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-5xl font-bold text-transparent">
                  {stat.value}
                </p>
                <p className="mt-2 text-base text-white">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-[900px]">
          <h2 className="mb-8 text-3xl font-bold text-white">What we believe in</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                icon: Shield,
                title: "Merit over connections",
                body: "The best candidate should get the job — regardless of who they know. Skills and experience speak for themselves on Vertex.",
              },
              {
                icon: Eye,
                title: "Transparency",
                body: "No black boxes. You see your match score, which skills matched, and why a job was recommended to you.",
              },
              {
                icon: Globe,
                title: "Accessibility",
                body: "Free to get started, always. Everyone deserves access to good job matching regardless of budget.",
              },
              {
                icon: Zap,
                title: "Speed",
                body: "The right match shouldn&apos;t take months. Vertex helps people find relevant opportunities in seconds.",
              },
            ].map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.title} className="glass-card rounded-2xl p-6">
                  <div className="flex items-center gap-3">
                    <Icon className="h-8 w-8 text-indigo-300" />
                    <h3 className="text-lg font-bold text-white">{v.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{v.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-[700px]">
          <h2 className="mb-8 text-3xl font-bold text-white">Our journey</h2>
          <div className="relative space-y-6 pl-8 before:absolute before:bottom-0 before:left-2 before:top-0 before:border-l before:border-dashed before:border-indigo-400/40 before:content-['']">
            {[
              {
                date: "2025",
                title: "The idea",
                body: "Frustrated with job boards that relied purely on keywords, we started building something smarter.",
                muted: false,
              },
              {
                date: "Early 2026",
                title: "First version launched",
                body: "Vertex goes live with better CV reading, daily job updates from 8 boards, and a platform built for both job seekers and companies.",
                muted: false,
              },
              {
                date: "2026",
                title: "Growing the platform",
                body: "Adding company job postings, contact requests, and clearer insights. The platform is evolving.",
                muted: false,
              },
              {
                date: "Future",
                title: "What's next",
                body: "Mobile app, Arabic language support, interview preparation coach, and expanding across the MENA region.",
                muted: true,
              },
            ].map((m) => (
              <div key={m.title} className="relative">
                <span className={`absolute -left-[29px] top-3 h-3 w-3 rounded-full ${m.muted ? "bg-slate-500" : "bg-indigo-400"}`} />
                <div className={`glass-card rounded-xl p-5 ${m.muted ? "border border-dashed border-slate-500/40 opacity-80" : ""}`}>
                  <p className={`text-sm font-semibold ${m.muted ? "text-slate-400" : "text-indigo-300"}`}>{m.date}</p>
                  <h3 className={`mt-1 text-lg font-bold ${m.muted ? "text-slate-300" : "text-white"}`}>{m.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{m.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="glass-card rounded-3xl border border-indigo-400/30 bg-indigo-500/[0.04] px-8 py-16 text-center shadow-[0_0_80px_-20px_rgba(99,102,241,0.5)]">
            <h2 className="text-3xl font-bold text-white">Ready to experience better matching?</h2>
            <p className="mt-3 text-base text-slate-300">Join Vertex today — free to get started.</p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/auth/register?type=jobseeker" className="glow-button rounded-full px-8 py-3 font-semibold text-white">
                Find Jobs
              </Link>
              <Link href="/auth/register?type=company" className="ghost-button rounded-full px-8 py-3 font-semibold text-white">
                Hire Talent
              </Link>
            </div>
          </div>
          <p className="mt-8 text-center text-sm text-slate-400">
            Have questions?{" "}
            <a href="mailto:support@vertex.com" className="text-indigo-300 hover:text-indigo-200">
              Contact us
            </a>{" "}
            ·{" "}
            <Link href="/privacy" className="text-indigo-300 hover:text-indigo-200">
              Read our Privacy Policy
            </Link>{" "}
            ·{" "}
            <Link href="/terms" className="text-indigo-300 hover:text-indigo-200">
              Terms of Service
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

