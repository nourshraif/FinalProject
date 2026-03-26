"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { uploadProfileCV, getMySlug, updateProfileVisibility } from "@/lib/api";
import { SkeletonProfileHeader } from "@/components/Skeleton";

export default function ProfilePage() {
  return (
    <ProtectedRoute requiredRole="jobseeker">
      <ProfileContent />
    </ProtectedRoute>
  );
}

function ProfileContent() {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSkills, setEditingSkills] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form fields
  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [yearsExp, setYearsExp] = useState(0);
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingCV, setIsUploadingCV] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    cv_filename: string;
    skills_extracted: string[];
    skills_count: number;
  } | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [slugLoading, setSlugLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (token) fetchProfile();
    else setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setSlugLoading(false);
      return;
    }
    getMySlug(token)
      .then((r) => {
        setSlug(r.slug);
        setProfileUrl(r.profile_url);
      })
      .catch(() => setSlugLoading(false))
      .finally(() => setSlugLoading(false));
  }, [token]);

  async function fetchProfile() {
    if (!token) return;
    try {
      setError("");
      const res = await fetch(`${BASE_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to load profile");
      setProfile(data);
      setFullName((data.full_name as string) || "");
      setHeadline((data.headline as string) || "");
      setBio((data.bio as string) || "");
      setLocation((data.location as string) || "");
      setLinkedinUrl((data.linkedin_url as string) || "");
      setYearsExp(Number(data.years_experience) || 0);
      setSkills(Array.isArray(data.skills) ? data.skills : []);
      setIsPublic((data as { is_public?: boolean }).is_public !== false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!token) return;
    try {
      setError("");
      setSuccess("");
      const res = await fetch(`${BASE_URL}/api/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: fullName,
          headline,
          bio,
          location,
          linkedin_url: linkedinUrl,
          years_experience: yearsExp,
        }),
      });
      const data = res.ok ? await res.json() : null;
      if (res.ok) {
        setSuccess("Profile saved successfully");
        setIsEditing(false);
        fetchProfile();
        showToast("Profile saved successfully", "success");
      } else {
        const msg = (data?.detail as string) || "Failed to save profile";
        setError(msg);
        showToast(msg, "error");
      }
    } catch (e) {
      const msg = "Failed to save profile";
      setError(msg);
      showToast(msg, "error");
    }
  }

  async function saveSkills() {
    if (!token) return;
    try {
      setError("");
      setSuccess("");
      const res = await fetch(`${BASE_URL}/api/profile/skills`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ skills }),
      });
      if (res.ok) {
        setEditingSkills(false);
        setSuccess("Skills saved successfully");
        fetchProfile();
        showToast("Skills saved successfully", "success");
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = (data?.detail as string) || "Failed to save skills";
        setError(msg);
        showToast(msg, "error");
      }
    } catch (e) {
      const msg = "Failed to save skills";
      setError(msg);
      showToast(msg, "error");
    }
  }

  function addSkill() {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkill("");
    }
  }

  function removeSkill(skill: string) {
    setSkills(skills.filter((s) => s !== skill));
  }

  async function handleCVUpload(file: File) {
    if (!file.name.endsWith(".pdf")) {
      setError("Please upload a PDF file only");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be under 10MB");
      return;
    }
    if (!token) return;
    setIsUploadingCV(true);
    setError("");
    setUploadResult(null);
    try {
      const result = await uploadProfileCV(token, file);
      setUploadResult(result);
      setSkills(result.skills_extracted || []);
      await fetchProfile();
      setSuccess("CV uploaded and skills extracted!");
      showToast("CV uploaded and skills extracted!", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to upload CV";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setIsUploadingCV(false);
    }
  }

  // Calculate completeness
  const completeness = [
    fullName ? 15 : 0,
    headline ? 15 : 0,
    bio ? 20 : 0,
    location ? 10 : 0,
    linkedinUrl ? 10 : 0,
    skills.length >= 3 ? 20 : 0,
    profile?.cv_filename ? 10 : 0,
  ].reduce((a, b) => a + b, 0);

  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const quickSkills = [
    "Python",
    "JavaScript",
    "React",
    "Node.js",
    "SQL",
    "PostgreSQL",
    "Docker",
    "AWS",
    "TypeScript",
    "Java",
    "Machine Learning",
    "Git",
  ];

  if (loading)
    return (
      <div className="min-h-screen px-4 pb-12 pt-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <SkeletonProfileHeader />
        </div>
      </div>
    );

  return (
    <div className="min-h-screen px-4 pb-12 pt-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        {/* Success/Error messages */}
        {success && (
          <div
            className="mb-4 rounded-lg p-3 text-sm"
            style={{
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.3)",
              color: "#22c55e",
            }}
          >
            {success}
          </div>
        )}
        {error && (
          <div
            className="mb-4 rounded-lg p-3 text-sm"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444",
            }}
          >
            {error}
          </div>
        )}

        {/* Public Profile URL Card */}
        <div className="glass-card mb-4 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-white">Your Public Profile</p>
              <p
                className="mt-1 font-mono text-sm"
                style={{ color: "#6366f1" }}
              >
                {slugLoading
                  ? "Generating..."
                  : profileUrl || "localhost:3000/u/your-slug"}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => {
                  if (profileUrl) {
                    navigator.clipboard.writeText(profileUrl);
                    setCopyFeedback(true);
                    showToast("Copied! ✓", "success");
                    setTimeout(() => setCopyFeedback(false), 2000);
                  }
                }}
                disabled={!profileUrl || slugLoading}
                className="ghost-button rounded-lg px-3 py-2 text-sm"
              >
                {copyFeedback ? "Copied! ✓" : "Copy Link"}
              </button>
              {profileUrl && (
                <a
                  href={`/u/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ghost-button rounded-lg px-3 py-2 text-center text-sm"
                >
                  View Profile
                </a>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4">
            <span className="text-xs text-vertex-muted">Public profile</span>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              onClick={() => {
                if (!token) return;
                const next = !isPublic;
                setIsPublic(next);
                updateProfileVisibility(token, next)
                  .then(() => {
                    showToast(
                      next ? "Profile is now public" : "Profile is now private",
                      "success"
                    );
                  })
                  .catch(() => {
                    setIsPublic(isPublic);
                    showToast("Failed to update visibility", "error");
                  });
              }}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                isPublic ? "bg-indigo-600" : "bg-white/20"
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  isPublic ? "left-7" : "left-1"
                }`}
              />
            </button>
            {!isPublic && (
              <span className="text-xs text-vertex-muted">(hidden)</span>
            )}
          </div>
        </div>

        {/* Profile Header Card */}
        <div className="glass-card mb-4 p-8">
          {!isEditing ? (
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div
                  className="flex flex-shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white"
                  style={{
                    width: 80,
                    height: 80,
                    background:
                      "linear-gradient(135deg, #7c3aed, #6366f1)",
                  }}
                >
                  {initials || "?"}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {fullName || "Your Name"}
                  </h1>
                  <p
                    style={{ color: "#94a3b8" }}
                    className="mt-1 text-base"
                  >
                    {headline || "Add a headline"}
                  </p>
                  {location && (
                    <p
                      style={{ color: "#64748b" }}
                      className="mt-1 text-sm"
                    >
                      📍 {location}
                    </p>
                  )}
                  {linkedinUrl && (
                    <a
                      href={linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#6366f1" }}
                      className="mt-1 block text-sm hover:underline"
                    >
                      🔗 LinkedIn Profile
                    </a>
                  )}
                  {bio && (
                    <p
                      style={{ color: "#94a3b8" }}
                      className="mt-3 max-w-lg leading-relaxed text-sm"
                    >
                      {bio}
                    </p>
                  )}
                  {/* Skills chips */}
                  {skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {skills.slice(0, 8).map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full px-3 py-1 text-xs"
                          style={{
                            background: "#1e1e3a",
                            color: "#94a3b8",
                            border: "1px solid #2a2a3d",
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                      {skills.length > 8 && (
                        <span
                          style={{ color: "#64748b" }}
                          className="py-1 text-xs"
                        >
                          +{skills.length - 8} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="ghost-button rounded-lg px-4 py-2 text-sm text-white"
              >
                Edit Profile
              </button>
            </div>
          ) : (
            <div>
              <h2 className="mb-6 text-lg font-bold text-white">
                Edit Profile
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label
                    style={{ color: "#94a3b8" }}
                    className="mb-1 block text-xs"
                  >
                    Full Name
                  </label>
                  <input
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label
                    style={{ color: "#94a3b8" }}
                    className="mb-1 block text-xs"
                  >
                    Headline
                  </label>
                  <input
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Senior React Developer"
                  />
                </div>
                <div>
                  <label
                    style={{ color: "#94a3b8" }}
                    className="mb-1 block text-xs"
                  >
                    Location
                  </label>
                  <input
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Beirut, Lebanon"
                  />
                </div>
                <div>
                  <label
                    style={{ color: "#94a3b8" }}
                    className="mb-1 block text-xs"
                  >
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={yearsExp}
                    onChange={(e) =>
                      setYearsExp(Number(e.target.value))
                    }
                  />
                </div>
                <div className="col-span-2">
                  <label
                    style={{ color: "#94a3b8" }}
                    className="mb-1 block text-xs"
                  >
                    LinkedIn URL
                  </label>
                  <input
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div className="col-span-2">
                  <label
                    style={{ color: "#94a3b8" }}
                    className="mb-1 block text-xs"
                  >
                    Bio
                  </label>
                  <textarea
                    rows={4}
                    className="vertex-input w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell companies about yourself..."
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={saveProfile}
                  className="glow-button rounded-lg px-6 py-2 text-sm font-medium text-white"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="ghost-button rounded-lg px-6 py-2 text-sm text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Skills Card */}
        <div className="glass-card mb-4 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              Your Skills
            </h2>
            <button
              onClick={() => setEditingSkills(!editingSkills)}
              className="ghost-button rounded-lg px-4 py-2 text-sm text-white"
            >
              {editingSkills ? "Cancel" : "Edit Skills"}
            </button>
          </div>

          {!editingSkills ? (
            <div className="flex flex-wrap gap-2">
              {skills.length > 0 ? (
                skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full px-3 py-1 text-xs"
                    style={{
                      background: "#1e1e3a",
                      color: "#94a3b8",
                      border: "1px solid #2a2a3d",
                    }}
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <p
                  style={{ color: "#64748b" }}
                  className="text-sm"
                >
                  No skills added yet. Upload your CV or add
                  skills manually.
                </p>
              )}
            </div>
          ) : (
            <div>
              {/* Current skills with remove */}
              <div className="mb-4 flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="flex items-center gap-1 rounded-full px-3 py-1 text-xs"
                    style={{
                      background: "rgba(99,102,241,0.15)",
                      color: "#a5b4fc",
                      border: "1px solid rgba(99,102,241,0.3)",
                    }}
                  >
                    {skill}
                    <button
                      onClick={() => removeSkill(skill)}
                      className="ml-1 transition-colors hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              {/* Add new skill */}
              <div className="mb-4 flex gap-2">
                <input
                  className="vertex-input flex-1 rounded-lg px-3 py-2 text-sm text-white"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && addSkill()
                  }
                  placeholder="Type a skill and press Enter"
                />
                <button
                  onClick={addSkill}
                  className="glow-button rounded-lg px-4 py-2 text-sm text-white"
                >
                  Add
                </button>
              </div>

              {/* Quick add */}
              <div className="mb-4">
                <p
                  style={{ color: "#64748b" }}
                  className="mb-2 text-xs"
                >
                  Quick add:
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickSkills.map((skill) => (
                    <button
                      key={skill}
                      onClick={() =>
                        skills.includes(skill)
                          ? removeSkill(skill)
                          : setSkills([...skills, skill])
                      }
                      className="rounded-full px-3 py-1 text-xs transition-all"
                      style={{
                        background: skills.includes(skill)
                          ? "rgba(99,102,241,0.2)"
                          : "#1e1e3a",
                        color: skills.includes(skill)
                          ? "#a5b4fc"
                          : "#94a3b8",
                        border: skills.includes(skill)
                          ? "1px solid rgba(99,102,241,0.4)"
                          : "1px solid #2a2a3d",
                      }}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={saveSkills}
                className="glow-button rounded-lg px-6 py-2 text-sm font-medium text-white"
              >
                Save Skills
              </button>
            </div>
          )}
        </div>

        {/* CV Upload Card */}
        <div className="glass-card mb-4 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">
                Your CV
              </h2>
              <p
                className="mt-1 text-xs"
                style={{ color: "#94a3b8" }}
              >
                Upload your CV to get matched to jobs and appear in company searches
              </p>
            </div>
          </div>

          {profile?.cv_filename ? (
            <div
              className="mb-4 flex items-center gap-3 rounded-lg p-3"
              style={{
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.2)",
              }}
            >
              <span style={{ color: "#22c55e" }}>📄</span>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: "#22c55e" }}>
                  CV Uploaded
                </p>
                <p className="text-xs" style={{ color: "#64748b" }}>
                  {profile.cv_filename as string}
                </p>
              </div>
              <span
                className="rounded-full px-2 py-1 text-xs"
                style={{
                  background: "rgba(34,197,94,0.15)",
                  color: "#22c55e",
                }}
              >
                Active
              </span>
            </div>
          ) : (
            <div
              className="mb-4 rounded-lg p-3"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.15)",
              }}
            >
              <p className="text-sm" style={{ color: "#94a3b8" }}>
                ⚠️ No CV uploaded yet. Upload your CV to get job matches and appear in company searches.
              </p>
            </div>
          )}

          <div
            className="cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all"
            style={{
              borderColor: isDragging ? "#6366f1" : "#2a2a3d",
              background: isDragging ? "rgba(99,102,241,0.05)" : "transparent",
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) handleCVUpload(file);
            }}
            onClick={() => cvInputRef.current?.click()}
          >
            <input
              ref={cvInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCVUpload(file);
              }}
            />

            {isUploadingCV ? (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"
                  aria-hidden
                />
                <p className="text-sm" style={{ color: "#94a3b8" }}>
                  Uploading and extracting skills...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="mb-2 text-4xl">📤</div>
                <p className="text-sm font-medium text-white">
                  {profile?.cv_filename ? "Upload a new CV" : "Upload your CV"}
                </p>
                <p className="text-xs" style={{ color: "#64748b" }}>
                  Drag and drop or click to browse
                </p>
                <p className="text-xs" style={{ color: "#64748b" }}>
                  PDF only · Max 10MB
                </p>
              </div>
            )}
          </div>

          {uploadResult && (
            <div
              className="mt-4 rounded-lg p-3"
              style={{
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.2)",
              }}
            >
              <p className="text-sm font-medium" style={{ color: "#22c55e" }}>
                ✓ CV uploaded successfully!
              </p>
              <p className="mt-1 text-xs" style={{ color: "#94a3b8" }}>
                Extracted {uploadResult.skills_count} skills from your CV
              </p>
              {uploadResult.skills_extracted?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {uploadResult.skills_extracted.slice(0, 8).map((skill: string) => (
                    <span
                      key={skill}
                      className="rounded-full px-2 py-1 text-xs"
                      style={{
                        background: "rgba(99,102,241,0.15)",
                        color: "#a5b4fc",
                        border: "1px solid rgba(99,102,241,0.3)",
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile Completeness Card */}
        <div className="glass-card p-6">
          <h2 className="mb-4 text-lg font-bold text-white">
            Profile Completeness
          </h2>
          <div className="mb-4 flex items-center gap-3">
            <div
              className="h-2 flex-1 rounded-full"
              style={{ background: "#1e1e3a" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${completeness}%`,
                  background:
                    "linear-gradient(90deg, #06b6d4, #6366f1)",
                }}
              />
            </div>
            <span className="gradient-text text-lg font-bold">
              {completeness}%
            </span>
          </div>
          <div className="space-y-2">
            {[
              { label: "Full name added", done: !!fullName },
              { label: "Headline added", done: !!headline },
              { label: "Bio written", done: !!bio },
              { label: "Location set", done: !!location },
              { label: "LinkedIn added", done: !!linkedinUrl },
              {
                label: "Skills added (3+)",
                done: skills.length >= 3,
              },
              {
                label: "CV uploaded",
                done: !!profile?.cv_filename,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2"
              >
                <span
                  style={{
                    color: item.done ? "#22c55e" : "#64748b",
                  }}
                >
                  {item.done ? "✓" : "○"}
                </span>
                <span
                  className="text-sm"
                  style={{
                    color: item.done
                      ? "#e2e8f0"
                      : "#64748b",
                  }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          {completeness < 100 && (
            <p
              className="mt-4 text-xs"
              style={{ color: "#64748b" }}
            >
              💡 Complete your profile to appear higher in
              company searches
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
