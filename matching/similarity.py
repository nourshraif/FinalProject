"""
Skill matching module using sentence transformers and cosine similarity.
This module is responsible ONLY for skill matching logic.
"""

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np


def match_skills(cv_skills: list[str], job_skills: list[str]) -> list[dict]:
    """
    Match CV skills to job skills using semantic similarity.
    
    Args:
        cv_skills: List of skills from CV/resume
        job_skills: List of skills from job posting
        
    Returns:
        List of dictionaries with cv_skill, best_job_match, and similarity score
    """
    # Load the sentence transformer model
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # Convert skill lists to embeddings
    cv_embeddings = model.encode(cv_skills)
    job_embeddings = model.encode(job_skills)
    
    # Calculate cosine similarity matrix
    # Shape: (len(cv_skills), len(job_skills))
    similarity_matrix = cosine_similarity(cv_embeddings, job_embeddings)
    
    # For each CV skill, find the most similar job skill
    results = []
    for i, cv_skill in enumerate(cv_skills):
        # Get similarity scores for this CV skill against all job skills
        similarities = similarity_matrix[i]
        
        # Find the index of the best matching job skill
        best_match_idx = np.argmax(similarities)
        best_match_score = float(similarities[best_match_idx])
        
        results.append({
            "cv_skill": cv_skill,
            "best_job_match": job_skills[best_match_idx],
            "score": best_match_score
        })
    
    return results


# Test section - runs when file is executed directly
if __name__ == "__main__":
    print("=" * 80)
    print("TESTING SKILL MATCHING")
    print("=" * 80)
    print()
    
    # Example test data
    cv_skills = ["Python programming", "Machine learning", "SQL"]
    job_skills = ["Deep learning", "Python developer", "Database management"]
    
    print(f"CV Skills: {cv_skills}")
    print(f"Job Skills: {job_skills}")
    print()
    print("Running matching...")
    print()
    
    # Run the matching
    results = match_skills(cv_skills, job_skills)
    
    # Display results
    print("RESULTS:")
    print("-" * 80)
    for i, result in enumerate(results, 1):
        print(f"Match {i}:")
        print(f"  CV Skill:         {result['cv_skill']}")
        print(f"  Best Job Match:   {result['best_job_match']}")
        print(f"  Similarity Score: {result['score']:.4f}")
        print()
    
    # Summary
    avg_score = sum(r['score'] for r in results) / len(results)
    print("-" * 80)
    print(f"Average Match Score: {avg_score:.4f}")
    print(f"Total Matches: {len(results)}")
    print("=" * 80)
    print("\n✅ Matching test completed successfully!")
