"""Vertex chatbot knowledge loader and prompt builder."""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

_KNOWLEDGE_PATH = Path(__file__).resolve().parent / "vertex_chat_knowledge.md"

# Friendly display names for in-app links (never show raw /paths to users).
PATH_LABELS: dict[str, str] = {
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
}

VERTEX_PAGE_HINTS = {
    "pricing": "/pricing",
    "plan": "/pricing",
    "subscription": "/settings/billing",
    "billing": "/settings/billing",
    "upgrade": "/pricing",
    "cancel": "/settings/billing",
    "analytics": "/analytics",
    "tracker": "/tracker",
    "application tracker": "/tracker",
    "my application": "/my-applications",
    "saved": "/saved",
    "save job": "/saved",
    "bookmark": "/saved",
    "match": "/match",
    "matches": "/match",
    "skills gap": "/skills-gap",
    "skill gap": "/skills-gap",
    "job alert": "/settings/alerts",
    "alert": "/settings/alerts",
    "post job": "/company/post-job",
    "post a job": "/company/post-job",
    "my job": "/company/jobs",
    "applicant": "/company/jobs",
    "application": "/company/applications",
    "candidate search": "/company/search",
    "find candidate": "/company/search",
    "search candidate": "/company/search",
    "talent pool": "/company/search",
    "contact request": "/company/requests",
    "search history": "/company/history",
    "profile": "/profile",
    "company profile": "/company/profile",
    "cv": "/profile",
    "resume": "/profile",
    "upload": "/profile",
    "login": "/auth/login",
    "log in": "/auth/login",
    "register": "/auth/register",
    "sign up": "/auth/register",
    "forgot password": "/auth/forgot-password",
    "reset password": "/auth/reset-password",
    "dashboard": "/dashboard/jobseeker",
    "vertex job": "/jobs",
    "job board": "/find-jobs",
    "find job": "/find-jobs",
    "contact": "/contact",
    "about": "/about",
    "privacy": "/privacy",
    "terms": "/terms",
    "notification": "/notifications",
    "home": "/",
    "growth": "/pricing",
    "business": "/pricing",
    "pro": "/pricing",
}


def path_label(path: str) -> str:
    """Human-friendly link text for an internal path."""
    clean = (path or "").strip().split("?")[0].split("#")[0]
    if not clean.startswith("/"):
        clean = f"/{clean.lstrip('/')}"
    if clean in PATH_LABELS:
        return PATH_LABELS[clean]
    # /auth/register?type=jobseeker -> Sign up
    for base, label in PATH_LABELS.items():
        if clean.startswith(base + "?") or clean == base:
            return label
    slug = clean.strip("/").split("/")[-1].replace("-", " ")
    return slug.title() if slug else "Open page"


_MD_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_BACKTICK_PATH_RE = re.compile(r"`(/[^\s`?#]+(?:\?[^\s`#]*)?)`")
_BARE_PATH_RE = re.compile(
    r"(?<!\]\()(?<!\[)(?<![\w-])"
    r"(/(?:[\w-]+(?:/[\w-]+)*)(?:\?[\w=&.-]+)?)"
    r"(?!\))"
)


def normalize_chat_reply_links(text: str) -> str:
    """
    Ensure links use friendly labels, e.g. [Jobs](/jobs) not [/jobs](/jobs) or `/jobs`.
    """
    if not text:
        return text

    def fix_md_link(match: re.Match) -> str:
        label = match.group(1).strip()
        url = match.group(2).strip()
        if not url.startswith("/") and not url.startswith("http"):
            url = f"/{url.lstrip('/')}"
        if url.startswith("/") and (
            label.startswith("/") or label.replace(" ", "") == url.strip("/")
        ):
            label = path_label(url)
        return f"[{label}]({url})"

    out = _MD_LINK_RE.sub(fix_md_link, text)

    out = _BACKTICK_PATH_RE.sub(
        lambda m: f"[{path_label(m.group(1))}]({m.group(1)})", out
    )

    def fix_bare(match: re.Match) -> str:
        path = match.group(1)
        if path.startswith("//"):
            return path
        return f"[{path_label(path)}]({path})"

    out = _BARE_PATH_RE.sub(fix_bare, out)
    return out


@lru_cache(maxsize=1)
def load_vertex_knowledge() -> str:
    try:
        return _KNOWLEDGE_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def reload_vertex_knowledge_cache() -> None:
    """Clear cached knowledge (e.g. after editing the markdown file in dev)."""
    load_vertex_knowledge.cache_clear()


def _user_context_block(user: Optional[dict]) -> str:
    if not user:
        return (
            "The user is a **guest** (not logged in). They can browse jobs but cannot save, apply, "
            "or use tracker. Suggest [Register](/auth/register) or [Login](/auth/login) when relevant."
        )
    user_type = (user.get("user_type") or "unknown").strip().lower()
    plan = (user.get("plan") or "free").strip().lower()
    if user_type == "company" and plan == "pro":
        plan_label = "Growth"
    elif user_type == "company" and plan == "business":
        plan_label = "Business"
    elif user_type == "jobseeker" and plan == "pro":
        plan_label = "Pro"
    else:
        plan_label = plan.capitalize() if plan != "free" else "Free"
    name = (user.get("full_name") or "").strip()
    who = f"{name} ({user_type}, {plan_label} plan)" if name else f"{user_type}, {plan_label} plan"
    dash = "/dashboard/company" if user_type == "company" else "/dashboard/jobseeker"
    billing = "/settings/billing"
    return (
        f"Logged-in user: {who}. Dashboard: {dash}. Billing: {billing}. "
        f"When suggesting features, check if their plan includes it; if not, link to [Pricing](/pricing)."
    )


def build_chat_system_prompt(user: Optional[dict] = None) -> str:
    knowledge = load_vertex_knowledge()
    user_ctx = _user_context_block(user)

    return (
        "You are **Vertex AI**, the in-app assistant for the Vertex job matching platform.\n\n"
        "You help with TWO topics:\n"
        "1. **Vertex platform** — features, plans, navigation, how to use the website.\n"
        "2. **Career coaching** — CV tips, interviews, job search strategy (general advice).\n\n"
        "RULES FOR PLATFORM QUESTIONS:\n"
        "- Use ONLY the PLATFORM KNOWLEDGE below. Never invent features, prices, or URLs.\n"
        "- **Always include 1–3 markdown links** with **friendly labels**, never raw paths.\n"
        "  Good: [Jobs](/jobs), [Pricing](/pricing), [Application tracker](/tracker)\n"
        "  Bad: /jobs, `/find-jobs`, [/jobs](/jobs), or showing URL paths as link text\n"
        "- When a feature needs a paid plan, name the plan (Free / Pro / Growth / Business) and link "
        "to [Pricing](/pricing) or [Billing](/settings/billing).\n"
        "- Prefer linking the user to the exact page where they can complete the action.\n"
        "- Use short paragraphs and bullet points. No markdown tables in your replies.\n"
        "- Keep answers within about 8–14 lines unless the user asks for detail.\n"
        "- If you don't know, say so and link [Contact](/contact) or [Pricing](/pricing).\n\n"
        "RULES FOR CAREER QUESTIONS:\n"
        "- Give practical CV, interview, and job-search advice.\n"
        "- Optionally link to [Profile](/profile), [Matches](/match), or [Skills Gap](/skills-gap) "
        "when it fits.\n\n"
        f"USER CONTEXT:\n{user_ctx}\n\n"
        "PLATFORM KNOWLEDGE:\n"
        f"{knowledge}"
    )


def _format_page_links(paths: List[str]) -> str:
    unique = list(dict.fromkeys(paths))[:4]
    if not unique:
        return ""
    return "\n\n**Helpful links:** " + " · ".join(
        f"[{path_label(p)}]({p})" for p in unique
    )


def vertex_fallback_reply(question: str, user: Optional[dict] = None) -> Optional[str]:
    """Return a canned Vertex help reply when the LLM is unavailable, or None."""
    q = (question or "").lower()
    if not q:
        return None

    vertex_signals = (
        "vertex", "website", "platform", "page", "where", "how do i", "how to", "what is",
        "pricing", "plan", "subscription", "billing", "upgrade", "feature", "cost", "price",
        "analytics", "tracker", "saved", "save job", "bookmark", "match", "skills gap",
        "post job", "applicant", "candidate", "contact request", "login", "register",
        "dashboard", "growth", "business", "pro plan", "free plan", "job alert",
        "find job", "company job", "my job", "navigate", "url", "link", "account",
        "cancel", "payment", "stripe", "notification", "profile", "cv", "upload",
    )
    if not any(s in q for s in vertex_signals):
        return None

    links: List[str] = []
    for phrase, path in VERTEX_PAGE_HINTS.items():
        if phrase in q and path not in links:
            links.append(path)

    user_type = (user.get("user_type") or "").lower() if user else ""
    default_dash = (
        "/dashboard/company" if user_type == "company" else "/dashboard/jobseeker"
    )

    if "pricing" in q or "plan" in q or "upgrade" in q or "cost" in q or "price" in q:
        body = (
            "Vertex pricing depends on whether you are a jobseeker or company:\n"
            "- **Jobseekers:** [Free](/pricing) (top 3 matches, save jobs) · **Pro** $12/mo (tracker, skills gap, all matches)\n"
            "- **Companies:** [Free](/pricing) (1 job) · **Growth** $29/mo (5 jobs, analytics) · **Business** $49/mo (search, contact candidates)\n"
            "Compare plans on [Pricing](/pricing). Manage your subscription at [Billing](/settings/billing)."
        )
        if "pricing" not in links:
            links.insert(0, "/pricing")
    elif "analytics" in q:
        body = (
            "**Analytics** shows hiring funnel stats for companies (**Growth** or **Business**) "
            "and personal activity for jobseekers (**Pro**).\n"
            "Open [Analytics](/analytics). If locked, upgrade via [Pricing](/pricing)."
        )
        links.insert(0, "/analytics")
    elif "save" in q or "bookmark" in q:
        body = (
            "**Saved jobs** are for logged-in **jobseekers** only (not guests or companies).\n"
            "Use the bookmark icon on a job card, then open [Saved jobs](/saved)."
        )
        links.insert(0, "/saved")
    elif "tracker" in q or "track application" in q:
        body = (
            "The **application tracker** is a **Pro** jobseeker feature.\n"
            "Go to [Tracker](/tracker). Vertex applications are also listed at [My applications](/my-applications).\n"
            "Upgrade at [Pricing](/pricing)."
        )
        links.extend(["/tracker", "/my-applications"])
    elif "skills gap" in q or "skill gap" in q:
        body = (
            "The **Skills Gap Analyzer** compares your profile to a target role (**Pro** jobseekers).\n"
            "Open [Skills Gap](/skills-gap) or upgrade at [Pricing](/pricing)."
        )
        links.insert(0, "/skills-gap")
    elif "match" in q:
        body = (
            "**Job matches** use your CV and skills. Free jobseekers see the **top 3**; **Pro** sees all matches.\n"
            "Upload your CV on [Profile](/profile), then visit [Matches](/match)."
        )
        links.extend(["/match", "/profile"])
    elif "alert" in q:
        body = (
            "**Job alerts** email you matching roles (**Pro** jobseekers).\n"
            "Configure them at [Job alerts](/settings/alerts)."
        )
        links.insert(0, "/settings/alerts")
    elif ("post" in q and "job" in q) or "my job" in q:
        body = (
            "Companies post roles at [Post a job](/company/post-job).\n"
            "Limits: Free = 1 active job · Growth = 5 · Business = unlimited.\n"
            "Manage listings at [My jobs](/company/jobs)."
        )
        links.extend(["/company/post-job", "/company/jobs"])
    elif "applicant" in q:
        body = (
            "To review applicants: open [My jobs](/company/jobs), pick a job, then view its applicant list.\n"
            "You can also check [Applications](/company/applications)."
        )
        links.extend(["/company/jobs", "/company/applications"])
    elif "candidate" in q or "talent" in q or ("search" in q and user_type == "company"):
        body = (
            "Proactive **candidate search** is **Business** only.\n"
            "[Find candidates](/company/search) · [Saved candidates](/company/saved) · [Contact requests](/company/requests).\n"
            "Upgrade at [Pricing](/pricing)."
        )
        links.extend(["/company/search", "/pricing"])
    elif "contact request" in q:
        if user_type == "company":
            body = (
                "Outbound contact requests require **Business**. Manage them at [Contact requests](/company/requests).\n"
                "Free/Growth companies still receive applicants via [My jobs](/company/jobs)."
            )
        else:
            body = (
                "Jobseekers receive company contact requests at [Requests](/requests)."
            )
            links.insert(0, "/requests")
    elif "billing" in q or "cancel" in q or "subscription" in q:
        body = (
            "View your current plan and manage billing at [Billing](/settings/billing).\n"
            "Compare or upgrade plans on [Pricing](/pricing)."
        )
        links.extend(["/settings/billing", "/pricing"])
    elif "login" in q or "register" in q or "sign up" in q or "account" in q:
        body = (
            "Create an account at [Register](/auth/register) (choose jobseeker or company).\n"
            "Already have an account? [Login](/auth/login)."
        )
        links.extend(["/auth/register", "/auth/login"])
    elif "profile" in q or "cv" in q or "resume" in q or "upload" in q:
        if user_type == "company":
            body = "Update your company details at [Company profile](/company/profile)."
            links.insert(0, "/company/profile")
        else:
            body = (
                "Upload your CV and manage skills at [Profile](/profile).\n"
                "This improves matches on [Matches](/match)."
            )
            links.extend(["/profile", "/match"])
    elif "notification" in q:
        body = "View all notifications at [Notifications](/notifications)."
        links.insert(0, "/notifications")
    else:
        body = (
            "I can help you navigate Vertex — plans, pages, and how features work.\n"
            f"Start from your [Dashboard]({default_dash}), [Pricing](/pricing), or [Contact](/contact)."
        )
        if default_dash not in links:
            links.insert(0, default_dash)

    return normalize_chat_reply_links(body + _format_page_links(links))
