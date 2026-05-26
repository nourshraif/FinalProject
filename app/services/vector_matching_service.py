"""
Vector-Based Skill Matcher using pgvector and Sentence Transformers.

This provides semantic matching between CV skills and job requirements using
vector embeddings stored in PostgreSQL with pgvector extension.

Requires: pgvector extension installed in PostgreSQL
"""

import os
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
        self.model = SentenceTransformer(model_name)
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
    
    def find_matching_jobs_hybrid(self,
                                  cv_skills: List[str],
                                  top_k: int = 50,
                                  vector_weight: float = 0.7,
                                  keyword_weight: float = 0.3) -> List[Dict]:
        """
        Hybrid matching: combines vector similarity with keyword matching.
        
        Args:
            cv_skills: List of skills from user's CV
            top_k: Number of top matches to return
            vector_weight: Weight for vector similarity (0-1)
            keyword_weight: Weight for keyword matching (0-1)
            
        Returns:
            List of matching jobs with combined scores
        """
        # Ensure embeddings exist for all jobs (silent auto-generation)
        self._ensure_embeddings_exist()
        
        # Get vector matches
        cv_embedding = self.embed_skills(cv_skills)
        
        # Normalize skills for keyword matching
        cv_skills_lower = [s.lower().strip() for s in cv_skills]
        
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
                1 - (je.embedding <=> %s::vector) as vector_similarity
            FROM jobs j
            JOIN job_embeddings je ON j.id = je.job_id
            WHERE j.is_active = TRUE
            ORDER BY je.embedding <=> %s::vector
            LIMIT %s
        """, (cv_embedding.tolist(), cv_embedding.tolist(), top_k * 2))
        
        results = self.cur.fetchall()
        
        matching_jobs = []
        
        for row in results:
            (job_id, source, title, company, location, description, 
             url, scraped_at, skills_text, vector_sim) = row
            
            # Calculate keyword matching score
            description_lower = (description or "").lower()
            keyword_matches = sum(1 for skill in cv_skills_lower 
                                 if skill in description_lower)
            keyword_score = keyword_matches / len(cv_skills) if cv_skills else 0
            
            # Combined score
            combined_score = (vector_weight * float(vector_sim)) + (keyword_weight * keyword_score)
            
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
                'vector_similarity': float(vector_sim),
                'keyword_score': keyword_score,
                'combined_score': combined_score,
                'match_percentage': combined_score * 100,
                'cv_skills': cv_skills
            })
        
        # Sort by combined score
        matching_jobs.sort(key=lambda x: x['combined_score'], reverse=True)
        
        return matching_jobs[:top_k]
    
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
