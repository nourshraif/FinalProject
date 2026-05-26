import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <p className="gradient-text text-8xl font-bold">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-vertex-white">Page not found</h1>
      <p className="mt-2 text-vertex-muted">
        The page you&apos;re looking for doesn&apos;t exist
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/"
          className="glow-button inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium text-white"
          style={{ background: "#6366f1" }}
        >
          Go Home
        </Link>
        <Link
          href="/auth/login"
          className="ghost-button inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}
