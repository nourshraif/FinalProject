"use client";

import { cn } from "@/lib/utils";

const MOCK_CARDS = [
  {
    initials: "TC",
    title: "Senior Frontend Engineer",
    company: "TechCorp",
    match: "94%",
    matchClass: "text-vertex-success",
    glowClass: "shadow-[0_0_12px_rgba(34,197,94,0.4)]",
    skills: ["React", "TypeScript", "Node.js"],
    offset: "-translate-x-2",
  },
  {
    initials: "DF",
    title: "ML Engineer",
    company: "Dataflow",
    match: "89%",
    matchClass: "text-vertex-success",
    glowClass: "shadow-[0_0_12px_rgba(34,197,94,0.4)]",
    skills: ["Python", "TensorFlow", "Docker"],
    offset: "",
  },
  {
    initials: "DO",
    title: "DevOps Engineer",
    company: "DevOps Inc",
    match: "81%",
    matchClass: "text-vertex-warning",
    glowClass: "shadow-[0_0_12px_rgba(245,158,11,0.3)]",
    skills: [],
    offset: "translate-x-2",
  },
];

function MockCard({
  initials,
  title,
  company,
  match,
  matchClass,
  glowClass,
  skills,
  offset,
  size = "default",
}: {
  initials: string;
  title: string;
  company: string;
  match: string;
  matchClass: string;
  glowClass: string;
  skills: string[];
  offset: string;
  size?: "sm" | "default";
}) {
  return (
    <div
      className={cn(
        "glass-card p-3 border border-vertex-purple/30",
        glowClass,
        offset,
        size === "sm" && "scale-90 opacity-90"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vertex-purple/60 text-xs font-semibold text-white">
            {initials}
          </div>
          <div>
            <p className="font-semibold text-vertex-white text-sm">{title}</p>
            <p className="text-xs text-vertex-muted">{company}</p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
            matchClass
          )}
        >
          {match} Match
        </span>
      </div>
      {skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {skills.map((s) => (
            <span
              key={s}
              className="rounded bg-vertex-card px-1.5 py-0.5 text-xs text-vertex-muted"
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function HeroPreviewPanel() {
  return (
    <div className="relative min-h-[280px]">
      {/* Animated gradient line (drawing effect) */}
      <svg
        className="absolute left-8 top-0 z-0"
        width="2"
        height="280"
        viewBox="0 0 2 280"
        aria-hidden
      >
        <defs>
          <linearGradient id="hero-line-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <line
          x1="1"
          y1="0"
          x2="1"
          y2="280"
          stroke="url(#hero-line-grad)"
          strokeWidth="2"
          strokeDasharray="280"
          strokeDashoffset="280"
          className="animate-draw-line"
        />
      </svg>

      <div className="relative z-10 flex flex-col gap-3 pl-4">
        {MOCK_CARDS.map((card, i) => (
          <MockCard
            key={card.title}
            {...card}
            size={i === 1 ? "default" : "sm"}
          />
        ))}
      </div>
    </div>
  );
}
