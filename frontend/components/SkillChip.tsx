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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "matched" && "bg-vertex-success/20 text-vertex-success",
        variant === "required" && "bg-vertex-violet/20 text-vertex-cyan",
        variant === "default" && "bg-vertex-card text-vertex-muted",
        className
      )}
    >
      {skill}
    </span>
  );
}
