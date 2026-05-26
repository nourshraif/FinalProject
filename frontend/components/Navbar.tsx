"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { getReceivedRequests, getSubscription, getUnreadCount } from "@/lib/api";
import type { Subscription } from "@/types";
import { Menu, X, ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";

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
  { href: "/jobs", label: "Vertex Jobs" },
  { href: "/find-jobs", label: "Job Boards" },
  { href: "/pricing", label: "Pricing" },
  { href: "/company", label: "For Companies" },
  { href: "/contact", label: "Contact" },
  { href: "/about", label: "About" },
];

export type NavItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
  className?: string;
};

/** Day-to-day workflow */
const jobseekerPrimary: NavItem[] = [
  { href: "/dashboard/jobseeker", label: "Dashboard" },
  { href: "/jobs", label: "Vertex Jobs" },
  { href: "/find-jobs", label: "Job Boards" },
  { href: "/tracker", label: "Tracker" },
  { href: "/saved", label: "Saved" },
  { href: "/requests", label: "Requests" },
];

const jobseekerMore: NavItem[] = [
  { href: "/search", label: "All Jobs" },
  { href: "/analytics", label: "Analytics" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/pricing", label: "Pricing" },
];

const jobseekerAccount: NavItem[] = [
  { href: "/settings/alerts", label: "Job alerts" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/notifications", label: "All notifications" },
];

const companyPrimary: NavItem[] = [
  { href: "/dashboard/company", label: "Dashboard" },
  { href: "/company/post-job", label: "Post job" },
  { href: "/company/jobs", label: "My jobs" },
  { href: "/company/search", label: "Find talent" },
  { href: "/company/saved", label: "Saved" },
  { href: "/company/requests", label: "Requests" },
];

const companyMore: NavItem[] = [
  { href: "/company/history", label: "History" },
  { href: "/analytics", label: "Analytics" },
  { href: "/company/profile", label: "Profile" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/pricing", label: "Pricing" },
];

const companyAccount: NavItem[] = [
  { href: "/settings/billing", label: "Billing" },
  { href: "/notifications", label: "All notifications" },
];

const adminPrimary: NavItem[] = [
  { href: "/admin", label: "Admin Panel" },
  { href: "/analytics", label: "Analytics" },
  { href: "/admin#users-section", label: "Users" },
  { href: "/pricing", label: "Pricing" },
];

function isLinkActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/company") return pathname === "/company";
  return pathname.startsWith(href);
}

function NavLinks({
  links,
  pathname,
  pendingRequestsCount = 0,
  onNavigate,
}: {
  links: NavItem[];
  pathname: string;
  pendingRequestsCount?: number;
  onNavigate?: () => void;
}) {
  return (
    <>
      {links.map((item) => {
        const active = isLinkActive(pathname, item.href);
        const showBadge =
          (item.href === "/requests" || item.href === "/company/requests") &&
          pendingRequestsCount > 0;
        const ItemIcon = item.icon;
        const linkClass = item.className;
        return (
          <span key={item.href} className="flex items-center">
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-1 font-body text-sm font-medium transition-colors duration-200",
                linkClass,
                !linkClass &&
                  (active
                    ? "border-b-2 border-indigo-400 px-1 py-1 text-indigo-300"
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

function NavMenuDropdown({
  label,
  triggerClassName,
  align,
  items,
  pathname,
  dropdownClass,
}: {
  label: string;
  triggerClassName?: string;
  align: "left" | "right";
  items: NavItem[];
  pathname: string;
  dropdownClass: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1 rounded-lg px-2 py-1.5 font-body text-sm font-medium transition-colors sm:px-3",
          "text-slate-400 hover:bg-white/5 hover:text-indigo-100",
          triggerClassName
        )}
      >
        {label}
        <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-70 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          className={cn(dropdownClass, align === "right" ? "right-0" : "left-0")}
          role="menu"
        >
          {items.map((item) => (
            <DropdownNavLink
              key={item.href}
              item={item}
              pathname={pathname}
              onPick={() => setOpen(false)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownNavLink({
  item,
  pathname,
  onPick,
  badgeCount,
}: {
  item: NavItem;
  pathname: string;
  onPick: () => void;
  badgeCount?: number;
}) {
  const active = isLinkActive(pathname, item.href);
  const ItemIcon = item.icon;
  return (
    <Link
      href={item.href}
      role="menuitem"
      onClick={onPick}
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2.5 font-body text-sm transition-colors",
        item.className,
        !item.className &&
          (active
            ? "bg-indigo-500/15 text-indigo-200"
            : "text-slate-300 hover:bg-white/5 hover:text-indigo-100")
      )}
    >
      <span className="flex items-center gap-2">
        {ItemIcon && <ItemIcon className="h-3.5 w-3.5 shrink-0" />}
        {item.label}
      </span>
      {badgeCount != null && badgeCount > 0 && (
        <span className="rounded-full bg-red-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      )}
    </Link>
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
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

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
    setAccountOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [accountOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accountOpen]);

  const dropdownPanelClass =
    "absolute z-[60] mt-1.5 min-w-[12.5rem] rounded-xl border border-white/10 bg-[#1a273e]/95 py-1 shadow-[0_16px_48px_rgba(0,8,24,0.5)] backdrop-blur-xl";

  const isCompany = user?.user_type === "company";
  const isAdmin = Boolean(user?.is_admin);
  const profileHref = isAdmin ? "/admin" : isCompany ? "/company/profile" : "/profile";
  const primary = !isLoggedIn
    ? publicNav
    : isAdmin
      ? adminPrimary
      : isCompany
        ? companyPrimary
        : jobseekerPrimary;
  const more = isLoggedIn
    ? isAdmin
      ? []
      : isCompany
        ? companyMore
        : jobseekerMore
    : [];
  const account = isLoggedIn
    ? isAdmin
      ? []
      : isCompany
        ? companyAccount
        : jobseekerAccount
    : [];

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full border-b transition-[background,border-color,backdrop-filter] duration-300",
        scrolled
          ? "border-white/[0.06] bg-[#0e182c]/92 shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
          : "border-white/[0.06] bg-[#0e182c]/68",
      )}
      style={{
        backdropFilter: "blur(20px) saturate(1.15)",
        WebkitBackdropFilter: "blur(20px) saturate(1.15)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        <Logo size="sm" href="/" className="mr-2 shrink-0 sm:mr-4" />

        {/* Desktop: primary + More + admin */}
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-x-2 md:flex lg:gap-x-3">
          {!isLoggedIn ? (
            <NavLinks links={primary} pathname={pathname} />
          ) : (
            <>
              <NavLinks
                links={primary}
                pathname={pathname}
                pendingRequestsCount={!isCompany ? pendingRequestsCount : 0}
              />
              {more.length > 0 && (
                <NavMenuDropdown label="More" align="left" items={more} pathname={pathname} dropdownClass={dropdownPanelClass} />
              )}
            </>
          )}
        </nav>

        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-indigo-200 md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {isLoggedIn && user ? (
            <>
              <NotificationBell />
              {/* Desktop account menu */}
              <div className="relative hidden md:block" ref={accountRef}>
                <div className="flex items-center gap-1 rounded-lg py-1 pl-1 pr-1 text-slate-400 transition-colors hover:bg-white/5 hover:text-indigo-100">
                  <button
                    type="button"
                    aria-expanded={accountOpen}
                    aria-haspopup="menu"
                    aria-label="Account menu"
                    onClick={() => setAccountOpen((o) => !o)}
                    className="flex items-center"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-v-surfaceContainerHighest text-xs font-semibold text-indigo-200 sm:h-10 sm:w-10">
                      {getInitials(user.full_name)}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Go to profile"
                    onClick={() => {
                      setAccountOpen(false);
                      router.push(profileHref);
                    }}
                    className="hidden rounded-md p-1 transition-colors hover:bg-white/5 hover:text-indigo-200 sm:block"
                  >
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </button>
                  <button
                    type="button"
                    aria-label="Toggle account menu"
                    onClick={() => setAccountOpen((o) => !o)}
                    className="hidden rounded-md p-1 transition-colors hover:bg-white/5 hover:text-indigo-200 sm:block"
                  >
                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0", accountOpen && "rotate-180")}
                    />
                  </button>
                </div>
                {accountOpen && (
                  <div
                    className={cn(dropdownPanelClass, "right-0")}
                    role="menu"
                  >
                    <div className="border-b border-white/5 px-3 py-2">
                      <p className="truncate text-xs font-medium text-indigo-200/90">{user.full_name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {subscription?.plan === "pro" && (
                          <span className="rounded-full bg-indigo-500/30 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                            PRO
                          </span>
                        )}
                        {subscription?.plan === "business" && (
                          <span className="rounded-full bg-cyan-500/30 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
                            BIZ
                          </span>
                        )}
                      </div>
                    </div>
                    {account.map((item) => (
                      <DropdownNavLink
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        onPick={() => setAccountOpen(false)}
                        badgeCount={item.href === "/notifications" ? unreadNotificationsCount : undefined}
                      />
                    ))}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      className="w-full border-t border-white/5 px-3 py-2.5 text-left font-body text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-indigo-200"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg px-2 py-1.5 text-xs text-slate-400 transition-colors hover:text-indigo-200 md:hidden sm:px-3 sm:text-sm"
              >
                Sign out
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

      {mobileOpen && (
        <div className="glass-card max-h-[min(85vh,calc(100dvh-4rem))] w-full overflow-y-auto border-t border-v-outlineVariant/20 px-4 py-4 md:hidden">
          {!isLoggedIn ? (
            <nav className="flex flex-col gap-1">
              {publicNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isLinkActive(pathname, item.href)
                      ? "bg-indigo-500/20 text-indigo-200"
                      : "text-v-onSurface hover:bg-white/5"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : (
            <nav className="flex flex-col gap-3">
              <div>
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Main
                </p>
                <div className="flex flex-col gap-0.5">
                  {primary.map((item) => {
                    const active = isLinkActive(pathname, item.href);
                    const showBadge =
                      (item.href === "/requests" || item.href === "/company/requests") &&
                      !isCompany &&
                      pendingRequestsCount > 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          active ? "bg-indigo-500/20 text-indigo-200" : "text-v-onSurface hover:bg-white/5"
                        )}
                      >
                        {item.label}
                        {showBadge && <span className="h-2 w-2 rounded-full bg-red-500" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
              {more.length > 0 && (
                <div>
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    More
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {more.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          isLinkActive(pathname, item.href)
                            ? "bg-indigo-500/20 text-indigo-200"
                            : "text-v-onSurface hover:bg-white/5"
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Account
                </p>
                <div className="flex flex-col gap-0.5">
                  {account.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        isLinkActive(pathname, item.href)
                          ? "bg-indigo-500/20 text-indigo-200"
                          : "text-v-onSurface hover:bg-white/5"
                      )}
                    >
                      {item.label}
                      {item.href === "/notifications" && unreadNotificationsCount > 0 && (
                        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-v-outlineVariant/20 pt-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-v-surfaceContainerHighest text-xs font-semibold text-indigo-200">
                  {getInitials(user?.full_name || "")}
                </div>
                <span className="flex-1 truncate text-sm text-v-onSurface">{user?.full_name}</span>
              </div>
            </nav>
          )}
        </div>
      )}
    </header>
  );
}
