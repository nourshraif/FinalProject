"""
Automatic Job Scraper - Runs on Container Startup

This script runs the complete scraping pipeline automatically:
1. Scrapes jobs from all configured sources
2. Saves jobs to database
3. Generates embeddings automatically (via scraper_service integration)

DESIGNED FOR AUTOMATED EXECUTION:
- Runs non-interactively (no user input required)
- Idempotent (safe to run multiple times)
- Runs once on Docker container startup
- Logs all operations for monitoring
- Exits cleanly after completion

USAGE:

Docker (Primary Method):
    docker compose up
    - Scraper runs automatically when container starts
    - Runs once and exits
    - Database is populated and ready for UI

Manual Execution (Testing):
    python -m scripts.scheduled_scraper
    - Useful for testing or manual runs
    - Exits after completion

FUTURE ENHANCEMENTS:
- Periodic scheduling (cron/task scheduler) can be added for production
- For now, scraping runs once on container startup

EXIT CODES:
- 0: Success
- 1: Error (check logs)
"""

import sys
import io
import logging
from pathlib import Path
from datetime import datetime

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add project root to path
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Ensure logs directory exists
logs_dir = project_root / 'logs'
logs_dir.mkdir(exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(logs_dir / 'scraper.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

from app.services.scraper_service import scrape_jobs
from app.database.db import get_connection


def run_scheduled_scrape():
    """
    Run the complete scraping pipeline.
    
    This function:
    - Scrapes jobs from all sources
    - Saves them to database (with automatic embedding generation)
    - Handles errors gracefully
    - Returns exit code for scheduling systems
    
    Returns:
        int: Exit code (0 for success, 1 for error)
    """
    start_time = datetime.now()
    logger.info("=" * 70)
    logger.info("Starting scheduled job scraping")
    logger.info(f"Started at: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 70)
    
    try:
        # Verify database connection
        logger.info("Verifying database connection...")
        conn = get_connection()
        conn.close()
        logger.info("✓ Database connection verified")
        
        # Run scraping pipeline
        # Note: Embeddings are automatically generated during scraping
        # (see scraper_service.py save_job method)
        logger.info("Running scraping pipeline...")
        results = scrape_jobs()
        
        # Log summary
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        logger.info("=" * 70)
        logger.info("Scraping completed successfully")
        logger.info(f"Duration: {duration:.1f} seconds")
        logger.info(f"Jobs collected: {results.get('collected', 0)}")
        logger.info(f"Jobs saved: {results.get('saved', 0)}")
        logger.info(f"Completed at: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("=" * 70)
        
        return 0  # Success
        
    except Exception as e:
        logger.error("=" * 70)
        logger.error("Scraping failed with error", exc_info=True)
        logger.error(f"Error: {str(e)}")
        logger.error(f"Failed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.error("=" * 70)
        return 1  # Error


if __name__ == "__main__":
    """
    Entry point for automatic execution on container startup.
    
    PRIMARY USAGE: Docker Container Startup
    - Configured in docker-compose.yml
    - Runs automatically when container starts
    - Executes once and exits cleanly
    - Database is populated and ready for UI
    
    The script will:
    1. Verify database connection
    2. Scrape jobs from all configured sources
    3. Save jobs to database (duplicates automatically skipped)
    4. Automatically generate embeddings for new jobs
    5. Log all operations
    6. Exit with appropriate code
    
    After completion:
    - Container exits (restart: "no" in docker-compose)
    - Database contains fresh jobs with embeddings
    - UI can be started and will work immediately
    """
    # Run scraping
    exit_code = run_scheduled_scrape()
    
    # Exit with appropriate code
    # 0 = success, 1 = error
    sys.exit(exit_code)
