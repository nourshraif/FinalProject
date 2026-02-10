"""
Test script for skill matching functionality.
"""

from matching.similarity import match_skills

# Example data
cv_skills = ["Python programming", "Machine learning", "SQL"]
job_skills = ["Deep learning", "Python developer", "Database management"]

# Call the function
results = match_skills(cv_skills, job_skills)

# Print each result clearly
print("=" * 80)
print("SKILL MATCHING RESULTS")
print("=" * 80)
print()

for i, result in enumerate(results, 1):
    print(f"Match {i}:")
    print(f"  CV Skill:        {result['cv_skill']}")
    print(f"  Best Job Match:  {result['best_job_match']}")
    print(f"  Similarity Score: {result['score']:.4f}")
    print()

print("=" * 80)
