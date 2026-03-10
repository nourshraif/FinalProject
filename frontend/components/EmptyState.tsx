"use client";

import { FileQuestion, Inbox, ChevronDown, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export type EmptyStateVariant = "no-cv" | "no-jobs";

export interface EmptyStateProps {
  variant: EmptyStateVariant;
  /** Optional id of the upload zone to scroll to (e.g. "cv-upload-zone") */
  uploadZoneId?: string;
}

export function EmptyState({ variant, uploadZoneId = "cv-upload-zone" }: EmptyStateProps) {
  if (variant === "no-cv") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-vertex-border bg-vertex-card/50 py-12 px-6 text-center">
        <Inbox className="h-12 w-12 text-vertex-muted mb-3" />
        <h3 className="font-semibold text-foreground mb-1">No CV uploaded yet</h3>
        <p className="text-sm text-vertex-muted mb-4 max-w-sm">
          Drop your PDF CV above or click to browse. Then click “Find Matching Jobs” to see results.
        </p>
        <a
          href={`#${uploadZoneId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-vertex-purple hover:underline"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(uploadZoneId)?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <ChevronDown className="h-4 w-4" />
          Go to upload
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-vertex-border bg-vertex-card/50 py-12 px-6 text-center">
      <FileQuestion className="h-12 w-12 text-vertex-muted mb-3" />
      <h3 className="font-semibold text-foreground mb-1">No jobs matched</h3>
      <p className="text-sm text-vertex-muted mb-4 max-w-sm">
        Try uploading a different CV or run the scraper to refresh job listings.
      </p>
      <Button variant="outline" size="sm" className="gap-2" asChild>
        <Link href="/dashboard">
          <RefreshCw className="h-4 w-4" />
          Run scraper
        </Link>
      </Button>
    </div>
  );
}
