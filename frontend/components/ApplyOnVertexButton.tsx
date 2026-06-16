"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  applyToVertexJob,
  getProfile,
  getVertexApplyStatus,
} from "@/lib/api";
import type { PostedJob } from "@/types";
import { cn } from "@/lib/utils";

type ApplyOnVertexButtonProps = {
  job: Pick<PostedJob, "id" | "title" | "company_name" | "location">;
  className?: string;
  fullWidth?: boolean;
};

export function ApplyOnVertexButton({
  job,
  className,
  fullWidth = false,
}: ApplyOnVertexButtonProps) {
  const router = useRouter();
  const { user, token, isLoggedIn } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [coverMessage, setCoverMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasCv, setHasCv] = useState<boolean | null>(null);

  const loadStatus = useCallback(() => {
    if (!token || user?.user_type !== "jobseeker") {
      setLoading(false);
      return;
    }
    setLoading(true);
    getVertexApplyStatus(token, job.id)
      .then((res) => {
        setApplied(Boolean(res.applied));
        setStatus(res.application?.status ?? null);
      })
      .catch(() => {
        setApplied(false);
        setStatus(null);
      })
      .finally(() => setLoading(false));
  }, [token, user?.user_type, job.id]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  if (user?.user_type === "company") {
    return null;
  }

  const openApply = () => {
    if (!isLoggedIn || !token) {
      router.push(
        `/auth/login?next=${encodeURIComponent(`/jobs/${job.id}`)}`
      );
      return;
    }
    if (user?.user_type !== "jobseeker") {
      showToast("Only job seeker accounts can apply", "error");
      return;
    }
    if (applied) {
      router.push("/my-applications");
      return;
    }
    setShowModal(true);
    getProfile(token)
      .then((p) => setHasCv(Boolean(p.cv_filename)))
      .catch(() => setHasCv(false));
  };

  const submit = () => {
    if (!token) return;
    if (!hasCv) {
      showToast("Upload your CV on your profile first", "error");
      router.push("/profile");
      return;
    }
    setSubmitting(true);
    applyToVertexJob(token, job.id, coverMessage.trim() || undefined)
      .then(() => {
        setShowModal(false);
        setCoverMessage("");
        setApplied(true);
        setStatus("applied");
        showToast("Application submitted to the company", "success");
      })
      .catch((e) =>
        showToast(e instanceof Error ? e.message : "Could not apply", "error")
      )
      .finally(() => setSubmitting(false));
  };

  const statusLabel =
    status === "applied"
      ? "Applied"
      : status === "reviewing"
        ? "Under review"
        : status === "interviewing"
          ? "Interviewing"
          : status === "offer"
            ? "Offer"
            : status === "rejected"
              ? "Not selected"
              : status === "withdrawn"
                ? "Withdrawn"
                : null;

  return (
    <>
      <button
        type="button"
        onClick={openApply}
        disabled={loading}
        className={cn(
          applied
            ? "ghost-button inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium"
            : "glow-button inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white",
          fullWidth && "w-full py-3",
          className
        )}
      >
        {loading
          ? "..."
          : applied
            ? statusLabel
              ? `${statusLabel} · View`
              : "Applied · View"
            : "Apply on Vertex"}
      </button>

      {showModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          >
            <div className="glass-card max-h-[90vh] w-full max-w-[500px] overflow-y-auto rounded-2xl p-8">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold text-white">Apply on Vertex</h2>
                  <p className="mt-1 text-sm text-vertex-muted">
                    {job.title} · {job.company_name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded p-1 text-vertex-muted hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-4 text-sm text-vertex-muted">
                Your profile and CV will be shared with the hiring company. You can
                track status in{" "}
                <Link href="/my-applications" className="text-indigo-300 hover:underline">
                  My Applications
                </Link>
                .
              </p>
              {hasCv === false && (
                <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  Upload your CV on your{" "}
                  <Link href="/profile" className="font-medium underline">
                    profile
                  </Link>{" "}
                  before applying.
                </p>
              )}
              <label className="mb-1 block text-xs text-vertex-muted">
                Cover message (optional)
              </label>
              <textarea
                rows={4}
                className="vertex-input mb-4 w-full resize-none rounded-lg px-3 py-2 text-sm text-white"
                placeholder="Why are you a great fit for this role?"
                value={coverMessage}
                onChange={(e) => setCoverMessage(e.target.value)}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || hasCv === false}
                  className="glow-button rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit application"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="ghost-button rounded-lg px-5 py-2.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
