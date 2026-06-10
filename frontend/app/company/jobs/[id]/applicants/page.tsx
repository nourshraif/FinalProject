"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { X } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  getCompanyApplications,
  getCompanyPostedJobs,
  updateCompanyApplicationStatus,
} from "@/lib/api";
import type { VertexApplicationStatus, VertexJobApplication } from "@/types";

const PIPELINE: { value: VertexApplicationStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "applied", label: "Applied" },
  { value: "reviewing", label: "Reviewing" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
];

type InterviewFormat = "video" | "in_person" | "phone";

type InterviewForm = {
  date: string;
  time: string;
  timezone: string;
  format: InterviewFormat | "";
  locationOrLink: string;
  interviewerName: string;
  duration: string;
  additionalNotes: string;
};

const EMPTY_INTERVIEW_FORM: InterviewForm = {
  date: "",
  time: "",
  timezone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC",
  format: "",
  locationOrLink: "",
  interviewerName: "",
  duration: "45",
  additionalNotes: "",
};

const INTERVIEW_FORMATS: { value: InterviewFormat; label: string }[] = [
  { value: "video", label: "Video call" },
  { value: "in_person", label: "In-person" },
  { value: "phone", label: "Phone" },
];

const TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Beirut",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
];

const DURATION_OPTIONS = [
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
];

function formatInterviewDateTime(date: string, time: string): string {
  if (!date) return "";
  try {
    const d = new Date(`${date}T${time || "00:00"}`);
    return d.toLocaleString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: time ? "numeric" : undefined,
      minute: time ? "2-digit" : undefined,
    });
  } catch {
    return `${date}${time ? ` at ${time}` : ""}`;
  }
}

function buildInterviewNotes(form: InterviewForm): string {
  const formatLabel =
    INTERVIEW_FORMATS.find((f) => f.value === form.format)?.label || form.format;
  const lines: string[] = ["Interview scheduled", ""];

  const when = formatInterviewDateTime(form.date, form.time);
  if (when) {
    lines.push(`Date & time: ${when}`);
    if (form.timezone) lines.push(`Timezone: ${form.timezone}`);
  }
  if (formatLabel) lines.push(`Format: ${formatLabel}`);

  if (form.locationOrLink.trim()) {
    const locLabel =
      form.format === "video"
        ? "Meeting link"
        : form.format === "in_person"
          ? "Location"
          : form.format === "phone"
            ? "Phone / dial-in"
            : "Details";
    lines.push(`${locLabel}: ${form.locationOrLink.trim()}`);
  }

  if (form.duration) {
    const dur =
      DURATION_OPTIONS.find((d) => d.value === form.duration)?.label ||
      `${form.duration} minutes`;
    lines.push(`Duration: ${dur}`);
  }

  if (form.interviewerName.trim()) {
    lines.push(`Interviewer: ${form.interviewerName.trim()}`);
  }

  if (form.additionalNotes.trim()) {
    lines.push("", "Notes:", form.additionalNotes.trim());
  }

  return lines.join("\n");
}

type OfferForm = {
  salary: string;
  salaryPeriod: "annual" | "monthly" | "hourly";
  currency: string;
  startDate: string;
  employmentType: string;
  responseDeadline: string;
  benefits: string;
  additionalNotes: string;
};

const EMPTY_OFFER_FORM: OfferForm = {
  salary: "",
  salaryPeriod: "annual",
  currency: "USD",
  startDate: "",
  employmentType: "full_time",
  responseDeadline: "",
  benefits: "",
  additionalNotes: "",
};

const SALARY_PERIOD_LABELS: Record<OfferForm["salaryPeriod"], string> = {
  annual: "per year",
  monthly: "per month",
  hourly: "per hour",
};

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "CAD", "AUD", "AED", "LBP"];

function formatOfferDate(date: string): string {
  if (!date) return "";
  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

function buildOfferNotes(form: OfferForm): string {
  const empLabel =
    EMPLOYMENT_TYPES.find((e) => e.value === form.employmentType)?.label ||
    form.employmentType;
  const lines: string[] = ["Job offer", ""];

  if (form.salary.trim()) {
    const period = SALARY_PERIOD_LABELS[form.salaryPeriod];
    lines.push(
      `Compensation: ${form.currency} ${form.salary.trim()} ${period}`,
    );
  }
  if (empLabel) lines.push(`Employment type: ${empLabel}`);
  if (form.startDate) {
    lines.push(`Start date: ${formatOfferDate(form.startDate)}`);
  }
  if (form.responseDeadline) {
    lines.push(`Respond by: ${formatOfferDate(form.responseDeadline)}`);
  }
  if (form.benefits.trim()) {
    lines.push("", "Benefits & perks:", form.benefits.trim());
  }
  if (form.additionalNotes.trim()) {
    lines.push("", "Additional details:", form.additionalNotes.trim());
  }

  return lines.join("\n");
}

const NEXT_STATUS: Partial<
  Record<VertexApplicationStatus, { value: VertexApplicationStatus; label: string }[]>
> = {
  applied: [
    { value: "reviewing", label: "Move to Reviewing" },
    { value: "rejected", label: "Reject" },
  ],
  reviewing: [
    { value: "interviewing", label: "Move to Interview" },
    { value: "rejected", label: "Reject" },
  ],
  interviewing: [
    { value: "offer", label: "Send Offer" },
    { value: "rejected", label: "Reject" },
  ],
  offer: [{ value: "rejected", label: "Reject" }],
};

function ApplicantsContent() {
  const params = useParams();
  const jobId = typeof params?.id === "string" ? parseInt(params.id, 10) : NaN;
  const { token } = useAuth();
  const { showToast } = useToast();
  const [jobTitle, setJobTitle] = useState("");
  const [apps, setApps] = useState<VertexJobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<VertexApplicationStatus | "all">("all");
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [interviewModal, setInterviewModal] = useState<{
    appId: number;
    name: string;
  } | null>(null);
  const [interviewForm, setInterviewForm] = useState<InterviewForm>(EMPTY_INTERVIEW_FORM);
  const [interviewErrors, setInterviewErrors] = useState<Record<string, string>>({});
  const [offerModal, setOfferModal] = useState<{
    appId: number;
    name: string;
  } | null>(null);
  const [offerForm, setOfferForm] = useState<OfferForm>(EMPTY_OFFER_FORM);
  const [offerErrors, setOfferErrors] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    if (!token || Number.isNaN(jobId)) return;
    setLoading(true);
    Promise.all([
      getCompanyPostedJobs(token),
      getCompanyApplications(token, { posted_job_id: jobId }),
    ])
      .then(([jobs, list]) => {
        const job = jobs.find((j) => j.id === jobId);
        setJobTitle(job?.title || `Job #${jobId}`);
        setApps(list);
        const drafts: Record<number, string> = {};
        list.forEach((a) => {
          drafts[a.id] = a.company_notes || "";
        });
        setNotesDraft(drafts);
      })
      .catch((e) => {
        setApps([]);
        showToast(e instanceof Error ? e.message : "Failed to load applicants", "error");
      })
      .finally(() => setLoading(false));
  }, [token, jobId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return apps.filter((a) => a.status !== "withdrawn");
    return apps.filter((a) => a.status === filter);
  }, [apps, filter]);

  const counts = useMemo(() => {
    const active = apps.filter((a) => a.status !== "withdrawn");
    return {
      all: active.length,
      applied: active.filter((a) => a.status === "applied").length,
      reviewing: active.filter((a) => a.status === "reviewing").length,
      interviewing: active.filter((a) => a.status === "interviewing").length,
      offer: active.filter((a) => a.status === "offer").length,
      rejected: active.filter((a) => a.status === "rejected").length,
      withdrawn: apps.filter((a) => a.status === "withdrawn").length,
      expired: apps.filter((a) => a.status === "expired").length,
    };
  }, [apps]);

  const updateStatus = (
    appId: number,
    status: VertexApplicationStatus,
    noteOverride?: string,
  ) => {
    if (!token) return;
    setUpdatingId(appId);
    const notes =
      noteOverride !== undefined
        ? noteOverride
        : notesDraft[appId]?.trim() || undefined;
    updateCompanyApplicationStatus(token, appId, { status, company_notes: notes })
      .then(() => {
        setApps((prev) =>
          prev.map((a) =>
            a.id === appId
              ? { ...a, status, company_notes: notes ?? a.company_notes, updated_at: new Date().toISOString() }
              : a
          )
        );
        if (notes) {
          setNotesDraft((d) => ({ ...d, [appId]: notes }));
        }
        showToast("Applicant status updated", "success");
      })
      .catch((e) =>
        showToast(e instanceof Error ? e.message : "Update failed", "error")
      )
      .finally(() => setUpdatingId(null));
  };

  const handleMoveToInterview = (appId: number, name: string) => {
    setInterviewForm({ ...EMPTY_INTERVIEW_FORM });
    setInterviewErrors({});
    setInterviewModal({ appId, name });
  };

  const validateInterviewForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!interviewForm.date) errors.date = "Date is required";
    if (!interviewForm.time) errors.time = "Time is required";
    if (!interviewForm.format) errors.format = "Format is required";
    if (
      (interviewForm.format === "video" || interviewForm.format === "in_person") &&
      !interviewForm.locationOrLink.trim()
    ) {
      errors.locationOrLink =
        interviewForm.format === "video"
          ? "Meeting link is required"
          : "Location is required";
    }
    setInterviewErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const confirmInterview = () => {
    if (!interviewModal || !validateInterviewForm()) return;
    const details = buildInterviewNotes(interviewForm);
    updateStatus(interviewModal.appId, "interviewing", details);
    setInterviewModal(null);
  };

  const setInterviewField = <K extends keyof InterviewForm>(
    key: K,
    value: InterviewForm[K],
  ) => {
    setInterviewForm((f) => ({ ...f, [key]: value }));
    setInterviewErrors((e) => {
      const next = { ...e };
      delete next[key as string];
      if (key === "format") delete next.locationOrLink;
      return next;
    });
  };

  const handleSendOffer = (appId: number, name: string) => {
    setOfferForm({ ...EMPTY_OFFER_FORM });
    setOfferErrors({});
    setOfferModal({ appId, name });
  };

  const validateOfferForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!offerForm.salary.trim()) errors.salary = "Salary / compensation is required";
    setOfferErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const confirmOffer = () => {
    if (!offerModal || !validateOfferForm()) return;
    const details = buildOfferNotes(offerForm);
    updateStatus(offerModal.appId, "offer", details);
    setOfferModal(null);
  };

  const setOfferField = <K extends keyof OfferForm>(key: K, value: OfferForm[K]) => {
    setOfferForm((f) => ({ ...f, [key]: value }));
    setOfferErrors((e) => {
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  };

  const saveNotes = (appId: number) => {
    const app = apps.find((a) => a.id === appId);
    if (!app || !token) return;
    setUpdatingId(appId);
    updateCompanyApplicationStatus(token, appId, {
      status: app.status,
      company_notes: notesDraft[appId] || "",
    })
      .then(() => {
        setApps((prev) =>
          prev.map((a) =>
            a.id === appId ? { ...a, company_notes: notesDraft[appId] } : a
          )
        );
        showToast("Notes saved", "success");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to save", "error"))
      .finally(() => setUpdatingId(null));
  };

  return (
    <>
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto max-w-[1000px] px-4 sm:px-6">
        <div className="mb-6">
          <Link
            href="/company/jobs"
            className="text-sm text-indigo-300 hover:underline"
          >
            ← My jobs
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-white">Applicants</h1>
          <p className="text-sm text-vertex-muted">{jobTitle}</p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {PIPELINE.map(({ value, label }) => {
            const count = value === "all" ? counts.all : counts[value];
            return (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={
                  filter === value
                    ? { background: "#6366f1", color: "white" }
                    : { color: "#94a3b8" }
                }
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
              style={{ borderTopColor: "#6366f1" }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-2xl py-16 text-center">
            <p className="text-white font-medium">No applicants in this stage</p>
            <p className="mt-1 text-sm text-vertex-muted">
              Candidates who apply on Vertex will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((app) => (
              <div key={app.id} className="glass-card rounded-xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-white">{app.applicant_name}</p>
                    <a
                      href={`mailto:${app.applicant_email}`}
                      className="text-sm text-indigo-300 hover:underline"
                    >
                      {app.applicant_email}
                    </a>
                    {app.headline && (
                      <p className="mt-1 text-sm text-vertex-muted">{app.headline}</p>
                    )}
                    {app.location && (
                      <p className="text-xs text-vertex-muted">📍 {app.location}</p>
                    )}
                    {app.years_experience != null && app.years_experience > 0 && (
                      <p className="text-xs text-vertex-muted">
                        {app.years_experience}+ years experience
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-200">
                    {app.status}
                  </span>
                </div>

                {app.skills?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {app.skills.slice(0, 12).map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-vertex-card px-2 py-0.5 text-xs text-vertex-muted"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {app.cover_message && (
                  <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-sm text-vertex-muted">
                    {app.cover_message}
                  </p>
                )}

                {app.profile_slug && (
                  <Link
                    href={`/profile/${app.profile_slug}`}
                    target="_blank"
                    className="mt-2 inline-block text-xs text-indigo-300 hover:underline"
                  >
                    View public profile →
                  </Link>
                )}

                <div className="mt-4">
                  <label className="mb-1 block text-xs text-vertex-muted">
                    Note to candidate{" "}
                    <span className="text-indigo-400">(visible to applicant)</span>
                  </label>
                  <textarea
                    rows={2}
                    className="vertex-input w-full resize-none rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="e.g. interview details, next steps, feedback…"
                    value={notesDraft[app.id] ?? ""}
                    onChange={(e) =>
                      setNotesDraft((d) => ({ ...d, [app.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    disabled={updatingId === app.id}
                    onClick={() => saveNotes(app.id)}
                    className="ghost-button mt-2 rounded-lg px-3 py-1.5 text-xs"
                  >
                    Save note
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(NEXT_STATUS[app.status] || []).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={updatingId === app.id}
                      onClick={() => {
                        if (opt.value === "interviewing") {
                          handleMoveToInterview(app.id, app.applicant_name);
                        } else if (opt.value === "offer") {
                          handleSendOffer(app.id, app.applicant_name);
                        } else {
                          updateStatus(app.id, opt.value);
                        }
                      }}
                      className={
                        opt.value === "rejected"
                          ? "rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                          : "glow-button rounded-lg px-3 py-1.5 text-xs text-white"
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Interview details modal */}
    {interviewModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
        onClick={() => setInterviewModal(null)}
      >
        <div
          className="glass-card max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-2xl p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              Schedule interview — {interviewModal.name}
            </h2>
            <button
              type="button"
              onClick={() => setInterviewModal(null)}
              className="rounded p-1 text-vertex-muted hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mb-5 text-sm text-vertex-muted">
            The candidate will see these details in their Application Tracker.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-vertex-muted">
                  Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  autoFocus
                  min={new Date().toISOString().slice(0, 10)}
                  className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                  value={interviewForm.date}
                  onChange={(e) => setInterviewField("date", e.target.value)}
                />
                {interviewErrors.date && (
                  <p className="mt-1 text-xs text-red-400">{interviewErrors.date}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs text-vertex-muted">
                  Time <span className="text-red-400">*</span>
                </label>
                <input
                  type="time"
                  className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                  value={interviewForm.time}
                  onChange={(e) => setInterviewField("time", e.target.value)}
                />
                {interviewErrors.time && (
                  <p className="mt-1 text-xs text-red-400">{interviewErrors.time}</p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-vertex-muted">Timezone</label>
              <select
                className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                value={interviewForm.timezone}
                onChange={(e) => setInterviewField("timezone", e.target.value)}
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-vertex-muted">
                Interview format <span className="text-red-400">*</span>
              </label>
              <select
                className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                value={interviewForm.format}
                onChange={(e) =>
                  setInterviewField("format", e.target.value as InterviewFormat | "")
                }
              >
                <option value="">Select format…</option>
                {INTERVIEW_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              {interviewErrors.format && (
                <p className="mt-1 text-xs text-red-400">{interviewErrors.format}</p>
              )}
            </div>

            {interviewForm.format && (
              <div>
                <label className="mb-1 block text-xs text-vertex-muted">
                  {interviewForm.format === "video"
                    ? "Meeting link"
                    : interviewForm.format === "in_person"
                      ? "Address / location"
                      : "Phone number or dial-in"}{" "}
                  {(interviewForm.format === "video" ||
                    interviewForm.format === "in_person") && (
                    <span className="text-red-400">*</span>
                  )}
                </label>
                <input
                  type={interviewForm.format === "video" ? "url" : "text"}
                  className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                  placeholder={
                    interviewForm.format === "video"
                      ? "https://meet.google.com/abc-xyz"
                      : interviewForm.format === "in_person"
                        ? "Office address or room"
                        : "+1 555 000 0000"
                  }
                  value={interviewForm.locationOrLink}
                  onChange={(e) =>
                    setInterviewField("locationOrLink", e.target.value)
                  }
                />
                {interviewErrors.locationOrLink && (
                  <p className="mt-1 text-xs text-red-400">
                    {interviewErrors.locationOrLink}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-vertex-muted">Duration</label>
                <select
                  className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                  value={interviewForm.duration}
                  onChange={(e) => setInterviewField("duration", e.target.value)}
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-vertex-muted">
                  Interviewer (optional)
                </label>
                <input
                  type="text"
                  className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="Name or team"
                  value={interviewForm.interviewerName}
                  onChange={(e) =>
                    setInterviewField("interviewerName", e.target.value)
                  }
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-vertex-muted">
                Additional notes (optional)
              </label>
              <textarea
                rows={3}
                className="vertex-input w-full resize-none rounded-lg px-3 py-2 text-sm text-white"
                placeholder="What to prepare, dress code, parking, etc."
                value={interviewForm.additionalNotes}
                onChange={(e) =>
                  setInterviewField("additionalNotes", e.target.value)
                }
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={confirmInterview}
              disabled={updatingId === interviewModal.appId}
              className="glow-button rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {updatingId === interviewModal.appId
                ? "Scheduling…"
                : "Confirm interview"}
            </button>
            <button
              type="button"
              onClick={() => setInterviewModal(null)}
              className="ghost-button rounded-lg px-5 py-2.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Job offer modal */}
    {offerModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
        onClick={() => setOfferModal(null)}
      >
        <div
          className="glass-card max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-2xl p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              Send offer — {offerModal.name}
            </h2>
            <button
              type="button"
              onClick={() => setOfferModal(null)}
              className="rounded p-1 text-vertex-muted hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mb-5 text-sm text-vertex-muted">
            The candidate will be notified by email and in-app. Offer details
            appear in their Application Tracker.
          </p>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-vertex-muted">
                Compensation <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  className="vertex-input w-24 shrink-0 rounded-lg px-2 py-2 text-sm text-white"
                  value={offerForm.currency}
                  onChange={(e) => setOfferField("currency", e.target.value)}
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  autoFocus
                  className="vertex-input min-w-0 flex-1 rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="e.g. 85,000"
                  value={offerForm.salary}
                  onChange={(e) => setOfferField("salary", e.target.value)}
                />
                <select
                  className="vertex-input w-28 shrink-0 rounded-lg px-2 py-2 text-sm text-white"
                  value={offerForm.salaryPeriod}
                  onChange={(e) =>
                    setOfferField(
                      "salaryPeriod",
                      e.target.value as OfferForm["salaryPeriod"],
                    )
                  }
                >
                  <option value="annual">/ year</option>
                  <option value="monthly">/ month</option>
                  <option value="hourly">/ hour</option>
                </select>
              </div>
              {offerErrors.salary && (
                <p className="mt-1 text-xs text-red-400">{offerErrors.salary}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs text-vertex-muted">
                Employment type
              </label>
              <select
                className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                value={offerForm.employmentType}
                onChange={(e) => setOfferField("employmentType", e.target.value)}
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-vertex-muted">
                  Start date (optional)
                </label>
                <input
                  type="date"
                  className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                  value={offerForm.startDate}
                  onChange={(e) => setOfferField("startDate", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-vertex-muted">
                  Respond by (optional)
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                  value={offerForm.responseDeadline}
                  onChange={(e) =>
                    setOfferField("responseDeadline", e.target.value)
                  }
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-vertex-muted">
                Benefits & perks (optional)
              </label>
              <textarea
                rows={2}
                className="vertex-input w-full resize-none rounded-lg px-3 py-2 text-sm text-white"
                placeholder="Health insurance, remote work, equity, PTO…"
                value={offerForm.benefits}
                onChange={(e) => setOfferField("benefits", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-vertex-muted">
                Additional details (optional)
              </label>
              <textarea
                rows={2}
                className="vertex-input w-full resize-none rounded-lg px-3 py-2 text-sm text-white"
                placeholder="Onboarding steps, who to contact, signing bonus…"
                value={offerForm.additionalNotes}
                onChange={(e) => setOfferField("additionalNotes", e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={confirmOffer}
              disabled={updatingId === offerModal.appId}
              className="glow-button rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {updatingId === offerModal.appId ? "Sending…" : "Send offer"}
            </button>
            <button
              type="button"
              onClick={() => setOfferModal(null)}
              className="ghost-button rounded-lg px-5 py-2.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default function JobApplicantsPage() {
  return (
    <ProtectedRoute requiredRole="company">
      <ApplicantsContent />
    </ProtectedRoute>
  );
}
