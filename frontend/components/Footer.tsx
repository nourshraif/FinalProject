"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { publicNav } from "@/lib/public-nav";
import { cn } from "@/lib/utils";

function isLinkActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function Footer() {
  const pathname = usePathname();
  const { user, isLoggedIn } = useAuth();
  const isAdminRoute = pathname.startsWith("/admin");
  const hideNavLinks = isAdminRoute || (isLoggedIn && Boolean(user?.is_admin));
  const footerNav = hideNavLinks ? [] : publicNav;

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
      <div
        className={cn(
          "mx-auto flex max-w-7xl flex-col items-center gap-8 px-8",
          footerNav.length > 0 ? "justify-between md:flex-row" : "justify-center"
        )}
      >
        <div className="flex flex-col items-center gap-2 md:items-start">
          <Logo size="sm" href={hideNavLinks ? "/admin" : "/"} />
          <p className="font-body text-sm text-slate-400">
            © {new Date().getFullYear()} Vertex
          </p>
        </div>
        {footerNav.length > 0 && (
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-3 sm:gap-x-8">
            {footerNav.map((item) => {
              const active = isLinkActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "font-body text-sm font-medium transition-colors",
                    active
                      ? "border-b-2 border-white pb-0.5 text-white"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </footer>
  );
}
