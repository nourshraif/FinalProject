"use client";

import Link from "next/link";
import { ArrowRight, User, Building2, Briefcase } from "lucide-react";

const TEASER_BTN_CLASS =
  "mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-v-primary to-v-primaryContainer px-4 py-3 text-xs font-bold uppercase tracking-wider text-v-onPrimaryContainer shadow-lg shadow-v-primary/20 transition hover:opacity-95 hover:shadow-v-primary/35 sm:text-sm";

type HeroMatchPanelProps = {
  rolesIndexedLabel?: string;
};

function RolesStatBar({ count }: { count: string }) {
  return (
    <div className="group relative">
      <div
        className="absolute -inset-px rounded-[1.75rem] bg-gradient-to-r from-v-primary/50 via-indigo-400/30 to-v-tertiary/40 opacity-70 blur-[1px] transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-br from-indigo-950/90 via-[#0e182c]/95 to-v-surfaceContainerLowest/40 px-6 py-5 shadow-[0_12px_40px_rgba(99,102,241,0.15)] backdrop-blur-xl sm:px-8 sm:py-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-v-primary/80 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-v-primary/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-8 -left-6 h-28 w-28 rounded-full bg-v-tertiary/20 blur-3xl"
          aria-hidden
        />

        <div className="relative flex items-center justify-center gap-3 sm:gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-v-primary/30 bg-v-primary/10 shadow-inner shadow-v-primary/10 sm:h-12 sm:w-12">
            <Briefcase className="h-5 w-5 text-v-primary sm:h-6 sm:w-6" aria-hidden />
          </span>
          <div className="flex items-baseline gap-2 sm:gap-3">
            <span className="font-headline text-4xl font-extrabold tabular-nums tracking-tight bg-gradient-to-b from-white to-indigo-200 bg-clip-text text-transparent sm:text-5xl">
              {count}
            </span>
            <span className="bg-gradient-to-r from-v-primary via-indigo-300 to-v-primaryContainer bg-clip-text font-label text-base font-bold uppercase tracking-[0.2em] text-transparent sm:text-lg">
              roles
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CandidateTeaser() {
  return (
    <div className="glass-card glass-card-interactive flex min-h-[220px] flex-col overflow-hidden rounded-[2rem] border border-v-primary/20 p-5 sm:min-h-[240px] sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <User className="h-5 w-5 shrink-0 text-v-primary" aria-hidden />
        <span className="text-xs font-bold uppercase tracking-widest text-v-primary">Job seekers</span>
      </div>

      <h3 className="text-balance font-headline text-lg font-extrabold leading-snug text-white sm:text-xl">
        Get matched to jobs{" "}
        <span className="bg-gradient-to-r from-v-primary to-v-primaryContainer bg-clip-text text-transparent">
          you&apos;re qualified for
        </span>
      </h3>

      <Link href="/match" className={TEASER_BTN_CLASS}>
        Match my CV
        <ArrowRight className="h-4 w-4 shrink-0" />
      </Link>
    </div>
  );
}

function CompanyTeaser() {
  return (
    <div className="glass-card glass-card-interactive flex min-h-[220px] flex-col overflow-hidden rounded-[2rem] border border-v-tertiary/20 p-5 sm:min-h-[240px] sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <Building2 className="h-5 w-5 shrink-0 text-v-tertiary" aria-hidden />
        <span className="text-xs font-bold uppercase tracking-widest text-v-tertiary">Companies</span>
      </div>

      <h3 className="text-balance font-headline text-lg font-extrabold leading-snug text-white sm:text-xl">
        Find talent{" "}
        <span className="bg-gradient-to-r from-v-tertiary to-v-primary bg-clip-text text-transparent">
          that fits the role
        </span>
      </h3>

      <Link href="/company" className={TEASER_BTN_CLASS}>
        For companies
        <ArrowRight className="h-4 w-4 shrink-0" />
      </Link>
    </div>
  );
}

export function HeroMatchPanel({ rolesIndexedLabel = "10K+" }: HeroMatchPanelProps) {
  return (
    <div className="space-y-4">
      <RolesStatBar count={rolesIndexedLabel} />

      <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
        <CandidateTeaser />
        <CompanyTeaser />
      </div>
    </div>
  );
}
