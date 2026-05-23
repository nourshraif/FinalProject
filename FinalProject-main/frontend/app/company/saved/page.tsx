"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, X } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ContactRequestModal } from "@/components/ContactRequestModal";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  getSavedCandidates,
  unsaveCandidate,
  updateCandidateNotes,
} from "@/lib/api";
import type { SavedCandidate } from "@/types";
import { ConfirmModal } from "@/components/ConfirmModal";

function relativeTime(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffDays > 0)
      return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
    if (diffHours > 0)
      return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    if (diffMins > 0)
      return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
    return "Just now";
  } catch {
    return iso;
  }
}

function getInitials(fullName: string): string {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (fullName || "?").slice(0, 2).toUpperCase();
}

const NOTES_MAX = 500;

function SavedContent() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [list, setList] = useState<SavedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCandidate, setSelectedCandidate] =
    useState<SavedCandidate | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [unsaveTarget, setUnsaveTarget] = useState<SavedCandidate | null>(null);
  const [contactModal, setContactModal] = useState<{
    userId: number;
    name: string;
  } | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getSavedCandidates(token)
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((e) => {
        setList([]);
        showToast(e instanceof Error ? e.message : "Failed to load saved candidates", "error");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedCandidate) setNotesDraft(selectedCandidate.notes ?? "");
  }, [selectedCandidate]);

  const filtered = list.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = (c.full_name ?? "").toLowerCase();
    const email = (c.email ?? "").toLowerCase();
    const location = (c.location ?? "").toLowerCase();
    const skills = Array.isArray(c.skills) ? c.skills : [];
    const skillMatch = skills.some((s) =>
      String(s).toLowerCase().includes(q)
    );
    return (
      name.includes(q) || email.includes(q) || location.includes(q) || skillMatch
    );
  });

  const handleUnsave = (c: SavedCandidate) => setUnsaveTarget(c);

  const confirmUnsave = () => {
    if (!unsaveTarget || !token) return;
    const c = unsaveTarget;
    setUnsaveTarget(null);
    unsaveCandidate(token, c.candidate_user_id)
      .then(() => {
        setList((prev) =>
          prev.filter((x) => x.candidate_user_id !== c.candidate_user_id)
        );
        showToast("Candidate removed from saved", "success");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to remove", "error"));
  };

  const handleSaveNotes = () => {
    if (!selectedCandidate || !token) return;
    const text = notesDraft.slice(0, NOTES_MAX);
    setNotesSaving(true);
    updateCandidateNotes(token, selectedCandidate.candidate_user_id, text)
      .then(() => {
        setList((prev) =>
          prev.map((x) =>
            x.candidate_user_id === selectedCandidate.candidate_user_id
              ? { ...x, notes: text, updated_at: new Date().toISOString() }
              : x
          )
        );
        setSelectedCandidate(null);
        showToast("Notes saved", "success");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to save notes", "error"))
      .finally(() => setNotesSaving(false));
  };

  const skillsList = (c: SavedCandidate): string[] =>
    Array.isArray(c.skills) ? c.skills : [];

  return (
    <div className="min-h-screen pt-[6rem] pb-12">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Saved Candidates</h1>
            <p className="mt-1 text-sm text-vertex-muted">
              Candidates you bookmarked
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-3 py-1 text-sm font-medium text-white"
            style={{ background: "#6366f1" }}
          >
            {list.length}
          </span>
        </div>

        <div className="mb-6">
          <input
            type="text"
            className="vertex-input w-full rounded-lg px-4 py-2 text-sm text-white"
            placeholder="Search by name, skill, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
              style={{ borderTopColor: "#6366f1" }}
              aria-hidden
            />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl py-16 text-center">
            <span className="text-5xl">🔖</span>
            <p className="mt-4 text-lg font-bold text-white">
              No saved candidates yet
            </p>
            <p className="mt-1 text-sm text-vertex-muted">
              Save candidates while searching to find them here
            </p>
            <Link
              href="/company/search"
              className="glow-button mt-6 rounded-lg px-6 py-2.5 text-sm font-medium text-white"
            >
              Search Candidates
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-vertex-muted">
              No candidates match your search
            </p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-2 text-sm font-medium transition-colors hover:underline"
              style={{ color: "#6366f1" }}
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="glass-card rounded-xl p-6 transition-all border border-[rgba(99,102,241,0.2)] hover:border-[rgba(99,102,241,0.3)]"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white"
                    aria-hidden
                  >
                    {getInitials(c.full_name ?? "")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-white">{c.full_name ?? "—"}</h2>
                    {c.headline && (
                      <p className="text-sm text-vertex-muted">{c.headline}</p>
                    )}
                    {c.location && (
                      <p className="text-xs text-vertex-muted">
                        📍 {c.location}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnsave(c)}
                    className="shrink-0 rounded p-1.5 transition-colors hover:bg-white/10"
                    title="Remove from saved"
                    aria-label="Remove from saved"
                  >
                    <Bookmark
                      className="h-5 w-5 fill-current"
                      style={{ color: "#6366f1" }}
                    />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {skillsList(c)
                    .slice(0, 5)
                    .map((s) => (
                      <span
                        key={s}
                        className="rounded-full px-2 py-1 text-xs"
                        style={{
                          background: "#1e1e3a",
                          color: "#94a3b8",
                          border: "1px solid #2a2a3d",
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  {skillsList(c).length > 5 && (
                    <span className="text-xs text-vertex-muted">
                      +{skillsList(c).length - 5} more
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  {c.notes && (
                    <p className="line-clamp-2 text-xs italic text-vertex-muted">
                      Saved note: {c.notes}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedCandidate(c)}
                    className="ghost-button mt-1 text-xs"
                  >
                    {c.notes ? "Edit Note" : "Add Note"}
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="text-xs text-vertex-muted">
                    Saved {relativeTime(c.saved_at)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setContactModal({
                          userId: c.candidate_user_id,
                          name: c.full_name ?? "Candidate",
                        })
                      }
                      className="ghost-button rounded-lg px-3 py-1.5 text-xs"
                    >
                      Contact
                    </button>
                    <a
                      href={`mailto:${c.email ?? ""}`}
                      className="ghost-button rounded-lg px-3 py-1.5 text-xs"
                    >
                      Email
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {contactModal && token && (
        <ContactRequestModal
          isOpen={!!contactModal}
          onClose={() => setContactModal(null)}
          candidateUserId={contactModal.userId}
          candidateName={contactModal.name}
          token={token}
        />
      )}

      {selectedCandidate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="notes-modal-title"
        >
          <div className="glass-card w-full max-w-[480px] rounded-2xl p-8">
            <div className="flex items-start justify-between gap-4">
              <h2
                id="notes-modal-title"
                className="text-xl font-bold text-white"
              >
                Notes — {selectedCandidate.full_name ?? "Candidate"}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="rounded p-1.5 text-vertex-muted transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-vertex-muted">
              📧 {selectedCandidate.email}
            </p>
            <textarea
              className="vertex-input mt-4 w-full resize-none rounded-lg px-3 py-2 text-sm text-white"
              rows={6}
              placeholder="Add your private notes about this candidate... only you can see these"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              maxLength={NOTES_MAX + 1}
            />
            <p className="mt-1 text-right text-xs text-vertex-muted">
              {notesDraft.length}/500 characters
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={notesSaving}
                className="glow-button rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {notesSaving ? "Saving…" : "Save Notes"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="ghost-button rounded-lg px-4 py-2.5 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!unsaveTarget}
        title="Remove candidate"
        message="Remove this candidate from your saved list?"
        confirmText="Remove"
        confirmStyle="destructive"
        onConfirm={confirmUnsave}
        onCancel={() => setUnsaveTarget(null)}
      />
    </div>
  );
}

export default function CompanySavedPage() {
  return (
    <ProtectedRoute requiredRole="company">
      <SavedContent />
    </ProtectedRoute>
  );
}
