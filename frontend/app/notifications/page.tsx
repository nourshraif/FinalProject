"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import {
  deleteNotification,
  getNotifications,
  markAllRead,
  markNotificationRead,
} from "@/lib/api";
import type { Notification } from "@/types";

type Filter = "all" | "unread" | "jobs" | "requests" | "alerts";

function relativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / (60 * 1000));
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

function isJobType(type: Notification["type"]) {
  return type === "job_alert" || type === "new_job_match";
}

function isRequestType(type: Notification["type"]) {
  return (
    type === "contact_request" ||
    type === "request_accepted" ||
    type === "request_declined"
  );
}

function symbolForType(type: Notification["type"]): string {
  switch (type) {
    case "contact_request":
      return "person_add";
    case "request_accepted":
      return "check_circle";
    case "request_declined":
      return "cancel";
    case "job_alert":
    case "new_job_match":
      return "work";
    case "profile_view":
      return "visibility";
    case "system":
      return "security";
    default:
      return "notifications";
  }
}

function symbolBg(type: Notification["type"]): string {
  switch (type) {
    case "job_alert":
    case "new_job_match":
      return "bg-v-primaryContainer/20 text-v-primary";
    case "contact_request":
      return "border border-v-outlineVariant/20 bg-v-surfaceContainerHighest/80 text-v-onSurface";
    case "system":
      return "bg-v-surfaceContainerHighest text-v-onSurfaceVariant";
    default:
      return "bg-v-tertiaryContainer/20 text-v-tertiary";
  }
}

function NotificationsPageContent() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const list = await getNotifications(token, false);
      setNotifications(Array.isArray(list) ? list : []);
    } catch {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => !n.is_read);
    if (filter === "jobs") return notifications.filter((n) => isJobType(n.type));
    if (filter === "requests") return notifications.filter((n) => isRequestType(n.type));
    if (filter === "alerts") return notifications.filter((n) => n.type === "system");
    return notifications;
  }, [filter, notifications]);

  const filterTabs: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "jobs", label: "Job activity" },
    { id: "requests", label: "Requests" },
    { id: "alerts", label: "Alerts" },
  ];

  return (
    <div className="relative min-h-screen bg-v-surface pb-32 pt-28 font-body text-v-onSurface selection:bg-v-primary/30">
      <div className="pointer-events-none fixed right-0 top-0 -z-10 h-[500px] w-[500px] opacity-60 aurora-glow" />
      <div className="pointer-events-none fixed bottom-0 left-0 -z-10 h-[600px] w-[600px] opacity-40 aurora-glow" />

      <main className="relative mx-auto max-w-5xl px-6">
        <section className="mb-12">
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-v-onSurface">
            Notifications
          </h1>
          <p className="mt-2 max-w-2xl font-body text-lg text-v-onSurfaceVariant">
            Stay updated with your latest career opportunities, networking connections, and platform
            system alerts.
          </p>
        </section>

        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div className="no-scrollbar flex items-center gap-3 overflow-x-auto pb-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-full px-6 py-2 font-label text-sm font-semibold uppercase tracking-wider transition-transform active:scale-95 ${
                  filter === tab.id
                    ? "bg-v-primary text-v-onPrimary"
                    : "border border-v-outlineVariant/10 bg-v-surfaceContainerHighest/60 text-v-onSurfaceVariant hover:bg-v-surfaceContainerHighest"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              className="font-label text-sm font-bold uppercase tracking-[0.2em] text-v-primary transition hover:opacity-90"
              onClick={async () => {
                await markAllRead(token || "");
                setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
              style={{ borderTopColor: "#c0c1ff" }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-[3rem] py-20 text-center">
            <span className="material-symbols-outlined text-5xl text-v-primary/50" aria-hidden>
              notifications_off
            </span>
            <p className="mt-4 font-headline text-xl font-bold text-indigo-50">That&apos;s all for now</p>
            <p className="mt-1 text-sm text-v-onSurfaceVariant">No notifications in this view.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => {
              const unread = !item.is_read;
              const sym = symbolForType(item.type);
              const rowClass = unread
                ? "glass-card border-v-outlineVariant/10 hover:bg-v-surfaceContainerHighest/50"
                : "border-v-outlineVariant/5 bg-v-surfaceContainerLow/40 hover:bg-v-surfaceContainerHighest/30";

              return (
                <div
                  key={item.id}
                  className={`group flex cursor-pointer items-center gap-5 rounded-[3rem] border p-5 transition-all ${rowClass}`}
                >
                  <div
                    className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${symbolBg(item.type)}`}
                  >
                    <span
                      className="material-symbols-outlined text-2xl"
                      style={unread ? { fontVariationSettings: "'FILL' 1, 'wght' 400" } : undefined}
                      aria-hidden
                    >
                      {sym}
                    </span>
                    {unread && (
                      <div className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0b1326] bg-v-primary shadow-[0_0_10px_rgba(192,193,255,0.6)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <h3
                        className={`font-headline truncate text-base font-bold ${
                          unread ? "text-v-onSurface" : "text-v-onSurfaceVariant"
                        }`}
                      >
                        {item.title}
                      </h3>
                      <span
                        className={`whitespace-nowrap font-label text-xs font-bold ${
                          unread ? "text-v-primary" : "text-v-onSurfaceVariant"
                        }`}
                      >
                        {relativeTime(item.created_at)}
                      </span>
                    </div>
                    <p
                      className={`line-clamp-2 text-sm ${
                        unread ? "text-v-onSurfaceVariant" : "text-v-onSurfaceVariant/60"
                      }`}
                    >
                      {item.message}
                    </p>
                    {item.link && (
                      <a
                        href={item.link}
                        className="mt-2 inline-block font-label text-sm font-semibold text-v-primary hover:underline"
                      >
                        Open
                      </a>
                    )}
                  </div>
                  <div className="hidden shrink-0 opacity-0 transition-opacity group-hover:opacity-100 md:block">
                    <span className="material-symbols-outlined text-v-onSurfaceVariant">chevron_right</span>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    {unread && (
                      <button
                        type="button"
                        className="font-label text-xs font-semibold text-v-primary hover:underline"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await markNotificationRead(token || "", item.id);
                          setNotifications((prev) =>
                            prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
                          );
                        }}
                      >
                        Read
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-v-onSurfaceVariant transition-colors hover:text-red-400"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await deleteNotification(token || "", item.id);
                        setNotifications((prev) => prev.filter((n) => n.id !== item.id));
                      }}
                      aria-label="Delete notification"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-16 flex flex-col items-end justify-between gap-6 border-t border-v-outlineVariant/10 pt-12 md:flex-row md:items-end">
          <div className="max-w-xs text-left">
            <h4 className="font-headline text-lg font-bold text-v-onSurface">That&apos;s all for now.</h4>
            <p className="text-sm text-v-onSurfaceVariant">
              Caught up on recent activity. Adjust alert frequency in settings anytime.
            </p>
          </div>
          <Link
            href="/settings/alerts"
            className="font-label text-sm font-bold uppercase tracking-[0.2em] text-v-primary transition hover:opacity-90"
          >
            Notification preferences
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute requiredRole="any">
      <NotificationsPageContent />
    </ProtectedRoute>
  );
}
