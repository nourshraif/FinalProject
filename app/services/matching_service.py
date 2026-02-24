"""
Skill matching service with multiple matching strategies.

This module provides:
1. Semantic matching using sentence transformers (existing)
2. Pattern-based matching (free, no API costs)
3. Vector-based matching using pgvector (advanced)
"""

import re
from typing import List, Dict, Optional, Set

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


# Pattern-based matching (FREE - no API costs)
_SKILL_KEYWORDS = {
    # Programming Languages
    'Python': ['python', 'py', 'python3'],
    'JavaScript': ['javascript', 'js', 'es6', 'ecmascript', 'node.js', 'nodejs'],
    'Java': ['java', 'jdk', 'jre', 'java se', 'java ee'],
    'TypeScript': ['typescript', 'ts'],
    'C++': ['c++', 'cpp', 'cplusplus'],
    'C#': ['c#', 'csharp', 'c sharp', '.net'],
    'Ruby': ['ruby', 'ruby on rails', 'rails'],
    'PHP': ['php', 'php7', 'php8'],
    'Go': ['go', 'golang'],
    'Rust': ['rust'],
    'Swift': ['swift', 'swiftui'],
    'Kotlin': ['kotlin'],
    'R': ['r programming', 'r language'],
    'Scala': ['scala'],
    
    # Frontend Frameworks
    'React': ['react', 'reactjs', 'react.js', 'react native'],
    'Angular': ['angular', 'angularjs', 'angular2+'],
    'Vue': ['vue', 'vuejs', 'vue.js'],
    'Svelte': ['svelte'],
    'Next.js': ['nextjs', 'next.js'],
    
    # Backend Frameworks
    'Django': ['django', 'django rest framework', 'drf'],
    'Flask': ['flask'],
    'FastAPI': ['fastapi'],
    'Express': ['express', 'expressjs', 'express.js'],
    'Spring': ['spring', 'spring boot', 'springboot'],
    'Laravel': ['laravel'],
    
    # Databases
    'PostgreSQL': ['postgresql', 'postgres', 'psql'],
    'MySQL': ['mysql'],
    'MongoDB': ['mongodb', 'mongo'],
    'Redis': ['redis'],
    'SQLite': ['sqlite'],
    'Oracle': ['oracle', 'oracle db'],
    'SQL Server': ['sql server', 'mssql', 'ms sql'],
    'Cassandra': ['cassandra'],
    'Elasticsearch': ['elasticsearch', 'elastic search'],
    
    # Cloud & DevOps
    'AWS': ['aws', 'amazon web services', 'ec2', 's3', 'lambda'],
    'Azure': ['azure', 'microsoft azure'],
    'GCP': ['gcp', 'google cloud', 'google cloud platform'],
    'Docker': ['docker', 'containerization', 'containers'],
    'Kubernetes': ['kubernetes', 'k8s'],
    'Jenkins': ['jenkins'],
    'Git': ['git', 'github', 'gitlab', 'bitbucket'],
    'CI/CD': ['ci/cd', 'cicd', 'continuous integration', 'continuous deployment'],
    'Terraform': ['terraform'],
    'Ansible': ['ansible'],
    
    # Data Science & ML
    'Machine Learning': ['machine learning', 'ml', 'deep learning', 'neural networks'],
    'TensorFlow': ['tensorflow', 'tf'],
    'PyTorch': ['pytorch', 'torch'],
    'Pandas': ['pandas'],
    'NumPy': ['numpy'],
    'Scikit-learn': ['scikit-learn', 'sklearn', 'scikit learn'],
    'Keras': ['keras'],
    
    # APIs & Protocols
    'REST API': ['rest api', 'restful', 'rest', 'rest apis'],
    'GraphQL': ['graphql', 'gql'],
    'gRPC': ['grpc'],
    'WebSocket': ['websocket', 'websockets'],
    
    # Testing
    'Jest': ['jest'],
    'Pytest': ['pytest'],
    'Selenium': ['selenium'],
    'Cypress': ['cypress'],
    'JUnit': ['junit'],
    
    # Other Tools
    'Linux': ['linux', 'unix'],
    'Agile': ['agile', 'scrum', 'kanban'],
    'Jira': ['jira'],
    'Microservices': ['microservices', 'micro services'],
    'API Design': ['api design', 'api development'],
}


def extract_skills_from_job_pattern(job_description: str) -> List[str]:
    """
    Extract skills from job description using pattern matching (FREE - no API calls).
    
    Args:
        job_description: The job description text
        
    Returns:
        List of extracted skills
    """
    if not job_description:
        return []
    
    job_lower = job_description.lower()
    found_skills = set()
    
    # Search for each skill and its variations
    for skill_name, variations in _SKILL_KEYWORDS.items():
        for variation in variations:
            # Use word boundaries to avoid partial matches
            pattern = r'\b' + re.escape(variation) + r'\b'
            if re.search(pattern, job_lower, re.IGNORECASE):
                found_skills.add(skill_name)
                break  # Found this skill, move to next
    
    return list(found_skills)


def normalize_skill(skill: str) -> str:
    """
    Normalize a skill name to match against our database.
    
    Args:
        skill: Raw skill name
        
    Returns:
        Normalized skill name
    """
    skill_lower = skill.lower().strip()
    
    # Check if this skill matches any in our database
    for standard_name, variations in _SKILL_KEYWORDS.items():
        if skill_lower in [v.lower() for v in variations]:
            return standard_name
        if skill_lower == standard_name.lower():
            return standard_name
    
    # Return original if not found (capitalized)
    return skill.strip().title()


def calculate_match_score_pattern(cv_skills: List[str], job_skills: List[str]) -> Dict:
    """
    Calculate match score between CV skills and job requirements using pattern matching.
    
    Args:
        cv_skills: List of skills from user's CV
        job_skills: List of required skills from job
        
    Returns:
        Dictionary with match details
    """
    if not job_skills:
        return {
            'score': 0,
            'percentage': 0,
            'exact_matches': [],
            'partial_matches': [],
            'missing_skills': [],
            'total_required': 0,
            'matched_count': 0
        }
    
    # Normalize skills
    cv_skills_normalized = [normalize_skill(s) for s in cv_skills]
    job_skills_normalized = [normalize_skill(s) for s in job_skills]
    
    cv_skills_lower = [s.lower() for s in cv_skills_normalized]
    job_skills_lower = [s.lower() for s in job_skills_normalized]
    
    # Find exact matches
    exact_matches = []
    for cv_skill in cv_skills_normalized:
        if cv_skill.lower() in job_skills_lower:
            exact_matches.append(cv_skill)
    
    # Find partial matches (substring matching)
    partial_matches = []
    matched_job_skills = set(s.lower() for s in exact_matches)
    
    for cv_skill in cv_skills_normalized:
        cv_lower = cv_skill.lower()
        if cv_lower in matched_job_skills:
            continue
            
        for job_skill in job_skills_normalized:
            job_lower = job_skill.lower()
            if job_lower in matched_job_skills:
                continue
                
            # Check for substring match
            if (cv_lower in job_lower or job_lower in cv_lower) and cv_lower != job_lower:
                partial_matches.append((cv_skill, job_skill))
                matched_job_skills.add(job_lower)
                break
    
    # Calculate score
    total_required = len(job_skills_normalized)
    exact_count = len(exact_matches)
    partial_count = len(partial_matches)
    
    score = exact_count + (partial_count * 0.5)
    percentage = (score / total_required) * 100 if total_required > 0 else 0
    
    # Find missing skills
    for cv_s, job_s in partial_matches:
        matched_job_skills.add(job_s.lower())
    
    missing_skills = [s for s in job_skills_normalized 
                     if s.lower() not in matched_job_skills]
    
    return {
        'score': round(score, 2),
        'percentage': round(percentage, 1),
        'exact_matches': list(set(exact_matches)),
        'partial_matches': partial_matches,
        'missing_skills': missing_skills,
        'total_required': total_required,
        'matched_count': exact_count + partial_count
    }

