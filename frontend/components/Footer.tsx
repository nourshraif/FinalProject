import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="border-t border-vertex-border bg-vertex-navy/80">
      <div className="container flex flex-col items-center justify-between gap-4 py-6 md:flex-row">
        <Logo size="sm" href="/" />
        <div className="flex gap-6 text-sm text-vertex-muted">
          <Link href="/" className="hover:text-vertex-white transition-colors">
            Home
          </Link>
          <Link href="/dashboard" className="hover:text-vertex-white transition-colors">
            Dashboard
          </Link>
          <Link href="/match" className="hover:text-vertex-white transition-colors">
            Match
          </Link>
          <Link href="/saved" className="hover:text-vertex-white transition-colors">
            Saved
          </Link>
        </div>
      </div>
    </footer>
  );
}
