"""
Skill matching service using sentence transformers and cosine similarity.

This module is responsible ONLY for skill matching logic.
"""

from typing import List, Dict

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


def match_skills(cv_skills: List[str], job_skills: List[str]) -> List[Dict]:
    """
    Match CV skills to job skills using semantic similarity.

    Args:
        cv_skills: List of skills from CV/resume
        job_skills: List of skills from job posting

    Returns:
        List of dictionaries with cv_skill, best_job_match, and similarity score
    """
    # Load the sentence transformer model
    model = SentenceTransformer("all-MiniLM-L6-v2")

    # Convert skill lists to embeddings
    cv_embeddings = model.encode(cv_skills)
    job_embeddings = model.encode(job_skills)

    # Calculate cosine similarity matrix
    # Shape: (len(cv_skills), len(job_skills))
    similarity_matrix = cosine_similarity(cv_embeddings, job_embeddings)

    # For each CV skill, find the most similar job skill
    results: List[Dict] = []
    for i, cv_skill in enumerate(cv_skills):
        # Get similarity scores for this CV skill against all job skills
        similarities = similarity_matrix[i]

        # Find the index of the best matching job skill
        best_match_idx = int(np.argmax(similarities))
        best_match_score = float(similarities[best_match_idx])

        results.append(
            {
                "cv_skill": cv_skill,
                "best_job_match": job_skills[best_match_idx],
                "score": best_match_score,
            }
        )

    return results

