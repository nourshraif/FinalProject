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
    """Scheduler wrapper for batch scraper"""
    logger.info("[SCHEDULER] Triggering batch job scraper...")

    try:
        from app.services.dynamic_scraper_loader import run_active_scrapers

        jobs = run_active_scrapers()
        logger.info(f"[SCHEDULER] Batch scraper collected {len(jobs)} jobs")

    except Exception as e:
        logger.error(f"[SCHEDULER] Error: {e}", exc_info=True)


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

    logger.info("✓ Batch scraper scheduled for 2:00 AM daily")
    logger.info("✓ Daily alerts scheduled for 8:00 AM daily")
    logger.info("✓ Weekly alerts scheduled for Monday 9:00 AM")

    return scheduler