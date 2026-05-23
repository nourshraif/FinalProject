"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/** Stitch header: Material `api` + Manrope “Vertex” in indigo-300 */
export interface LogoProps {
  size?: "sm" | "lg" | "xl";
  className?: string;
  href?: string;
}

export function Logo({ size = "sm", className, href = "/" }: LogoProps) {
  const iconClass =
    size === "sm"
      ? "text-2xl"
      : size === "lg"
        ? "text-3xl"
        : "text-5xl sm:text-6xl";

  const textClass =
    size === "sm"
      ? "text-xl"
      : size === "lg"
        ? "text-4xl"
        : "text-7xl sm:text-8xl";

  const content = (
    <>
      <span
        className={cn("material-symbols-outlined shrink-0 text-indigo-300", iconClass)}
        style={{ fontVariationSettings: "'FILL' 1, 'wght' 400" }}
        aria-hidden
      >
        api
      </span>
      <span className={cn("font-headline font-bold tracking-tight text-indigo-300", textClass)}>Vertex</span>
    </>
  );

  const wrapperClassName = cn("inline-flex items-center gap-3", className);

  if (href) {
    return (
      <Link href={href} className={wrapperClassName}>
        {content}
      </Link>
    );
  }

  return <span className={wrapperClassName}>{content}</span>;
}
