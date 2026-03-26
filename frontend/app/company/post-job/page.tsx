"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getCompanyProfile, createPostedJob } from "@/lib/api";
import { PostedJobCard } from "@/components/PostedJobCard";
import { QuickSkillSelector } from "@/components/QuickSkillSelector";
import type { PostedJob } from "@/types";

const JOB_TYPES = ["full-time", "part-time", "contract", "internship", "remote"] as const;
const EXPERIENCE_LEVELS = ["junior", "mid", "senior", "lead", "any"] as const;
const CURRENCIES = ["USD", "EUR", "LBP", "GBP", "AED"] as const;
const DESC_MAX = 5000;

const initialForm = {
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
};

function PostJobContent() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [preview, setPreview] = useState(false);
  const [newSkill, setNewSkill] = useState("");

  const loadProfile = useCallback(() => {
    if (!token) return;
    getCompanyProfile(token)
      .then((p) => {
        setForm((f) => ({
          ...f,
          company_name: p.company_name?.trim() || f.company_name,
          application_email: p.email?.trim() || f.application_email,
        }));
      })
      .catch(() => {})
      .finally(() => setProfileLoaded(true));
  }, [token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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

  const previewJob: PostedJob = {
    id: 0,
    company_user_id: 0,
    title: form.title || "Job Title",
    company_name: form.company_name || "Company",
    location: form.location || undefined,
    job_type: form.job_type,
    experience_level: form.experience_level,
    salary_min: typeof form.salary_min === "number" ? form.salary_min : undefined,
    salary_max: typeof form.salary_max === "number" ? form.salary_max : undefined,
    salary_currency: form.salary_currency,
    description: form.description || "No description.",
    requirements: form.requirements || undefined,
    benefits: form.benefits || undefined,
    skills_required: form.skills_required,
    application_url: form.application_url || undefined,
    application_email: form.application_email || undefined,
    is_active: true,
    is_featured: false,
    views_count: 0,
    applications_count: 0,
    created_at: new Date().toISOString(),
  };

  const handleSubmit = () => {
    const title = form.title.trim();
    const description = form.description.trim();
    if (!title || !description) {
      showToast("Title and description are required", "error");
      return;
    }
    if (!form.company_name.trim()) {
      showToast("Company name is required", "error");
      return;
    }
    if (form.description.length > DESC_MAX) {
      showToast(`Description must be at most ${DESC_MAX} characters`, "error");
      return;
    }
    if (!token) return;
    setLoading(true);
    const payload: Record<string, unknown> = {
      title,
      company_name: form.company_name.trim(),
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
      expires_at: form.expires_at.trim() || undefined,
    };
    const min = typeof form.salary_min === "number" ? form.salary_min : (form.salary_min === "" ? undefined : Number(form.salary_min));
    const max = typeof form.salary_max === "number" ? form.salary_max : (form.salary_max === "" ? undefined : Number(form.salary_max));
    if (min != null && !Number.isNaN(min)) payload.salary_min = min;
    if (max != null && !Number.isNaN(max)) payload.salary_max = max;

    createPostedJob(token, payload)
      .then(() => {
        showToast("Job posted successfully!", "success");
        router.push("/company/jobs");
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to post job", "error"))
      .finally(() => setLoading(false));
  };

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto max-w-[800px] px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Post a Job</h1>
          <p className="mt-1 text-sm text-vertex-muted">
            Reach thousands of qualified candidates on Vertex
          </p>
        </div>

        {preview ? (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreview(false)}
                className="ghost-button rounded-lg px-4 py-2 text-sm"
              >
                Back to form
              </button>
            </div>
            <PostedJobCard job={previewJob} showCompany />
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-8">
            {/* Section 1 — Basic Info */}
            <h2 className="mb-4 border-b border-[#2a2a3d] pb-4 text-lg font-bold text-white">
              Basic Information
            </h2>
            <div className="mb-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm text-vertex-muted">Job Title *</label>
                <input
                  className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                  placeholder="e.g. Senior React Developer"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-vertex-muted">Company Name *</label>
                <input
                  className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                  placeholder="Your company name"
                  value={form.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-vertex-muted">Location</label>
                <input
                  className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                  placeholder="e.g. Beirut, Lebanon or Remote"
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
                      <option key={t} value={t}>
                        {t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </option>
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
                      <option key={l} value={l}>
                        {l === "mid" ? "Mid-level" : l.replace(/\b\w/g, (c) => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2 — Compensation */}
            <h2 className="mb-4 border-b border-[#2a2a3d] pb-4 text-lg font-bold text-white">
              Compensation
            </h2>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-vertex-muted">Min Salary</label>
                <input
                  type="number"
                  className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                  placeholder="e.g. 30000"
                  value={form.salary_min === "" ? "" : form.salary_min}
                  onChange={(e) => {
                    const v = e.target.value;
                    update("salary_min", v === "" ? "" : Number(v));
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-vertex-muted">Max Salary</label>
                <input
                  type="number"
                  className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                  placeholder="e.g. 60000"
                  value={form.salary_max === "" ? "" : form.salary_max}
                  onChange={(e) => {
                    const v = e.target.value;
                    update("salary_max", v === "" ? "" : Number(v));
                  }}
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
            <p className="mb-6 text-xs text-vertex-muted">
              Leave empty to show &quot;Salary not disclosed&quot;
            </p>

            {/* Section 3 — Job Details */}
            <h2 className="mb-4 border-b border-[#2a2a3d] pb-4 text-lg font-bold text-white">
              Job Details
            </h2>
            <div className="mb-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm text-vertex-muted">Description *</label>
                <textarea
                  rows={8}
                  className="vertex-input w-full resize-none rounded-lg px-3 py-2 text-white"
                  placeholder="Describe the role, responsibilities, and what you're looking for..."
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                />
                <p className="mt-1 text-xs text-vertex-muted">
                  {form.description.length}/{DESC_MAX}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm text-vertex-muted">Requirements</label>
                <textarea
                  rows={5}
                  className="vertex-input w-full resize-none rounded-lg px-3 py-2 text-white"
                  placeholder="List the requirements and qualifications..."
                  value={form.requirements}
                  onChange={(e) => update("requirements", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-vertex-muted">Benefits</label>
                <textarea
                  rows={4}
                  className="vertex-input w-full resize-none rounded-lg px-3 py-2 text-white"
                  placeholder="Describe the benefits and perks of the role..."
                  value={form.benefits}
                  onChange={(e) => update("benefits", e.target.value)}
                />
              </div>
            </div>

            {/* Section 4 — Required Skills */}
            <h2 className="mb-4 border-b border-[#2a2a3d] pb-4 text-lg font-bold text-white">
              Required Skills
            </h2>
            <div className="mb-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                {form.skills_required.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full bg-vertex-card px-3 py-1 text-sm text-white"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => removeSkill(s)}
                      className="ml-1 hover:opacity-80"
                      aria-label={`Remove ${s}`}
                    >
                      ×
                    </button>
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
                <button
                  type="button"
                  onClick={addSkill}
                  className="ghost-button rounded-lg px-4 py-2 text-sm"
                >
                  Add
                </button>
              </div>
              <QuickSkillSelector
                selected={form.skills_required}
                onChange={(skills) => setForm((f) => ({ ...f, skills_required: skills }))}
              />
            </div>

            {/* Section 5 — Application */}
            <h2 className="mb-4 text-lg font-bold text-white">
              How to Apply
            </h2>
            <div className="mb-6 space-y-4">
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                  <input
                    type="radio"
                    name="applyVia"
                    checked={form.applyVia === "url"}
                    onChange={() => update("applyVia", "url")}
                    className="rounded-full"
                  />
                  Apply via URL
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                  <input
                    type="radio"
                    name="applyVia"
                    checked={form.applyVia === "email"}
                    onChange={() => update("applyVia", "email")}
                    className="rounded-full"
                  />
                  Apply via Email
                </label>
              </div>
              {form.applyVia === "url" && (
                <div>
                  <input
                    className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                    placeholder="https://..."
                    value={form.application_url}
                    onChange={(e) => update("application_url", e.target.value)}
                  />
                </div>
              )}
              {form.applyVia === "email" && (
                <div>
                  <input
                    className="vertex-input w-full rounded-lg px-3 py-2 text-white"
                    placeholder="jobs@company.com"
                    value={form.application_email}
                    onChange={(e) => update("application_email", e.target.value)}
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm text-vertex-muted">
                  Job expires on (optional)
                </label>
                <input
                  type="date"
                  className="vertex-input rounded-lg px-3 py-2 text-white"
                  value={form.expires_at}
                  onChange={(e) => update("expires_at", e.target.value)}
                />
                <p className="mt-1 text-xs text-vertex-muted">Leave empty for no expiry</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 pt-4">
              <button
                type="button"
                onClick={() => setPreview(true)}
                className="ghost-button w-full rounded-lg py-2.5 text-sm sm:w-auto"
              >
                Preview Job Posting
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !form.title.trim() || !form.description.trim()}
                className="glow-button h-[52px] w-full rounded-lg font-medium text-white disabled:opacity-60"
              >
                {loading ? "Publishing..." : "Post Job"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PostJobPage() {
  return (
    <ProtectedRoute requiredRole="company">
      <PostJobContent />
    </ProtectedRoute>
  );
}
