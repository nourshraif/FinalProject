import sys
from pathlib import Path
import logging

project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def run_scheduled_scrape():
    """Main entry point for batch scraper — collects AND saves to DB."""
    try:
        from app.services.scraper_service import scrape_jobs

        results = scrape_jobs()
        logger.info(
            f"Pipeline complete — fetched: {results['collected']}, "
            f"saved: {results['saved']}, "
            f"duplicates: {results['duplicates']}, "
            f"errors: {results['errors']}"
        )
        return 0

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(run_scheduled_scrape())