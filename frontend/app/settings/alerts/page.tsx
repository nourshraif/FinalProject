"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  getAlertSettings,
  updateAlertSettings,
  type AlertSettings,
} from "@/lib/api";
import { Zap, Sun, Calendar } from "lucide-react";

function AlertsContent() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(true);
  const [localFrequency, setLocalFrequency] = useState<"immediate" | "daily" | "weekly">("daily");
  const [localMinScore, setLocalMinScore] = useState(70);

  const load = useCallback(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    getAlertSettings(token)
      .then((s) => {
        setSettings(s);
        setLocalEnabled(s.is_enabled ?? true);
        setLocalFrequency((s.frequency as "immediate" | "daily" | "weekly") || "daily");
        setLocalMinScore(s.min_match_score ?? 70);
      })
      .catch(() => {
        setLocalEnabled(true);
        setLocalFrequency("daily");
        setLocalMinScore(70);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSave() {
    if (!token) return;
    setSaving(true);
    updateAlertSettings(token, {
      is_enabled: localEnabled,
      frequency: localFrequency,
      min_match_score: localMinScore,
    })
      .then((s) => {
        setSettings(s);
        showToast("Alert settings saved", "success");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to save", "error"))
      .finally(() => setSaving(false));
  }

  async function handleTestAlert() {
    if (!token) return;
    setIsTestLoading(true);
    try {
      const BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      const res = await fetch(`${BASE_URL}/api/alerts/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof err.detail === "string" ? err.detail : "Failed to send test alert"
        );
      }

      const data = await res.json();
      showToast(
        `Test alert sent! Found ${data.jobs_count} matching jobs. Check your email.`,
        "success"
      );
    } catch (e: unknown) {
      showToast(
        e instanceof Error ? e.message : "Failed to send test alert",
        "error"
      );
    } finally {
      setIsTestLoading(false);
    }
  }

  const scoreLabel =
    localMinScore <= 50
      ? "Low — you'll receive many alerts"
      : localMinScore <= 75
        ? "Balanced — good quality alerts"
        : "High — only the best matches";
  const scoreColor =
    localMinScore <= 50
      ? "text-amber-400"
      : localMinScore <= 75
        ? "text-green-400"
        : "text-indigo-400";

  if (loading) {
    return (
      <div className="mx-auto max-w-[700px] px-6 pt-24 pb-16">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-transparent border-t-indigo-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[700px] px-6 pt-24 pb-16">
      <h1 className="text-3xl font-bold text-white">Job Alert Settings</h1>
      <p className="mt-1 text-sm text-vertex-muted">
        Get notified when new matching jobs are found
      </p>

      <div className="glass-card mt-8 rounded-2xl p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-bold text-white">Job Alerts</p>
            <p className="mt-0.5 text-sm text-vertex-muted">
              Receive email notifications for new matching jobs
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={localEnabled}
            onClick={() => setLocalEnabled((e) => !e)}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
              localEnabled ? "bg-indigo-600" : "bg-white/20"
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                localEnabled ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>

        {localEnabled && (
          <>
            <p className="mt-6 font-bold text-white">Alert Frequency</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  value: "immediate" as const,
                  icon: Zap,
                  title: "Immediate",
                  desc: "As soon as new jobs are scraped",
                },
                {
                  value: "daily" as const,
                  icon: Sun,
                  title: "Daily",
                  desc: "Once a day at 8:00 AM",
                },
                {
                  value: "weekly" as const,
                  icon: Calendar,
                  title: "Weekly",
                  desc: "Every Monday morning",
                },
              ].map((opt) => {
                const Icon = opt.icon;
                const selected = localFrequency === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLocalFrequency(opt.value)}
                    className={`rounded-xl border-2 p-4 text-left transition ${
                      selected
                        ? "border-indigo-500 bg-indigo-500/20"
                        : "border-transparent bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${selected ? "text-indigo-400" : "text-vertex-muted"}`}
                    />
                    <p className="mt-2 font-medium text-white">{opt.title}</p>
                    <p className="mt-0.5 text-xs text-vertex-muted">{opt.desc}</p>
                  </button>
                );
              })}
            </div>

            <p className="mt-6 font-bold text-white">Minimum Match Score</p>
            <p className="mt-0.5 text-xs text-vertex-muted">
              Only send alerts for jobs above this match score
            </p>
            <p className="gradient-text mt-2 text-center text-3xl font-bold">
              {localMinScore}%
            </p>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={localMinScore}
              onChange={(e) => setLocalMinScore(Number(e.target.value))}
              className="mt-2 w-full accent-indigo-500"
            />
            <p className={`mt-1 text-center text-sm ${scoreColor}`}>{scoreLabel}</p>
          </>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="glow-button mt-8 w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-70"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>

      <div className="glass-card mt-6 rounded-2xl p-6">
        <h2 className="font-bold text-white">Test Your Alerts</h2>
        <p className="mt-1 mb-4 text-sm text-vertex-muted">
          Send a test alert to see what your job alert emails look like
        </p>
        <button
          type="button"
          onClick={handleTestAlert}
          disabled={isTestLoading}
          className="ghost-button rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-70"
        >
          {isTestLoading ? "Sending…" : "Send Test Alert"}
        </button>
        <p className="mt-3 text-xs text-vertex-muted">
          Test alerts use your current skills and the latest available jobs
        </p>
      </div>

      <div className="glass-card mt-6 rounded-2xl p-6">
        <h2 className="font-bold text-white">Alert History</h2>
        <p className="mt-0.5 text-xs text-vertex-muted">Recent alerts sent to you</p>
        <p className="mt-6 text-center text-sm text-vertex-muted">
          Alert history coming soon
        </p>
      </div>
    </div>
  );
}

export default function AlertsSettingsPage() {
  return (
    <ProtectedRoute requiredRole="jobseeker">
      <AlertsContent />
    </ProtectedRoute>
  );
}
