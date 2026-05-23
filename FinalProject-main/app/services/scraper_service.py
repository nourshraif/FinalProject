# app/services/scraper_service.py

import time
import logging
from typing import List, Dict, Set
from datetime import datetime
from app.services.Scrapers import get_all_scrapers
from app.services.Scrapers.hirelebanese_scraper import scrape_hirelebanese
from app.services.Scrapers.careersandjobsinlebanon_scraper import (
    scrape_careersandjobsinlebanon,
)
from app.database.db import get_connection
from app.services.embedding_service import generate_and_save_embedding

logger = logging.getLogger(__name__)


def normalize_source(source: str) -> str:
    """Normalize source names for consistency."""
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


class BatchStats:
    """Track statistics across all 3 phases."""
    
    def __init__(self):
        self.phase_start = None
        self.phase_end = None
        
        # Phase 1: Ingestion
        self.sources_processed = 0
        self.total_fetched = 0
        self.source_breakdown = {}
        
        # Phase 2: Processing
        self.total_valid = 0
        self.duplicates_found = 0
        self.enriched = 0
        
        # Phase 3: Storage
        self.total_saved = 0
        self.errors_count = 0
        self.embeddings_generated = 0
        self.embeddings_failed = 0
    
    def log_phase_header(self, phase_num: int, phase_name: str):
        """Log phase start"""
        self.phase_start = datetime.now()
        print(f"\n{'='*80}")
        print(f"📍 PHASE {phase_num}: {phase_name}")
        print(f"{'='*80}")
    
    def log_phase_complete(self):
        """Log phase completion with duration"""
        if self.phase_start:
            duration = (datetime.now() - self.phase_start).total_seconds()
            print(f"✅ Phase completed in {duration:.1f}s\n")
    
    def print_summary(self):
        """Print complete batch summary"""
        print(f"\n{'='*80}")
        print("📊 BATCH INGESTION SUMMARY")
        print(f"{'='*80}")
        
        print(f"\n📥 PHASE 1 (INGESTION):")
        print(f"   Sources processed: {self.sources_processed}")
        print(f"   Total jobs fetched: {self.total_fetched}")
        for source, count in self.source_breakdown.items():
            print(f"     • {source}: {count} jobs")
        
        print(f"\n🔄 PHASE 2 (PROCESSING):")
        print(f"   Jobs validated: {self.total_valid}")
        print(f"   Duplicates found: {self.duplicates_found}")
        print(f"   Jobs enriched: {self.enriched}")
        
        print(f"\n💾 PHASE 3 (STORAGE):")
        print(f"   Jobs saved: {self.total_saved}")
        print(f"   Embeddings generated: {self.embeddings_generated}")
        print(f"   Embeddings failed: {self.embeddings_failed}")
        print(f"   Errors: {self.errors_count}")
        
        print(f"\n{'='*80}\n")


class ScraperService:
    """Service for orchestrating job scraping with batch architecture.
    
    3-Phase Pipeline:
    1. INGESTION - Fetch from all sources
    2. PROCESSING - Validate, deduplicate, enrich
    3. STORAGE - Batch insert to database + embeddings
    """
    
    def __init__(self, db_connection):
        self.conn = db_connection
        self.cur = self.conn.cursor()
        self.scrapers = get_all_scrapers()
        self.stats = BatchStats()
    
    # ══════════════════════════════════════════════════════════════════════════════
    # PHASE 1: DATA INGESTION - Fetch from all sources
    # ══════════════════════════════════════════════════════════════════════════════
    
    def phase1_ingest_from_sources(self, delay_seconds: int = 2) -> List[Dict]:
        """
        PHASE 1: Fetch jobs from all configured sources.
        
        Returns:
            List of raw job dictionaries from all sources
        """
        self.stats.log_phase_header(1, "DATA INGESTION (Fetch from sources)")
        
        all_jobs = []
        
        # Scrape class-based sources
        print(f"🔍 Scraping {len(self.scrapers)} job boards...\n")
        
        for scraper in self.scrapers:
            try:
                jobs = scraper.scrape()
                all_jobs.extend(jobs)
                self.stats.source_breakdown[scraper.source_name] = len(jobs)
                self.stats.sources_processed += 1
                self.stats.total_fetched += len(jobs)
                
                print(f"  ✓ {scraper.source_name:20s} → {len(jobs):4d} jobs")
                time.sleep(delay_seconds)
                
            except Exception as e:
                logger.error(f"Error scraping {scraper.source_name}: {e}", exc_info=True)
                print(f"  ✗ {scraper.source_name:20s} → ERROR: {e}")
        
        # Scrape HireLebanese
        try:
            logger.info("Scraping HireLebanese...")
            hl_jobs = scrape_hirelebanese()
            all_jobs.extend(hl_jobs)
            self.stats.source_breakdown["HireLebanese"] = len(hl_jobs)
            self.stats.sources_processed += 1
            self.stats.total_fetched += len(hl_jobs)
            
            print(f"  ✓ {'HireLebanese':20s} → {len(hl_jobs):4d} jobs")
            time.sleep(delay_seconds)
            
        except Exception as e:
            logger.error(f"HireLebanese scraper failed: {e}")
            print(f"  ✗ {'HireLebanese':20s} → ERROR: {e}")

        # Scrape CareersAndJobsInLebanon
        try:
            logger.info("Scraping CareersAndJobsInLebanon...")
            cjl_jobs = scrape_careersandjobsinlebanon()
            all_jobs.extend(cjl_jobs)
            self.stats.source_breakdown["CareersAndJobsInLebanon"] = len(cjl_jobs)
            self.stats.sources_processed += 1
            self.stats.total_fetched += len(cjl_jobs)
            
            print(f"  ✓ {'CareersAndJobsInLebanon':20s} → {len(cjl_jobs):4d} jobs")
            
        except Exception as e:
            logger.error(f"CareersAndJobsInLebanon scraper failed: {e}")
            print(f"  ✗ {'CareersAndJobsInLebanon':20s} → ERROR: {e}")
        
        print(f"\n📥 PHASE 1 Result: {self.stats.total_fetched} jobs fetched from {self.stats.sources_processed} sources")
        self.stats.log_phase_complete()
        
        return all_jobs
    
    # ══════════════════════════════════════════════════════════════════════════════
    # PHASE 2: DATA PROCESSING - Validate, deduplicate, enrich
    # ══════════════════════════════════════════════════════════════════════════════
    
    def validate_job(self, job: dict) -> bool:
        """Check if job has required fields."""
        url = job.get('url')
        title = job.get('title')
        
        if not url or not title:
            return False
        
        # Additional validation
        if len(str(url).strip()) < 5:
            return False
        if len(str(title).strip()) < 3:
            return False
        
        return True
    
    def phase2_process_jobs(self, raw_jobs: List[Dict]) -> List[Dict]:
        """
        PHASE 2: Validate, deduplicate, and enrich jobs.
        
        Steps:
        1. Validate required fields
        2. Deduplicate by URL (in-memory)
        3. Enrich with metadata
        
        Returns:
            List of processed jobs ready for storage
        """
        self.stats.log_phase_header(2, "DATA PROCESSING (Validate & Deduplicate)")
        
        # Step 1: Validate
        print("✓ Validating jobs...\n")
        valid_jobs = []
        
        for job in raw_jobs:
            if self.validate_job(job):
                valid_jobs.append(job)
                self.stats.total_valid += 1
            else:
                logger.debug(f"Job validation failed: {job}")
        
        print(f"  Validation: {self.stats.total_valid}/{len(raw_jobs)} jobs passed")
        
        # Step 2: Deduplicate by URL
        print("✓ Deduplicating by URL...\n")
        seen_urls: Set[str] = set()
        unique_jobs = []
        
        for job in valid_jobs:
            url = job.get('url')
            if url not in seen_urls:
                seen_urls.add(url)
                unique_jobs.append(job)
            else:
                self.stats.duplicates_found += 1
        
        print(f"  Deduplication: {len(unique_jobs)} unique (removed {self.stats.duplicates_found} duplicates)")
        
        # Step 3: Enrich
        print("✓ Enriching data...\n")
        enriched_jobs = []
        
        for job in unique_jobs:
            try:
                enriched = self.enrich_job(job)
                enriched_jobs.append(enriched)
                self.stats.enriched += 1
            except Exception as e:
                logger.warning(f"Error enriching job: {e}")
        
        print(f"  Enrichment: {self.stats.enriched}/{len(unique_jobs)} jobs enriched")
        print(f"\n🔄 PHASE 2 Result: {len(enriched_jobs)} jobs ready for storage")
        self.stats.log_phase_complete()
        
        return enriched_jobs
    
    def enrich_job(self, job: dict) -> dict:
        """Add metadata and normalize job data."""
        # Ensure values are strings and truncate
        job['title'] = str(job.get('title', ''))[:255]
        job['company'] = str(job.get('company', ''))[:255]
        job['location'] = str(job.get('location', 'Remote'))[:255]
        job['url'] = str(job.get('url', ''))
        job['description'] = str(job.get('description', ''))
        job['source'] = normalize_source(job.get('source', ''))
        job['scraped_at'] = datetime.now().isoformat()
        
        return job
    
    # ══════════════════════════════════════════════════════════════════════════════
    # PHASE 3: DATA STORAGE - Batch insert to database + embeddings
    # ══════════════════════════════════════════════════════════════════════════════
    
    def save_job_to_db(self, job_data: dict) -> bool:
        """Save a single job to database (used by batch insert)."""
        try:
            url = job_data.get('url')
            title = job_data.get('title')
            
            if not url or not title:
                return False
            
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
                job_data.get('source'),
                title,
                job_data.get('company', ''),
                job_data.get('location', 'Remote'),
                job_data.get('description', ''),
                url
            ))
            
            result = self.cur.fetchone()
            if result:
                job_id = result[0]
                
                # Generate embedding (async-safe)
                try:
                    generate_and_save_embedding(
                        cursor=self.cur,
                        connection=self.conn,
                        job_id=job_id,
                        title=title,
                        company=job_data.get('company', ''),
                        location=job_data.get('location', ''),
                        description=job_data.get('description', '')
                    )
                    self.stats.embeddings_generated += 1
                    
                except Exception as e:
                    logger.warning(f"Failed to generate embedding for job {job_id}: {e}")
                    self.stats.embeddings_failed += 1
                
                self.stats.total_saved += 1
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error saving job: {e}", exc_info=True)
            self.stats.errors_count += 1
            return False
    
    def phase3_store_jobs(self, processed_jobs: List[Dict], batch_size: int = 50) -> int:
        """
        PHASE 3: Batch insert jobs to database with embeddings.
        
        Inserts in chunks of batch_size for efficiency.
        
        Returns:
            Number of jobs successfully saved
        """
        self.stats.log_phase_header(3, "DATA STORAGE (Batch insert to DB)")
        
        print(f"💾 Inserting {len(processed_jobs)} jobs in batches of {batch_size}...\n")
        
        for i in range(0, len(processed_jobs), batch_size):
            batch = processed_jobs[i:i+batch_size]
            batch_num = (i // batch_size) + 1
            
            for job in batch:
                self.save_job_to_db(job)
            
            # Commit batch
            try:
                self.conn.commit()
                print(f"  ✓ Batch {batch_num:2d}: {len(batch):3d} jobs inserted, {self.stats.embeddings_generated} embeddings")
            except Exception as e:
                logger.error(f"Error committing batch {batch_num}: {e}")
                self.conn.rollback()
                self.stats.errors_count += 1
        
        print(f"\n💾 PHASE 3 Result: {self.stats.total_saved} jobs saved to database")
        print(f"   Embeddings: {self.stats.embeddings_generated} generated, {self.stats.embeddings_failed} failed")
        self.stats.log_phase_complete()
        
        return self.stats.total_saved
    
    # ══════════════════════════════════════════════════════════════════════════════
    # MAIN ORCHESTRATION - Run all 3 phases
    # ══════════════════════════════════════════════════════════════════════════════
    
    def scrape_all_sources(self) -> Dict[str, int]:
        """
        Main method: Run complete batch ingestion pipeline.
        
        Pipeline:
        1. INGESTION: Fetch from all sources
        2. PROCESSING: Validate, deduplicate, enrich
        3. STORAGE: Batch insert to DB + embeddings
        
        Returns:
            Dictionary with stats: {'collected': N, 'saved': M, 'duplicates': D}
        """
        print(f"\n{'='*80}")
        print(f"🚀 BATCH JOB INGESTION PIPELINE")
        print(f"{'='*80}")
        
        try:
            # Phase 1: Ingest
            raw_jobs = self.phase1_ingest_from_sources(delay_seconds=2)
            
            # Phase 2: Process
            processed_jobs = self.phase2_process_jobs(raw_jobs)
            
            # Phase 3: Store
            self.phase3_store_jobs(processed_jobs, batch_size=50)
            
            # Print final summary
            self.stats.print_summary()
            
            # Print database stats
            self._print_db_stats()
            
            result = {
                'collected': self.stats.total_fetched,
                'saved': self.stats.total_saved,
                'duplicates': self.stats.duplicates_found,
                'errors': self.stats.errors_count
            }
            
            print(f"✅ Pipeline completed successfully!")
            return result
            
        except Exception as e:
            logger.error(f"Error during scraping pipeline: {e}", exc_info=True)
            self.conn.rollback()
            print(f"\n❌ Pipeline failed: {e}")
            raise
    
    def _print_db_stats(self):
        """Print current database statistics."""
        try:
            self.cur.execute("""
                SELECT source, COUNT(*) 
                FROM jobs 
                GROUP BY source 
                ORDER BY COUNT(*) DESC
            """)
            
            print(f"{'='*80}")
            print("📈 CURRENT DATABASE STATUS")
            print(f"{'='*80}")
            
            total = 0
            for source, count in self.cur.fetchall():
                bar = "█" * min(50, count // 10)
                print(f"  {source:30s} [{count:5d}] {bar}")
                total += count
            
            print(f"\n  {'TOTAL JOBS':30s} [{total:5d}]")
            print(f"{'='*80}\n")
            
        except Exception as e:
            logger.warning(f"Error getting database stats: {e}")
    
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


# ══════════════════════════════════════════════════════════════════════════════
# Convenience function - unchanged signature for backward compatibility
# ══════════════════════════════════════════════════════════════════════════════

def scrape_jobs():
    """
    Convenience function to run the complete batch scraper pipeline.
    
    Usage:
        from app.services.scraper_service import scrape_jobs
        results = scrape_jobs()
        print(f"Saved {results['saved']} jobs")
    """
    conn = None
    service = None
    try:
        conn = get_connection()
        service = ScraperService(conn)
        results = service.scrape_all_sources()
        
        return results
        
    except Exception as e:
        logger.error(f"Fatal error in scrape_jobs: {e}", exc_info=True)
        raise
    finally:
        if service:
            service.close()
        elif conn:
            try:
                conn.close()
            except Exception:
                pass