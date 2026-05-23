"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import {
  getCompanyProfile,
  updateCompanyProfile,
  getCandidateCount,
} from "@/lib/api";
import type { CompanyProfile } from "@/types";
import { toast } from "sonner";

const COMPANY_SIZE_OPTIONS = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "500-1000",
  "1000+",
];

function completeness(p: CompanyProfile | null): number {
  if (!p) return 0;
  let n = 0;
  if (p.company_name?.trim()) n += 25;
  if (p.industry?.trim()) n += 20;
  if (p.company_size?.trim()) n += 15;
  if (p.website?.trim()) n += 15;
  if (p.description?.trim()) n += 25;
  return n;
}

function CompanyProfileContent() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [talentPoolCount, setTalentPoolCount] = useState<number | null>(null);
  const [form, setForm] = useState({
    company_name: "",
    industry: "",
    company_size: "",
    website: "",
    contact_name: "",
    description: "",
  });

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getCompanyProfile(token)
      .then((p) => {
        setProfile(p);
        setForm({
          company_name: p.company_name ?? "",
          industry: p.industry ?? "",
          company_size: p.company_size ?? "",
          website: p.website ?? "",
          contact_name: p.full_name ?? "",
          description: p.description ?? "",
        });
      })
      .catch((e) => {
        setProfile(null);
        toast.error(e instanceof Error ? e.message : "Failed to load profile");
      })
      .finally(() => setLoading(false));
    getCandidateCount()
      .then(setTalentPoolCount)
      .catch(() => setTalentPoolCount(0));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = () => {
    if (!token || !form.company_name.trim()) return;
    setSaveLoading(true);
    updateCompanyProfile(token, {
      company_name: form.company_name.trim(),
      industry: form.industry.trim() || undefined,
      company_size: form.company_size || undefined,
      website: form.website.trim() || undefined,
      description: form.description.trim() || undefined,
      contact_name: form.contact_name.trim() || undefined,
    })
      .then((updated) => {
        setProfile(updated);
        setIsEditing(false);
        toast.success("Company profile saved");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to save profile"))
      .finally(() => setSaveLoading(false));
  };

  const pct = completeness(profile);
  const checks = {
    company_name: !!(profile?.company_name?.trim()),
    industry: !!(profile?.industry?.trim()),
    company_size: !!(profile?.company_size?.trim()),
    website: !!(profile?.website?.trim()),
    description: !!(profile?.description?.trim()),
  };
  const initial = (profile?.company_name ?? "?")[0].toUpperCase();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-transparent"
          style={{ borderTopColor: "#6366f1" }}
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto max-w-[900px] px-4 sm:px-6">
        {/* Header card */}
        <div className="glass-card mb-6 rounded-2xl p-8">
          {!isEditing ? (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div
                  className="mb-4 flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  }}
                >
                  {initial}
                </div>
                <h1 className="text-2xl font-bold text-vertex-white">
                  {profile?.company_name || "Company Name"}
                </h1>
                {profile?.industry && (
                  <p className="mt-1 flex items-center gap-1.5 text-base text-vertex-muted">
                    <span aria-hidden>🏢</span> {profile.industry}
                  </p>
                )}
                {profile?.company_size && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-vertex-muted">
                    <span aria-hidden>👥</span> {profile.company_size}
                  </p>
                )}
                {profile?.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-1.5 text-sm transition-colors hover:underline"
                    style={{ color: "#6366f1" }}
                  >
                    <span aria-hidden>🌐</span> {profile.website}
                  </a>
                )}
                <div className="mt-4 max-w-[600px]">
                  {profile?.description ? (
                    <p className="text-sm leading-relaxed text-vertex-muted">
                      {profile.description}
                    </p>
                  ) : (
                    <p className="italic text-vertex-muted">
                      No description added yet
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="ghost-button shrink-0 rounded-lg px-4 py-2 text-sm font-medium"
              >
                Edit Profile
              </button>
            </div>
          ) : (
            <div>
              <h2 className="mb-6 text-lg font-bold text-vertex-white">
                Edit Company Profile
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-vertex-muted">
                    Company Name *
                  </label>
                  <input
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={form.company_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, company_name: e.target.value }))
                    }
                    placeholder="Your company name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-vertex-muted">
                    Industry
                  </label>
                  <input
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={form.industry}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, industry: e.target.value }))
                    }
                    placeholder="e.g. Technology, Finance, Healthcare"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-vertex-muted">
                    Company Size
                  </label>
                  <select
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={form.company_size}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, company_size: e.target.value }))
                    }
                  >
                    <option value="">Select size</option>
                    {COMPANY_SIZE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-vertex-muted">
                    Website
                  </label>
                  <input
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={form.website}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, website: e.target.value }))
                    }
                    placeholder="https://yourcompany.com"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-vertex-muted">
                    Contact Name
                  </label>
                  <input
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={form.contact_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contact_name: e.target.value }))
                    }
                    placeholder="Your full name"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-vertex-muted">
                    Description
                  </label>
                  <textarea
                    rows={4}
                    className="vertex-input w-full resize-none rounded-lg px-3 py-2 text-sm text-white"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="Tell job seekers about your company, culture, and what makes you unique..."
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveLoading || !form.company_name.trim()}
                  className="glow-button rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saveLoading ? "Saving..." : "Save Profile"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="ghost-button rounded-lg px-5 py-2.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hiring Activity */}
        <div className="glass-card mb-6 rounded-2xl p-8">
          <h2 className="mb-6 text-lg font-bold text-vertex-white">
            Hiring Activity
          </h2>
          <div className="flex flex-wrap items-center gap-6">
            <div className="px-4">
              <p className="text-2xl font-bold text-vertex-white">0</p>
              <p className="text-sm text-vertex-muted">Searches Run</p>
            </div>
            <div
              className="h-10 w-px shrink-0"
              style={{ background: "#2a2a3d" }}
              aria-hidden
            />
            <div className="px-4">
              <p className="text-2xl font-bold text-vertex-white">0</p>
              <p className="text-sm text-vertex-muted">Candidates Viewed</p>
            </div>
            <div
              className="h-10 w-px shrink-0"
              style={{ background: "#2a2a3d" }}
              aria-hidden
            />
            <div className="px-4">
              <p className="text-2xl font-bold text-vertex-white">
                {talentPoolCount === null ? "..." : talentPoolCount}
              </p>
              <p className="text-sm text-vertex-muted">Talent Pool Size</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass-card mb-6 rounded-2xl p-8">
          <h2 className="mb-6 text-lg font-bold text-vertex-white">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/company/search"
              className="glow-button rounded-lg px-5 py-2.5 text-sm font-medium text-white"
            >
              Search Candidates
            </Link>
            <Link
              href="/company/admin"
              className="ghost-button rounded-lg px-5 py-2.5 text-sm font-medium"
            >
              View All Talent
            </Link>
            <Link
              href="/dashboard/company"
              className="ghost-button rounded-lg px-5 py-2.5 text-sm font-medium"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Profile Completeness */}
        <div className="glass-card mt-6 rounded-2xl p-6">
          <h2 className="mb-4 text-lg font-bold text-vertex-white">
            Profile Completeness
          </h2>
          <div className="mb-2 h-2 w-full overflow-hidden rounded" style={{ background: "#1e1e3a" }}>
            <div
              className="h-full rounded transition-all duration-300"
              style={{
                width: `${pct}%`,
                background:
                  "linear-gradient(90deg, #06b6d4 0%, #6366f1 100%)",
              }}
            />
          </div>
          <p className="mb-6 text-xl font-bold gradient-text">{pct}% Complete</p>
          <ul className="space-y-2 text-sm">
            {[
              { key: "company_name", label: "Company name added", done: checks.company_name },
              { key: "industry", label: "Industry added", done: checks.industry },
              { key: "company_size", label: "Company size set", done: checks.company_size },
              { key: "website", label: "Website added", done: checks.website },
              { key: "description", label: "Description written", done: checks.description },
            ].map(({ key, label, done }) => (
              <li key={key} className="flex items-center gap-2">
                {done ? (
                  <Check className="h-4 w-4 shrink-0" style={{ color: "#22c55e" }} />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-vertex-muted" />
                )}
                <span className={done ? "text-vertex-white" : "text-vertex-muted"}>
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function CompanyProfilePage() {
  return (
    <ProtectedRoute requiredRole="company">
      <CompanyProfileContent />
    </ProtectedRoute>
  );
}
