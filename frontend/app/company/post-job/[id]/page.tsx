"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getCompanyPostedJobs, updatePostedJob } from "@/lib/api";
import type { PostedJob } from "@/types";

const JOB_TYPES = ["full-time", "part-time", "contract", "internship", "remote"] as const;
const EXPERIENCE_LEVELS = ["junior", "mid", "senior", "lead", "any"] as const;
const CURRENCIES = ["USD", "EUR", "LBP", "GBP", "AED"] as const;
const DESC_MAX = 5000;

function toFormExpiresAt(expires_at?: string | null): string {
  if (!expires_at) return "";
  try {
    const d = new Date(expires_at);
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function EditJobContent() {
  const params = useParams();
  const id = typeof params?.id === "string" ? parseInt(params.id, 10) : NaN;
  const { token } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [job, setJob] = useState<PostedJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    company_name: "",
    location: "",
    job_type: "full-time" as const,
    experience_level: "mid" as const,
    salary_min: "" as number | "",
    salary_max: "" as number | "",
    salary_currency: "USD" as const,
    description: "",
    requirements: "",
    benefits: "",
    skills_required: [] as string[],
    application_url: "",
    application_email: "",
    applyVia: "url" as "url" | "email",
    expires_at: "",
    is_active: true,
  });
  const [newSkill, setNewSkill] = useState("");

  const load = useCallback(() => {
    if (!token || Number.isNaN(id)) return;
    setLoading(true);
    getCompanyPostedJobs(token)
      .then((list) => {
        const found = list.find((j) => j.id === id);
        if (!found) {
          router.replace("/company/jobs");
          return;
        }
        setJob(found);
        setForm({
          title: found.title || "",
          company_name: found.company_name || "",
          location: found.location || "",
          job_type: (found.job_type as typeof form.job_type) || "full-time",
          experience_level: (found.experience_level as typeof form.experience_level) || "mid",
          salary_min: found.salary_min ?? "",
          salary_max: found.salary_max ?? "",
          salary_currency: (found.salary_currency as typeof form.salary_currency) || "USD",
          description: found.description || "",
          requirements: found.requirements || "",
          benefits: found.benefits || "",
          skills_required: Array.isArray(found.skills_required) ? found.skills_required : [],
          application_url: found.application_url || "",
          application_email: found.application_email || "",
          applyVia: found.application_url ? "url" : "email",
          expires_at: toFormExpiresAt(found.expires_at),
          is_active: found.is_active ?? true,
        });
      })
      .catch(() => router.replace("/company/jobs"))
      .finally(() => setLoading(false));
  }, [token, id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (key: string, value: unknown) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s || form.skills_required.includes(s)) return;
    setForm((f) => ({ ...f, skills_required: [...f.skills_required, s] }));
    setNewSkill("");
  };

  const removeSkill = (skill: string) => {
    setForm((f) => ({
      ...f,
      skills_required: f.skills_required.filter((x) => x !== skill),
    }));
  };

  const handleSubmit = () => {
    const title = form.title.trim();
    const description = form.description.trim();
    if (!title || !description) {
      showToast("Title and description are required", "error");
      return;
    }
    if (form.description.length > DESC_MAX) {
      showToast(`Description must be at most ${DESC_MAX} characters`, "error");
      return;
    }
    if (!token || Number.isNaN(id)) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      title,
      location: form.location.trim() || undefined,
      job_type: form.job_type,
      experience_level: form.experience_level,
      salary_currency: form.salary_currency,
      description,
      requirements: form.requirements.trim() || undefined,
      benefits: form.benefits.trim() || undefined,
      skills_required: form.skills_required,
      application_url: form.applyVia === "url" ? (form.application_url.trim() || undefined) : undefined,
      application_email: form.applyVia === "email" ? (form.application_email.trim() || undefined) : undefined,
      is_active: form.is_active,
    };
    const min = typeof form.salary_min === "number" ? form.salary_min : (form.salary_min === "" ? undefined : Number(form.salary_min));
    const max = typeof form.salary_max === "number" ? form.salary_max : (form.salary_max === "" ? undefined : Number(form.salary_max));
    if (min != null && !Number.isNaN(min)) payload.salary_min = min;
    if (max != null && !Number.isNaN(max)) payload.salary_max = max;

    updatePostedJob(token, id, payload)
      .then(() => {
        showToast("Job updated successfully!", "success");
        router.push("/company/jobs");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to update job", "error"))
      .finally(() => setSaving(false));
  };

  if (loading || !job) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center pt-24">
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
      <div className="mx-auto max-w-[800px] px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Edit Job</h1>
          <p className="mt-1 text-sm text-vertex-muted">
            Update your job posting
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8">
          <div className="mb-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm text-vertex-muted">Job Title *</label>
              <input
                className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-vertex-muted">Company Name</label>
              <input
                className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                value={form.company_name}
                readOnly
                disabled
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-vertex-muted">Location</label>
              <input
                className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-vertex-muted">Job Type</label>
                <select
                  className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                  value={form.job_type}
                  onChange={(e) => update("job_type", e.target.value)}
                >
                  {JOB_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/-/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-vertex-muted">Experience Level</label>
                <select
                  className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                  value={form.experience_level}
                  onChange={(e) => update("experience_level", e.target.value)}
                >
                  {EXPERIENCE_LEVELS.map((l) => (
                    <option key={l} value={l}>{l === "mid" ? "Mid-level" : l}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-vertex-muted">Min Salary</label>
              <input
                type="number"
                className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                value={form.salary_min === "" ? "" : form.salary_min}
                onChange={(e) => update("salary_min", e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-vertex-muted">Max Salary</label>
              <input
                type="number"
                className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                value={form.salary_max === "" ? "" : form.salary_max}
                onChange={(e) => update("salary_max", e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-vertex-muted">Currency</label>
              <select
                className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                value={form.salary_currency}
                onChange={(e) => update("salary_currency", e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm text-vertex-muted">Description *</label>
              <textarea
                rows={8}
                className="vertex-input w-full resize-none rounded-lg px-3 py-2 text-white"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
              <p className="mt-1 text-xs text-vertex-muted">{form.description.length}/{DESC_MAX}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-vertex-muted">Requirements</label>
              <textarea
                rows={5}
                className="vertex-input w-full resize-none rounded-lg px-3 py-2 text-white"
                value={form.requirements}
                onChange={(e) => update("requirements", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-vertex-muted">Benefits</label>
              <textarea
                rows={4}
                className="vertex-input w-full resize-none rounded-lg px-3 py-2 text-white"
                value={form.benefits}
                onChange={(e) => update("benefits", e.target.value)}
              />
            </div>
          </div>

          <div className="mb-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Required Skills</h2>
            <div className="flex flex-wrap gap-2">
              {form.skills_required.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full bg-vertex-card px-3 py-1 text-sm text-white"
                >
                  {s}
                  <button type="button" onClick={() => removeSkill(s)} className="ml-1 hover:opacity-80" aria-label={`Remove ${s}`}>×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="vertex-input flex-1 rounded-lg px-3 py-2 text-white"
                placeholder="Add a skill"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
              />
              <button type="button" onClick={addSkill} className="ghost-button rounded-lg px-4 py-2 text-sm">Add</button>
            </div>
          </div>

          <div className="mb-6 space-y-4">
            <h2 className="text-lg font-bold text-white">How to Apply</h2>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                <input type="radio" name="applyVia" checked={form.applyVia === "url"} onChange={() => update("applyVia", "url")} className="rounded-full" />
                Apply via URL
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                <input type="radio" name="applyVia" checked={form.applyVia === "email"} onChange={() => update("applyVia", "email")} className="rounded-full" />
                Apply via Email
              </label>
            </div>
            {form.applyVia === "url" && (
              <input
                className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                placeholder="https://..."
                value={form.application_url}
                onChange={(e) => update("application_url", e.target.value)}
              />
            )}
            {form.applyVia === "email" && (
              <input
                className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                placeholder="jobs@company.com"
                value={form.application_email}
                onChange={(e) => update("application_email", e.target.value)}
              />
            )}
            <div>
              <label className="mb-1 block text-sm text-vertex-muted">Job expires on (optional)</label>
              <input
                type="date"
                className="vertex-input rounded-lg px-3 py-2 text-white"
                value={form.expires_at}
                onChange={(e) => update("expires_at", e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !form.title.trim() || !form.description.trim()}
              className="glow-button h-12 flex-1 rounded-lg font-medium text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <Link href="/company/jobs" className="ghost-button flex-1 rounded-lg py-3 text-center text-sm font-medium">
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditPostJobPage() {
  return (
    <ProtectedRoute requiredRole="company">
      <EditJobContent />
    </ProtectedRoute>
  );
}
