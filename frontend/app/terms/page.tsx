import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Terms of Service | Vertex",
  description: "Terms governing your use of the Vertex job matching platform.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="glass-card mb-4 rounded-2xl border border-white/[0.06] p-8">
      <h2 className="border-b border-[#2a2a3d] pb-3 text-lg font-bold text-white">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-400">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-transparent pb-20 pt-24">
      <div className="mx-auto max-w-[800px] px-6">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-white">Terms of Service</h1>
          <p className="mt-2 text-sm text-slate-400">Last updated: April 2026</p>
        </header>

        <Section title="Acceptance">
          <p>
            By using Vertex you agree to these terms. If you do not agree, please do not use our platform.
          </p>
        </Section>

        <Section title="Description of Service">
          <p>
            Vertex is an AI-powered job matching platform that connects job seekers with companies. We provide job
            matching, candidate search, and career tools.
          </p>
        </Section>

        <Section title="User Accounts">
          <ul className="list-disc space-y-1 pl-5">
            <li>You must provide accurate information</li>
            <li>You are responsible for your account security</li>
            <li>One account per person</li>
            <li>You must be 18 or older to use Vertex</li>
            <li>We reserve the right to suspend accounts that violate these terms</li>
          </ul>
        </Section>

        <Section title="Job Seeker Rules">
          <ul className="list-disc space-y-1 pl-5">
            <li>Upload only your own CV</li>
            <li>Provide accurate profile information</li>
            <li>Do not spam companies with applications</li>
            <li>Free plan limited to 5 saved jobs</li>
            <li>Pro plan required for full access</li>
          </ul>
        </Section>

        <Section title="Company Rules">
          <ul className="list-disc space-y-1 pl-5">
            <li>Post only legitimate job opportunities</li>
            <li>No misleading job descriptions</li>
            <li>Free plan limited to 1 active job posting</li>
            <li>3 contact requests per month on free plan</li>
            <li>Contact candidates respectfully</li>
          </ul>
        </Section>

        <Section title="Prohibited Activities">
          <ul className="list-disc space-y-1 pl-5">
            <li>Creating fake profiles or accounts</li>
            <li>Scraping or copying platform data</li>
            <li>Harassing other users</li>
            <li>Posting illegal or discriminatory content</li>
            <li>Attempting to bypass subscription limits</li>
          </ul>
        </Section>

        <Section title="Intellectual Property">
          <p>
            Vertex and its features are owned by Vertex Technologies. You may not copy, modify, or distribute our
            platform.
          </p>
        </Section>

        <Section title="Disclaimers">
          <p>
            We do not guarantee employment outcomes. Job listings are provided by third parties. We are not responsible
            for hiring decisions.
          </p>
        </Section>

        <Section title="Limitation of Liability">
          <p>Vertex is not liable for any indirect damages arising from use of our platform.</p>
        </Section>

        <Section title="Termination">
          <p>We may terminate accounts that violate these terms. You may delete your account at any time from settings.</p>
        </Section>

        <Section title="Governing Law">
          <p>These terms are governed by the laws of Lebanon.</p>
        </Section>

        <Section title="Contact">
          <p>
            For questions about these terms:{" "}
            <a href="mailto:legal@vertex.com" className="text-indigo-300 hover:text-indigo-200">
              legal@vertex.com
            </a>
            {/* TODO: update with real email */}
          </p>
        </Section>
      </div>
    </div>
  );
}
