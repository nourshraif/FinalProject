"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { getReceivedRequests, getSubscription, getUnreadCount } from "@/lib/api";
import type { Subscription } from "@/types";
import { Menu, X, Shield } from "lucide-react";

function getInitials(fullName: string): string {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (fullName || "?").slice(0, 2).toUpperCase();
}

const publicNav = [
  { href: "/", label: "Home" },
  { href: "/match", label: "Features" },
  { href: "/jobs", label: "Jobs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/company", label: "For Companies" },
  { href: "/#about", label: "About" },
];

const jobseekerNav = [
  { href: "/dashboard/jobseeker", label: "Dashboard" },
  { href: "/tracker", label: "Tracker" },
  { href: "/search", label: "Search Jobs" },
  { href: "/jobs", label: "Jobs" },
  { href: "/saved", label: "Saved" },
  { href: "/requests", label: "Requests" },
  { href: "/analytics", label: "Analytics" },
  { href: "/pricing", label: "Pricing" },
  { href: "/settings/alerts", label: "Alerts" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/notifications", label: "Notifications" },
];

const companyNav = [
  { href: "/dashboard/company", label: "Dashboard" },
  { href: "/company/post-job", label: "Post Job" },
  { href: "/company/jobs", label: "My Jobs" },
  { href: "/company/search", label: "Find Talent" },
  { href: "/company/saved", label: "Saved" },
  { href: "/company/requests", label: "Requests" },
  { href: "/company/history", label: "History" },
  { href: "/analytics", label: "Analytics" },
  { href: "/company/profile", label: "Profile" },
  { href: "/pricing", label: "Pricing" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/notifications", label: "Notifications" },
];

const adminNavItem = {
  href: "/admin",
  label: "Admin",
  icon: Shield,
  className: "text-orange-400 hover:text-orange-300",
};

function NavLinks({
  links,
  pathname,
  pendingRequestsCount = 0,
}: {
  links: { href: string; label: string; icon?: typeof Shield; className?: string }[];
  pathname: string;
  pendingRequestsCount?: number;
}) {
  return (
    <>
      {links.map((item, i) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : item.href === "/company"
              ? pathname === "/company"
              : pathname.startsWith(item.href);
        const showBadge =
          (item.href === "/requests" || item.href === "/company/requests") &&
          pendingRequestsCount > 0;
        const ItemIcon = item.icon;
        const linkClass = item.className;
        return (
          <span key={item.href} className="flex items-center">
            <Link
              href={item.href}
              className={cn(
                "relative flex items-center gap-1 font-body text-sm font-medium transition-colors duration-200",
                linkClass,
                !linkClass &&
                  (isActive
                    ? "border-b-2 border-indigo-400 px-1 py-1 text-indigo-200"
                    : "rounded-lg px-3 py-1.5 text-slate-400 hover:bg-white/5 hover:text-indigo-100")
              )}
            >
              {ItemIcon && <ItemIcon className="h-3.5 w-3.5 shrink-0" />}
              {item.label}
              {showBadge && (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500"
                  aria-label={`${pendingRequestsCount} pending`}
                />
              )}
            </Link>
          </span>
        );
      })}
    </>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoggedIn, logout, token } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const loadSubscription = useCallback(() => {
    if (!token) return;
    getSubscription(token)
      .then(setSubscription)
      .catch(() => setSubscription(null));
  }, [token]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const loadPendingRequests = useCallback(() => {
    if (!token || user?.user_type !== "jobseeker") return;
    getReceivedRequests(token)
      .then((list) => {
        const n = (list || []).filter((r) => r.status === "pending").length;
        setPendingRequestsCount(n);
      })
      .catch(() => setPendingRequestsCount(0));
  }, [token, user?.user_type]);

  useEffect(() => {
    loadPendingRequests();
  }, [loadPendingRequests]);

  useEffect(() => {
    if (!token) return;
    const load = () => {
      getUnreadCount(token)
        .then((data) => setUnreadNotificationsCount(data.count || 0))
        .catch(() => setUnreadNotificationsCount(0));
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [token]);

  function handleSignOut() {
    logout();
    router.push("/");
    setMobileOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const baseLinks = !isLoggedIn
    ? publicNav
    : user?.user_type === "company"
      ? companyNav
      : jobseekerNav;
  const links =
    isLoggedIn && user?.is_admin
      ? [...baseLinks, adminNavItem]
      : baseLinks;

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full border-b border-white/[0.06] shadow-[0_20px_40px_rgba(0,0,0,0.45)] transition-[background,backdrop-filter] duration-300",
        scrolled ? "bg-[#0b1326]/92" : "bg-[#0b1326]/65"
      )}
      style={{
        backdropFilter: "blur(20px) saturate(1.15)",
        WebkitBackdropFilter: "blur(20px) saturate(1.15)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        <Logo size="sm" href="/" className="mr-2 shrink-0 sm:mr-4" />

        {/* Desktop nav */}
        <nav className="hidden max-w-4xl flex-1 flex-wrap items-center justify-center gap-x-6 gap-y-1 md:flex lg:gap-x-8">
          <NavLinks
            links={links}
            pathname={pathname}
            pendingRequestsCount={user?.user_type === "jobseeker" ? pendingRequestsCount : 0}
          />
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-indigo-200 md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Right: Auth buttons or user */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isLoggedIn && user ? (
            <>
              <div className="flex items-center gap-2 sm:gap-4">
                <NotificationBell />
                <div className="hidden items-center gap-2 sm:flex">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-v-surfaceContainerHighest text-xs font-semibold text-indigo-200 sm:h-10 sm:w-10"
                    aria-hidden
                  >
                    {getInitials(user.full_name)}
                  </div>
                  <span className="hidden text-sm text-v-onSurface lg:inline">
                    {user.full_name}
                  </span>
                  {subscription?.plan === "pro" && (
                    <span className="rounded-full bg-indigo-500/30 px-2 py-0.5 text-xs font-medium text-indigo-300">
                      PRO
                    </span>
                  )}
                  {subscription?.plan === "business" && (
                    <span className="rounded-full bg-cyan-500/30 px-2 py-0.5 text-xs font-medium text-cyan-300">
                      BIZ
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg px-2 py-1.5 text-xs text-slate-400 transition-colors hover:text-indigo-200 sm:px-3 sm:text-sm"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="hidden rounded-lg px-2 py-1.5 text-xs text-slate-400 transition-colors hover:text-indigo-200 sm:block sm:px-3 sm:text-sm"
              >
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-violet-500/20 sm:px-4 sm:py-2 sm:text-sm"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile dropdown — slide down, glass-card, full width */}
      {mobileOpen && (
        <div className="glass-card w-full border-t border-v-outlineVariant/20 px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : item.href === "/company"
                    ? pathname === "/company"
                    : pathname.startsWith(item.href);
              const showBadge =
                (item.href === "/requests" || item.href === "/company/requests") &&
                user?.user_type === "jobseeker" &&
                pendingRequestsCount > 0;
              const showNotificationsBadge =
                item.href === "/notifications" && unreadNotificationsCount > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-indigo-500/20 text-indigo-200"
                      : "text-v-onSurface hover:bg-white/5"
                  )}
                >
                  {item.label}
                  {showBadge && (
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                  )}
                  {showNotificationsBadge && (
                    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          {isLoggedIn && user && (
            <div className="mt-3 flex items-center gap-2 border-t border-v-outlineVariant/20 pt-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-v-surfaceContainerHighest text-xs font-semibold text-indigo-200">
                {getInitials(user.full_name)}
              </div>
              <span className="text-sm text-v-onSurface">{user.full_name}</span>
              {subscription?.plan === "pro" && (
                <span className="rounded-full bg-indigo-500/30 px-2 py-0.5 text-xs font-medium text-indigo-300">
                  PRO
                </span>
              )}
              {subscription?.plan === "business" && (
                <span className="rounded-full bg-cyan-500/30 px-2 py-0.5 text-xs font-medium text-cyan-300">
                  BIZ
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
