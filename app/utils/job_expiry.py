"""Detect expired job listings from scraped HTML/text (WP Job Manager and similar)."""

from __future__ import annotations

import re
from typing import Any, Optional

# Phrases seen on careersandjobsinlebanon.com and similar WP Job Manager sites.
_EXPIRED_TEXT_PATTERNS = (
    r"this\s+listing\s+has\s+expired",
    r"this\s+job\s+has\s+expired",
    r"this\s+position\s+has\s+expired",
    r"job\s+listing\s+has\s+expired",
    r"listing\s+is\s+no\s+longer\s+available",
    r"no\s+longer\s+accepting\s+applications",
)

_EXPIRED_COMPILED = [re.compile(p, re.IGNORECASE) for p in _EXPIRED_TEXT_PATTERNS]


def is_expired_listing_text(text: Optional[str]) -> bool:
    """True when page body/description indicates the source site marked the job expired."""
    if not text or not str(text).strip():
        return False
    normalized = " ".join(str(text).split())
    return any(p.search(normalized) for p in _EXPIRED_COMPILED)


def is_expired_listing_soup(soup: Any) -> bool:
    """Check common WP Job Manager / theme markers before parsing fields."""
    if soup is None:
        return False

    for selector in (
        ".job-manager-expired",
        ".job_listing-expired",
        ".expired-job",
        "[data-expired='true']",
    ):
        if soup.select_one(selector):
            return True

    for node in soup.select(".job-listing-meta, .entry-content, .job_description, article"):
        if is_expired_listing_text(node.get_text(" ", strip=True)):
            return True

    return is_expired_listing_text(soup.get_text(" ", strip=True))
