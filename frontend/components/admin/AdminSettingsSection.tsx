"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminGetSettings, adminUpdateSettings } from "@/lib/api";
import type { PlatformSettings } from "@/types";

type Props = {
  token: string;
  showToast: (msg: string, type: "success" | "error") => void;
};

const FIELDS: { key: keyof PlatformSettings; label: string; prefix?: string }[] = [
  { key: "pro_monthly_price", label: "Pro monthly", prefix: "$" },
  { key: "pro_annual_price", label: "Pro annual", prefix: "$" },
  { key: "business_monthly_price", label: "Business monthly", prefix: "$" },
  { key: "business_annual_price", label: "Business annual", prefix: "$" },
  { key: "free_job_matches_limit", label: "Free job matches shown" },
  { key: "free_saved_jobs_limit", label: "Free saved jobs limit" },
  { key: "growth_monthly_price", label: "Growth monthly", prefix: "$" },
  { key: "growth_annual_price", label: "Growth annual (per mo)", prefix: "$" },
  { key: "growth_job_postings_limit", label: "Growth active jobs" },
  { key: "growth_contact_requests_limit", label: "Growth contact requests / mo" },
  { key: "growth_saved_candidates_limit", label: "Growth saved candidates" },
  { key: "free_contact_requests_limit", label: "Free contact requests / month" },
  { key: "free_job_postings_limit", label: "Free job postings limit" },
];

export function AdminSettingsSection({ token, showToast }: Props) {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    adminGetSettings(token)
      .then(setSettings)
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = (key: keyof PlatformSettings, value: string) => {
    const num = parseInt(value, 10);
    if (!Number.isNaN(num)) {
      setSettings((s) => (s ? { ...s, [key]: num } : s));
    }
  };

  const handleSave = async () => {
    if (!token || !settings) return;
    setSaving(true);
    try {
      const { _updated_at, ...payload } = settings;
      await adminUpdateSettings(token, payload);
      showToast("Settings saved", "success");
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card mt-6 flex justify-center rounded-xl p-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="glass-card mt-6 rounded-xl p-6 text-center text-vertex-muted">
        Could not load settings
      </div>
    );
  }

  return (
    <div className="glass-card mt-6 rounded-xl p-6">
      <h2 className="text-lg font-bold text-white">Pricing configuration</h2>
      <p className="mt-1 text-sm text-vertex-muted">
        Adjust plan prices and feature limits
      </p>

      <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
        Changing prices affects new subscribers only. Existing subscribers keep their
        current price.
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-bold text-white">Prices</h3>
          <div className="space-y-3">
            {FIELDS.slice(0, 4).map((f) => (
              <label key={f.key} className="block">
                <span className="text-xs text-vertex-muted">{f.label}</span>
                <div className="mt-1 flex items-center gap-2">
                  {f.prefix && (
                    <span className="text-sm text-vertex-muted">{f.prefix}</span>
                  )}
                  <input
                    type="number"
                    min={0}
                    className="vertex-input flex-1 px-3 py-2 text-sm"
                    value={settings[f.key] ?? 0}
                    onChange={(e) => updateField(f.key, e.target.value)}
                  />
                </div>
              </label>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-white">Feature limits (free)</h3>
          <div className="space-y-3">
            {FIELDS.slice(4).map((f) => (
              <label key={f.key} className="block">
                <span className="text-xs text-vertex-muted">{f.label}</span>
                <input
                  type="number"
                  min={0}
                  className="vertex-input mt-1 w-full px-3 py-2 text-sm"
                  value={settings[f.key] ?? 0}
                  onChange={(e) => updateField(f.key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="glow-button mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm disabled:opacity-70"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Saving…
          </>
        ) : (
          "Save settings"
        )}
      </button>

      {settings._updated_at && (
        <p className="mt-2 text-center text-xs text-vertex-muted">
          Last updated: {new Date(settings._updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
