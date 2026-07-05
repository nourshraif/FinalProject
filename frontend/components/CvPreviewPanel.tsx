"use client";

import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { displayCvName, isPdfCv } from "@/lib/cv-formats";

type Props = {
  filename: string;
  previewUrl: string | null;
  loading: boolean;
  error?: boolean;
  /** Extracted CV text — used as preview for Word/text files when PDF iframe isn't possible */
  cvText?: string | null;
  title?: string;
};

export function CvPreviewPanel({
  filename,
  previewUrl,
  loading,
  error = false,
  cvText,
  title = "Your CV",
}: Props) {
  const displayName = displayCvName(filename);
  const isPdf = isPdfCv(filename);
  const textPreview =
    cvText && cvText.trim().length > 0
      ? cvText.length > 8000
        ? `${cvText.slice(0, 8000)}\n\n… (truncated)`
        : cvText
      : null;

  return (
    <>
      <div
        className="mb-4 flex items-center gap-3 rounded-lg p-3"
        style={{
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.2)",
        }}
      >
        <FileText className="h-5 w-5 shrink-0" style={{ color: "#22c55e" }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium" style={{ color: "#22c55e" }}>
            CV uploaded
          </p>
          <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {displayName}
          </p>
        </div>
        {previewUrl && (
          <a
            href={previewUrl}
            download={displayName}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Download
          </a>
        )}
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Preview
        </p>
        {loading ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-white/10 bg-black/20">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        ) : error ? (
          <div
            className="rounded-xl border border-white/10 p-4 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Could not load CV preview. Try uploading again.
          </div>
        ) : previewUrl && isPdf ? (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
            <iframe
              src={`${previewUrl}#toolbar=1&navpanes=0`}
              title={title}
              className="h-[480px] w-full"
              style={{ border: "none" }}
            />
          </div>
        ) : textPreview ? (
          <div className="max-h-[480px] overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-4">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-300">
              {textPreview}
            </pre>
          </div>
        ) : previewUrl ? (
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <FileText className="h-8 w-8 shrink-0 text-indigo-400" />
            <div>
              <p className="text-sm text-white">{displayName}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Word and text files can&apos;t be previewed here. Use Download to open your CV.
              </p>
            </div>
          </div>
        ) : (
          <div
            className="rounded-xl border border-white/10 p-4 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Could not load CV preview. Try uploading again.
          </div>
        )}
      </div>
    </>
  );
}
