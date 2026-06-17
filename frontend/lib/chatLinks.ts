/** Friendly labels for chatbot in-app links (matches api/chat_knowledge.py). */
const PATH_LABELS: Record<string, string> = {
  "/": "Home",
  "/jobs": "Jobs",
  "/find-jobs": "Job boards",
  "/search": "Search all jobs",
  "/match": "Matches",
  "/saved": "Saved jobs",
  "/tracker": "Application tracker",
  "/my-applications": "My applications",
  "/skills-gap": "Skills gap analyzer",
  "/requests": "Contact requests",
  "/analytics": "Analytics",
  "/profile": "Profile",
  "/pricing": "Pricing",
  "/about": "About",
  "/contact": "Contact",
  "/privacy": "Privacy policy",
  "/terms": "Terms of service",
  "/notifications": "Notifications",
  "/dashboard/jobseeker": "Jobseeker dashboard",
  "/dashboard/company": "Company dashboard",
  "/settings/billing": "Billing",
  "/settings/alerts": "Job alerts",
  "/auth/login": "Log in",
  "/auth/register": "Sign up",
  "/auth/forgot-password": "Forgot password",
  "/auth/reset-password": "Reset password",
  "/company/jobs": "My jobs",
  "/company/post-job": "Post a job",
  "/company/search": "Find candidates",
  "/company/saved": "Saved candidates",
  "/company/requests": "Contact requests",
  "/company/history": "Search history",
  "/company/profile": "Company profile",
  "/company/applications": "Applications",
};

function pathLabel(path: string): string {
  const clean = path.trim().split("?")[0].split("#")[0];
  const normalized = clean.startsWith("/") ? clean : `/${clean}`;
  if (PATH_LABELS[normalized]) return PATH_LABELS[normalized];
  for (const base of Object.keys(PATH_LABELS)) {
    if (normalized.startsWith(`${base}?`) || normalized === base) {
      return PATH_LABELS[base];
    }
  }
  const slug = normalized.replace(/^\//, "").split("/").pop()?.replace(/-/g, " ");
  return slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "Open page";
}

/** Normalize chat replies: friendly link text instead of raw /paths. */
export function normalizeChatReplyLinks(text: string): string {
  if (!text) return text;

  let out = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, url: string) => {
    const u = url.trim();
    const l = label.trim();
    if (u.startsWith("/") && (l.startsWith("/") || l.replace(/\s/g, "") === u.replace(/^\//, ""))) {
      return `[${pathLabel(u)}](${u})`;
    }
    return `[${label}](${url})`;
  });

  out = out.replace(/`(\/[^\s`?#]+(?:\?[^\s`#]*)?)`/g, (_, path: string) =>
    `[${pathLabel(path)}](${path})`
  );

  out = out.replace(
    /(?<!\]\()(?<!\[)(?<![\w-])(\/(?:[\w-]+(?:\/[\w-]+)*)(?:\?[\w=&.-]+)?)(?!\))/g,
    (path) => `[${pathLabel(path)}](${path})`
  );

  return out;
}
