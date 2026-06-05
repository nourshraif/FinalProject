# api/job_alerts_scheduler.py

import os
import sys
from pathlib import Path
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

# Add project root to path
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =========================================================
# MATCH SCORE FUNCTION
# =========================================================

def calculate_match_score(user_skills: list, job: dict) -> float:
    if not user_skills or not job.get("description"):
        return 0.0

    job_text = (
        (job.get("job_title", "") or "")
        + " "
        + (job.get("description", "") or "")
        + " "
        + (job.get("company", "") or "")
    ).lower()

    matched = sum(
        1 for skill in user_skills
        if skill and (str(skill).lower() in job_text)
    )

    return (matched / len(user_skills)) * 100 if user_skills else 0.0


# =========================================================
# BATCH SCRAPER JOB
# =========================================================

def run_batch_scraper_job():
    """Run full scrape pipeline: fetch, validate, dedupe, save to DB, embeddings."""
    logger.info("[SCHEDULER] Starting nightly batch job scraper...")

    try:
        from app.services.scraper_service import scrape_jobs

        results = scrape_jobs()
        logger.info(
            "[SCHEDULER] Batch scraper finished — fetched=%s saved=%s duplicates=%s errors=%s",
            results.get("collected", 0),
            results.get("saved", 0),
            results.get("duplicates", 0),
            results.get("errors", 0),
        )
    except Exception as e:
        logger.error(f"[SCHEDULER] Batch scraper failed: {e}", exc_info=True)


# =========================================================
# DAILY ALERTS
# =========================================================

def run_daily_alerts():
    logger.info("Running daily job alerts...")

    try:
        from app.database.db import (
            get_users_for_alerts,
            get_new_jobs_since,
            mark_jobs_as_alerted,
            get_already_alerted_job_ids,
        )

        from api.email_service import send_job_alert_email
        from datetime import datetime, timedelta

        since = datetime.now() - timedelta(hours=24)
        new_jobs = get_new_jobs_since(since)

        if not new_jobs:
            logger.info("No new jobs found")
            return

        logger.info(f"Found {len(new_jobs)} new jobs")

        users = get_users_for_alerts()
        logger.info(f"Processing alerts for {len(users)} users")

        for user in users:

            try:
                if user.get("frequency") not in ("immediate", "daily"):
                    continue

                already_sent = get_already_alerted_job_ids(user["id"])

                unsent_jobs = [
                    j for j in new_jobs
                    if j["id"] not in already_sent
                ]

                if not unsent_jobs:
                    continue

                skills = user.get("skills") or []

                if not skills:
                    continue

                scored_jobs = []

                for job in unsent_jobs:

                    score = calculate_match_score(skills, job)

                    if score >= user.get("min_match_score", 70):
                        scored_jobs.append({
                            **job,
                            "match_score": score
                        })

                if not scored_jobs:
                    continue

                scored_jobs.sort(
                    key=lambda x: x["match_score"],
                    reverse=True
                )

                top_jobs = scored_jobs[:5]

                sent = send_job_alert_email(
                    user["email"],
                    user.get("full_name") or user["email"],
                    top_jobs,
                )

                if sent:
                    job_ids = [j["id"] for j in top_jobs]

                    mark_jobs_as_alerted(user["id"], job_ids)

                    logger.info(
                        f"Sent {len(top_jobs)} job alerts to {user['email']}"
                    )

            except Exception as e:
                logger.error(
                    f"Error processing user {user.get('email', '?')}: {e}"
                )
                continue

        logger.info("Daily alerts completed")

    except Exception as e:
        logger.error(f"Alert job failed: {e}")


# =========================================================
# WEEKLY ALERTS
# =========================================================

def run_weekly_alerts():
    logger.info("Running weekly job alerts...")

    try:
        from app.database.db import (
            get_users_for_alerts,
            get_new_jobs_since,
            mark_jobs_as_alerted,
            get_already_alerted_job_ids,
        )

        from api.email_service import send_job_alert_email
        from datetime import datetime, timedelta

        since = datetime.now() - timedelta(days=7)

        new_jobs = get_new_jobs_since(since)

        if not new_jobs:
            return

        users = [
            u for u in get_users_for_alerts()
            if u.get("frequency") == "weekly"
        ]

        for user in users:

            try:
                already_sent = get_already_alerted_job_ids(user["id"])

                unsent_jobs = [
                    j for j in new_jobs
                    if j["id"] not in already_sent
                ]

                if not unsent_jobs:
                    continue

                skills = user.get("skills") or []

                if not skills:
                    continue

                scored_jobs = []

                for job in unsent_jobs:

                    score = calculate_match_score(skills, job)

                    if score >= user.get("min_match_score", 70):
                        scored_jobs.append({
                            **job,
                            "match_score": score
                        })

                if not scored_jobs:
                    continue

                scored_jobs.sort(
                    key=lambda x: x["match_score"],
                    reverse=True
                )

                top_jobs = scored_jobs[:10]

                sent = send_job_alert_email(
                    user["email"],
                    user.get("full_name") or user["email"],
                    top_jobs,
                )

                if sent:
                    job_ids = [j["id"] for j in top_jobs]

                    mark_jobs_as_alerted(user["id"], job_ids)

                    logger.info(
                        f"Weekly alerts sent to {user['email']}"
                    )

            except Exception as e:
                logger.error(f"Weekly alert error: {e}")
                continue

    except Exception as e:
        logger.error(f"Weekly alerts failed: {e}")


# =========================================================
# NIGHTLY CLEANUP
# =========================================================

def run_cleanup_job():
    """
    Remove or archive stale jobs nightly.
    - Scraped jobs not re-seen in 30 days are marked inactive, then deleted
      unless a user has saved them.
    - Company-posted jobs older than 30 days (with no explicit expiry) and
      explicitly deactivated/expired postings are removed; postings that still
      have active applications are only soft-deleted to preserve the records.
    """
    logger.info("[SCHEDULER] Starting nightly job cleanup...")
    try:
        from app.database.db import (
            remove_inactive_or_expired_jobs,
            purge_old_archive_data,
            cleanup_old_notifications,
        )

        # 1. Expire stale/old jobs and archive their metadata
        result = remove_inactive_or_expired_jobs()
        logger.info(
            "[SCHEDULER] Job cleanup — "
            "stale_scraped=%s archived=%s deleted=%s | "
            "expired_posted=%s archived=%s deleted=%s",
            result.get("marked_stale_scraped", 0),
            result.get("archived_scraped", 0),
            result.get("deleted_scraped", 0),
            result.get("marked_expired_posted", 0),
            result.get("archived_posted", 0),
            result.get("deleted_posted", 0),
        )

        # 2. Purge archive rows older than 6 months
        purge = purge_old_archive_data()
        logger.info(
            "[SCHEDULER] Archive purge — scraped=%s posted=%s",
            purge.get("purged_archived_jobs", 0),
            purge.get("purged_archived_posted", 0),
        )

        # 3. Delete stale notifications
        notif_deleted = cleanup_old_notifications()
        logger.info("[SCHEDULER] Notifications pruned — deleted=%s", notif_deleted)

    except Exception as e:
        logger.error("[SCHEDULER] Cleanup job failed: %s", e, exc_info=True)


# =========================================================
# CREATE SCHEDULER
# =========================================================

def create_scheduler():
    """Create scheduler with all background jobs"""

    scheduler = BackgroundScheduler()

    # -----------------------------------------------------
    # NIGHTLY BATCH SCRAPER
    # -----------------------------------------------------
    scheduler.add_job(
        run_batch_scraper_job,
        CronTrigger(hour=2, minute=0),
        id="batch_job_scraper",
        name="Batch Job Ingestion (Nightly)",
        replace_existing=True,
    )

    # -----------------------------------------------------
    # DAILY ALERTS
    # -----------------------------------------------------
    scheduler.add_job(
        run_daily_alerts,
        CronTrigger(hour=8, minute=0),
        id="daily_alerts",
        name="Daily Job Alerts",
        replace_existing=True,
    )

    # -----------------------------------------------------
    # WEEKLY ALERTS
    # -----------------------------------------------------
    scheduler.add_job(
        run_weekly_alerts,
        CronTrigger(day_of_week="mon", hour=9, minute=0),
        id="weekly_alerts",
        name="Weekly Job Alerts",
        replace_existing=True,
    )

    # -----------------------------------------------------
    # NIGHTLY CLEANUP (stale / expired jobs)
    # -----------------------------------------------------
    scheduler.add_job(
        run_cleanup_job,
        CronTrigger(hour=3, minute=0),
        id="nightly_cleanup",
        name="Nightly Job Lifecycle Cleanup",
        replace_existing=True,
    )

    logger.info("✓ Batch scraper scheduled for 2:00 AM daily")
    logger.info("✓ Daily alerts scheduled for 8:00 AM daily")
    logger.info("✓ Weekly alerts scheduled for Monday 9:00 AM")
    logger.info("✓ Nightly cleanup scheduled for 3:00 AM daily")

    return scheduler