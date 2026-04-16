import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy Policy | Vertex",
  description: "How Vertex collects, uses, and protects your personal information.",
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

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-white">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-transparent pb-20 pt-24">
      <div className="mx-auto max-w-[800px] px-6">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-white">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate-400">Last updated: April 2026</p>
        </header>

        <Section title="Introduction">
          <p>
            At Vertex, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your
            personal information when you use our platform.
          </p>
        </Section>

        <Section title="Information We Collect">
          <Sub title="Information you provide:">
            <ul className="list-disc space-y-1 pl-5">
              <li>Name and email address when registering</li>
              <li>CV content when uploaded for job matching</li>
              <li>Profile information you choose to add</li>
              <li>Messages sent through our platform</li>
            </ul>
          </Sub>
          <Sub title="Information collected automatically:">
            <ul className="list-disc space-y-1 pl-5">
              <li>Usage data and page views</li>
              <li>Device and browser information</li>
              <li>IP address (for security purposes)</li>
            </ul>
          </Sub>
        </Section>

        <Section title="How We Use Your Information">
          <ul className="list-disc space-y-1 pl-5">
            <li>To match you with relevant job opportunities</li>
            <li>To allow companies to find your profile</li>
            <li>To send job alerts you have requested</li>
            <li>To improve our matching algorithms</li>
            <li>To communicate platform updates</li>
          </ul>
        </Section>

        <Section title="Who Can See Your Information">
          <ul className="list-disc space-y-1 pl-5">
            <li>Your profile is visible to companies only when you set it to public</li>
            <li>Your email is never shared until you accept a contact request</li>
            <li>We never sell your personal data</li>
            <li>CV text is processed for skill extraction and stored securely</li>
          </ul>
        </Section>

        <Section title="Data Security">
          <ul className="list-disc space-y-1 pl-5">
            <li>Passwords are encrypted using bcrypt</li>
            <li>All data transmitted over HTTPS</li>
            <li>JWT tokens expire after 24 hours</li>
            <li>We follow industry security standards</li>
          </ul>
        </Section>

        <Section title="Your Rights">
          <ul className="list-disc space-y-1 pl-5">
            <li>Access your data at any time</li>
            <li>Request deletion of your account</li>
            <li>Download your data</li>
            <li>Opt out of job alerts anytime</li>
            <li>Set your profile to private</li>
          </ul>
        </Section>

        <Section title="Cookies">
          <ul className="list-disc space-y-1 pl-5">
            <li>We use minimal cookies for authentication</li>
            <li>No advertising cookies</li>
            <li>No third-party tracking</li>
          </ul>
        </Section>

        <Section title="Contact">
          <p>
            For privacy questions contact us at:{" "}
            <a href="mailto:privacy@vertex.com" className="text-indigo-300 hover:text-indigo-200">
              privacy@vertex.com
            </a>
            {/* TODO: update with real email */}
          </p>
        </Section>

        <Section title="Changes">
          <p>We may update this policy occasionally. We will notify you of significant changes via email.</p>
        </Section>
      </div>
    </div>
  );
}
