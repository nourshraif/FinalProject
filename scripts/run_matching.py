"""
Simple script to run skill matching with custom skills.

Modify the cv_skills and job_skills lists below to test your own data.
"""

from app.services.matching_service import match_skills


# ============================================
# CUSTOMIZE THESE LISTS WITH YOUR OWN SKILLS
# ============================================
cv_skills = [
    "Python programming",
    "Machine learning",
    "SQL",
    "Web development",
]

job_skills = [
    "Deep learning",
    "Python developer",
    "Database management",
    "Frontend development",
    "Backend development",
]


def main() -> None:
    """Run a demo matching session with the configured skills."""
    print("Running skill matching...")
    print(f"CV Skills: {cv_skills}")
    print(f"Job Skills: {job_skills}")
    print()

    results = match_skills(cv_skills, job_skills)

    print("=" * 80)
    print("MATCHING RESULTS")
    print("=" * 80)
    print()

    for i, result in enumerate(results, 1):
        print(f"Match {i}:")
        print(f"  CV Skill:         {result['cv_skill']}")
        print(f"  Best Job Match:   {result['best_job_match']}")
        print(f"  Similarity Score: {result['score']:.4f}")
        print()

    print("=" * 80)

    # Summary statistics
    avg_score = sum(r["score"] for r in results) / len(results)
    print(f"\nAverage Match Score: {avg_score:.4f}")
    print(f"Total Matches: {len(results)}")


if __name__ == "__main__":
    main()

