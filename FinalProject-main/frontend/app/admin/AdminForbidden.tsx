"use client";

import Link from "next/link";

export function AdminForbidden() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
      <div className="glass-card flex max-w-md flex-col items-center rounded-2xl p-10 text-center">
        <span className="mb-4 text-6xl" aria-hidden>
          🔒
        </span>
        <h1 className="mb-2 text-2xl font-bold text-white">Access Denied</h1>
        <p className="mb-6 text-sm text-vertex-muted">
          You need admin privileges to view this page.
        </p>
        <Link href="/" className="glow-button rounded-lg px-6 py-2.5 text-sm font-medium text-white">
          Go Home
        </Link>
      </div>
    </div>
  );
}
