"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";

const nav = [
  { href: "/", label: "Home" },
  { href: "/match", label: "Features" },
  { href: "/company", label: "For Companies" },
  { href: "/#about", label: "About" },
];

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return fullName.slice(0, 2).toUpperCase() || "?";
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoggedIn, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  function handleSignOut() {
    logout();
    router.push("/");
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-vertex-border/50 transition-[background] duration-300"
      style={{
        background: scrolled ? "rgba(10, 10, 15, 0.95)" : "rgba(10, 10, 15, 0.6)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="container flex h-14 items-center justify-between">
        <Logo size="sm" href="/" className="mr-4" />

        <nav className="flex flex-1 items-center justify-center gap-0">
          {isLoggedIn && user?.user_type === "jobseeker" && (
            <>
              <Link
                href="/dashboard/jobseeker"
                className={cn(
                  "relative px-2 py-1 text-sm font-medium transition-colors duration-200",
                  pathname === "/dashboard/jobseeker"
                    ? "text-vertex-purple nav-link-active"
                    : "text-vertex-white hover:text-vertex-purple"
                )}
              >
                Dashboard
              </Link>
              <span className="mx-2 text-vertex-muted select-none">|</span>
              <Link
                href="/tracker"
                className={cn(
                  "relative px-2 py-1 text-sm font-medium transition-colors duration-200",
                  pathname.startsWith("/tracker")
                    ? "text-vertex-purple nav-link-active"
                    : "text-vertex-white hover:text-vertex-purple"
                )}
              >
                Tracker
              </Link>
              <span className="mx-2 text-vertex-muted select-none">|</span>
              <Link
                href="/saved"
                className={cn(
                  "relative px-2 py-1 text-sm font-medium transition-colors duration-200",
                  pathname.startsWith("/saved")
                    ? "text-vertex-purple nav-link-active"
                    : "text-vertex-white hover:text-vertex-purple"
                )}
              >
                Saved
              </Link>
              <span className="mx-2 text-vertex-muted select-none">|</span>
              <Link
                href="/match"
                className={cn(
                  "relative px-2 py-1 text-sm font-medium transition-colors duration-200",
                  pathname.startsWith("/match")
                    ? "text-vertex-purple nav-link-active"
                    : "text-vertex-white hover:text-vertex-purple"
                )}
              >
                Find Jobs
              </Link>
              <span className="mx-2 text-vertex-muted select-none">|</span>
            </>
          )}
          {isLoggedIn && user?.user_type === "company" && (
            <>
              <Link
                href="/dashboard/company"
                className={cn(
                  "relative px-2 py-1 text-sm font-medium transition-colors duration-200",
                  pathname === "/dashboard/company"
                    ? "text-vertex-purple nav-link-active"
                    : "text-vertex-white hover:text-vertex-purple"
                )}
              >
                Dashboard
              </Link>
              <span className="mx-2 text-vertex-muted select-none">|</span>
              <Link
                href="/company/search"
                className={cn(
                  "relative px-2 py-1 text-sm font-medium transition-colors duration-200",
                  pathname.startsWith("/company/search")
                    ? "text-vertex-purple nav-link-active"
                    : "text-vertex-white hover:text-vertex-purple"
                )}
              >
                Search
              </Link>
              <span className="mx-2 text-vertex-muted select-none">|</span>
              <Link
                href="/company/saved"
                className={cn(
                  "relative px-2 py-1 text-sm font-medium transition-colors duration-200",
                  pathname.startsWith("/company/saved")
                    ? "text-vertex-purple nav-link-active"
                    : "text-vertex-white hover:text-vertex-purple"
                )}
              >
                Saved
              </Link>
              <span className="mx-2 text-vertex-muted select-none">|</span>
              <Link
                href="/company/admin"
                className={cn(
                  "relative px-2 py-1 text-sm font-medium transition-colors duration-200",
                  pathname.startsWith("/company/admin")
                    ? "text-vertex-purple nav-link-active"
                    : "text-vertex-white hover:text-vertex-purple"
                )}
              >
                Talent Pool
              </Link>
              <span className="mx-2 text-vertex-muted select-none">|</span>
              <Link
                href="/company/profile"
                className={cn(
                  "relative px-2 py-1 text-sm font-medium transition-colors duration-200",
                  pathname.startsWith("/company/profile")
                    ? "text-vertex-purple nav-link-active"
                    : "text-vertex-white hover:text-vertex-purple"
                )}
              >
                Profile
              </Link>
              <span className="mx-2 text-vertex-muted select-none">|</span>
            </>
          )}
          {nav.map((item, i) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : item.href === "/company"
                  ? pathname.startsWith("/company")
                  : pathname.startsWith(item.href);
            return (
              <span key={item.href} className="flex items-center gap-0">
                {i > 0 && (
                  <span className="mx-2 text-vertex-muted select-none">|</span>
                )}
                <Link
                  href={item.href}
                  className={cn(
                    "relative px-2 py-1 text-sm font-medium transition-colors duration-200",
                    isActive
                      ? "text-vertex-purple nav-link-active"
                      : "text-vertex-white hover:text-vertex-purple"
                  )}
                >
                  {item.label}
                </Link>
              </span>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {isLoggedIn && user ? (
            <>
              <div className="flex items-center gap-2">
                <div
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ background: "#6366f1" }}
                  aria-hidden
                >
                  {getInitials(user.full_name)}
                </div>
                <span className="hidden text-sm text-vertex-white sm:inline">
                  {user.full_name}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="ghost-button rounded-lg px-3 py-1.5 text-sm text-vertex-muted transition-colors hover:text-vertex-white"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="ghost-button rounded-lg px-3 py-1.5 text-sm text-vertex-muted transition-colors hover:text-vertex-white"
              >
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-vertex-muted/20"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
