"use client";

import { useState, useCallback } from "react";
import type { Job } from "@/types";
import { CVUploader } from "@/components/CVUploader";
import { JobCardFromJob } from "@/components/JobCard";
import { FilterSidebar } from "@/components/FilterSidebar";
import { SkeletonJobCard } from "@/components/SkeletonJobCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const SKELETON_COUNT = 6;

export default function MatchPage() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleMatchComplete = useCallback((results: Job[]) => {
    setJobs(results);
    setError(null);
    setHasSearched(true);
  }, []);

  const handleMatchError = useCallback((message: string) => {
    setError(message);
    setJobs([]);
    setHasSearched(true);
    toast.error(message);
  }, []);

  const noCVYet = !jobsLoading && jobs.length === 0 && !hasSearched && !error;
  const noJobsMatched = !jobsLoading && hasSearched && jobs.length === 0;

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-2xl font-bold">Match Jobs</h1>

      <div id="cv-upload-zone" className="mb-8 scroll-mt-4">
        <CVUploader
          onMatchComplete={handleMatchComplete}
          onSkillsExtracted={() => setError(null)}
          onError={handleMatchError}
          onLoadingChange={setJobsLoading}
        />
      </div>

      {error && (
        <p className="mb-4 text-sm text-vertex-danger">{error}</p>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Mobile/tablet: toggle button; desktop: sidebar always visible */}
        <div className="lg:hidden">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-expanded={sidebarOpen}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {sidebarOpen ? "Hide filters" : "Show filters"}
          </Button>
        </div>

        <FilterSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          showCloseButton
        />

        <div className="min-w-0 flex-1">
          {jobsLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <SkeletonJobCard key={i} />
              ))}
            </div>
          ) : jobs.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (
                <JobCardFromJob
                  key={job.id}
                  job={job}
                  token={token}
                  initialSaved={false}
                />
              ))}
            </div>
          ) : noCVYet ? (
            <EmptyState variant="no-cv" uploadZoneId="cv-upload-zone" />
          ) : noJobsMatched ? (
            <EmptyState variant="no-jobs" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
