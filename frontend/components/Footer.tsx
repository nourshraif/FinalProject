import Link from "next/link";
import { Logo } from "@/components/Logo";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/jobs", label: "Opportunities" },
  { href: "/match", label: "Match" },
  { href: "/pricing", label: "Pricing" },
];

export function Footer() {
  return (
    <footer className="relative z-10 w-full border-t border-indigo-500/10 bg-[#131b2e] py-14">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-80"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(192,193,255,0.25) 45%, transparent)",
        }}
        aria-hidden
      />
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-8 md:flex-row">
        <div className="flex flex-col items-center gap-2 md:items-start">
          <Logo size="sm" href="/" />
          <p className="font-body text-sm text-slate-400">© {new Date().getFullYear()} Vertex Celestial Systems</p>
        </div>
        <div className="flex flex-wrap justify-center gap-8">
          {footerLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-body text-sm text-slate-500 transition-colors hover:text-indigo-200"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
