"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PlanGate } from "@/components/PlanGate";
import { CVUploader } from "@/components/CVUploader";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { analyzeJobGap, getJobById } from "@/lib/api";
import type { ScrapedJob, SkillsGapResult } from "@/types";

function SkillsGapContent() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const jobIdParam = searchParams.get("job_id");
  const jobId = useMemo(() => {
    if (!jobIdParam) return null;
    const parsed = Number(jobIdParam);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [jobIdParam]);

  const [job, setJob] = useState<ScrapedJob | null>(null);
  const [analysis, setAnalysis] = useState<SkillsGapResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualJobDescription, setManualJobDescription] = useState("");

  useEffect(() => {
    if (!token || !jobId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    Promise.all([getJobById(jobId), analyzeJobGap(token, jobId)])
      .then(([jobData, analysisData]) => {
        if (cancelled) return;
        setJob(jobData);
        setAnalysis(analysisData);
      })
      .catch((e) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Could not run job-specific analysis";
        setError(message);
        showToast(message, "error");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, jobId, showToast]);

  const isJobSpecificMode = Boolean(jobId);

  return (
    <div className="container max-w-3xl py-10 pt-24">
      <h1 className="text-3xl font-bold text-white">Skills Gap Analyzer</h1>
      <p className="mt-3 text-sm text-slate-400">
        Compare your profile skills to target roles and discover what to learn next.
      </p>

      {isJobSpecificMode && (
        <div className="glass-card mt-8 rounded-2xl border border-white/[0.06] p-6">
          <p className="text-xs text-slate-400">Analyzing gap for:</p>
          <p className="mt-1 text-lg font-bold text-white">{job?.job_title || "Loading job..."}</p>
          <p className="mt-1 text-sm text-slate-400">{job?.company || " "}</p>
        </div>
      )}

      {isJobSpecificMode ? (
        <div className="mt-6 space-y-4">
          {isLoading && (
            <div className="glass-card rounded-2xl border border-white/[0.06] p-6 text-sm text-slate-400">
              Running job-specific skills gap analysis...
            </div>
          )}
          {error && (
            <div className="glass-card rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
              {error}
            </div>
          )}
          {analysis && (
            <>
              <div className="glass-card rounded-2xl border border-white/[0.06] p-6">
                <p className="text-xs text-slate-400">Match percentage</p>
                <p className="mt-1 text-3xl font-bold text-white">{analysis.match_percentage}%</p>
                <p className="mt-3 text-sm text-slate-300">{analysis.overall_assessment}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Estimated readiness: <span className="text-slate-200">{analysis.estimated_ready_in}</span>
                </p>
              </div>

              <div className="glass-card rounded-2xl border border-white/[0.06] p-6">
                <p className="text-sm font-semibold text-white">Matched Skills</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(analysis.matched_skills || []).map((skill) => (
                    <span key={skill} className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-200">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="glass-card rounded-2xl border border-white/[0.06] p-6">
                <p className="text-sm font-semibold text-white">Missing Skills</p>
                <div className="mt-3 space-y-3">
                  {(analysis.missing_skills || []).map((item) => (
                    <div key={item.skill} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{item.skill}</p>
                        <span className="text-xs text-slate-400">{item.importance} priority</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{item.reason}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {item.time_to_learn} • {item.difficulty}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card rounded-2xl border border-white/[0.06] p-6">
                <p className="text-sm font-semibold text-white">Priority Learning Path</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                  {(analysis.priority_learning_path || []).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="glass-card rounded-2xl border border-white/[0.06] p-6">
            <p className="text-sm font-semibold text-white">Upload CV</p>
            <p className="mt-1 text-xs text-slate-400">
              Upload a CV to extract skills for analysis.
            </p>
            <div className="mt-4">
              <CVUploader />
            </div>
          </div>

          <div className="glass-card rounded-2xl border border-white/[0.06] p-6">
            <p className="text-sm font-semibold text-white">Job Description</p>
            <p className="mt-1 text-xs text-slate-400">
              Paste a job description to compare against your profile skills.
            </p>
            <textarea
              value={manualJobDescription}
              onChange={(e) => setManualJobDescription(e.target.value)}
              placeholder="Paste job description here..."
              className="vertex-input mt-4 min-h-[140px] w-full rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function SkillsGapPage() {
  return (
    <ProtectedRoute requiredRole="jobseeker">
      <PlanGate feature="skills_gap" requiredPlan="pro">
        <SkillsGapContent />
      </PlanGate>
    </ProtectedRoute>
  );
}
