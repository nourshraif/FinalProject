"use client";

import { cn } from "@/lib/utils";

const shimmerClass = "animate-skeleton-shimmer rounded-md";

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(shimmerClass, className)}
      style={{
        background: "linear-gradient(90deg, #1e1e3a 25%, #2a2a4a 50%, #1e1e3a 75%)",
        backgroundSize: "200% 100%",
        ...style,
      }}
    />
  );
}

export function SkeletonJobCard() {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4" style={{ width: "60%", height: 16 }} />
          <Skeleton className="h-3" style={{ width: "40%", height: 12 }} />
        </div>
        <Skeleton
          className="h-8 w-8 shrink-0 rounded-full"
          style={{ width: 32, height: 32 }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Skeleton className="h-5 w-14" style={{ height: 20, width: 56 }} />
        <Skeleton className="h-5 w-16" style={{ height: 20, width: 64 }} />
        <Skeleton className="h-5 w-12" style={{ height: 20, width: 48 }} />
      </div>
    </div>
  );
}

export function SkeletonCandidateCard() {
  return (
    <div className="glass-card flex items-center gap-3 rounded-xl p-4">
      <Skeleton
        className="h-10 w-10 shrink-0 rounded-full"
        style={{ width: 40, height: 40 }}
      />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4" style={{ width: "70%", height: 16 }} />
        <Skeleton className="h-3" style={{ width: "50%", height: 12 }} />
      </div>
      <div className="flex flex-wrap gap-1">
        <Skeleton className="h-5 w-12" style={{ height: 20, width: 48 }} />
        <Skeleton className="h-5 w-14" style={{ height: 20, width: 56 }} />
        <Skeleton className="h-5 w-10" style={{ height: 20, width: 40 }} />
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="glass-card rounded-xl p-5">
      <Skeleton className="mb-1 h-8" style={{ height: 32, width: "60%" }} />
      <Skeleton className="h-3 w-2/3" style={{ height: 14, width: "66%" }} />
    </div>
  );
}

export function SkeletonProfileHeader() {
  return (
    <div className="glass-card flex flex-col gap-4 p-8 sm:flex-row sm:items-start">
      <Skeleton
        className="h-20 w-20 shrink-0 rounded-full"
        style={{ width: 80, height: 80 }}
      />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-7 w-48" style={{ height: 28, width: 192 }} />
        <Skeleton className="h-4 w-64" style={{ height: 16, width: 256 }} />
        <Skeleton className="h-3 w-32" style={{ height: 12, width: 128 }} />
      </div>
    </div>
  );
}
