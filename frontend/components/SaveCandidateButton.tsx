"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { saveCandidate, unsaveCandidate } from "@/lib/api";

export interface SaveCandidateButtonProps {
  candidateUserId: number;
  token: string | null;
  initialSaved?: boolean;
  onSave?: () => void;
  onUnsave?: () => void;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

export function SaveCandidateButton({
  candidateUserId,
  token,
  initialSaved = false,
  onSave,
  onUnsave,
  size = "md",
  showLabel = true,
  className,
}: SaveCandidateButtonProps) {
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    if (!token || isLoading) return;
    const wasSaved = isSaved;
    setIsLoading(true);
    const promise = isSaved
      ? unsaveCandidate(token, candidateUserId)
      : saveCandidate(token, candidateUserId);
    promise
      .then(() => {
        setIsSaved(!isSaved);
        if (!wasSaved) onSave?.();
        else onUnsave?.();
      })
      .catch(() => {
        setIsSaved(wasSaved);
      })
      .finally(() => setIsLoading(false));
  };

  const iconSize = size === "sm" ? 14 : 16;
  const label = isSaved ? "Saved" : "Save";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!token || isLoading}
      className={["inline-flex items-center gap-1.5 rounded-md transition-all duration-300 hover:scale-105 disabled:opacity-50", className].filter(Boolean).join(" ")}
      style={{
        color: isSaved ? "#6366f1" : "#94a3b8",
      }}
      title={showLabel ? undefined : isSaved ? "Remove from saved" : "Save candidate"}
      aria-label={isSaved ? "Unsave candidate" : "Save candidate"}
    >
      {isLoading ? (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-transparent"
          style={{
            borderTopColor: "#6366f1",
            width: iconSize,
            height: iconSize,
          }}
          aria-hidden
        />
      ) : (
        <Bookmark
          className={isSaved ? "fill-current" : ""}
          style={{
            width: iconSize,
            height: iconSize,
            color: isSaved ? "#6366f1" : undefined,
          }}
        />
      )}
      {showLabel && (
        <span className="text-xs font-medium transition-colors duration-300">
          {label}
        </span>
      )}
    </button>
  );
}
