"use client";

import { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const QUICK_SKILLS = [
  "Python",
  "JavaScript",
  "React",
  "Node.js",
  "SQL",
  "PostgreSQL",
  "MongoDB",
  "Docker",
  "Kubernetes",
  "AWS",
  "Machine Learning",
  "Deep Learning",
  "Django",
  "Flask",
  "TypeScript",
  "Java",
  "C++",
  "Git",
  "REST API",
  "GraphQL",
] as const;

export interface QuickSkillSelectorProps {
  selected: string[];
  onChange: (skills: string[]) => void;
  className?: string;
}

export function QuickSkillSelector({
  selected,
  onChange,
  className,
}: QuickSkillSelectorProps) {
  const toggle = useCallback(
    (skill: string) => {
      const set = new Set(selected);
      if (set.has(skill)) set.delete(skill);
      else set.add(skill);
      onChange(Array.from(set));
    },
    [selected, onChange]
  );

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">Quick add</Label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {QUICK_SKILLS.map((skill) => (
          <label
            key={skill}
            className="flex cursor-pointer items-center gap-2 text-sm text-vertex-muted"
          >
            <input
              type="checkbox"
              checked={selected.includes(skill)}
              onChange={() => toggle(skill)}
              className="rounded border-vertex-border"
            />
            {skill}
          </label>
        ))}
      </div>
    </div>
  );
}
