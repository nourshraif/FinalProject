"use client";

import { useCallback, useState } from "react";
import { uploadCV, matchJobs, uploadProfileCV } from "@/lib/api";
import type { MatchJobsResult, Skill } from "@/types";
import { toast } from "sonner";
import { Upload, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CVUploaderProps {
  /** Called with job results after upload + match (on submit) */
  onMatchComplete?: (result: MatchJobsResult) => void;
  /** Optional: called when skills are extracted so parent can display them */
  onSkillsExtracted?: (skills: Skill[]) => void;
  /** Optional: called when an error occurs */
  onError?: (message: string) => void;
  /** Optional: called when loading state changes (e.g. for showing skeletons) */
  onLoadingChange?: (loading: boolean) => void;
  /** When set with persistToProfile, uploads CV via /api/profile/upload-cv (saves skills + file). */
  token?: string | null;
  /** If true and token is set, persist CV and skills to the user profile before matching. */
  persistToProfile?: boolean;
  /** Called after a successful profile CV upload (before matching). */
  onPersistedToProfile?: () => void;
  className?: string;
}

export function CVUploader({
  onMatchComplete,
  onSkillsExtracted,
  onError,
  onLoadingChange,
  token,
  persistToProfile = false,
  onPersistedToProfile,
  className,
}: CVUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);

  const handleFileSelect = useCallback((f: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    setFile(f);
    setError(null);
    setSkills([]);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      handleFileSelect(f ?? null);
    },
    [handleFileSelect]
  );

  const handleSubmit = useCallback(async () => {
    if (!file) return;
    setError(null);
    setLoading(true);
    onLoadingChange?.(true);
    try {
      let extractedSkills: Skill[];
      if (persistToProfile && token) {
        const r = await uploadProfileCV(token, file);
        extractedSkills = r.skills_extracted ?? [];
        onPersistedToProfile?.();
        toast.success("CV saved to your profile");
      } else {
        extractedSkills = await uploadCV(file);
        toast.success("CV uploaded successfully");
      }
      setSkills(extractedSkills);
      onSkillsExtracted?.(extractedSkills);
      const matchResult = await matchJobs(extractedSkills);
      onMatchComplete?.(matchResult);
      const n = matchResult.jobs?.length ?? 0;
      toast.success(`Loaded ${n} matching job${n !== 1 ? "s" : ""}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setError(message);
      onError?.(message);
      toast.error(message);
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }, [file, onMatchComplete, onSkillsExtracted, onError, onLoadingChange, onPersistedToProfile, persistToProfile, token]);

  const canSubmit = Boolean(file && !loading);

  return (
    <div className={cn("space-y-4", className)}>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-vertex-border bg-vertex-card/50 p-6 transition-colors",
          dragging && "border-vertex-purple/50 bg-vertex-card",
          loading && "pointer-events-none opacity-70"
        )}
      >
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={onInputChange}
          className="absolute h-0 w-0 opacity-0"
          id="cv-upload"
          disabled={loading}
        />
        <label
          htmlFor="cv-upload"
          className="flex cursor-pointer flex-col items-center gap-2 text-center"
        >
          {loading ? (
            <Loader2 className="h-10 w-10 animate-spin text-vertex-muted" />
          ) : (
            <Upload className="h-10 w-10 text-vertex-muted" />
          )}
          <span className="text-sm font-medium">
            {loading
              ? "Extracting skills and finding jobs…"
              : "Drop your CV here or click to browse"}
          </span>
          <span className="text-xs text-vertex-muted">PDF only</span>
        </label>
      </div>

      {file && !loading && (
        <div className="flex items-center gap-2 rounded-md border border-vertex-border bg-vertex-card/50 px-3 py-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-vertex-muted" />
          <span className="truncate">{file.name}</span>
        </div>
      )}

      {skills.length > 0 && !loading && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-vertex-muted">Extracted skills:</span>
          {skills.map((s) => (
            <span key={s} className="rounded-md bg-vertex-card px-2 py-1 text-sm">
              {s}
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {canSubmit && (
        <Button onClick={handleSubmit} disabled={loading} className="gap-2">
          Find Matching Jobs
        </Button>
      )}
    </div>
  );
}
