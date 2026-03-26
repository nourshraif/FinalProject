"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const { token, isLoggedIn } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  async function fetchUnreadCount() {
    if (!token) return;
    try {
      const res = await fetch(
        `${BASE_URL}/api/notifications/unread-count`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (res.ok) {
        const data = (await res.json()) as { count?: number };
        const n = data.count;
        setUnreadCount(typeof n === "number" ? n : Number(n) || 0);
      }
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
    }
  }

  async function fetchNotifications() {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/notifications?limit=10`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as Notification[];
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function markAllRead() {
    if (!token) return;
    try {
      await fetch(`${BASE_URL}/api/notifications/read-all`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );
    } catch (e) {
      console.error("Failed to mark all read:", e);
    }
  }

  async function markRead(id: number) {
    if (!token) return;
    try {
      await fetch(`${BASE_URL}/api/notifications/${id}/read`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setNotifications((prev) => {
        const hadUnread = prev.some((n) => n.id === id && !n.is_read);
        if (hadUnread) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        );
      });
    } catch (e) {
      console.error("Failed to mark read:", e);
    }
  }

  useEffect(() => {
    if (!isLoggedIn || !token) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [isLoggedIn, token]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleBellClick() {
    if (!isOpen) {
      fetchNotifications();
      setIsOpen(true);
      setTimeout(() => markAllRead(), 2000);
    } else {
      setIsOpen(false);
    }
  }

  function getNotificationIcon(type: string) {
    const icons: Record<string, string> = {
      contact_request: "👤",
      request_accepted: "✅",
      request_declined: "❌",
      job_alert: "🔔",
      new_job_match: "💼",
      profile_view: "👁",
      system: "🎉",
    };
    return icons[type] || "🔔";
  }

  function getTimeAgo(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  if (!isLoggedIn) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleBellClick}
        className="relative rounded-lg p-2 transition-colors hover:bg-white/10"
        style={{ color: "white" }}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            className="absolute flex items-center justify-center font-bold"
            style={{
              top: "-4px",
              right: "-4px",
              minWidth: "18px",
              height: "18px",
              background: "#ef4444",
              borderRadius: "9999px",
              fontSize: "10px",
              color: "white",
              padding: "0 4px",
              animation: "notification-pulse 2s infinite",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="glass-card absolute overflow-hidden"
          style={{
            top: "calc(100% + 8px)",
            right: 0,
            width: "380px",
            maxHeight: "480px",
            zIndex: 100,
          }}
        >
          <div
            className="flex items-center justify-between p-4"
            style={{ borderBottom: "1px solid #2a2a3d" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    background: "rgba(99,102,241,0.2)",
                    color: "#a5b4fc",
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs transition-colors"
              style={{ color: "#6366f1" }}
            >
              Mark all read
            </button>
          </div>

          <div style={{ overflowY: "auto", maxHeight: "360px" }}>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div
                  className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"
                  aria-hidden
                />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mb-2 text-4xl">🔔</div>
                <p className="text-sm" style={{ color: "#94a3b8" }}>
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    markRead(notification.id);
                    if (notification.link) {
                      router.push(notification.link);
                    }
                    setIsOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      markRead(notification.id);
                      if (notification.link) router.push(notification.link);
                      setIsOpen(false);
                    }
                  }}
                  className="flex cursor-pointer gap-3 p-4 transition-colors"
                  style={{
                    borderBottom: "1px solid #1e1e3a",
                    background: notification.is_read
                      ? "transparent"
                      : "rgba(99,102,241,0.05)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                      "rgba(255,255,255,0.03)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                      notification.is_read
                        ? "transparent"
                        : "rgba(99,102,241,0.05)";
                  }}
                >
                  <div
                    className="flex flex-shrink-0 items-center justify-center rounded-full text-lg"
                    style={{
                      width: 36,
                      height: 36,
                      background: "rgba(99,102,241,0.15)",
                    }}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium"
                      style={{
                        color: notification.is_read ? "#94a3b8" : "white",
                      }}
                    >
                      {notification.title}
                    </p>
                    <p
                      className="mt-0.5 text-xs"
                      style={{
                        color: "#64748b",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {notification.message}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "#475569" }}>
                      {getTimeAgo(notification.created_at)}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div
                      className="mt-1 flex-shrink-0"
                      style={{
                        width: 6,
                        height: 6,
                        background: "#6366f1",
                        borderRadius: "50%",
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>

          <div className="p-3 text-center" style={{ borderTop: "1px solid #2a2a3d" }}>
            <button
              type="button"
              onClick={() => {
                router.push("/notifications");
                setIsOpen(false);
              }}
              className="text-sm transition-colors"
              style={{ color: "#6366f1" }}
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
