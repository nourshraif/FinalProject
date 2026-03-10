import Link from "next/link";
import { cn } from "@/lib/utils";

/** Upward triangle with cyan-to-purple gradient fill */
function VertexIcon({ className, size }: { className?: string; size: "sm" | "lg" | "xl" }) {
  const dim = size === "sm" ? 20 : size === "lg" ? 36 : 56;
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="vertex-icon-gradient" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#06b6d4" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path
        d="M12 2L4 22h16L12 2z"
        fill="url(#vertex-icon-gradient)"
      />
    </svg>
  );
}

export interface LogoProps {
  size?: "sm" | "lg" | "xl";
  className?: string;
  href?: string;
}

export function Logo({ size = "sm", className, href = "/" }: LogoProps) {
  const content = (
    <>
      <VertexIcon size={size} />
      <span className="inline">
        <span className="font-bold text-vertex-white">Vert</span>
        <span className="font-bold gradient-text">ex</span>
      </span>
    </>
  );

  const wrapperClassName = cn(
    "inline-flex items-center gap-1.5",
    size === "sm" && "text-xl",
    size === "lg" && "text-4xl",
    size === "xl" && "text-7xl sm:text-8xl",
    className
  );

  if (href) {
    return (
      <Link href={href} className={wrapperClassName}>
        {content}
      </Link>
    );
  }

  return <span className={wrapperClassName}>{content}</span>;
}
