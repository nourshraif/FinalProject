"""
Vector-Based Skill Matcher using pgvector and Sentence Transformers.

This provides semantic matching between CV skills and job requirements using
vector embeddings stored in PostgreSQL with pgvector extension.

Requires: pgvector extension installed in PostgreSQL
"""

import os
import re
from typing import List, Dict, Optional, Tuple
import numpy as np
from sentence_transformers import SentenceTransformer
from app.database.db import get_connection
import psycopg2
from psycopg2.extras import execute_values


class VectorSkillMatcher:
    """
    Advanced skill matcher using vector embeddings for semantic similarity.
    Uses sentence-transformers for encoding and pgvector for fast similarity search.
    """
    
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        """
        Initialize the vector-based skill matcher.
        
        Args:
            model_name: Sentence transformer model name
                       'all-MiniLM-L6-v2' - Fast, lightweight (default)
                       'all-mpnet-base-v2' - More accurate, slower
        """
        print(f"Loading embedding model: {model_name}...")
        local_only = os.getenv("HF_HUB_OFFLINE", "").lower() in ("1", "true", "yes")
        self.model = SentenceTransformer(model_name, local_files_only=local_only)
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
        print(f"✓ Model loaded! Embedding dimension: {self.embedding_dim}")
        
        self.conn = get_connection()
        self.cur = self.conn.cursor()
        
        # Ensure pgvector extension is enabled
        self._setup_pgvector()
    
    def _setup_pgvector(self):
        """Set up pgvector extension and create necessary tables."""
        try:
            # Enable pgvector extension
            self.cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            self.conn.commit()
            print("✓ pgvector extension enabled")
            
            # Create job_embeddings table
            self.cur.execute(f"""
                CREATE TABLE IF NOT EXISTS job_embeddings (
                    job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
                    full_text TEXT NOT NULL,
                    skills_text TEXT,
                    embedding vector({self.embedding_dim}) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # Create index for faster similarity search
            self.cur.execute("""
                CREATE INDEX IF NOT EXISTS job_embeddings_embedding_idx 
                ON job_embeddings 
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """)
            
            # Create posted_job_embeddings table (separate from scraped jobs)
            self.cur.execute(f"""
                CREATE TABLE IF NOT EXISTS posted_job_embeddings (
                    posted_job_id INTEGER PRIMARY KEY REFERENCES posted_jobs(id) ON DELETE CASCADE,
                    full_text TEXT NOT NULL,
                    skills_text TEXT,
                    embedding vector({self.embedding_dim}) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            self.cur.execute("""
                CREATE INDEX IF NOT EXISTS posted_job_embeddings_idx
                ON posted_job_embeddings
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 10);
            """)

            # Create CV embeddings table
            self.cur.execute(f"""
                CREATE TABLE IF NOT EXISTS cv_embeddings (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255),
                    skills_text TEXT NOT NULL,
                    embedding vector({self.embedding_dim}) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            self.conn.commit()
            print("✓ Vector tables and indexes created")
            
        except Exception as e:
            print(f"Warning setting up pgvector: {e}")
            print("Make sure pgvector is installed: https://github.com/pgvector/pgvector")
            self.conn.rollback()
    
    def embed_text(self, text: str) -> np.ndarray:
        """
        Convert text to vector embedding.
        
        Args:
            text: Text to embed
            
        Returns:
            Vector embedding as numpy array
        """
        embedding = self.model.encode(text, convert_to_numpy=True)
        return embedding
    
    def embed_skills(self, skills: List[str]) -> np.ndarray:
        """
        Convert list of skills to a single vector embedding.
        
        Args:
            skills: List of skill names
            
        Returns:
            Vector embedding representing all skills
        """
        # Combine skills into a sentence for better context
        skills_text = "Professional skills: " + ", ".join(skills)
        return self.embed_text(skills_text)
    
    def embed_posted_job(self, posted_job_id: int, title: str, company: str,
                         location: str, description: str, skills: list = None):
        """
        Generate and save embedding for a single company-posted job.
        Called automatically when a company creates or updates a job posting.
        """
        skills_str = ", ".join(skills) if skills else ""
        full_text = f"""
        Job Title: {title}
        Company: {company}
        Location: {location or 'Remote'}
        Skills Required: {skills_str}
        Description: {(description or '')[:2000]}
        """.strip()

        embedding = self.embed_text(full_text)
        skills_text = skills_str or (description or "")[:1000]

        self.cur.execute("""
            INSERT INTO posted_job_embeddings (posted_job_id, full_text, skills_text, embedding)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (posted_job_id) DO UPDATE
                SET full_text = EXCLUDED.full_text,
                    skills_text = EXCLUDED.skills_text,
                    embedding = EXCLUDED.embedding,
                    created_at = CURRENT_TIMESTAMP
        """, (posted_job_id, full_text, skills_text, embedding.tolist()))
        self.conn.commit()
        print(f"✓ Embedding saved for posted job {posted_job_id}")

    def generate_job_embeddings(self, batch_size: int = 100, force_regenerate: bool = False):
        """
        Generate and store embeddings for all jobs in database.
        
        Args:
            batch_size: Number of jobs to process at once
            force_regenerate: If True, regenerate all embeddings
        """
        if force_regenerate:
            print("Clearing existing embeddings...")
            self.cur.execute("DELETE FROM job_embeddings")
            self.conn.commit()
        
        # Get jobs without embeddings (include jobs without descriptions too)
        self.cur.execute("""
            SELECT j.id, j.job_title, j.company, j.location, j.description
            FROM jobs j
            LEFT JOIN job_embeddings je ON j.id = je.job_id
            WHERE je.job_id IS NULL
                AND j.is_active = TRUE
            ORDER BY j.scraped_at DESC
        """)
        
        jobs = self.cur.fetchall()
        total_jobs = len(jobs)
        
        if total_jobs == 0:
            print("✓ All jobs already have embeddings!")
            return
        
        print(f"\nGenerating embeddings for {total_jobs} jobs...")
        print("This may take a few minutes for the first run.")
        
        embeddings_to_insert = []
        
        for i, (job_id, title, company, location, description) in enumerate(jobs, 1):
            # Create comprehensive text representation
            # Use description if available, otherwise use title + company + location
            if description and description.strip():
                desc_text = description[:2000]
            else:
                # Fallback: use title, company, and location
                desc_text = f"{title} at {company}"
                if location:
                    desc_text += f" in {location}"
            
            full_text = f"""
            Job Title: {title}
            Company: {company}
            Location: {location or 'Remote'}
            Description: {desc_text}
            """.strip()
            
            # Generate embedding
            embedding = self.embed_text(full_text)
            
            # Store description or fallback text
            skills_text = description[:1000] if description and description.strip() else desc_text[:1000]
            
            embeddings_to_insert.append((
                job_id,
                full_text,
                skills_text,
                embedding.tolist()
            ))
            
            # Insert in batches
            if len(embeddings_to_insert) >= batch_size or i == total_jobs:
                execute_values(
                    self.cur,
                    """
                    INSERT INTO job_embeddings (job_id, full_text, skills_text, embedding)
                    VALUES %s
                    ON CONFLICT (job_id) DO NOTHING
                    """,
                    embeddings_to_insert
                )
                self.conn.commit()
                
                print(f"  Processed {i}/{total_jobs} jobs ({(i/total_jobs)*100:.1f}%)")
                embeddings_to_insert = []
        
        print(f"✓ Generated embeddings for {total_jobs} jobs!")
    
    def _ensure_embeddings_exist(self):
        """
        Silently generate embeddings for any jobs that don't have them.
        This ensures matching always works without user intervention.
        """
        # Check for jobs without embeddings
        self.cur.execute("""
            SELECT j.id, j.job_title, j.company, j.location, j.description
            FROM jobs j
            LEFT JOIN job_embeddings je ON j.id = je.job_id
            WHERE je.job_id IS NULL
                AND j.is_active = TRUE
            LIMIT 100
        """)
        
        missing_jobs = self.cur.fetchall()
        
        if missing_jobs:
            # Import here to avoid circular dependency
            from app.services.embedding_service import generate_and_save_embedding
            
            for job_id, title, company, location, description in missing_jobs:
                try:
                    generate_and_save_embedding(
                        cursor=self.cur,
                        connection=self.conn,
                        job_id=job_id,
                        title=title,
                        company=company,
                        location=location,
                        description=description
                    )
                except Exception as e:
                    # Log but continue - don't fail the entire operation
                    print(f"Warning: Failed to generate embedding for job {job_id}: {e}")
    
    def find_similar_jobs(self, 
                         cv_skills: List[str],
                         top_k: int = 50,
                         similarity_threshold: float = 0.3) -> List[Dict]:
        """
        Find jobs most similar to CV skills using vector similarity.
        
        Args:
            cv_skills: List of skills from user's CV
            top_k: Number of top matches to return
            similarity_threshold: Minimum similarity score (0-1)
            
        Returns:
            List of matching jobs with similarity scores
        """
        # Ensure embeddings exist for all jobs (silent auto-generation)
        self._ensure_embeddings_exist()
        
        # Generate embedding for CV skills
        cv_embedding = self.embed_skills(cv_skills)
        
        # Find similar jobs using cosine similarity
        self.cur.execute("""
            SELECT 
                j.id,
                j.source,
                j.job_title,
                j.company,
                j.location,
                j.description,
                j.job_url,
                j.scraped_at,
                je.skills_text,
                1 - (je.embedding <=> %s::vector) as similarity
            FROM jobs j
            JOIN job_embeddings je ON j.id = je.job_id
            WHERE j.is_active = TRUE
                AND (1 - (je.embedding <=> %s::vector)) >= %s
            ORDER BY je.embedding <=> %s::vector
            LIMIT %s
        """, (cv_embedding.tolist(), cv_embedding.tolist(), similarity_threshold, 
              cv_embedding.tolist(), top_k))
        
        results = self.cur.fetchall()
        
        matching_jobs = []
        for row in results:
            (job_id, source, title, company, location, description, 
             url, scraped_at, skills_text, similarity) = row
            
            matching_jobs.append({
                'job_id': job_id,
                'source': source,
                'title': title,
                'company': company,
                'location': location,
                'description': description,
                'url': url,
                'scraped_at': scraped_at,
                'skills_text': skills_text,
                'similarity_score': float(similarity),
                'match_percentage': float(similarity * 100)
            })
        
        return matching_jobs

    # Soft skills barely move the needle; hard/role overlap should dominate.
    SOFT_SKILL_WEIGHT = 0.08
    TECH_SKILL_WEIGHT = 2.5
    OTHER_SKILL_WEIGHT = 1.0
    # Cross-family jobs (e.g. software CV vs trades listing) are strongly demoted.
    ROLE_FAMILY_MISMATCH_FACTOR = 0.32
    # Same-field but different licensed role (nurse vs pharmacist): near-hard drop.
    ROLE_FAMILY_INCOMPATIBLE_FACTOR = 0.12
    # Job TITLE contains the user's primary role (e.g. "Nurse" in "Registered Nurse").
    PRIMARY_ROLE_TITLE_BOOST = 1.35
    PRIMARY_ROLE_DESC_BOOST = 1.08

    ROLE_FAMILY_KEYWORDS = {
        "software_engineering": (
            "software", "developer", "engineer", "programming", "programmer",
            "backend", "frontend", "fullstack", "full-stack", "devops",
            "python", "javascript", "typescript", "java", "react", "node",
            "api", "web developer", "mobile developer", "kotlin", "django",
        ),
        "data_ai": (
            "data scientist", "data analyst", "machine learning", "deep learning",
            "nlp", "mlops", "artificial intelligence", "tensorflow", "pytorch",
            "pandas", "numpy", "scikit", "analytics engineer",
        ),
        "nursing_clinical": (
            "nurse", "nursing", "nmc", "registered nurse", "staff nurse",
            "icu nurse", "midwife", "midwifery", "ward nurse", "rn ",
            "nursing assistant", "clinical nurse",
        ),
        # Keep pharmacy separate from nursing — embeddings often confuse them.
        "pharmacy": (
            "pharmacist", "pharmacy", "pharmd", "clinical pharmacist",
            "dispens", "pharmacology", "pharmacy technician", "chemist shop",
        ),
        "physician": (
            "physician", "medical doctor", " md ", "gp ", "general practitioner",
            "surgeon", "resident doctor", "consultant doctor",
        ),
        "allied_health": (
            "physiotherapist", "physiotherapy", "physical therapist",
            "occupational therapist", "radiographer", "radiology tech",
            "lab technician", "medical laboratory", "dietitian", "nutritionist",
            "speech therapist", "respiratory therapist",
        ),
        "dental": (
            "dentist", "dental", "orthodont", "oral hygienist",
        ),
        "education": (
            "teacher", "teaching", "tutor", "lecturer", "professor", "school",
            "curriculum", "education", "instructor", "special education",
            "autism", "aba",
        ),
        "trades_construction": (
            "welder", "welding", "carpenter", "electrician", "plumber",
            "blacksmith", "ironworker", "aluminum", "aluminium", "construction",
            "foreman", "mechanic", "technician site", "fabricat",
            "حداد", "ألومنيوم", "المنيوم",
        ),
        "sales_marketing": (
            "sales", "marketing", "seo", "social media", "account executive",
            "business development", "advertising", "brand manager",
        ),
        "finance_accounting": (
            "accountant", "accounting", "finance", "auditor", "bookkeep",
            "cfo", "financial analyst", "payroll",
        ),
        "hr_admin": (
            "human resources", "hr ", "recruiter", "talent acquisition",
            "administrative", "office manager", "receptionist",
        ),
        "hospitality": (
            "hotel", "restaurant", "chef", "waiter", "hospitality", "barista",
            "housekeeping",
        ),
    }

    # Licensed / profession-specific roles that must not cross-match each other.
    # Shared workplace language ("hospital", "patient") no longer collapses them.
    INCOMPATIBLE_ROLE_FAMILIES = frozenset({
        frozenset({"nursing_clinical", "pharmacy"}),
        frozenset({"nursing_clinical", "physician"}),
        frozenset({"nursing_clinical", "allied_health"}),
        frozenset({"nursing_clinical", "dental"}),
        frozenset({"pharmacy", "physician"}),
        frozenset({"pharmacy", "allied_health"}),
        frozenset({"pharmacy", "dental"}),
        frozenset({"physician", "allied_health"}),
        frozenset({"physician", "dental"}),
        frozenset({"allied_health", "dental"}),
        frozenset({"software_engineering", "nursing_clinical"}),
        frozenset({"software_engineering", "pharmacy"}),
        frozenset({"data_ai", "nursing_clinical"}),
        frozenset({"data_ai", "pharmacy"}),
    })

    @staticmethod
    def _is_language_skill(skill: str) -> bool:
        """Spoken/written languages — profile metadata, not match drivers."""
        language_keywords = (
            "english", "arabic", "french", "spanish", "german", "italian",
            "portuguese", "chinese", "mandarin", "hindi", "russian",
            "turkish", "hebrew", "fluent in", "native speaker",
        )
        s = (skill or "").lower().strip()
        return any(k in s for k in language_keywords)

    @staticmethod
    def _is_soft_skill(skill: str) -> bool:
        soft_keywords = (
            "communication", "teamwork", "team player", "leadership",
            "problem solving", "critical thinking", "time management",
            "collaboration", "organized", "organization", "interpersonal",
            "adaptability", "creativity", "attention to detail",
        )
        s = (skill or "").lower().strip()
        if VectorSkillMatcher._is_language_skill(s):
            return False
        return any(k in s for k in soft_keywords)

    @staticmethod
    def _is_technical_skill(skill: str) -> bool:
        technical_keywords = (
            "python", "java", "javascript", "typescript", "c++", "sql", "php",
            "kotlin", "c#", "html", "css", "react", "node", "django", "flask",
            "scikit", "pandas", "numpy", "matplotlib", "nlp", "ml", "ai",
            "tensorflow", "pytorch", "regression", "classification", "k-means",
            "database", "arduino", "assembly", "tf-idf",
        )
        s = (skill or "").lower().strip()
        return any(k in s for k in technical_keywords)

    @staticmethod
    def _count_keyword_hits(skills: List[str], text: str) -> int:
        hits = 0
        for skill in skills:
            token = (skill or "").strip().lower()
            if not token:
                continue
            # Word boundaries reduce noisy substring matches.
            if re.search(rf"\b{re.escape(token)}\b", text):
                hits += 1
        return hits

    @classmethod
    def detect_role_families(cls, text: str) -> set:
        """Coarse role families from CV skills or job title/description."""
        blob = (text or "").lower()
        if not blob.strip():
            return set()
        families = set()
        for family, keywords in cls.ROLE_FAMILY_KEYWORDS.items():
            for kw in keywords:
                if kw in blob:
                    families.add(family)
                    break
        return families

    @classmethod
    def role_families_incompatible(cls, families_a: set, families_b: set) -> bool:
        """True when both sides have licensed roles that should never cross-match."""
        if not families_a or not families_b:
            return False
        for a in families_a:
            for b in families_b:
                if a == b:
                    continue
                if frozenset({a, b}) in cls.INCOMPATIBLE_ROLE_FAMILIES:
                    return True
        return False

    @staticmethod
    def _split_skill_groups(cv_skills: List[str]) -> Tuple[List[str], List[str], List[str]]:
        cv_skills_norm = [s.strip() for s in cv_skills if str(s).strip()]
        # Languages never enter keyword scoring (profile signal only).
        usable = [s for s in cv_skills_norm if not VectorSkillMatcher._is_language_skill(s)]
        tech_skills = [s for s in usable if VectorSkillMatcher._is_technical_skill(s)]
        soft_skills = [s for s in usable if VectorSkillMatcher._is_soft_skill(s)]
        other_skills = [
            s for s in usable if s not in tech_skills and s not in soft_skills
        ]
        return tech_skills, other_skills, soft_skills

    def _compute_hybrid_score(
        self,
        cv_skills: List[str],
        vector_sim: float,
        title: str,
        company: str,
        location: str,
        description: str,
        skills_text: str,
        vector_weight: float,
        keyword_weight: float,
    ) -> Dict[str, float]:
        tech_skills, other_skills, soft_skills = self._split_skill_groups(cv_skills)
        full_text = " ".join([
            str(title or ""),
            str(company or ""),
            str(location or ""),
            str(description or ""),
            str(skills_text or ""),
        ]).lower()
        tech_hits = self._count_keyword_hits(tech_skills, full_text)
        other_hits = self._count_keyword_hits(other_skills, full_text)
        soft_hits = self._count_keyword_hits(soft_skills, full_text)

        soft_w = self.SOFT_SKILL_WEIGHT
        tech_w = self.TECH_SKILL_WEIGHT
        other_w = self.OTHER_SKILL_WEIGHT
        weighted_hits = (tech_w * tech_hits) + (other_w * other_hits) + (soft_w * soft_hits)
        max_possible = (
            (tech_w * len(tech_skills))
            + (other_w * len(other_skills))
            + (soft_w * len(soft_skills))
        )
        keyword_score = (weighted_hits / max_possible) if max_possible > 0 else 0.0

        if tech_skills and tech_hits == 0:
            keyword_score *= 0.25

        combined_score = (vector_weight * float(vector_sim)) + (keyword_weight * keyword_score)

        # Additional relevance guard:
        # If a job has zero overlap on core domain terms extracted from the CV
        # (e.g. nursing, nmc, ward), dampen the final score even when semantic
        # similarity is moderately high due to broad healthcare wording.
        core_terms = self._extract_core_terms(cv_skills)
        core_hits = self._count_keyword_hits(core_terms, full_text)
        core_penalty_applied = False
        if core_terms and core_hits == 0:
            combined_score *= 0.55
            core_penalty_applied = True

        # Job-title relevance boost:
        # If role-defining core terms appear in the title (e.g. "nurse"),
        # promote this listing modestly. This helps profession-specific CVs
        # rank role-matching jobs above generic domain-adjacent roles.
        title_core_hits = self._count_keyword_hits(core_terms, str(title or "").lower())
        title_boost_applied = False
        if title_core_hits > 0:
            combined_score *= 1.15
            title_boost_applied = True

        # Prefer job TITLE for family detection (avoids description noise like
        # "works with nurses / hospital team" on a pharmacist posting).
        cv_text = " ".join(str(s) for s in (cv_skills or []))
        cv_families = self.detect_role_families(cv_text)
        job_title_families = self.detect_role_families(str(title or ""))
        job_families = job_title_families or self.detect_role_families(
            f"{title or ''} {description or ''} {skills_text or ''}"
        )

        role_family_incompatible = self.role_families_incompatible(
            cv_families, job_families
        )
        role_family_mismatch = False
        if role_family_incompatible:
            # Nurse ↔ Clinical Pharmacist, etc.
            combined_score *= self.ROLE_FAMILY_INCOMPATIBLE_FACTOR
            role_family_mismatch = True
        elif cv_families and job_families and cv_families.isdisjoint(job_families):
            combined_score *= self.ROLE_FAMILY_MISMATCH_FACTOR
            role_family_mismatch = True

        # Keep scores bounded.
        combined_score = max(0.0, min(1.0, combined_score))

        return {
            "vector_similarity": float(vector_sim),
            "keyword_score": keyword_score,
            "core_terms_checked": float(len(core_terms)),
            "core_hits": float(core_hits),
            "core_penalty_applied": 1.0 if core_penalty_applied else 0.0,
            "title_core_hits": float(title_core_hits),
            "title_boost_applied": 1.0 if title_boost_applied else 0.0,
            "role_family_mismatch": 1.0 if role_family_mismatch else 0.0,
            "role_family_incompatible": 1.0 if role_family_incompatible else 0.0,
            "combined_score": combined_score,
            "match_percentage": combined_score * 100,
        }

    @staticmethod
    def _extract_core_terms(cv_skills: List[str]) -> List[str]:
        """
        Extract domain-defining terms from CV skills.
        These terms are used as a hard relevance guard to avoid high scores
        for jobs that share broad language but miss core profession overlap.
        """
        stop = {
            "skills", "skill", "experience", "professional", "management",
            "communication", "teamwork", "leadership", "english", "arabic",
            "french", "spanish", "care", "health", "patient", "support",
        }
        out: List[str] = []
        seen = set()
        for raw in cv_skills or []:
            s = (raw or "").strip().lower()
            if not s or VectorSkillMatcher._is_language_skill(s):
                continue
            # Keep full phrase as a core term (e.g. "adult nursing").
            if s not in stop and s not in seen and len(s) >= 4:
                seen.add(s)
                out.append(s)

            # Also keep meaningful tokens from multi-word skills.
            for tok in re.findall(r"[a-z0-9\+#\.]{3,}", s):
                if tok in stop or tok in seen or VectorSkillMatcher._is_language_skill(tok):
                    continue
                seen.add(tok)
                out.append(tok)

        return out[:12]

    def score_jobs_hybrid_batch(
        self,
        cv_skills: List[str],
        jobs: List[Dict],
        vector_weight: float = 0.6,
        keyword_weight: float = 0.4,
    ) -> List[Dict]:
        """
        Score a list of job dicts (from get_new_jobs_since / get_recent_jobs)
        with the same hybrid formula as find_matching_jobs_hybrid.
        Embeds CV skills once. Returns jobs that have embeddings, with
        match_percentage (raw 0-100) and match_score unset.
        """
        if not cv_skills or not jobs:
            return []

        self._ensure_embeddings_exist()
        cv_embedding = self.embed_skills(cv_skills)
        cv_list = cv_embedding.tolist()
        scored: List[Dict] = []

        for job in jobs:
            job_id = job.get("id")
            if job_id is None:
                continue
            try:
                jid = int(job_id)
            except (TypeError, ValueError):
                continue

            if jid < 0:
                self.cur.execute(
                    """
                    SELECT pj.title, pj.company_name, pj.location, pj.description,
                           pje.skills_text, 1 - (pje.embedding <=> %s::vector) AS vector_sim
                    FROM posted_jobs pj
                    JOIN posted_job_embeddings pje ON pj.id = pje.posted_job_id
                    WHERE pj.id = %s AND pj.is_active = TRUE
                    """,
                    (cv_list, -jid),
                )
            else:
                self.cur.execute(
                    """
                    SELECT j.job_title, j.company, j.location, j.description,
                           je.skills_text, 1 - (je.embedding <=> %s::vector) AS vector_sim
                    FROM jobs j
                    JOIN job_embeddings je ON j.id = je.job_id
                    WHERE j.id = %s AND j.is_active = TRUE
                    """,
                    (cv_list, jid),
                )

            row = self.cur.fetchone()
            if not row:
                continue

            title, company, location, description, skills_text, vector_sim = row
            score = self._compute_hybrid_score(
                cv_skills=cv_skills,
                vector_sim=float(vector_sim),
                title=title,
                company=company,
                location=location,
                description=description,
                skills_text=skills_text,
                vector_weight=vector_weight,
                keyword_weight=keyword_weight,
            )
            scored.append({
                **job,
                "job_title": title or job.get("job_title"),
                "company": company or job.get("company"),
                "location": location or job.get("location"),
                "description": description if description is not None else job.get("description"),
                "match_percentage": score["match_percentage"],
            })

        scored.sort(key=lambda x: x.get("match_percentage", 0), reverse=True)
        return scored

    def score_job_hybrid(
        self,
        cv_skills: List[str],
        job_id: int,
        vector_weight: float = 0.6,
        keyword_weight: float = 0.4,
    ) -> Optional[float]:
        """Return raw hybrid match percentage (0-100) for a single job id."""
        self._ensure_embeddings_exist()
        cv_embedding = self.embed_skills(cv_skills)

        if job_id < 0:
            self.cur.execute(
                """
                SELECT pj.title, pj.company_name, pj.location, pj.description,
                       pje.skills_text, 1 - (pje.embedding <=> %s::vector) AS vector_sim
                FROM posted_jobs pj
                JOIN posted_job_embeddings pje ON pj.id = pje.posted_job_id
                WHERE pj.id = %s AND pj.is_active = TRUE
                """,
                (cv_embedding.tolist(), -job_id),
            )
        else:
            self.cur.execute(
                """
                SELECT j.job_title, j.company, j.location, j.description,
                       je.skills_text, 1 - (je.embedding <=> %s::vector) AS vector_sim
                FROM jobs j
                JOIN job_embeddings je ON j.id = je.job_id
                WHERE j.id = %s AND j.is_active = TRUE
                """,
                (cv_embedding.tolist(), job_id),
            )

        row = self.cur.fetchone()
        if not row:
            return None

        title, company, location, description, skills_text, vector_sim = row
        return self._compute_hybrid_score(
            cv_skills=cv_skills,
            vector_sim=float(vector_sim),
            title=title,
            company=company,
            location=location,
            description=description,
            skills_text=skills_text,
            vector_weight=vector_weight,
            keyword_weight=keyword_weight,
        )["match_percentage"]
    
    def find_matching_jobs_hybrid(self,
                                  cv_skills: List[str],
                                  top_k: int = 50,
                                  vector_weight: float = 0.7,
                                  keyword_weight: float = 0.3,
                                  min_combined_score: Optional[float] = None) -> List[Dict]:
        """
        Hybrid matching: combines vector similarity with keyword matching.

        Args:
            cv_skills: List of skills from user's CV
            top_k: Maximum number of matches to return (cap, not a fixed count)
            vector_weight: Weight for vector similarity (0-1)
            keyword_weight: Weight for keyword matching (0-1)
            min_combined_score: Drop jobs below this raw hybrid score (0-1).
                Defaults to MATCH_MIN_COMBINED_SCORE env (0.22). Without this
                filter the API always returned exactly min(50, DB size) neighbors.

        Returns:
            List of matching jobs with combined scores (length varies by quality)
        """
        if min_combined_score is None:
            try:
                min_combined_score = float(os.getenv("MATCH_MIN_COMBINED_SCORE", "0.22"))
            except ValueError:
                min_combined_score = 0.22
        min_combined_score = max(0.0, min(1.0, float(min_combined_score)))

        # Ensure embeddings exist for all jobs (silent auto-generation)
        self._ensure_embeddings_exist()

        # Get vector matches — pull a wider pool, then filter by quality.
        cv_embedding = self.embed_skills(cv_skills)
        tech_skills, other_skills, soft_skills = self._split_skill_groups(cv_skills)
        candidate_limit = max(top_k * 4, 100)

        self.cur.execute("""
            SELECT
                id, source, job_title, company, location,
                description, job_url, scraped_at, skills_text,
                1 - (embedding <=> %s::vector) as vector_similarity
            FROM (
                -- Scraped jobs
                SELECT
                    j.id,
                    j.source,
                    j.job_title,
                    j.company,
                    j.location,
                    j.description,
                    j.job_url,
                    j.scraped_at,
                    je.skills_text,
                    je.embedding
                FROM jobs j
                JOIN job_embeddings je ON j.id = je.job_id
                WHERE j.is_active = TRUE

                UNION ALL

                -- Company posted jobs
                SELECT
                    pj.id * -1 AS id,
                    'company_posted' AS source,
                    pj.title AS job_title,
                    pj.company_name AS company,
                    pj.location,
                    pj.description,
                    COALESCE(pj.application_url, '') AS job_url,
                    pj.created_at AS scraped_at,
                    pje.skills_text,
                    pje.embedding
                FROM posted_jobs pj
                JOIN posted_job_embeddings pje ON pj.id = pje.posted_job_id
                WHERE pj.is_active = TRUE
            ) combined
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """, (cv_embedding.tolist(), cv_embedding.tolist(), candidate_limit))

        results = self.cur.fetchall()

        matching_jobs = []

        for row in results:
            (job_id, source, title, company, location, description,
             url, scraped_at, skills_text, vector_sim) = row

            score = self._compute_hybrid_score(
                cv_skills=cv_skills,
                vector_sim=float(vector_sim),
                title=title,
                company=company,
                location=location,
                description=description,
                skills_text=skills_text,
                vector_weight=vector_weight,
                keyword_weight=keyword_weight,
            )

            # Quality gate: do not count weak / cross-domain neighbors as matches.
            if score["combined_score"] < min_combined_score:
                continue
            if score.get("role_family_mismatch", 0) >= 1.0:
                continue

            full_text = " ".join([
                str(title or ""),
                str(company or ""),
                str(location or ""),
                str(description or ""),
                str(skills_text or ""),
            ]).lower()

            matching_jobs.append({
                'job_id': job_id,
                'source': source,
                'title': title,
                'company': company,
                'location': location,
                'description': description,
                'url': url,
                'scraped_at': scraped_at,
                'skills_text': skills_text,
                'vector_similarity': score["vector_similarity"],
                'keyword_score': score["keyword_score"],
                'keyword_hits': {
                    'technical': self._count_keyword_hits(tech_skills, full_text),
                    'other': self._count_keyword_hits(other_skills, full_text),
                    'soft': self._count_keyword_hits(soft_skills, full_text),
                },
                'combined_score': score["combined_score"],
                'match_percentage': score["match_percentage"],
                'cv_skills': cv_skills
            })

        # Sort by combined score (best first)
        matching_jobs.sort(key=lambda x: x['combined_score'], reverse=True)

        # ── Deduplication ────────────────────────────────────────────────────
        # Remove duplicate jobs that appear from multiple scrapers or from
        # both a scraper and a company posting.
        # Strategy: normalize title + company → keep only the highest-scoring one.
        def _dedup_key(job):
            title_norm = (job['title'] or '').lower().strip()
            company_norm = (job['company'] or '').lower().strip()
            # Remove common noise words so "Software Engineer" == "software engineer"
            title_norm = re.sub(r'[^a-z0-9\s]', '', title_norm).strip()
            company_norm = re.sub(r'[^a-z0-9\s]', '', company_norm).strip()
            return (title_norm, company_norm)

        seen_keys = set()
        deduplicated = []
        for job in matching_jobs:
            key = _dedup_key(job)
            if key not in seen_keys:
                seen_keys.add(key)
                deduplicated.append(job)
        # ─────────────────────────────────────────────────────────────────────

        return deduplicated[:top_k]
    
    def explain_match(self, cv_skills: List[str], job_description: str, 
                     top_n_similar: int = 5) -> Dict:
        """
        Explain why a job matches the CV by finding most similar skills.
        
        Args:
            cv_skills: User's CV skills
            job_description: Job description text
            top_n_similar: Number of top similar skills to show
            
        Returns:
            Dictionary with match explanation
        """
        # Embed each skill individually
        skill_embeddings = {skill: self.embed_text(skill) for skill in cv_skills}
        job_embedding = self.embed_text(job_description[:2000])
        
        # Calculate similarity for each skill
        similarities = {}
        for skill, skill_emb in skill_embeddings.items():
            # Cosine similarity
            cos_sim = np.dot(skill_emb, job_embedding) / (
                np.linalg.norm(skill_emb) * np.linalg.norm(job_embedding)
            )
            similarities[skill] = float(cos_sim)
        
        # Sort by similarity
        sorted_skills = sorted(similarities.items(), key=lambda x: x[1], reverse=True)
        
        return {
            'top_relevant_skills': [
                {'skill': skill, 'relevance': round(score * 100, 1)}
                for skill, score in sorted_skills[:top_n_similar]
            ],
            'least_relevant_skills': [
                {'skill': skill, 'relevance': round(score * 100, 1)}
                for skill, score in sorted_skills[-top_n_similar:]
            ]
        }
    
    def get_skill_recommendations(self, cv_skills: List[str], 
                                 n_jobs: int = 50) -> Dict:
        """
        Get skill recommendations based on similar job postings.
        
        Args:
            cv_skills: User's current skills
            n_jobs: Number of jobs to analyze
            
        Returns:
            Dictionary with skill recommendations
        """
        matching_jobs = self.find_similar_jobs(cv_skills, top_k=n_jobs, 
                                              similarity_threshold=0.2)
        
        if not matching_jobs:
            return {
                'recommendations': [],
                'jobs_analyzed': 0
            }
        
        # Extract all text from job descriptions
        all_job_text = " ".join([j.get('description', '')[:1000] for j in matching_jobs 
                                if j.get('description')])
        
        # Common tech skills to check
        potential_skills = [
            'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'Go', 'Rust',
            'React', 'Angular', 'Vue', 'Node.js', 'Django', 'Flask', 'Spring',
            'PostgreSQL', 'MongoDB', 'Redis', 'MySQL',
            'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes',
            'Machine Learning', 'Data Science', 'AI', 'Deep Learning',
            'REST API', 'GraphQL', 'Microservices',
            'Git', 'CI/CD', 'Agile', 'Scrum'
        ]
        
        # Filter out skills user already has
        cv_skills_lower = [s.lower() for s in cv_skills]
        new_skills = [s for s in potential_skills 
                     if s.lower() not in cv_skills_lower]
        
        # Count mentions
        skill_mentions = {}
        for skill in new_skills:
            count = all_job_text.lower().count(skill.lower())
            if count > 0:
                skill_mentions[skill] = count
        
        # Sort by frequency
        sorted_skills = sorted(skill_mentions.items(), key=lambda x: x[1], reverse=True)
        
        return {
            'recommendations': [
                {
                    'skill': skill,
                    'mentions': count,
                    'percentage': (count / len(matching_jobs)) * 100
                }
                for skill, count in sorted_skills[:15]
            ],
            'jobs_analyzed': len(matching_jobs)
        }
    
    def close(self):
        """Close database connection."""
        if self.cur:
            self.cur.close()
        if self.conn:
            self.conn.close()
