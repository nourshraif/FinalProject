/** Session key: skills extracted during a guest CV match, restored after sign-up/login. */
export const PENDING_MATCH_SKILLS_KEY = "vertex_pending_match_skills";

/** Match page query flag — auto-run matching right after auth. */
export const MATCH_PREVIEW_PATH = "/match?preview=1";

export function savePendingMatchSkills(skills: string[]): void {
  if (typeof window === "undefined" || skills.length === 0) return;
  try {
    sessionStorage.setItem(PENDING_MATCH_SKILLS_KEY, JSON.stringify(skills));
  } catch {
    // ignore quota / private mode
  }
}

export function peekPendingMatchSkills(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_MATCH_SKILLS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const skills = parsed.map((s) => String(s).trim()).filter(Boolean);
    return skills.length > 0 ? skills : null;
  } catch {
    return null;
  }
}

export function takePendingMatchSkills(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_MATCH_SKILLS_KEY);
    sessionStorage.removeItem(PENDING_MATCH_SKILLS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const skills = parsed.map((s) => String(s).trim()).filter(Boolean);
    return skills.length > 0 ? skills : null;
  } catch {
    return null;
  }
}

export function matchRegisterUrl(): string {
  return `/auth/register?type=jobseeker&next=${encodeURIComponent(MATCH_PREVIEW_PATH)}`;
}

export function matchLoginUrl(): string {
  return `/auth/login?next=${encodeURIComponent(MATCH_PREVIEW_PATH)}`;
}

export function postAuthPathFromNext(
  nextUrl: string | null,
  fallback: string
): string {
  if (nextUrl && nextUrl.startsWith("/") && !nextUrl.startsWith("//")) {
    return nextUrl;
  }
  return fallback;
}
