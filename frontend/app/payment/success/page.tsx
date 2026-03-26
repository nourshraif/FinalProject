"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = (searchParams.get("plan") || "pro").toLowerCase();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          router.push("/dashboard");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [router]);

  const subtext =
    plan === "business"
      ? "You now have unlimited candidate searches and contact requests."
      : "You now have access to unlimited matches, daily job alerts, and priority matching.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-16">
      <div
        className="mb-6 flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-4xl text-white"
        className="animate-scale-in"
        style={{
          background: "linear-gradient(135deg, #22c55e, #16a34a)",
          boxShadow: "0 0 40px rgba(34,197,94,0.4)",
        }}
      >
        ✓
      </div>
      <h1 className="text-center text-3xl font-bold text-white">
        Payment Successful!
      </h1>
      <p className="gradient-text mt-2 text-center text-xl font-medium">
        Welcome to Vertex {plan === "business" ? "Business" : "Pro"}!
      </p>
      <p className="mt-3 max-w-md text-center text-sm" style={{ color: "#94a3b8" }}>
        {subtext}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/dashboard"
          className="glow-button rounded-lg px-6 py-2.5 text-center text-sm font-medium text-white"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/settings/billing"
          className="ghost-button rounded-lg px-6 py-2.5 text-center text-sm font-medium text-white"
        >
          View Billing
        </Link>
      </div>
      <p className="mt-6 text-sm" style={{ color: "#64748b" }}>
        Redirecting in {countdown} seconds...
      </p>
    </div>
  );
}
