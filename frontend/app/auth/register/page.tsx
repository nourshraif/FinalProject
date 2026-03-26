"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Building2, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { registerUser } from "@/lib/api";
import type { User as AuthUser } from "@/context/AuthContext";
import GoogleButton from "@/components/GoogleButton";

type UserType = "jobseeker" | "company";

function getPasswordStrength(password: string): { level: "weak" | "medium" | "strong"; width: number; color: string; label: string } {
  const len = password.length;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  if (len < 6) {
    return { level: "weak", width: 33, color: "#ef4444", label: "Weak" };
  }
  if (len >= 10 && hasNumber && hasSpecial) {
    return { level: "strong", width: 100, color: "#22c55e", label: "Strong" };
  }
  return { level: "medium", width: 66, color: "#f59e0b", label: "Medium" };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userType, setUserType] = useState<UserType>("jobseeker");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(password);

  async function handleRegister() {
    setError("");
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      const msg = "Please fill in all fields";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    if (password.length < 6) {
      const msg = "Password must be at least 6 characters";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    if (password !== confirmPassword) {
      const msg = "Passwords do not match";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      const msg = "Please enter a valid email";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    if (userType === "company" && !companyName.trim()) {
      const msg = "Please enter your company name";
      setError(msg);
      showToast(msg, "error");
      return;
    }

    setLoading(true);
    try {
      const res = await registerUser({
        email: email.trim(),
        full_name: fullName.trim(),
        password,
        user_type: userType,
        company_name: userType === "company" ? companyName.trim() : null,
      });
      const user: AuthUser = {
        id: res.user_id,
        email: res.email,
        full_name: res.full_name,
        user_type: res.user_type as "jobseeker" | "company",
        is_admin: res.is_admin ?? false,
      };
      login(res.access_token, user);
      showToast("Account created successfully", "success");
      if (user.user_type === "jobseeker") {
        router.push("/dashboard/jobseeker");
      } else {
        router.push("/dashboard/company");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-[480px] rounded-2xl p-10">
        <div className="mb-2 flex justify-center">
          <Logo size="lg" href="/" />
        </div>
        <h1 className="text-center text-2xl font-bold text-vertex-white">
          Create your account
        </h1>
        <p className="mb-8 text-center text-sm text-vertex-muted">
          Join Vertex. Free to get started.
        </p>

        <div className="mb-6">
          <label className="mb-2 block text-xs text-vertex-muted">I am a...</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setUserType("jobseeker")}
              className="glass-card flex flex-col items-center gap-1 rounded-xl p-4 text-left transition-colors cursor-pointer border-2"
              style={{
                borderColor: userType === "jobseeker" ? "#6366f1" : "#2a2a3d",
                background: userType === "jobseeker" ? "rgba(99,102,241,0.1)" : undefined,
              }}
            >
              <User className="h-6 w-6" style={{ color: "#6366f1" }} />
              <span className="font-bold text-vertex-white">Job Seeker</span>
              <span className="text-xs text-vertex-muted">Find your perfect role</span>
            </button>
            <button
              type="button"
              onClick={() => setUserType("company")}
              className="glass-card flex flex-col items-center gap-1 rounded-xl p-4 text-left transition-colors cursor-pointer border-2"
              style={{
                borderColor: userType === "company" ? "#6366f1" : "#2a2a3d",
                background: userType === "company" ? "rgba(99,102,241,0.1)" : undefined,
              }}
            >
              <Building2 className="h-6 w-6" style={{ color: "#6366f1" }} />
              <span className="font-bold text-vertex-white">Company</span>
              <span className="text-xs text-vertex-muted">Find the right talent</span>
            </button>
          </div>
        </div>

        <GoogleButton
          userType={userType}
          label={`Continue with Google as ${userType === "company" ? "Company" : "Job Seeker"}`}
        />

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-vertex-border" />
          <span className="text-sm text-vertex-muted">or</span>
          <div className="h-px flex-1 bg-vertex-border" />
        </div>

        <div>
          <label className="mb-1 block text-xs text-vertex-muted">Full Name</label>
          <input
            type="text"
            placeholder="John Smith"
            className="vertex-input w-full"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-vertex-muted">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            className="vertex-input w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-vertex-muted">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            className="vertex-input w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-sm" style={{ background: "#2a2a3d" }}>
            <div
              className="h-full rounded-sm transition-all duration-200"
              style={{ width: `${strength.width}%`, background: strength.color }}
            />
          </div>
          <p className="mt-0.5 text-xs" style={{ color: strength.color }}>
            {strength.label}
          </p>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-vertex-muted">Confirm Password</label>
          <input
            type="password"
            placeholder="••••••••"
            className="vertex-input w-full"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        {userType === "company" && (
          <div className="mt-4 overflow-hidden transition-all duration-300">
            <label className="mb-1 block text-xs text-vertex-muted">Company Name</label>
            <input
              type="text"
              placeholder="Acme Corp"
              className="vertex-input w-full"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={loading}
            />
          </div>
        )}

        {error && (
          <div
            className="mt-4 rounded-lg border px-3 py-3"
            style={{
              background: "rgba(239,68,68,0.1)",
              borderColor: "rgba(239,68,68,0.3)",
              color: "#ef4444",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleRegister}
          disabled={loading}
          className="glow-button mt-6 flex h-12 w-full items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </button>

        <p className="mt-6 text-center text-sm text-vertex-muted">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium hover:underline"
            style={{ color: "#6366f1" }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
