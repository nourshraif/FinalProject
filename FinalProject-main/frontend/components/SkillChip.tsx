import { cn } from "@/lib/utils";

export type SkillChipVariant = "matched" | "required" | "default";

export interface SkillChipProps {
  skill: string;
  variant?: SkillChipVariant;
  className?: string;
}

export function SkillChip({ skill, variant = "default", className }: SkillChipProps) {
  return (
    <span
      className={cn(
        "skill-chip inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variant === "matched" && "matched-chip bg-vertex-success/20 text-vertex-success border-transparent",
        variant === "required" && "bg-vertex-violet/20 text-vertex-cyan border-transparent",
        variant === "default" && "bg-vertex-card text-vertex-muted border-transparent",
        className
      )}
    >
      {skill}
    </span>
  );
}
