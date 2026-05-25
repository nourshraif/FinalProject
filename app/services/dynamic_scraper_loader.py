import re
from urllib.parse import urlparse
from app.database.db import get_connection
from app.services.Scrapers.arbeitnow import ArbeitnowScraper
from app.services.Scrapers.bayt import BaytScraper
from app.services.Scrapers.himalayas import HimalayasScraper
from app.services.Scrapers.indeed import IndeedScraper
from app.services.Scrapers.linkedin import LinkedInScraper
from app.services.Scrapers.remoteok import RemoteOkScraper
from app.services.Scrapers.remotive import RemotiveScraper
from app.services.Scrapers.weworkremotely import WeWorkRemotelyScraper
from app.services.Scrapers.justremote import JustRemoteScraper
from app.services.Scrapers.nodesk import NoDeskScraper
from app.services.Scrapers.pangian import PangianScraper
from app.services.Scrapers.powertofly import PowerToFlyScraper
from app.services.Scrapers.remoteco import RemoteCoScraper
from app.services.Scrapers.remoter import RemotersScraper
from app.services.Scrapers.wellfound import WellfoundScraper
from app.services.Scrapers.workingnomads import WorkingNomadsScraper
from app.services.Scrapers.hirelebanese_scraper import scrape_hirelebanese
from app.services.Scrapers.careersandjobsinlebanon_scraper import scrape_careersandjobsinlebanon

SCRAPER_MAP = {
    "weworkremotely": WeWorkRemotelyScraper,
    "linkedin": LinkedInScraper,
    "remotive": RemotiveScraper,
    "remoteok": RemoteOkScraper,
    "arbeitnow": ArbeitnowScraper,
    "himalayas": HimalayasScraper,
    "bayt": BaytScraper,
    "indeed": IndeedScraper,
    "justremote": JustRemoteScraper,
    "nodesk": NoDeskScraper,
    "pangian": PangianScraper,
    "powertofly": PowerToFlyScraper,
    "remoteco": RemoteCoScraper,
    "remoters": RemotersScraper,
    "wellfound": WellfoundScraper,
    "workingnomads": WorkingNomadsScraper,
    "hirelebanese": scrape_hirelebanese,
    "careersandjobsinlebanon": scrape_careersandjobsinlebanon,
    # alias keys
    "remote_ok": RemoteOkScraper,
    "we_work_remotely": WeWorkRemotelyScraper,
    "hire_lebanese": scrape_hirelebanese,
    "careers_and_jobs_in_lebanon": scrape_careersandjobsinlebanon,
    "careersandjobs": scrape_careersandjobsinlebanon,
    "careers_and_jobs": scrape_careersandjobsinlebanon,
    "indeed_com": IndeedScraper,
    "bayt_com": BaytScraper,
    "linkedin_com": LinkedInScraper,
    "remoteok_com": RemoteOkScraper,
    "remotive_com": RemotiveScraper,
    "weworkremotely_com": WeWorkRemotelyScraper,
}


def _scrape_source(scraper_or_func):
    if callable(scraper_or_func):
        return scraper_or_func()
    elif hasattr(scraper_or_func, "scrape"):
        return scraper_or_func.scrape()
    elif hasattr(scraper_or_func, "scrape_jobs"):
        return scraper_or_func.scrape_jobs()
    raise RuntimeError("Unsupported scraper implementation")


def normalize_source_key(value: str) -> str:
    if not value:
        return ""
    normalized = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return normalized


def extract_base_key(base_url: str) -> str:
    if not base_url:
        return ""
    parsed = urlparse(base_url if base_url.startswith("http") else f"https://{base_url}")
    domain = parsed.netloc or parsed.path
    domain = domain.lower().replace("www.", "")
    return normalize_source_key(domain)


def run_active_scrapers():
    conn = get_connection()
    cur = conn.cursor()

    try:
        # Get active sources
        cur.execute("""
            SELECT id, source_name, source_key, base_url
            FROM scraper_sources
            WHERE is_active = TRUE;
        """)

        rows = cur.fetchall()

        all_jobs = []

        for row in rows:
            source_id, source_name, source_key, base_url = row
            source_key = normalize_source_key(source_key)
            source_name_value = normalize_source_key(source_name)
            base_url_key = extract_base_key(base_url)

            scraper_impl = (
                SCRAPER_MAP.get(source_key)
                or SCRAPER_MAP.get(source_name_value)
                or SCRAPER_MAP.get(base_url_key)
            )

            if not scraper_impl:
                print(
                    f"No scraper found for source_key={source_key} "
                    f"source_name={source_name_value} base_url={base_url_key}"
                )
                continue

            try:
                if isinstance(scraper_impl, type):
                    scraper = scraper_impl()
                else:
                    scraper = scraper_impl

                jobs = _scrape_source(scraper)
                print(f"✓ {source_name}: {len(jobs)} jobs")
                all_jobs.extend(jobs)

            except Exception as e:
                print(f"Error in {source_name}: {e}")

        return all_jobs

    finally:
        cur.close()
        conn.close()