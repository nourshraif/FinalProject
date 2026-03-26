"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { createCheckoutSession } from "@/lib/api";

type BillingCycle = "monthly" | "annually";
type PlanType = "jobseekers" | "companies";

const FAQ_ITEMS = [
  {
    q: "Is the free plan really free forever?",
    a: "Yes. No credit card required. The free plan never expires and includes core features to get you started.",
  },
  {
    q: "Can I upgrade or downgrade anytime?",
    a: "Absolutely. You can change your plan at any time. Upgrades take effect immediately. Downgrades take effect at the next billing cycle.",
  },
  {
    q: "How does the job matching work?",
    a: "Upload your CV and our system reads it properly — not just keywords. It understands your experience and finds roles that genuinely fit your background.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards, PayPal, and bank transfers for annual plans. // TODO: integrate payment processor",
  },
  {
    q: "Is my data secure?",
    a: "Yes. Your CV and profile data is encrypted and never shared without your permission. Companies only see your profile if you're visible in the talent pool.",
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { isLoggedIn, token } = useAuth();
  const { showToast } = useToast();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [planType, setPlanType] = useState<PlanType>("jobseekers");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<"pro" | "business" | null>(null);

  async function handleProUpgrade() {
    if (!isLoggedIn) {
      router.push("/auth/register?plan=pro");
      return;
    }
    if (!token) return;
    setIsLoading("pro");
    try {
      const url = await createCheckoutSession(token, "pro", billingCycle);
      window.location.href = url;
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to start checkout", "error");
    } finally {
      setIsLoading(null);
    }
  }

  async function handleBusinessUpgrade() {
    if (!isLoggedIn) {
      router.push("/auth/register?plan=business");
      return;
    }
    if (!token) return;
    setIsLoading("business");
    try {
      const url = await createCheckoutSession(token, "business", billingCycle);
      window.location.href = url;
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to start checkout", "error");
    } finally {
      setIsLoading(null);
    }
  }

  const proMonthly = 12;
  const proAnnual = 10;
  const businessMonthly = 49;
  const businessAnnual = 39;

  const proPrice = billingCycle === "monthly" ? proMonthly : proAnnual;
  const businessPrice = billingCycle === "monthly" ? businessMonthly : businessAnnual;

  const freeFeaturesJobSeekers = [
    { text: "Upload 1 CV", included: true },
    { text: "See top 10 job matches", included: true },
    { text: "Basic profile page", included: true },
    { text: "Application tracker", included: true },
    { text: "Job alerts", included: false },
    { text: "Priority matching", included: false },
    { text: "Profile boost", included: false },
  ];

  const freeFeaturesCompanies = [
    { text: "Search up to 10 candidates/month", included: true },
    { text: "Basic candidate profiles", included: true },
    { text: "3 contact requests/month", included: true },
    { text: "Saved candidates list", included: false },
    { text: "Search history", included: false },
    { text: "Analytics", included: false },
  ];

  const proFeaturesJobSeekers = [
    "Unlimited CV uploads",
    "See all job matches (unlimited)",
    "Advanced profile page",
    "Application tracker",
    "Daily job alerts by email",
    "Priority matching algorithm",
    "Profile boost in searches",
    "Download match reports",
  ];

  const growthFeaturesCompanies = [
    "100 candidate searches/month",
    "Full candidate profiles",
    "20 contact requests/month",
    "Saved candidates list",
    "Search history",
    { text: "Team access", included: false },
    { text: "API access", included: false },
  ];

  const businessFeaturesCompanies = [
    "Unlimited candidate searches",
    "Full candidate profiles",
    "Contact request system",
    "Save unlimited candidates",
    "Search history & analytics",
    "Team collaboration", // TODO
    "Priority support",
    "Custom skill filters",
    { text: "API access", included: false },
    { text: "White label", included: false },
  ];

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-[1100px] px-6">
        {/* SECTION 1 — PAGE HEADER */}
        <section className="text-center">
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ background: "#6366f1" }}
          >
            Simple, transparent pricing
          </span>
          <h1 className="mt-4 text-4xl font-bold">
            <span className="text-white">Invest in your </span>
            <span className="gradient-text">next opportunity</span>
          </h1>
          <p
            className="mx-auto mt-3 max-w-[500px] text-center text-base"
            style={{ color: "#94a3b8" }}
          >
            Start free. Upgrade when you need more. No hidden fees. No surprises.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
              style={
                billingCycle === "monthly"
                  ? { background: "#6366f1", color: "white" }
                  : { color: "#94a3b8" }
              }
            >
              Monthly
            </button>
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBillingCycle("annually")}
                className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
                style={
                  billingCycle === "annually"
                    ? { background: "#6366f1", color: "white" }
                    : { color: "#94a3b8" }
              }
              >
                Annually
              </button>
              {billingCycle === "annually" && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold"
                  style={{ background: "rgba(34,197,94,0.3)", color: "#22c55e" }}
                >
                  Save 20%
                </span>
              )}
            </span>
          </div>
        </section>

        {/* PLAN TYPE TOGGLE */}
        <div className="mt-10 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => setPlanType("jobseekers")}
            className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
            style={
              planType === "jobseekers"
                ? { background: "#6366f1", color: "white" }
                : { color: "#94a3b8" }
            }
          >
            For Job Seekers
          </button>
          <button
            type="button"
            onClick={() => setPlanType("companies")}
            className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
            style={
              planType === "companies"
                ? { background: "#6366f1", color: "white" }
                : { color: "#94a3b8" }
            }
          >
            For Companies
          </button>
        </div>

        {/* SECTION 2 — PRICING CARDS */}
        <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* CARD 1 — Free */}
          <div className="glass-card rounded-2xl p-8">
            <h3 className="text-xl font-bold text-white">Free</h3>
            <p className="mt-1 text-sm" style={{ color: "#94a3b8" }}>
              Perfect for getting started
            </p>
            <div className="my-6">
              <span className="text-5xl font-bold text-white">$0</span>
              <span className="ml-1 text-base" style={{ color: "#94a3b8" }}>
                /month
              </span>
              <p className="mt-1 text-xs" style={{ color: "#64748b" }}>
                Forever free
              </p>
            </div>
            <div className="h-px" style={{ background: "#2a2a3d" }} />
            <ul className="mt-6 space-y-3">
              {(planType === "jobseekers"
                ? freeFeaturesJobSeekers
                : freeFeaturesCompanies
              ).map((f, i) => {
                const included = typeof f === "object" ? f.included : (f as { included: boolean }).included;
                const text = typeof f === "object" ? (f as { text: string }).text : String(f);
                return (
                  <li key={i} className="flex items-center gap-2">
                    {included ? (
                      <Check className="h-5 w-5 shrink-0" style={{ color: "#22c55e" }} />
                    ) : (
                      <X className="h-5 w-5 shrink-0" style={{ color: "#ef4444" }} />
                    )}
                    <span
                      className="text-sm"
                      style={included ? { color: "#e2e8f0" } : { color: "#64748b" }}
                    >
                      {text}
                    </span>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => router.push("/auth/register")}
              className="ghost-button mt-8 w-full rounded-lg py-2.5 text-sm font-medium text-white"
            >
              Get Started Free
            </button>
          </div>

          {/* CARD 2 — Pro / Growth */}
          <div
            className="glass-card relative rounded-2xl p-8"
            style={{
              border: "1px solid rgba(99,102,241,0.5)",
              boxShadow: "0 0 40px rgba(124,58,237,0.15)",
            }}
          >
            <div
              className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-3 rounded-full px-4 py-1 text-xs font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              }}
            >
              Most Popular
            </div>
            <h3 className="gradient-text text-xl font-bold">
              {planType === "jobseekers" ? "Pro" : "Growth"}
            </h3>
            <p className="mt-1 text-sm" style={{ color: "#94a3b8" }}>
              {planType === "jobseekers"
                ? "For serious job seekers"
                : "For growing teams"}
            </p>
            <div className="my-6">
              {billingCycle === "annually" && planType === "jobseekers" && (
                <span className="text-base font-medium line-through" style={{ color: "#64748b" }}>
                  $12
                </span>
              )}
              <span className="text-5xl font-bold text-white">
                ${planType === "jobseekers" ? proPrice : "29"}
              </span>
              <span className="ml-1 text-base" style={{ color: "#94a3b8" }}>
                /month
              </span>
              {billingCycle === "annually" && planType === "jobseekers" && (
                <p className="mt-1 text-xs" style={{ color: "#64748b" }}>
                  Billed $120/year
                </p>
              )}
            </div>
            <div className="h-px" style={{ background: "#2a2a3d" }} />
            <ul className="mt-6 space-y-3">
              {(planType === "jobseekers"
                ? proFeaturesJobSeekers
                : growthFeaturesCompanies
              ).map((f, i) => {
                if (typeof f === "object" && "included" in f) {
                  const item = f as { text: string; included: boolean };
                  return (
                    <li key={i} className="flex items-center gap-2">
                      {item.included ? (
                        <Check className="h-5 w-5 shrink-0" style={{ color: "#22c55e" }} />
                      ) : (
                        <X className="h-5 w-5 shrink-0" style={{ color: "#ef4444" }} />
                      )}
                      <span
                        className="text-sm"
                        style={item.included ? { color: "#e2e8f0" } : { color: "#64748b" }}
                      >
                        {item.text}
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-5 w-5 shrink-0" style={{ color: "#22c55e" }} />
                    <span className="text-sm text-white">{String(f)}</span>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={handleProUpgrade}
              disabled={!!isLoading}
              className="glow-button mt-8 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-70"
            >
              {isLoading === "pro" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Start {planType === "jobseekers" ? "Pro" : "Growth"} — $
              {planType === "jobseekers" ? proPrice : "29"}
              /mo
            </button>
          </div>

          {/* CARD 3 — Business */}
          <div
            className="glass-card rounded-2xl p-8"
            style={{ border: "1px solid rgba(6,182,212,0.2)" }}
          >
            <h3 className="text-xl font-bold text-white">Business</h3>
            <p className="mt-1 text-sm" style={{ color: "#94a3b8" }}>
              For hiring teams
            </p>
            <div className="my-6">
              <span className="text-5xl font-bold text-white">${businessPrice}</span>
              <span className="ml-1 text-base" style={{ color: "#94a3b8" }}>
                /month
              </span>
              {billingCycle === "annually" && (
                <p className="mt-1 text-xs" style={{ color: "#64748b" }}>
                  Billed ${businessAnnual * 12}/year
                </p>
              )}
            </div>
            <div className="h-px" style={{ background: "#2a2a3d" }} />
            <ul className="mt-6 space-y-3">
              {businessFeaturesCompanies.map((f, i) => {
                if (typeof f === "object" && "included" in f) {
                  const item = f as { text: string; included: boolean };
                  return (
                    <li key={i} className="flex items-center gap-2">
                      {item.included ? (
                        <Check className="h-5 w-5 shrink-0" style={{ color: "#22c55e" }} />
                      ) : (
                        <X className="h-5 w-5 shrink-0" style={{ color: "#ef4444" }} />
                      )}
                      <span
                        className="text-sm"
                        style={item.included ? { color: "#e2e8f0" } : { color: "#64748b" }}
                      >
                        {item.text}
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-5 w-5 shrink-0" style={{ color: "#22c55e" }} />
                    <span className="text-sm text-white">{String(f)}</span>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={handleBusinessUpgrade}
              disabled={!!isLoading}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-70"
              style={{
                border: "1px solid rgba(6,182,212,0.4)",
                color: "#06b6d4",
                background: "transparent",
              }}
            >
              {isLoading === "business" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Start Business
            </button>
          </div>
        </section>

        {/* SECTION 3 — FEATURE COMPARISON TABLE */}
        <section className="mt-20">
          <h2 className="mb-8 text-center text-2xl font-bold text-white">
            Compare all features
          </h2>
          <div className="glass-card overflow-x-auto rounded-xl">
            <table className="w-full min-w-[600px] border-collapse text-left">
              <thead>
                <tr style={{ background: "#13131f" }}>
                  <th className="p-3 text-sm font-medium" style={{ color: "#94a3b8" }}>
                    Feature
                  </th>
                  <th className="p-3 text-center text-sm font-bold text-white">Free</th>
                  <th className="p-3 text-center text-sm font-bold" style={{ color: "#6366f1" }}>
                    Pro
                  </th>
                  <th className="p-3 text-center text-sm font-bold text-white">Business</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>CV Uploads</td>
                  <td className="p-3 text-center text-white">1</td>
                  <td className="p-3 text-center text-white">Unlimited</td>
                  <td className="p-3 text-center text-white">Unlimited</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>Job Matches Shown</td>
                  <td className="p-3 text-center text-white">Top 10</td>
                  <td className="p-3 text-center text-white">Unlimited</td>
                  <td className="p-3 text-center text-white">Unlimited</td>
                </tr>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>Match Algorithm</td>
                  <td className="p-3 text-center text-white">Basic</td>
                  <td className="p-3 text-center text-white">Priority</td>
                  <td className="p-3 text-center text-white">Priority</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>Job Alerts</td>
                  <td className="p-3 text-center">
                    <X className="inline h-4 w-4" style={{ color: "#ef4444" }} />
                  </td>
                  <td className="p-3 text-center">
                    <Check className="inline h-4 w-4" style={{ color: "#22c55e" }} />
                  </td>
                  <td className="p-3 text-center">
                    <Check className="inline h-4 w-4" style={{ color: "#22c55e" }} />
                  </td>
                </tr>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>Profile Page</td>
                  <td className="p-3 text-center text-white">Basic</td>
                  <td className="p-3 text-center text-white">Advanced</td>
                  <td className="p-3 text-center text-white">Advanced</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>Profile Boost</td>
                  <td className="p-3 text-center">
                    <X className="inline h-4 w-4" style={{ color: "#ef4444" }} />
                  </td>
                  <td className="p-3 text-center">
                    <Check className="inline h-4 w-4" style={{ color: "#22c55e" }} />
                  </td>
                  <td className="p-3 text-center">
                    <Check className="inline h-4 w-4" style={{ color: "#22c55e" }} />
                  </td>
                </tr>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>Skills Management</td>
                  <td className="p-3 text-center">
                    <Check className="inline h-4 w-4" style={{ color: "#22c55e" }} />
                  </td>
                  <td className="p-3 text-center">
                    <Check className="inline h-4 w-4" style={{ color: "#22c55e" }} />
                  </td>
                  <td className="p-3 text-center">
                    <Check className="inline h-4 w-4" style={{ color: "#22c55e" }} />
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>Application Tracker</td>
                  <td className="p-3 text-center">
                    <Check className="inline h-4 w-4" style={{ color: "#22c55e" }} />
                  </td>
                  <td className="p-3 text-center">
                    <Check className="inline h-4 w-4" style={{ color: "#22c55e" }} />
                  </td>
                  <td className="p-3 text-center">
                    <Check className="inline h-4 w-4" style={{ color: "#22c55e" }} />
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>Saved Jobs</td>
                  <td className="p-3 text-center text-white">10</td>
                  <td className="p-3 text-center text-white">Unlimited</td>
                  <td className="p-3 text-center text-white">Unlimited</td>
                </tr>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>Match Reports</td>
                  <td className="p-3 text-center">
                    <X className="inline h-4 w-4" style={{ color: "#ef4444" }} />
                  </td>
                  <td className="p-3 text-center">
                    <Check className="inline h-4 w-4" style={{ color: "#22c55e" }} />
                  </td>
                  <td className="p-3 text-center">
                    <Check className="inline h-4 w-4" style={{ color: "#22c55e" }} />
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>Candidate Searches</td>
                  <td className="p-3 text-center text-white">10/mo</td>
                  <td className="p-3 text-center text-white">—</td>
                  <td className="p-3 text-center text-white">Unlimited</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>Contact Requests</td>
                  <td className="p-3 text-center text-white">3/mo</td>
                  <td className="p-3 text-center text-white">—</td>
                  <td className="p-3 text-center text-white">Unlimited</td>
                </tr>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>Search History</td>
                  <td className="p-3 text-center">
                    <X className="inline h-4 w-4" style={{ color: "#ef4444" }} />
                  </td>
                  <td className="p-3 text-center text-white">—</td>
                  <td className="p-3 text-center">
                    <Check className="inline h-4 w-4" style={{ color: "#22c55e" }} />
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>Team Members</td>
                  <td className="p-3 text-center text-white">1</td>
                  <td className="p-3 text-center text-white">—</td>
                  <td className="p-3 text-center text-white">5</td>
                </tr>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>Support</td>
                  <td className="p-3 text-center text-white">Community</td>
                  <td className="p-3 text-center text-white">Email</td>
                  <td className="p-3 text-center text-white">Priority</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium" style={{ color: "#94a3b8" }}>Response Time</td>
                  <td className="p-3 text-center text-white">—</td>
                  <td className="p-3 text-center text-white">48hrs</td>
                  <td className="p-3 text-center text-white">24hrs</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 4 — FAQ */}
        <section className="mt-20">
          <h2 className="mb-8 text-center text-2xl font-bold text-white">
            Frequently asked questions
          </h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((faq, i) => (
              <div
                key={i}
                className="glass-card cursor-pointer rounded-xl p-5 transition-colors"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <p className="font-medium text-white">{faq.q}</p>
                <div
                  className="overflow-hidden transition-all duration-200"
                  style={{
                    maxHeight: openFaq === i ? 200 : 0,
                    opacity: openFaq === i ? 1 : 0,
                  }}
                >
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 5 — CTA BANNER */}
        <section className="mt-20">
          <div
            className="glass-card rounded-2xl py-16 px-6 text-center md:py-20 md:px-12"
            style={{
              border: "1px solid rgba(99,102,241,0.3)",
              background: "rgba(99,102,241,0.05)",
              boxShadow: "0 0 60px rgba(124,58,237,0.1)",
            }}
          >
            <h2 className="mb-4 text-3xl font-bold text-white">Ready to get started?</h2>
            <p className="mb-8 text-base" style={{ color: "#94a3b8" }}>
              Join thousands of professionals on Vertex
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => router.push("/auth/register")}
                className="glow-button rounded-lg px-6 py-3 text-sm font-medium text-white"
              >
                Start Free
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="ghost-button rounded-lg px-6 py-3 text-sm font-medium text-white"
              >
                View Demo
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
