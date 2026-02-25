"""Run the scraping pipeline: scrape jobs, save to DB, generate embeddings. Usage: python -m scripts.scheduled_scraper"""

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
    """Scrape all sources, save to DB, generate embeddings. Returns 0 on success, 1 on error."""
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
    sys.exit(run_scheduled_scrape())
