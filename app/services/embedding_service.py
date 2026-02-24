"""
Embedding Service - Shared utility for generating job embeddings.

This service provides a lightweight way to generate embeddings for individual jobs
during the scraping pipeline, without requiring a full VectorSkillMatcher instance.
"""

import logging
from typing import Optional
import numpy as np
from sentence_transformers import SentenceTransformer
from psycopg2.extras import execute_values

logger = logging.getLogger(__name__)

# Global model instance (lazy-loaded, singleton pattern)
_embedding_model = None
_embedding_dim = None


def _get_model(model_name: str = 'all-MiniLM-L6-v2'):
    """
    Get or initialize the embedding model (singleton pattern).
    
    Args:
        model_name: Sentence transformer model name
        
    Returns:
        Tuple of (model, embedding_dimension)
    """
    global _embedding_model, _embedding_dim
    
    if _embedding_model is None:
        logger.info(f"Loading embedding model: {model_name}...")
        _embedding_model = SentenceTransformer(model_name)
        _embedding_dim = _embedding_model.get_sentence_embedding_dimension()
        logger.info(f"Model loaded. Embedding dimension: {_embedding_dim}")
    
    return _embedding_model, _embedding_dim


def generate_job_embedding(job_id: int, title: str, company: str, 
                          location: Optional[str], description: Optional[str],
                          model_name: str = 'all-MiniLM-L6-v2') -> tuple:
    """
    Generate embedding for a single job.
    
    Args:
        job_id: Database ID of the job
        title: Job title
        company: Company name
        location: Job location (optional)
        description: Job description (optional)
        model_name: Sentence transformer model name
        
    Returns:
        Tuple of (full_text, skills_text, embedding_list) ready for database insertion
        Returns None if generation fails
    """
    try:
        # Get model
        model, embedding_dim = _get_model(model_name)
        
        # Create text representation
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
        embedding = model.encode(full_text, convert_to_numpy=True)
        
        # Prepare text for storage
        skills_text = description[:1000] if description and description.strip() else desc_text[:1000]
        
        return (job_id, full_text, skills_text, embedding.tolist())
        
    except Exception as e:
        logger.error(f"Error generating embedding for job {job_id}: {e}", exc_info=True)
        return None


def save_job_embedding(cursor, connection, embedding_data: tuple):
    """
    Save a single job embedding to the database.
    
    Args:
        cursor: Database cursor
        connection: Database connection
        embedding_data: Tuple from generate_job_embedding (job_id, full_text, skills_text, embedding)
        
    Returns:
        True if saved successfully, False otherwise
    """
    if embedding_data is None:
        return False
    
    try:
        job_id, full_text, skills_text, embedding = embedding_data
        
        # Ensure pgvector extension is enabled
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        
        # Ensure job_embeddings table exists
        model, embedding_dim = _get_model()
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS job_embeddings (
                job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
                full_text TEXT NOT NULL,
                skills_text TEXT,
                embedding vector({embedding_dim}) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Insert embedding (skip if already exists)
        cursor.execute("""
            INSERT INTO job_embeddings (job_id, full_text, skills_text, embedding)
            VALUES (%s, %s, %s, %s::vector)
            ON CONFLICT (job_id) DO NOTHING
        """, (job_id, full_text, skills_text, embedding))
        
        connection.commit()
        return True
        
    except Exception as e:
        logger.error(f"Error saving embedding for job {embedding_data[0] if embedding_data else 'unknown'}: {e}", exc_info=True)
        connection.rollback()
        return False


def generate_and_save_embedding(cursor, connection, job_id: int, title: str, 
                                company: str, location: Optional[str], 
                                description: Optional[str],
                                model_name: str = 'all-MiniLM-L6-v2') -> bool:
    """
    Convenience function: Generate and save embedding in one call.
    
    Args:
        cursor: Database cursor
        connection: Database connection
        job_id: Database ID of the job
        title: Job title
        company: Company name
        location: Job location (optional)
        description: Job description (optional)
        model_name: Sentence transformer model name
        
    Returns:
        True if embedding was generated and saved, False otherwise
    """
    embedding_data = generate_job_embedding(
        job_id, title, company, location, description, model_name
    )
    
    if embedding_data:
        return save_job_embedding(cursor, connection, embedding_data)
    
    return False
