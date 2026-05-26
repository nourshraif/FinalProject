"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  adminSendAnnouncement,
  adminGetAnnouncements,
  adminGetAnnouncementRecipientCounts,
  adminDeleteAnnouncement,
} from "@/lib/api";
import type { Announcement } from "@/types";

type Target = "all" | "jobseekers" | "companies";

type Props = {
  token: string;
  showToast: (msg: string, type: "success" | "error") => void;
};

export function AdminAnnouncementsSection({ token, showToast }: Props) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<Target>("all");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendNotification, setSendNotification] = useState(true);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Announcement[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [counts, setCounts] = useState({
    all: 0,
    jobseekers: 0,
    companies: 0,
  });

  const loadHistory = useCallback(() => {
    if (!token) return;
    adminGetAnnouncements(token).then(setHistory).catch(() => setHistory([]));
  }, [token]);

  useEffect(() => {
    loadHistory();
    adminGetAnnouncementRecipientCounts(token)
      .then(setCounts)
      .catch(() => {});
  }, [token, loadHistory]);

  const recipientCount =
    target === "all"
      ? counts.all
      : target === "jobseekers"
        ? counts.jobseekers
        : counts.companies;

  const handleSend = async () => {
    if (!token) return;
    if (!title.trim() || !message.trim()) {
      showToast("Title and message are required", "error");
      return;
    }
    setSending(true);
    try {
      const res = await adminSendAnnouncement(token, {
        title: title.trim(),
        message: message.trim(),
        target,
        send_email: sendEmail,
        send_notification: sendNotification,
      });
      showToast(res.message, "success");
      setTitle("");
      setMessage("");
      loadHistory();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Send failed", "error");
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || deleteId === null) return;
    setDeleting(true);
    try {
      await adminDeleteAnnouncement(token, deleteId);
      setHistory((prev) => prev.filter((a) => a.id !== deleteId));
      showToast("Announcement deleted", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const targets: { id: Target; label: string; count: number }[] = [
    { id: "all", label: "All users", count: counts.all },
    { id: "jobseekers", label: "Job seekers only", count: counts.jobseekers },
    { id: "companies", label: "Companies only", count: counts.companies },
  ];

  return (
    <div className="glass-card mt-6 rounded-xl p-6">
      <h2 className="text-lg font-bold text-white">Send announcement</h2>
      <p className="mt-1 text-sm text-vertex-muted">
        Notifications and email go to active users only (admins are excluded)
      </p>

      <div className="mt-6 space-y-4">
        <input
          className="vertex-input w-full px-3 py-2 text-sm"
          placeholder="e.g. New features available!"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div>
          <textarea
            className="vertex-input min-h-[140px] w-full px-3 py-2 text-sm"
            placeholder="Write your announcement..."
            value={message}
            maxLength={1000}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="mt-1 text-xs text-vertex-muted">{message.length}/1000</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {targets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTarget(t.id)}
              className={cn(
                "glass-card rounded-xl border p-4 text-left transition",
                target === t.id
                  ? "border-indigo-500/50 bg-indigo-500/10"
                  : "border-white/10 hover:border-white/20"
              )}
            >
              <p className="font-medium text-white">{t.label}</p>
              <p className="mt-1 text-xs text-vertex-muted">{t.count} users</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-6 text-sm text-white">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            Send email notification
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sendNotification}
              onChange={(e) => setSendNotification(e.target.checked)}
            />
            Send in-app notification
          </label>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wider text-vertex-muted">Preview</p>
          <h3 className="mt-2 font-bold text-white">{title || "Announcement title"}</h3>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-300">
            {message || "Your message will appear here…"}
          </p>
        </div>

        <button
          type="button"
          disabled={sending}
          onClick={handleSend}
          className="glow-button flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium disabled:opacity-70"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            `Send to ${recipientCount} users`
          )}
        </button>
      </div>

      {history.length > 0 && (
        <div className="mt-8 border-t border-white/10 pt-6">
          <h3 className="mb-3 text-sm font-bold text-white">Recent announcements</h3>
          <ul className="space-y-2">
            {history.slice(0, 10).map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm text-vertex-muted"
              >
                <span className="min-w-0 flex-1 font-medium text-white">{a.title}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <span>
                    {a.target} · {a.recipients_count} recipients ·{" "}
                    {a.sent_at ? new Date(a.sent_at).toLocaleString() : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleteId(a.id)}
                    className="rounded p-1.5 text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                    title="Delete announcement"
                    aria-label={`Delete announcement: ${a.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteId !== null}
        title="Delete announcement"
        message="Remove this announcement from admin history and delete it from all users' notification lists."
        confirmText={deleting ? "Deleting…" : "Delete"}
        confirmStyle="destructive"
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteId(null)}
      />
    </div>
  );
}
