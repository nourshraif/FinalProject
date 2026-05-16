"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Placeholder card shown for matches hidden behind the free plan preview. */
export function BlurredMatchCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "glass-card relative overflow-hidden rounded-2xl border border-white/[0.06]",
        className
      )}
      aria-hidden
    >
      <div className="p-5 blur-md select-none pointer-events-none">
        <div className="h-5 w-4/5 max-w-[240px] rounded-md bg-white/10" />
        <div className="mt-3 flex gap-3">
          <div className="h-3.5 w-24 rounded bg-white/8" />
          <div className="h-3.5 w-20 rounded bg-white/8" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-16 rounded-full bg-indigo-500/15" />
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-2.5 w-full rounded bg-white/6" />
          <div className="h-2.5 w-5/6 rounded bg-white/6" />
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/55 backdrop-blur-[2px]">
        <Lock className="h-6 w-6 text-indigo-300/90" />
        <span className="text-xs font-medium text-slate-300">Pro match</span>
      </div>
    </div>
  );
}
