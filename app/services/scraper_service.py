# app/services/scraper_service.py

import time
import logging
from typing import List, Dict
from app.services.Scrapers import get_all_scrapers
from app.services.Scrapers.hirelebanese_scraper import scrape_hirelebanese
from app.services.Scrapers.careersandjobsinlebanon_scraper import (
    scrape_careersandjobsinlebanon,
)
from app.database.db import get_connection
from app.services.embedding_service import generate_and_save_embedding

logger = logging.getLogger(__name__)


def normalize_source(source: str) -> str:
    mapping = {
        "hirelebanese": "HireLebanese",
        "hire_lebanese": "HireLebanese",
        "weworkremotely": "WeWorkRemotely",
        "we_work_remotely": "WeWorkRemotely",
        "remoteok": "RemoteOK",
        "remote_ok": "RemoteOK",
        "remotive": "Remotive",
        "himalayas": "Himalayas",
        "arbeitnow": "Arbeitnow",
        "bayt": "Bayt",
        "linkedin": "LinkedIn",
        "indeed": "Indeed",
        "careersandjobs": "CareersAndJobsInLebanon",
        "careers_and_jobs": "CareersAndJobsInLebanon",
        "careersandjobsinlebanon": "CareersAndJobsInLebanon",
        "careers_and_jobs_in_lebanon": "CareersAndJobsInLebanon",
    }
    src = str(source or "").strip()
    return mapping.get(src.lower(), src)


class ScraperService:
    """Service for orchestrating job scraping and saving to database."""
    
    def __init__(self, db_connection):
        self.conn = db_connection
        self.cur = self.conn.cursor()
        self.scrapers = get_all_scrapers()
        self.jobs_saved = 0
    
    def scrape_web_sources(self, delay_seconds: int = 2) -> List[Dict]:
        """Scrape all web sources."""
        all_jobs = []
        
        print(f"\n{'='*70}")
        print(f"🚀 Scraping {len(self.scrapers)} job boards")
        print(f"{'='*70}")
        
        for scraper in self.scrapers:
            try:
                jobs = scraper.scrape()
                all_jobs.extend(jobs)
                print(f"  ✓ {scraper.source_name}: {len(jobs)} jobs")
                time.sleep(delay_seconds)
            except Exception as e:
                print(f"  ✗ {scraper.source_name}: {e}")
        
        try:
            logger.info("Scraping HireLebanese...")
            hl_jobs = scrape_hirelebanese()
            all_jobs += hl_jobs
            logger.info(f"HireLebanese: {len(hl_jobs)} jobs")
        except Exception as e:
            logger.error(f"HireLebanese scraper failed: {e}")

        try:
            logger.info("Scraping CareersAndJobsInLebanon...")
            cjl_jobs = scrape_careersandjobsinlebanon()
            all_jobs += cjl_jobs
            logger.info(f"CareersAndJobsInLebanon: {len(cjl_jobs)} jobs")
        except Exception as e:
            logger.error(f"CareersAndJobsInLebanon scraper failed: {e}")
        
        print(f"\n{'='*70}")
        print(f"✅ Total collected: {len(all_jobs)} jobs")
        print(f"{'='*70}\n")
        
        return all_jobs
    
    def save_job(self, job_data: dict) -> bool:
        """Save a single job to database.
        
        Returns:
            True if job was inserted, False if duplicate or error
        """
        try:
            # Validate required fields
            url = job_data.get('url')
            title = job_data.get('title')
            if not url or not title:
                logger.debug(f"Skipping job - missing url or title: url={bool(url)}, title={bool(title)}")
                return False
            
            # Ensure values are strings and not None before slicing
            title_str = str(title) if title else ''
            company_str = str(job_data.get('company', '')) if job_data.get('company') else ''
            location_str = str(job_data.get('location', 'Remote')) if job_data.get('location', 'Remote') else 'Remote'
            
            source_name = normalize_source(job_data.get("source", ""))

            self.cur.execute("""
                INSERT INTO jobs (source, job_title, company, location, description, job_url, scraped_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (job_url) DO UPDATE SET
                  source = EXCLUDED.source,
                  job_title = EXCLUDED.job_title,
                  company = EXCLUDED.company,
                  location = EXCLUDED.location,
                  description = EXCLUDED.description,
                  scraped_at = NOW()
                RETURNING id;
            """, (
                source_name,
                title_str[:255],
                company_str[:255],
                location_str[:255],
                job_data.get('description', ''),
                url
            ))
            
            result = self.cur.fetchone()
            if result:
                # Upserted job (new or existing) - commit so row is persisted even if embedding fails
                job_id = result[0]
                self.jobs_saved += 1
                self.conn.commit()
                
                # Generate embedding for the new job (failure won't remove the job)
                try:
                    generate_and_save_embedding(
                        cursor=self.cur,
                        connection=self.conn,
                        job_id=job_id,
                        title=title_str,
                        company=company_str,
                        location=location_str if location_str != 'Remote' else None,
                        description=job_data.get('description', '')
                    )
                except Exception as e:
                    # Log error but don't fail - job is already saved
                    logger.warning(f"Failed to generate embedding for job {job_id}: {e}")
                
                if self.jobs_saved % 10 == 0:
                    print(f"  💾 Saved {self.jobs_saved} jobs...")
                return True
            else:
                # Defensive fallback; RETURNING id should always return a row for upsert.
                return False
            
        except Exception as e:
            logger.error(f"Error saving job (URL: {job_data.get('url', 'N/A')[:50]}): {e}", exc_info=True)
            try:
                self.conn.rollback()
            except Exception:
                pass
            return False
    
    def save_jobs_batch(self, jobs: List[Dict]) -> int:
        """Save multiple jobs to database."""
        saved_count = 0
        skipped_count = 0
        for job in jobs:
            result = self.save_job(job)
            if result:
                saved_count += 1
            else:
                # Check if it was skipped due to duplicate or error
                if job.get('url') and job.get('title'):
                    skipped_count += 1
        
        if skipped_count > 0:
            print(f"  ⚠️  Skipped {skipped_count} jobs (duplicates or errors)")
        return saved_count
    
    def scrape_all_sources(self) -> Dict[str, int]:
        """Main method - scrape and save."""
        print(f"\n{'='*70}")
        print("🚀 Starting job scraping")
        print(f"{'='*70}\n")
        
        try:
            # Scrape
            all_jobs = self.scrape_web_sources()
            
            # Save
            print(f"💾 Saving {len(all_jobs)} jobs to database...")
            saved = self.save_jobs_batch(all_jobs)
            duplicates = len(all_jobs) - saved
            
            # Commit
            self.conn.commit()
            print(f"✅ Committed to database")
            if duplicates > 0:
                print(f"   ({duplicates} jobs were duplicates and skipped)")
            print()
            
            # Stats
            self._print_stats()
            
            return {'collected': len(all_jobs), 'saved': saved}
        except Exception as e:
            # Rollback on error
            self.conn.rollback()
            logger.error(f"Error during scraping: {e}", exc_info=True)
            print(f"❌ Error occurred, transaction rolled back: {e}")
            raise
    
    def _print_stats(self):
        """Print database statistics."""
        try:
            self.cur.execute("""
                SELECT source, COUNT(*) 
                FROM jobs 
                GROUP BY source 
                ORDER BY COUNT(*) DESC
            """)
            
            print(f"{'='*70}")
            print("📊 Database Statistics:")
            print(f"{'='*70}")
            
            for source, count in self.cur.fetchall():
                bar = "█" * min(50, count // 10)
                print(f"  {source:20s} [{count:4d}] {bar}")
            
            self.cur.execute("SELECT COUNT(*) FROM jobs")
            total = self.cur.fetchone()[0]
            print(f"\n  {'TOTAL':20s} [{total:4d}]")
            print(f"{'='*70}\n")
            
        except Exception as e:
            print(f"Error getting stats: {e}")
    
    def close(self):
        """Close database connections."""
        try:
            if self.cur:
                self.cur.close()
        except Exception as e:
            logger.warning(f"Error closing cursor: {e}")
        
        try:
            if self.conn:
                self.conn.close()
        except Exception as e:
            logger.warning(f"Error closing connection: {e}")


def scrape_jobs():
    """
    Convenience function to run the scraper service.
    Initializes database connection, runs scraping, and cleans up.
    """
    conn = None
    service = None
    try:
        # Get database connection
        conn = get_connection()
        
        # Initialize service
        service = ScraperService(conn)
        
        # Run scraping
        results = service.scrape_all_sources()
        
        print(f"\n{'='*70}")
        print(f"🎉 Scraping Complete!")
        print(f"   Collected: {results['collected']} jobs")
        print(f"   Saved: {results['saved']} jobs")
        print(f"{'='*70}\n")
        
        return results
        
    except Exception as e:
        logger.error(f"Fatal error in scrape_jobs: {e}", exc_info=True)
        print(f"❌ Fatal error: {e}")
        raise
    finally:
        # Clean up
        if service:
            service.close()
        elif conn:
            try:
                conn.close()
            except Exception:
                pass