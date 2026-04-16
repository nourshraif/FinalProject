"""
Skill extraction service.

This service wraps all communication with the Hugging Face Inference API
and post-processing of responses to obtain a clean list of skills.
When the API is unreachable (e.g. connection error), a simple fallback
extractor is used so the app still returns skills.
"""

import os
import re
from typing import Any, List, Optional, Set

from dotenv import load_dotenv

try:
    from openai import OpenAI
except ImportError as e:
    raise ImportError(
        "The 'openai' package is not installed. Please install it by running:\n"
        "  pip install openai>=1.0.0\n"
        "Or install all requirements:\n"
        "  pip install -r requirements.txt\n\n"
        f"Original error: {e}"
    ) from e


# Load environment variables from .env file
load_dotenv()

# Max skills returned to callers after merge / parse
_MAX_SKILLS_OUT = 60

# Lowercase alias → canonical display label (dedupe is case-insensitive on canonical).
_ALIAS_TO_CANONICAL: dict[str, str] = {
    "js": "JavaScript",
    "javascript": "JavaScript",
    "ts": "TypeScript",
    "typescript": "TypeScript",
    "pg": "PostgreSQL",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "ml": "Machine Learning",
    "machine learning": "Machine Learning",
    "ai": "AI",
}


def normalize_skills_list(skills: List[str]) -> List[str]:
    """
    Canonicalize common abbreviations, drop junk, dedupe case-insensitively, preserve order.
    """
    out: List[str] = []
    seen: Set[str] = set()
    for raw in skills or []:
        s = (raw or "").strip()
        if len(s) < 2:
            continue
        if re.fullmatch(r"\d+\.?\d*", s):
            continue
        key = s.lower()
        canonical = _ALIAS_TO_CANONICAL.get(key, s.strip())
        dedupe_key = canonical.lower()
        if dedupe_key not in seen:
            seen.add(dedupe_key)
            out.append(canonical)
    return out[:_MAX_SKILLS_OUT]


def select_cv_excerpt_for_llm(cv_text: str, max_chars: int = 22000) -> str:
    """
    Prefer dense regions (skills / stack headings) plus head, middle, and tail of long CVs
    so the model sees more than the first page when PDFs are long.
    """
    t = cv_text.strip()
    if len(t) <= max_chars:
        return t
    tl = t.lower()
    markers = [
        "technical skills",
        "core skills",
        "key skills",
        "skills &",
        "skills and",
        "skills:",
        "skill set",
        "tech stack",
        "technologies",
        "tools &",
        "programming languages",
        "frameworks",
        "libraries",
        "certifications",
        "software skills",
        "it skills",
        "stack:",
        "environment:",
    ]
    chunks: List[str] = []
    seen_key: Set[str] = set()
    for marker in markers:
        pos = 0
        while True:
            i = tl.find(marker, pos)
            if i < 0:
                break
            chunk = t[max(0, i - 120) : i + 5500]
            key = chunk[:500]
            if key not in seen_key:
                seen_key.add(key)
                chunks.append(chunk.strip())
            pos = i + len(marker)
            if len(chunks) >= 8:
                break
    block = "\n\n--- SECTION ---\n\n".join(chunks) if chunks else ""
    head = t[:9000]
    tail = t[-6500:] if len(t) > 13000 else ""
    mid_start = max(0, len(t) // 2 - 4000)
    mid = t[mid_start : mid_start + 8000] if len(t) > 15000 else ""
    parts = [p for p in (block, "--- START ---\n" + head, "--- MID ---\n" + mid, "--- END ---\n" + tail) if p]
    combined = "\n\n".join(parts)
    if len(combined) > max_chars:
        combined = combined[:max_chars]
    return combined + "\n\n[Truncated: extract every skill evidenced in this excerpt; full CV is longer.]"


def merge_skills_from_api_and_fallback(cv_text: str, api_skills: List[str]) -> List[str]:
    """
    Union API-extracted skills with keyword fallback on full CV text, deduped
    case-insensitively (API order first, then additions).
    """
    api_skills = normalize_skills_list([str(s).strip() for s in (api_skills or []) if s and str(s).strip()])
    fb = fallback_extract_skills(cv_text)
    seen = {s.lower() for s in api_skills}
    out = list(api_skills)
    for s in fb:
        sl = s.lower()
        if sl not in seen:
            seen.add(sl)
            out.append(s)
    return normalize_skills_list(out)


def call_huggingface_api(cv_text: str, model_name: Optional[str] = None) -> Optional[str]:
    """
    Send CV text to Hugging Face Inference API and get extracted skills.

    Args:
        cv_text: The text content extracted from the CV PDF
        model_name: Optional model name. If not provided, uses HF_MODEL from .env or defaults to "gpt2"

    Returns:
        str: Response from the API containing extracted skills
    """
    # Get API token from environment variable
    api_token = os.getenv("HF_TOKEN")

    if not api_token:
        raise ValueError("HF_TOKEN not found in environment variables. Please check your .env file.")

    # Get model name from parameter, environment variable, or use default
    if model_name is None:
        model_name = os.getenv("HF_MODEL", "openai/gpt-oss-120b:groq")  # Default model

    if not model_name:
        model_name = "openai/gpt-oss-120b:groq"  # Final fallback

    # Initialize OpenAI client with Hugging Face router endpoint
    client = OpenAI(
        base_url="https://router.huggingface.co/v1",
        api_key=api_token,
    )

    system_prompt = (
        "You are a precise skill extractor for a "
        "job matching platform that serves ALL industries "
        "not just technology.\n\n"
        "Extract ALL relevant professional skills "
        "from the CV text provided.\n\n"
        "FOR TECH CVs INCLUDE:\n"
        "- Programming languages (Python, JavaScript)\n"
        "- Frameworks (React, Django, Spring Boot)\n"
        "- Databases (PostgreSQL, MongoDB)\n"
        "- Cloud platforms (AWS, Azure, GCP)\n"
        "- DevOps tools (Docker, Git, Kubernetes)\n"
        "- Methodologies (Agile, Scrum, TDD)\n\n"
        "FOR ALL CVs INCLUDE:\n"
        "- Professional competencies clearly shown "
        "in the CV (case management, psychosocial support)\n"
        "- Domain knowledge (clinical psychology, "
        "social work, GBV, child protection)\n"
        "- Industry-specific tools and software\n"
        "- Languages spoken (Arabic, French, English)\n"
        "- Certifications and specializations\n"
        "- Healthcare skills (patient assessment, "
        "counseling, therapy)\n"
        "- Business skills (accounting, project "
        "management, sales, marketing)\n"
        "- Design skills (Figma, Photoshop, AutoCAD)\n"
        "- Research skills (data analysis, "
        "academic research, report writing)\n\n"
        "DO NOT INCLUDE:\n"
        "- Job titles (Software Engineer, Manager, "
        "Caseworker)\n"
        "- Company names (Amel Association, Google)\n"
        "- City names or locations (Beirut, Lebanon)\n"
        "- University names\n"
        "- Degree names (Bachelor, Master, MBA)\n"
        "- Dates and years\n"
        "- Generic phrases (responsible for, "
        "worked with, managed)\n"
        "- Personal information (email, phone)\n\n"
        "EXAMPLES of good extraction:\n"
        "Tech CV: ['Python', 'React', 'PostgreSQL', "
        "'Docker', 'AWS', 'Agile']\n"
        "Psychology CV: ['Psychosocial Support', "
        "'Case Management', 'GBV', 'Child Protection', "
        "'Counseling', 'Arabic', 'French']\n"
        "Business CV: ['Financial Analysis', 'Excel', "
        "'SAP', 'Project Management', 'Arabic']\n\n"
        "Output ONLY a Python list of strings.\n"
        "Example: ['Skill 1', 'Skill 2', 'Skill 3']\n"
        "No explanation. No markdown. Just the list.\n"
        "Extract between 5 and 40 skills."
    )
    excerpt = select_cv_excerpt_for_llm(cv_text)
    user_prompt = f"CV text (excerpt may be truncated for very long documents):\n\n{excerpt}"
    retry_prompt = (
        "List all relevant professional skills from this CV "
        "as a Python list: ['skill1', 'skill2']\n"
        "CV text:\n" + excerpt
    )

    def _completion_text(messages: List[Any]) -> Optional[str]:
        completion = client.chat.completions.create(
            model=model_name,
            messages=messages,
            max_tokens=2000,
            temperature=0.25,
        )
        if completion.choices and len(completion.choices) > 0:
            content = completion.choices[0].message.content
            return content.strip() if content else None
        return None

    def _raise_api_error(e: Exception) -> None:
        error_msg = str(e)
        if "404" in error_msg or "not found" in error_msg.lower():
            raise Exception(
                f"Model '{model_name}' not found or not available.\n\n"
                f"Please check:\n"
                f"1. The model name is correct: {model_name}\n"
                f"2. The model is available at: https://huggingface.co/{model_name.split(':')[0]}\n"
                f"3. Try a different model like 'openai/gpt-oss-120b:groq' or 'gpt2'"
            ) from e
        if "401" in error_msg or "unauthorized" in error_msg.lower():
            raise Exception(
                "Authentication failed. Please check your HF_TOKEN at https://huggingface.co/settings/tokens"
            ) from e
        if "rate limit" in error_msg.lower() or "429" in error_msg:
            raise Exception(
                "Rate limit exceeded. Please wait a moment and try again, or upgrade your Hugging Face account."
            ) from e
        if "connection" in error_msg.lower() or "connect" in error_msg.lower():
            raise Exception(
                "Could not reach the skill-extraction API (connection error). "
                "Check your internet connection and try again. "
                "If the problem persists, the Hugging Face endpoint may be temporarily unavailable."
            ) from e
        raise Exception(
            f"Error calling API: {error_msg}\n\nModel: {model_name}\nEndpoint: https://router.huggingface.co/v1"
        ) from e

    def _parsed_nonempty(text: Optional[str]) -> bool:
        if not text:
            return False
        # parse_skills_from_response is defined later in this module; resolved at call time.
        skills = parse_skills_from_response(text)
        return len(skills) > 0

    first_text: Optional[str] = None
    try:
        first_text = _completion_text(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
        )
    except Exception as first_err:
        try:
            retry_text = _completion_text([{"role": "user", "content": retry_prompt}])
            if retry_text:
                return retry_text
        except Exception:
            pass
        _raise_api_error(first_err)

    if _parsed_nonempty(first_text):
        return first_text

    try:
        retry_text = _completion_text([{"role": "user", "content": retry_prompt}])
        if retry_text:
            return retry_text
    except Exception:
        pass

    return first_text


# Phrases first (longer matches win when scanning text_lower).
_FALLBACK_PHRASES = [
    "machine learning", "deep learning", "data science", "computer vision", "nlp",
    "natural language", "react native", "node.js", "next.js", "vue.js", "angularjs",
    "asp.net", "spring boot", "spring mvc", "ci/cd", "ci cd", "github actions", "gitlab ci",
    "power bi", "google cloud", "amazon web services", "ruby on rails",
    "objective-c", "objective c", "visual studio", "vs code", "unit testing",
    "microservices", "rest api", "graphql api", "data engineering", "big data",
    "apache spark", "apache kafka", "apache airflow", "microsoft azure",
    "microsoft office", "project management", "digital marketing", "google analytics",
    "social media", "content writing",
]
# Single tokens / short names (lowercase).
_FALLBACK_KEYWORDS = [
    "python", "javascript", "typescript", "java", "kotlin", "swift", "scala", "rust",
    "go", "golang", "ruby", "php", "perl", "r", "c++", "c#", "csharp", ".net", "dotnet",
    "react", "angular", "vue", "svelte", "ember", "jquery", "html", "css", "sass", "scss",
    "node", "express", "nestjs", "django", "flask", "fastapi", "spring", "laravel",
    "sql", "mysql", "postgresql", "postgres", "mongodb", "mongo", "redis", "sqlite",
    "oracle", "dynamodb", "elasticsearch", "cassandra", "snowflake", "bigquery",
    "aws", "azure", "gcp", "terraform", "ansible", "kubernetes", "k8s", "docker",
    "jenkins", "git", "github", "gitlab", "bitbucket", "linux", "unix", "bash", "powershell",
    "tensorflow", "pytorch", "keras", "scikit-learn", "sklearn", "pandas", "numpy",
    "opencv", "spark", "hadoop", "kafka", "rabbitmq", "nginx", "graphql", "rest",
    "grpc", "websocket", "oauth", "jwt", "ldap", "active directory", "sso",
    "figma", "sketch", "jira", "confluence", "slack", "notion", "agile", "scrum", "kanban",
    "tableau", "excel", "looker", "dbt", "airflow", "etl", "elt", "nosql",
    "android", "ios", "flutter", "dart", "xamarin", "ionic", "swiftui",
    "solidity", "web3", "blockchain", "ethereum", "hardhat", "truffle",
    "selenium", "cypress", "playwright", "jest", "mocha", "pytest", "junit",
    "webpack", "vite", "rollup", "babel", "eslint", "prettier",
    "redux", "mobx", "nuxt", "nuxt.js", "gatsby", "prisma", "sequelize", "typeorm",
    "storybook", "tailwind", "bootstrap", "mui", "material-ui", "chakra",
    "supabase", "firebase", "strapi", "wordpress", "shopify", "stripe", "twilio",
    "splunk", "datadog", "newrelic", "prometheus", "grafana", "elk",
    "salesforce", "servicenow", "sap", "dynamics", "workday",
    "matlab", "cuda", "scipy", "matplotlib",
    "unity", "unreal", "blender", "photoshop", "illustrator",
    "swagger", "openapi", "postman", "insomnia", "vim", "emacs", "intellij",
    "arabic", "french", "english", "accounting", "quickbooks", "autocad", "revit", "solidworks",
    "indesign", "word", "powerpoint", "erp", "crm", "pmp", "seo",
]

# Display label for awkward keys
_FALLBACK_LABEL = {
    "csharp": "C#",
    "dotnet": ".NET",
    "mongo": "MongoDB",
    "postgres": "PostgreSQL",
    "sklearn": "scikit-learn",
    "k8s": "Kubernetes",
    "gcp": "GCP",
    "aws": "AWS",
    "nlp": "NLP",
    "golang": "Go",
    "seo": "SEO",
    "pmp": "PMP",
    "erp": "ERP",
    "crm": "CRM",
}

# NGO / social work and adjacent domains (lowercase phrases or single tokens).
_NGO_KEYWORDS = [
    "case management",
    "psychosocial support",
    "gbv",
    "gender based violence",
    "child protection",
    "counseling",
    "social work",
    "community development",
    "humanitarian",
    "protection",
    "advocacy",
    "referral",
    "assessment",
    "monitoring",
    "evaluation",
    "m&e",
    "capacity building",
    "training",
    "data collection",
    "report writing",
    "stakeholder management",
    "needs assessment",
    "field work",
]

_HEALTH_KEYWORDS = [
    "patient care",
    "clinical assessment",
    "mental health",
    "therapy",
    "diagnosis",
    "treatment planning",
    "medical records",
    "first aid",
    "public health",
    "epidemiology",
    "pharmacy",
    "nursing",
    "surgery",
]

_BUSINESS_KEYWORDS = [
    "financial analysis",
    "budgeting",
    "accounting",
    "auditing",
    "taxation",
    "sales",
    "marketing",
    "crm",
    "customer service",
    "negotiation",
    "supply chain",
    "procurement",
    "human resources",
    "recruitment",
    "payroll",
    "erp",
    "business development",
]

_LANGUAGE_KEYWORDS = [
    "arabic",
    "french",
    "english",
    "spanish",
    "german",
    "mandarin",
]

# Display overrides for domain fallback phrases (lowercase key).
_DOMAIN_PHRASE_LABEL: dict[str, str] = {
    "gbv": "GBV",
    "m&e": "M&E",
    "crm": "CRM",
    "erp": "ERP",
}


def _domain_keyword_display(lower_phrase: str) -> str:
    """Title-style label for a matched lowercase phrase; handles acronyms."""
    lp = lower_phrase.strip().lower()
    if lp in _DOMAIN_PHRASE_LABEL:
        return _DOMAIN_PHRASE_LABEL[lp]
    return lp.replace(" ", " ").title()


def _domain_keyword_is_substring_scan(kw: str) -> bool:
    """Multi-token or symbols → scan with `in text_lower`; else word-boundary on original text."""
    lk = kw.strip().lower()
    if not lk:
        return True
    if " " in lk or "/" in lk or "&" in lk:
        return True
    return False


def _add_domain_list_matches(text: str, text_lower: str, skills: Set[str], keywords: List[str]) -> None:
    for kw in keywords:
        lk = kw.strip().lower()
        if not lk:
            continue
        if _domain_keyword_is_substring_scan(kw):
            if lk in text_lower:
                skills.add(_domain_keyword_display(lk))
        elif _keyword_boundary_pattern(lk).search(text):
            skills.add(_domain_keyword_display(lk))


def _extract_language_lines_skills(text: str, skills: Set[str]) -> None:
    """
    Pick up languages from proficiency lines (e.g. 'Arabic: fluent') and
    from headings like 'Languages: Arabic, French'.
    """
    lang_union = "|".join(re.escape(w) for w in sorted(_LANGUAGE_KEYWORDS, key=len, reverse=True))
    if lang_union:
        # e.g. Arabic: fluent, French — native
        for m in re.finditer(rf"(?i)\b({lang_union})\s*:\s*([^\n,;]+)", text):
            lang = m.group(1).strip().lower()
            if lang in _LANGUAGE_KEYWORDS:
                skills.add(lang.title())

    for m in re.finditer(
        r"(?i)\blanguages?\b\s*:?\s*([^\n]+)",
        text,
    ):
        tail = m.group(1)
        # Trim common trailing clause separators
        tail = re.split(r"\n|(?i)\b(proficiency|skills|experience)\b", tail, maxsplit=1)[0]
        for part in re.split(r"[,;·|/]", tail):
            chunk = re.sub(r'^[\d\.\-\s\*"]+', "", part).strip()
            if not chunk:
                continue
            chunk = re.sub(r"\s*\([^)]*\)\s*$", "", chunk).strip()
            first = re.split(r"[\s\-–—(/]", chunk, maxsplit=1)[0].strip().lower()
            if first in _LANGUAGE_KEYWORDS:
                skills.add(first.title())
            else:
                for lang in _LANGUAGE_KEYWORDS:
                    if re.search(rf"(?i)\b{re.escape(lang)}\b", chunk):
                        skills.add(lang.title())


def _keyword_boundary_pattern(keyword: str) -> re.Pattern:
    """Match keyword as its own token (avoids 'java' in 'javascript', 'go' in 'mongodb')."""
    return re.compile(
        r"(?<![A-Za-z0-9])" + re.escape(keyword) + r"(?![A-Za-z0-9])",
        re.IGNORECASE,
    )


def fallback_extract_skills(cv_text: str) -> List[str]:
    """
    Extract likely skills from CV text when the external API is unavailable or
    returns nothing parseable. Uses keyword / phrase matching and light splitting.
    """
    if not cv_text or not cv_text.strip():
        return []
    text = cv_text.strip()
    text_lower = text.lower()
    skills: Set[str] = set()

    for phrase in _FALLBACK_PHRASES:
        if phrase in text_lower:
            skills.add(phrase.title())

    for kw in _FALLBACK_KEYWORDS:
        if _keyword_boundary_pattern(kw).search(text):
            label = _FALLBACK_LABEL.get(kw, kw.replace(" ", " ").title())
            skills.add(label)

    # Comma / semicolon / pipe / slash chunks (e.g. "Python / Django / React")
    for part in re.split(r"[,;|•/]+", text):
        p = re.sub(r"^[\d\.\-\s\*]+", "", part).strip()
        if 2 <= len(p) <= 55:
            pl = p.lower()
            for kw in _FALLBACK_KEYWORDS:
                if pl == kw or pl.startswith(kw + " ") or pl.startswith(kw + "("):
                    label = _FALLBACK_LABEL.get(kw, kw.title())
                    skills.add(label)
                    break

    # Parenthesized tech lists: "stack (A, B, C)"
    for m in re.finditer(r"\(([^)]{3,120})\)", text):
        inner = m.group(1)
        for part in re.split(r"[,;/|]+", inner):
            p = re.sub(r"^[\d\.\-\s\*]+", "", part).strip()
            if 2 <= len(p) <= 55:
                pl = p.lower()
                for kw in _FALLBACK_KEYWORDS:
                    if pl == kw or pl.startswith(kw + " "):
                        skills.add(_FALLBACK_LABEL.get(kw, kw.title()))
                        break

    # Title-case single tokens that are known skills (PDFs with proper casing)
    for m in re.finditer(r"\b([A-Z][a-z]+)\b", text):
        word = m.group(1).strip()
        wl = word.lower()
        if wl in _FALLBACK_KEYWORDS and wl not in ("go", "r"):
            skills.add(_FALLBACK_LABEL.get(wl, word))

    # NGO / healthcare / business / languages (non-tech CVs)
    _add_domain_list_matches(text, text_lower, skills, _NGO_KEYWORDS)
    _add_domain_list_matches(text, text_lower, skills, _HEALTH_KEYWORDS)
    _add_domain_list_matches(text, text_lower, skills, _BUSINESS_KEYWORDS)
    _add_domain_list_matches(text, text_lower, skills, _LANGUAGE_KEYWORDS)
    _extract_language_lines_skills(text, skills)

    out = sorted(skills, key=str.lower)
    return normalize_skills_list(out)[:50]


def parse_skills_from_response(api_response: str) -> List[str]:
    """
    Parse skills from the API response string.

    The API should return a Python list format like: ['skill1', 'skill2', ...]
    This function extracts and cleans the skills.

    Args:
        api_response: Raw response string from the API

    Returns:
        List[str]: List of extracted skills
    """
    if not api_response or not api_response.strip():
        return []

    import ast

    t = api_response.strip()
    # Strip markdown fences if the model ignored "no fences"
    t = re.sub(r"^```(?:python|json)?\s*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s*```\s*$", "", t).strip()

    # Prefer a balanced [...] slice, then literal_eval (handles unquoted ints etc.)
    bracket = re.search(r"\[[\s\S]*\]", t)
    if bracket:
        blob = bracket.group(0)
        try:
            val = ast.literal_eval(blob)
            if isinstance(val, list):
                out = [str(x).strip() for x in val if str(x).strip()]
                if out:
                    return normalize_skills_list(out)
        except (ValueError, SyntaxError, TypeError):
            pass
        list_content = bracket.group(0)[1:-1]
        skills = re.findall(r"['\"]([^'\"]+)['\"]", list_content)
        skills = [skill.strip() for skill in skills if skill.strip()]
        if skills:
            return normalize_skills_list(skills)

    # If no list found, try to extract skills from bullet points or lines
    lines = t.split("\n")
    skills = []
    for line in lines:
        line = line.strip()
        line = re.sub(r"^[-*•\d.\s]+", "", line)
        if line and len(line) > 2:
            skills.append(line)

    return normalize_skills_list(skills) if skills else []

