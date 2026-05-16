"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";

/** High-intent pages only — discovery lives in the header & hero. */
const footerPrimary = [
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact us" },
  { href: "/about", label: "About" },
];

const footerLegal = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function Footer() {
  return (
    <footer className="relative z-10 w-full border-t border-indigo-500/10 bg-[#152238] py-14">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-80"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(192,193,255,0.25) 45%, transparent)",
        }}
        aria-hidden
      />
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-8 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col items-center gap-3 md:items-start">
          <Logo size="sm" href="/" />
          <p className="font-body text-sm text-slate-400">
            © {new Date().getFullYear()} Vertex
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 md:justify-start">
            {footerLegal.map((l, i) => (
              <span key={l.href} className="flex items-center gap-3">
                {i > 0 && <span className="text-slate-600" aria-hidden>·</span>}
                <Link
                  href={l.href}
                  className="font-body text-xs text-slate-500 transition-colors hover:text-slate-400"
                >
                  {l.label}
                </Link>
              </span>
            ))}
          </div>
        </div>

        <nav
          className="flex flex-wrap justify-center gap-6 sm:gap-8"
          aria-label="Footer"
        >
          {footerPrimary.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-body text-sm font-medium text-slate-400 transition-colors hover:text-indigo-200"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
