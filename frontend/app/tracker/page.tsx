"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
} from "@/lib/api";
import type { JobApplication, ApplicationStatus } from "@/types";
import { ConfirmModal } from "@/components/ConfirmModal";

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  applied: { border: "#6366f1", bg: "rgba(99,102,241,0.2)", text: "#a5b4fc" },
  interviewing: { border: "#f59e0b", bg: "rgba(245,158,11,0.2)", text: "#fcd34d" },
  offer: { border: "#22c55e", bg: "rgba(34,197,94,0.2)", text: "#86efac" },
  rejected: { border: "#ef4444", bg: "rgba(239,68,68,0.2)", text: "#fca5a5" },
  saved: { border: "#64748b", bg: "rgba(100,116,139,0.2)", text: "#94a3b8" },
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function TrackerContent() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ApplicationStatus | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JobApplication | null>(null);
  const [selectedAppForNotes, setSelectedAppForNotes] = useState<JobApplication | null>(null);
  const [notesText, setNotesText] = useState("");

  const [addJobTitle, setAddJobTitle] = useState("");
  const [addCompany, setAddCompany] = useState("");
  const [addLocation, setAddLocation] = useState("");
  const [addJobUrl, setAddJobUrl] = useState("");
  const [addStatus, setAddStatus] = useState<ApplicationStatus>("applied");
  const [addNotes, setAddNotes] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getApplications(token)
      .then(setApplications)
      .catch((e) => {
        setApplications([]);
        showToast(e instanceof Error ? e.message : "Failed to load applications", "error");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    filter === "all"
      ? applications
      : applications.filter((a) => a.status === filter);

  const counts = {
    applied: applications.filter((a) => a.status === "applied").length,
    interviewing: applications.filter((a) => a.status === "interviewing").length,
    offer: applications.filter((a) => a.status === "offer").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  const handleAddApplication = () => {
    const title = addJobTitle.trim();
    const company = addCompany.trim();
    if (!title || !company || !token) return;
    setAddSaving(true);
    createApplication(token, {
      job_title: title,
      company,
      location: addLocation.trim() || undefined,
      job_url: addJobUrl.trim() || undefined,
      status: addStatus,
      notes: addNotes.trim() || undefined,
    })
      .then(() => {
        setShowAddModal(false);
        setAddJobTitle("");
        setAddCompany("");
        setAddLocation("");
        setAddJobUrl("");
        setAddStatus("applied");
        setAddNotes("");
        load();
        showToast("Application added", "success");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to add application", "error"))
      .finally(() => setAddSaving(false));
  };

  const handleStatusChange = (app: JobApplication, newStatus: ApplicationStatus) => {
    if (!token) return;
    updateApplication(token, app.id, { status: newStatus })
      .then(() => {
        setApplications((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, status: newStatus } : a))
        );
        showToast("Status updated", "success");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to update", "error"));
  };

  const handleDelete = (app: JobApplication) => {
    setDeleteTarget(app);
  };

  const confirmDelete = () => {
    if (!deleteTarget || !token) return;
    const app = deleteTarget;
    setDeleteTarget(null);
    deleteApplication(token, app.id)
      .then(() => {
        setApplications((prev) => prev.filter((a) => a.id !== app.id));
        showToast("Application deleted", "success");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to delete", "error"));
  };

  const openNotes = (app: JobApplication) => {
    setSelectedAppForNotes(app);
    setNotesText(app.notes || "");
  };

  const saveNotes = () => {
    if (!selectedAppForNotes || !token) return;
    setNotesSaving(true);
    updateApplication(token, selectedAppForNotes.id, { notes: notesText })
      .then(() => {
        setApplications((prev) =>
          prev.map((a) =>
            a.id === selectedAppForNotes.id ? { ...a, notes: notesText } : a
          )
        );
        setSelectedAppForNotes(null);
        showToast("Notes saved", "success");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to save notes", "error"))
      .finally(() => setNotesSaving(false));
  };

  const getStatusStyle = (status: string) =>
    STATUS_STYLES[status] || STATUS_STYLES.applied;

  const getAvatarBg = (status: string) =>
    status === "applied"
      ? "#6366f1"
      : status === "interviewing"
        ? "#f59e0b"
        : status === "offer"
          ? "#22c55e"
          : "#ef4444";

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        {/* Page header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-vertex-white">
              Application Tracker
            </h1>
            <p className="mt-1 text-sm text-vertex-muted">
              Track every job you apply to
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="glow-button shrink-0 rounded-lg px-5 py-2.5 text-sm font-medium text-white"
          >
            Add Application
          </button>
        </div>

        {/* Stats row */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div
            className="glass-card rounded-xl p-5"
            style={{ borderLeft: "3px solid #6366f1" }}
          >
            <p className="text-3xl font-bold text-vertex-white">{counts.applied}</p>
            <p className="mt-0.5 text-sm text-vertex-muted">Applied</p>
          </div>
          <div
            className="glass-card rounded-xl p-5"
            style={{ borderLeft: "3px solid #f59e0b" }}
          >
            <p className="text-3xl font-bold text-vertex-white">
              {counts.interviewing}
            </p>
            <p className="mt-0.5 text-sm text-vertex-muted">Interviewing</p>
          </div>
          <div
            className="glass-card rounded-xl p-5"
            style={{ borderLeft: "3px solid #22c55e" }}
          >
            <p className="text-3xl font-bold text-vertex-white">{counts.offer}</p>
            <p className="mt-0.5 text-sm text-vertex-muted">Offers</p>
          </div>
          <div
            className="glass-card rounded-xl p-5"
            style={{ borderLeft: "3px solid #ef4444" }}
          >
            <p className="text-3xl font-bold text-vertex-white">
              {counts.rejected}
            </p>
            <p className="mt-0.5 text-sm text-vertex-muted">Rejected</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(
            [
              { key: "all" as const, label: "All" },
              { key: "applied" as const, label: "Applied" },
              { key: "interviewing" as const, label: "Interviewing" },
              { key: "offer" as const, label: "Offer" },
              { key: "rejected" as const, label: "Rejected" },
            ] as const
          ).map(({ key, label }) => {
            const count =
              key === "all"
                ? applications.length
                : applications.filter((a) => a.status === key).length;
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={
                  active
                    ? { background: "#6366f1", color: "white" }
                    : { color: "#94a3b8" }
                }
              >
                {label}{" "}
                <span className="ml-1 opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Applications list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
              style={{ borderTopColor: "#6366f1" }}
              aria-hidden
            />
          </div>
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl py-16 text-center">
            <span className="text-5xl">📋</span>
            <p className="mt-4 text-lg font-bold text-vertex-white">
              No applications yet
            </p>
            <p className="mt-1 text-sm text-vertex-muted">
              Start tracking your job applications
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="glow-button mt-6 rounded-lg px-6 py-2.5 text-sm font-medium text-white"
            >
              Add Your First Application
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-vertex-muted">
            No {filter === "all" ? "" : filter} applications
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((app) => (
              <div
                key={app.id}
                className="group glass-card flex flex-wrap items-center gap-4 rounded-xl p-5 transition-colors hover:border-indigo-500/30"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: getAvatarBg(app.status) }}
                  >
                    {(app.company || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-vertex-white">{app.job_title}</p>
                    <p className="text-sm text-vertex-muted">{app.company}</p>
                    {app.location && (
                      <p className="text-xs text-vertex-muted">📍 {app.location}</p>
                    )}
                    <p className="text-xs text-vertex-muted">
                      Applied {formatDate(app.applied_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      background: getStatusStyle(app.status).bg,
                      color: getStatusStyle(app.status).text,
                    }}
                  >
                    {STATUS_OPTIONS.find((o) => o.value === app.status)?.label ||
                      app.status}
                  </span>
                  <select
                    value={app.status}
                    onChange={(e) =>
                      handleStatusChange(app, e.target.value as ApplicationStatus)
                    }
                    className="vertex-input w-28 rounded-lg px-2 py-1.5 text-xs"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => openNotes(app)}
                    className="rounded p-1.5 text-vertex-muted transition-colors hover:bg-white/10 hover:text-vertex-white"
                    aria-label="Edit notes"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(app)}
                    className="rounded p-1.5 text-vertex-muted transition-colors hover:bg-red-500/20 hover:text-red-400"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Application Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        >
          <div className="glass-card w-full max-w-[500px] rounded-2xl p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-vertex-white">
                Add Application
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded p-1 text-vertex-muted hover:bg-white/10 hover:text-vertex-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-vertex-muted">
                  Job Title *
                </label>
                <input
                  className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                  value={addJobTitle}
                  onChange={(e) => setAddJobTitle(e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-vertex-muted">
                  Company *
                </label>
                <input
                  className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                  value={addCompany}
                  onChange={(e) => setAddCompany(e.target.value)}
                  placeholder="Company name"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-vertex-muted">
                  Location
                </label>
                <input
                  className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                  value={addLocation}
                  onChange={(e) => setAddLocation(e.target.value)}
                  placeholder="e.g. Remote, New York"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-vertex-muted">
                  Job URL
                </label>
                <input
                  className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                  value={addJobUrl}
                  onChange={(e) => setAddJobUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-vertex-muted">
                  Status
                </label>
                <select
                  value={addStatus}
                  onChange={(e) => setAddStatus(e.target.value as ApplicationStatus)}
                  className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="saved">Saved</option>
                  <option value="applied">Applied</option>
                  <option value="interviewing">Interviewing</option>
                  <option value="offer">Offer</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-vertex-muted">
                  Notes
                </label>
                <textarea
                  rows={3}
                  className="vertex-input w-full resize-none rounded-lg px-3 py-2 text-sm text-white"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  placeholder="Optional notes"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleAddApplication}
                disabled={
                  addSaving || !addJobTitle.trim() || !addCompany.trim()
                }
                className="glow-button rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {addSaving ? "Adding..." : "Add Application"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="ghost-button rounded-lg px-5 py-2.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {selectedAppForNotes && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        >
          <div className="glass-card w-full max-w-[500px] rounded-2xl p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-vertex-white">
                Notes — {selectedAppForNotes.job_title}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedAppForNotes(null)}
                className="rounded p-1 text-vertex-muted hover:bg-white/10 hover:text-vertex-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea
              rows={6}
              className="vertex-input w-full resize-none rounded-lg px-3 py-2 text-sm text-white"
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Add notes..."
            />
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={saveNotes}
                disabled={notesSaving}
                className="glow-button rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {notesSaving ? "Saving..." : "Save Notes"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedAppForNotes(null)}
                className="ghost-button rounded-lg px-5 py-2.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete application"
        message="Remove this application from your tracker? This cannot be undone."
        confirmText="Delete"
        confirmStyle="destructive"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function TrackerPage() {
  return (
    <ProtectedRoute requiredRole="jobseeker">
      <TrackerContent />
    </ProtectedRoute>
  );
}
