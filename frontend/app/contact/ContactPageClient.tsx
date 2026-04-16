"use client";

import Link from "next/link";
import { Mail, MessageSquare, Building2, Clock3 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

type ContactFormState = {
  fullName: string;
  email: string;
  company: string;
  subject: string;
  message: string;
};

const initialForm: ContactFormState = {
  fullName: "",
  email: "",
  company: "",
  subject: "",
  message: "",
};

const SUPPORT_EMAIL = "support@vertex.com";

export default function ContactPageClient() {
  const [form, setForm] = useState<ContactFormState>(initialForm);

  const subjectLine = useMemo(() => {
    const base = form.subject.trim() || "Support request";
    return `[Vertex Support] ${base}`;
  }, [form.subject]);

  function setField<K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.fullName.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const body = [
      `Name: ${form.fullName.trim()}`,
      `Email: ${form.email.trim()}`,
      `Company: ${form.company.trim() || "N/A"}`,
      "",
      "Message:",
      form.message.trim(),
    ].join("\n");

    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    toast.success("Opening your email app to contact support.");
  }

  return (
    <div className="aurora-bg min-h-screen bg-transparent pb-20 pt-24">
      <div className="mx-auto max-w-6xl px-6">
        <header className="mb-10 text-center">
          <span className="inline-flex rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-1 text-xs font-semibold text-indigo-200">
            Contact
          </span>
          <h1 className="mt-5 text-4xl font-bold text-white">Contact Us</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300">
            Questions about Vertex, subscriptions, partnerships, or support? Send us a message and our team will get back
            to you.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="glass-card rounded-2xl border border-white/[0.06] p-6 lg:col-span-2">
            <h2 className="text-xl font-bold text-white">Send us a message</h2>
            <p className="mt-2 text-sm text-slate-400">Fields marked with * are required.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-300">Full name *</span>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setField("fullName", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#0d1628] px-3 py-2.5 text-sm text-white outline-none transition focus:border-indigo-400/60"
                    placeholder="Your full name"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-300">Email *</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#0d1628] px-3 py-2.5 text-sm text-white outline-none transition focus:border-indigo-400/60"
                    placeholder="you@example.com"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-slate-300">Company (optional)</span>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setField("company", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#0d1628] px-3 py-2.5 text-sm text-white outline-none transition focus:border-indigo-400/60"
                  placeholder="Your company"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-300">Subject *</span>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setField("subject", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#0d1628] px-3 py-2.5 text-sm text-white outline-none transition focus:border-indigo-400/60"
                  placeholder="How can we help?"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-300">Message *</span>
                <textarea
                  value={form.message}
                  onChange={(e) => setField("message", e.target.value)}
                  className="mt-1 min-h-[150px] w-full rounded-xl border border-white/10 bg-[#0d1628] px-3 py-2.5 text-sm text-white outline-none transition focus:border-indigo-400/60"
                  placeholder="Tell us what you need..."
                />
              </label>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  className="glow-button rounded-full px-6 py-2.5 text-sm font-semibold text-white"
                >
                  Contact Support
                </button>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="ghost-button rounded-full px-6 py-2.5 text-sm font-semibold text-white">
                  Email Directly
                </a>
              </div>
            </form>
          </section>

          <aside className="space-y-4">
            <div className="glass-card rounded-2xl border border-white/[0.06] p-5">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-indigo-300" />
                <p className="text-sm font-semibold text-white">Email</p>
              </div>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-2 inline-block text-sm text-indigo-300 hover:text-indigo-200">
                {SUPPORT_EMAIL}
              </a>
            </div>

            <div className="glass-card rounded-2xl border border-white/[0.06] p-5">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-indigo-300" />
                <p className="text-sm font-semibold text-white">Response Time</p>
              </div>
              <p className="mt-2 text-sm text-slate-300">Usually within 24-48 business hours.</p>
            </div>

            <div className="glass-card rounded-2xl border border-white/[0.06] p-5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-300" />
                <p className="text-sm font-semibold text-white">Partnerships</p>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                For business partnerships, include partnership details in your subject.
              </p>
            </div>

            <div className="glass-card rounded-2xl border border-white/[0.06] p-5">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-300" />
                <p className="text-sm font-semibold text-white">Helpful Links</p>
              </div>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <Link href="/about" className="text-indigo-300 hover:text-indigo-200">
                  About Vertex
                </Link>
                <Link href="/pricing" className="text-indigo-300 hover:text-indigo-200">
                  Pricing
                </Link>
                <Link href="/privacy" className="text-indigo-300 hover:text-indigo-200">
                  Privacy Policy
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

