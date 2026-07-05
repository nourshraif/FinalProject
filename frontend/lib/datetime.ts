/**
 * Parse API timestamps. The backend stores UTC in PostgreSQL and often
 * serializes naive datetimes without a "Z" suffix. Browsers treat those as
 * local time, which skews "X ago" labels (e.g. by 3h in UTC+3).
 */
export function parseApiDate(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  const s = String(iso).trim();
  if (!s) return null;

  const hasTimezone = /[zZ]$|[+-]\d{2}:\d{2}$/.test(s);
  const normalized = hasTimezone ? s : `${s}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Human-readable relative time, e.g. "5 minutes ago". */
export function timeAgo(iso: string | undefined | null): string {
  const d = parseApiDate(iso);
  if (!d) return "";

  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "Just now";

  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (mins < 1) return "Just now";
  return `${mins} minute${mins === 1 ? "" : "s"} ago`;
}

/** Short relative time for compact UI, e.g. "5m ago". */
export function timeAgoShort(iso: string | undefined | null): string {
  const d = parseApiDate(iso);
  if (!d) return "";

  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "Just now";

  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}
