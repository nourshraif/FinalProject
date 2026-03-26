"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getPublicProfile, type PublicProfile } from "@/lib/api";
import { ContactRequestModal } from "@/components/ContactRequestModal";
import { Share2, Linkedin } from "lucide-react";

function getInitials(fullName: string): string {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (fullName || "?").slice(0, 2).toUpperCase();
}

function SkeletonProfileHeader() {
  return (
    <div className="glass-card animate-pulse rounded-2xl p-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-6">
          <div className="h-24 w-24 shrink-0 rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-8 w-48 rounded bg-white/10" />
            <div className="h-5 w-32 rounded bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicProfilePage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const { user, token, isLoggedIn } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const load = useCallback(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    getPublicProfile(slug)
      .then(setProfile)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  function handleCopyUrl() {
    const url =
      typeof window !== "undefined"
        ? window.location.href
        : `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/u/${slug}`;
    navigator.clipboard.writeText(url).then(() => showToast("Copied!", "success"));
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[800px] px-6 pt-24 pb-16">
        <SkeletonProfileHeader />
        <div className="mt-4 h-32 animate-pulse rounded-2xl bg-white/5" />
        <div className="mt-4 h-40 animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 pt-24">
        <p className="gradient-text text-8xl font-bold">404</p>
        <h1 className="mt-4 text-2xl font-bold text-white">Profile not found</h1>
        <p className="mt-2 text-sm text-vertex-muted">
          This profile doesn&apos;t exist or is private
        </p>
        <Link
          href="/"
          className="glow-button mt-8 rounded-lg px-6 py-2.5 text-sm font-medium text-white"
        >
          Go Home
        </Link>
      </div>
    );
  }

  const isCompany = isLoggedIn && user?.user_type === "company";
  const isJobseeker = isLoggedIn && user?.user_type === "jobseeker";

  return (
    <div className="mx-auto max-w-[800px] px-6 pt-24 pb-16">
      {/* Profile header */}
      <div className="glass-card mb-6 rounded-2xl p-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-3xl font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              }}
            >
              {getInitials(profile.full_name)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{profile.full_name}</h1>
              <p className={profile.headline ? "gradient-text text-lg" : "text-vertex-muted text-lg"}>
                {profile.headline || "No headline"}
              </p>
              {profile.location && (
                <p className="mt-1 text-sm text-vertex-muted">📍 {profile.location}</p>
              )}
              {profile.years_experience != null && (
                <p className="text-sm text-vertex-muted">
                  💼 {profile.years_experience} years experience
                </p>
              )}
              {profile.member_since != null && (
                <p className="text-xs text-vertex-muted">📅 Member since {profile.member_since}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.linkedin_url && (
              <a
                href={profile.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ghost-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
              >
                <Linkedin className="h-4 w-4" />
                View LinkedIn
              </a>
            )}
            <button
              type="button"
              onClick={handleCopyUrl}
              className="ghost-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
            >
              <Share2 className="h-4 w-4" />
              Share Profile
            </button>
          </div>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <div className="glass-card mb-4 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white">About</h2>
          <p className="mt-2 text-base leading-relaxed text-vertex-muted">{profile.bio}</p>
        </div>
      )}

      {/* Skills */}
      <div className="glass-card mb-4 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Skills</h2>
          <span className="text-sm text-vertex-muted">
            {profile.skills?.length ?? 0} skills
          </span>
        </div>
        {profile.skills?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.skills.map((s, i) => (
              <span
                key={i}
                className="rounded-full border px-3 py-1 text-sm"
                style={{ borderColor: "#2a2a3d", background: "#1e1e3a", color: "#94a3b8" }}
              >
                {s}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-vertex-muted">No skills listed</p>
        )}
      </div>

      {/* CTA */}
      <div
        className="rounded-2xl border p-6 text-center"
        style={{
          borderColor: "rgba(99,102,241,0.3)",
          background: "rgba(99,102,241,0.05)",
        }}
      >
        {!isLoggedIn && (
          <>
            <h2 className="text-lg font-bold text-white">
              Interested in {profile.full_name}?
            </h2>
            <p className="mt-1 text-sm text-vertex-muted">
              Sign up as a company to contact this candidate
            </p>
            <Link
              href="/auth/register?type=company"
              className="glow-button mt-4 inline-block rounded-lg px-6 py-2.5 text-sm font-medium text-white"
            >
              Sign Up as Company
            </Link>
            <p className="mt-4 text-sm text-vertex-muted">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-medium text-indigo-400 hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}
        {isCompany && (
          <>
            <h2 className="text-lg font-bold text-white">Contact {profile.full_name}</h2>
            {profile.user_id != null && token && (
              <>
                <button
                  type="button"
                  onClick={() => setContactModalOpen(true)}
                  className="glow-button mt-4 rounded-lg px-6 py-2.5 text-sm font-medium text-white"
                >
                  Send Contact Request
                </button>
                <ContactRequestModal
                  isOpen={contactModalOpen}
                  onClose={() => setContactModalOpen(false)}
                  candidateUserId={profile.user_id}
                  candidateName={profile.full_name}
                  token={token}
                />
              </>
            )}
          </>
        )}
        {isJobseeker && (
          <p className="text-sm text-vertex-muted">This is a job seeker profile</p>
        )}
      </div>
    </div>
  );
}
