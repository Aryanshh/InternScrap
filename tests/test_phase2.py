import os
import sys
import io

sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.services.resume_parser import parse_resume, extract_skills
from backend.services.matching_engine import evaluate_job_match, compute_keyword_match, compute_semantic_match

SAMPLE_RESUME_TEXT = """
Aryanshh Srivastava
Full-Stack Engineer & AI Developer
Email: aryanshh@example.com | GitHub: github.com/aryanshh | San Francisco, CA

PROFESSIONAL SUMMARY
Results-driven software engineer with 3+ years of experience developing robust full-stack web applications, 
data pipelines, and AI systems. Proficient in Python, FastAPI, React, TypeScript, PostgreSQL, and Docker.

TECHNICAL SKILLS
Languages: Python, TypeScript, JavaScript, SQL, Bash
Frontend: React, Next.js, Tailwind CSS, HTML5, CSS3, Redux
Backend: FastAPI, Flask, Node.js, Express, RESTful APIs, GraphQL
Databases: PostgreSQL, Redis, SQLite, Supabase
Cloud & DevOps: Docker, AWS (S3, EC2), Git, GitHub Actions, Linux
AI / Machine Learning: PyTorch, Scikit-learn, Hugging Face, LLM, RAG

WORK EXPERIENCE
Software Engineer | Apex Tech Solutions (2023 - Present)
- Designed and maintained scalable RESTful microservices using Python and FastAPI, serving 100k+ daily users.
- Developed modern responsive client dashboards using React, TypeScript, and Tailwind CSS.
- Optimized PostgreSQL database queries, reducing average API response latency by 35%.
- Implemented automated CI/CD pipelines using GitHub Actions and Docker containerization.

AI Engineering Intern | DeepData Labs (Summer 2022)
- Built Retrieval-Augmented Generation (RAG) pipelines using Python, PyTorch, and vector search.
- Fine-tuned transformer models for domain-specific text classification with Scikit-learn and Hugging Face.

PROJECTS
JobAggregator Platform
- Engineered a full-stack aggregator with deduplication, FastAPI backend, and React Vite frontend.
- Integrated sentence-transformers for local semantic resume matching and automated gap analysis.

EDUCATION
Bachelor of Science in Computer Science | State University (Graduated May 2023)
- GPA: 3.8 / 4.0
"""

def test_resume_parser():
    print("--- 1. Testing Resume Parsing & Extraction ---", flush=True)
    res = parse_resume(SAMPLE_RESUME_TEXT.encode("utf-8"), "aryan_resume.txt")
    parsed = res["parsed_json"]
    
    print(f" Extracted Skills ({len(parsed['skills'])}): {parsed['skills'][:8]}...", flush=True)
    print(f" Extracted Tools ({len(parsed['tools'])}): {parsed['tools']}", flush=True)
    print(f" Extracted Experience Bullets ({len(parsed['experience'])}): {parsed['experience'][0][:60]}...", flush=True)
    print(f" Extracted Education: {parsed['education']}", flush=True)
    
    assert "Python" in parsed["skills"], "Python should be detected"
    assert "React" in parsed["skills"], "React should be detected"
    assert "Fastapi" in parsed["skills"], "FastAPI should be detected"
    assert "Docker" in parsed["tools"], "Docker should be in tools"
    assert len(parsed["experience"]) >= 4, "Experience bullets should be extracted"
    print(" Resume Parser Unit Tests PASSED!\n", flush=True)
    return res

def test_matching_engine(resume_data):
    print("--- 2. Testing Honest Matching Engine & Factual Gap Analysis ---", flush=True)
    
    # Case A: High match software role
    matching_jd = """
    We are looking for a Senior Python Developer with expertise in FastAPI, PostgreSQL, Docker, and React.
    Responsibilities:
    - Build performant backend APIs in Python and FastAPI.
    - Write unit tests, manage Docker images, and maintain PostgreSQL database schemas.
    - Collaborate with frontend team building React components.
    Requirements:
    - Strong proficiency in Python, FastAPI, PostgreSQL, and Docker.
    - Familiarity with React and Git.
    - Experience with Kubernetes is a plus.
    """
    
    match_a = evaluate_job_match(matching_jd, resume_data)
    print(f"\n[Case A: Relevant Python/FastAPI JD]")
    print(f"  Blended Match Score: {match_a['blended_score']}% (Semantic: {match_a['semantic_score']}%, Keyword: {match_a['keyword_score']}%)")
    print(f"  Matched Skills: {match_a['matched_skills']}")
    print(f"  Factual Gap List (Missing): {match_a['gap_list']}")
    
    assert match_a["blended_score"] >= 65.0, f"Expected high match score, got {match_a['blended_score']}"
    assert "Kubernetes" in match_a["gap_list"], "Kubernetes was in JD but absent from resume, must be in gap_list!"
    assert "Fastapi" in match_a["matched_skills"] or "Python" in match_a["matched_skills"], "Python/FastAPI must match"

    # Case B: Completely mismatched role (Bio-Medical Nurse)
    mismatched_jd = """
    Registered Nurse (RN) - Intensive Care Unit.
    Requirements:
    - Active RN license and BLS/ACLS certification.
    - 2+ years of clinical nursing experience in acute care or hospital telemetry.
    - Knowledge of patient triage, phlebotomy, medication administration, and bedside patient care.
    - Degree in Nursing (BSN) required.
    """
    
    match_b = evaluate_job_match(mismatched_jd, resume_data)
    print(f"\n[Case B: Irrelevant Clinical Nurse JD]")
    print(f"  Blended Match Score: {match_b['blended_score']}% (Semantic: {match_b['semantic_score']}%, Keyword: {match_b['keyword_score']}%)")
    print(f"  Factual Gap List: {match_b['gap_list']}")
    
    assert match_b["blended_score"] <= 35.0, f"Expected low match score for nursing job, got {match_b['blended_score']}"
    print("\n Matching Engine Unit Tests PASSED! Scores are non-inflated and gap analysis is factual.\n", flush=True)

if __name__ == "__main__":
    resume_res = test_resume_parser()
    test_matching_engine(resume_res)
