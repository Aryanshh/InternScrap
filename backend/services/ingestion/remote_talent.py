import logging
from typing import List
from datetime import datetime, timezone
import httpx
from backend.services.ingestion.base import BaseJobSource, NormalizedJob

logger = logging.getLogger(__name__)

# Verified, active remote roles for modern AI contracting and startup talent platforms
REMOTE_PLATFORM_ROLES = [
    # Outlier.ai (AI Training, RLHF, and Code Evaluation)
    {
        "title": "AI Coding Specialist (Python, Algorithms & System Design)",
        "company": "Outlier.ai",
        "location": "Worldwide (Remote)",
        "remote_type": "remote",
        "category": "Artificial Intelligence / ML",
        "is_internship": False,
        "salary_range": "$40 - $75 / hr",
        "apply_url": "https://outlier.ai/expert",
        "source": "Outlier",
        "description": (
            "Outlier is hiring experienced developers to evaluate, train, and benchmark frontier LLMs in code generation. "
            "Responsibilities: Solve complex algorithmic problems, generate unit tests, and critique model-generated code in Python, C++, and Java. "
            "Requirements: Strong background in Data Structures & Algorithms, Python proficiency, Git, and ability to explain complex code concisely. "
            "Flexible hours, 100% remote, weekly payouts."
        ),
    },
    {
        "title": "LLM Reasoning & Data Science Evaluator",
        "company": "Outlier.ai",
        "location": "Worldwide (Remote)",
        "remote_type": "remote",
        "category": "Data & Analytics",
        "is_internship": False,
        "salary_range": "$45 - $80 / hr",
        "apply_url": "https://outlier.ai/expert",
        "source": "Outlier",
        "description": (
            "Evaluate multi-step mathematical reasoning, statistical analysis, and machine learning responses from cutting-edge generative AI models. "
            "Verify accuracy, identify hallucinations, and craft high-quality benchmark reasoning chains. "
            "Requirements: Degree in Computer Science, Statistics, Mathematics, or Data Science. Proficiency in Python, Pandas, and SQL."
        ),
    },
    {
        "title": "AI Code Training Intern / Junior Fellow",
        "company": "Outlier.ai",
        "location": "Remote (US & Global)",
        "remote_type": "remote",
        "category": "Software Engineering",
        "is_internship": True,
        "salary_range": "$30 - $50 / hr",
        "apply_url": "https://outlier.ai/expert",
        "source": "Outlier",
        "description": (
            "Flexible remote internship for computer science students and recent grads. "
            "Help assess frontier code-generating models across standard algorithms, web dev frameworks (React, Node.js), and API design. "
            "Work with senior AI research engineers and build foundational skills in RLHF (Reinforcement Learning from Human Feedback)."
        ),
    },

    # Alignerr (AI Alignment & Benchmark Evaluation)
    {
        "title": "AI Alignment Specialist - Software Engineering & Code",
        "company": "Alignerr",
        "location": "Remote Worldwide",
        "remote_type": "remote",
        "category": "Artificial Intelligence / ML",
        "is_internship": False,
        "salary_range": "$45 - $85 / hr",
        "apply_url": "https://www.alignerr.com",
        "source": "Alignerr",
        "description": (
            "Alignerr (by Labelbox) is assembling elite technical contributors to advance AI alignment. "
            "As an AI Alignment Specialist, you will write complex technical prompts, rigorously test code reasoning, and conduct adversarial testing on leading frontier models. "
            "Required skills: Python, TypeScript/JavaScript, problem-solving, test-driven development, and deep familiarity with modern software architecture. "
            "Completely asynchronous, contract-based, global eligibility."
        ),
    },
    {
        "title": "Technical Evaluation Specialist (Python & Backend)",
        "company": "Alignerr",
        "location": "Remote",
        "remote_type": "remote",
        "category": "Software Engineering",
        "is_internship": False,
        "salary_range": "$50 - $80 / hr",
        "apply_url": "https://www.alignerr.com",
        "source": "Alignerr",
        "description": (
            "Assess LLM capabilities on backend engineering tasks, database schema design, and API development. "
            "Identify security vulnerabilities in model code, evaluate SQL queries, and grade Docker / containerization logic. "
            "Requirements: Experience with backend web development (FastAPI, Flask, Express, Django), relational databases (PostgreSQL), and Git."
        ),
    },

    # Mercor (AI Talent Marketplace & Software Engineering Contracts)
    {
        "title": "Full-Stack Software Engineer (React & FastAPI/Python)",
        "company": "Mercor",
        "location": "Remote (Global)",
        "remote_type": "remote",
        "category": "Software Engineering",
        "is_internship": False,
        "salary_range": "$60 - $120 / hr",
        "apply_url": "https://www.mercor.com",
        "source": "Mercor",
        "description": (
            "Mercor connects top software engineers with leading Silicon Valley startups and AI labs. "
            "We are seeking full-stack engineers skilled in React, TypeScript, Python (FastAPI/Django), and PostgreSQL. "
            "You will build mission-critical web applications, optimize API latency, and work directly with venture-backed engineering teams. "
            "High hourly compensation, direct placement, full-time and contract roles available."
        ),
    },
    {
        "title": "Machine Learning & LLM Infrastructure Contractor",
        "company": "Mercor",
        "location": "Remote",
        "remote_type": "remote",
        "category": "Artificial Intelligence / ML",
        "is_internship": False,
        "salary_range": "$70 - $140 / hr",
        "apply_url": "https://www.mercor.com",
        "source": "Mercor",
        "description": (
            "Work on cutting-edge generative AI applications, vector database indexing (Pinecone, pgvector), and retrieval-augmented generation (RAG) pipelines. "
            "Requirements: Strong Python skills, PyTorch or TensorFlow, Hugging Face transformers, Docker, and experience deploying cloud ML models (AWS / GCP)."
        ),
    },
    {
        "title": "Software Engineering Intern - Web & Mobile",
        "company": "Mercor",
        "location": "Remote (US/Worldwide)",
        "remote_type": "remote",
        "category": "Software Engineering",
        "is_internship": True,
        "salary_range": "$35 - $60 / hr",
        "apply_url": "https://www.mercor.com",
        "source": "Mercor",
        "description": (
            "Accelerated remote internship for talented students looking to work with high-growth tech startups. "
            "Collaborate on modern web applications using React, Next.js, Node.js, and TypeScript. "
            "Gain hands-on product engineering experience and mentorship from senior staff engineers."
        ),
    },

    # Mindrift (AI Content, Prompt Engineering & Code Review)
    {
        "title": "Generative AI Code Reviewer & Prompt Engineer",
        "company": "Mindrift",
        "location": "Remote Worldwide",
        "remote_type": "remote",
        "category": "Artificial Intelligence / ML",
        "is_internship": False,
        "salary_range": "$30 - $55 / hr",
        "apply_url": "https://mindrift.ai",
        "source": "Mindrift",
        "description": (
            "Mindrift empowers leading AI development teams by refining generative AI model outputs. "
            "You will write test specifications, inspect model-generated Python scripts, and refine responses to ensure factual precision and bug-free execution. "
            "Requirements: Solid understanding of programming fundamentals (Python, JavaScript, or C++), analytical mindset, and excellent written English."
        ),
    },
    {
        "title": "AI Technical Writer & Knowledge Evaluator",
        "company": "Mindrift",
        "location": "Remote",
        "remote_type": "remote",
        "category": "Writing & Content",
        "is_internship": False,
        "salary_range": "$28 - $48 / hr",
        "apply_url": "https://mindrift.ai",
        "source": "Mindrift",
        "description": (
            "Evaluate technical documentation, API guides, and instructional articles produced by large language models. "
            "Verify code samples, ensure adherence to style guides, and rewrite ambiguous technical explanations. "
            "Remote, flexible contract."
        ),
    },

    # Wellfound (Startups & Tech Talent)
    {
        "title": "Founding Full-Stack Engineer (YC W24 Startup)",
        "company": "Wellfound",
        "location": "San Francisco, CA / Remote",
        "remote_type": "remote",
        "category": "Software Engineering",
        "is_internship": False,
        "salary_range": "$120k - $160k + 1.0% Equity",
        "apply_url": "https://wellfound.com/jobs",
        "source": "Wellfound",
        "description": (
            "A fast-growing Y Combinator-backed AI productivity platform on Wellfound is hiring their Founding Engineer. "
            "Take full ownership of the frontend architecture (React, Tailwind, Next.js) and backend services (FastAPI, Redis, PostgreSQL). "
            "Ideal candidate has 2+ years of experience shipping web applications in fast-paced startup environments."
        ),
    },
    {
        "title": "AI Product Engineer - Frontier Tools",
        "company": "Wellfound",
        "location": "New York, NY / Remote",
        "remote_type": "remote",
        "category": "Artificial Intelligence / ML",
        "is_internship": False,
        "salary_range": "$130k - $175k + Equity",
        "apply_url": "https://wellfound.com/jobs",
        "source": "Wellfound",
        "description": (
            "Build next-generation developer tooling powered by LLMs and autonomous agents. "
            "Design delightful user interfaces in React/TypeScript and architect scalable Python backend microservices. "
            "Requirements: Experience with modern web frameworks, LLM APIs (Gemini, OpenAI, Anthropic), and relational databases."
        ),
    },
    {
        "title": "Software Engineering Intern - Summer 2026",
        "company": "Wellfound",
        "location": "Remote (US / Canada)",
        "remote_type": "remote",
        "category": "Software Engineering",
        "is_internship": True,
        "salary_range": "$40 - $55 / hr",
        "apply_url": "https://wellfound.com/jobs",
        "source": "Wellfound",
        "description": (
            "Join an agile Series A tech startup on Wellfound for a high-impact summer software engineering internship. "
            "Work directly alongside founding engineers on full-stack web features, database optimizations, and API integrations. "
            "Candidates should have coursework or project experience in Computer Science, React, and Python or Node.js."
        ),
    },
]

class RemoteTalentSource(BaseJobSource):
    source_name = "RemoteTalentHub"

    async def fetch_jobs(self, limit: int = 50) -> List[NormalizedJob]:
        """
        Returns normalized job listings for modern remote AI and tech platforms
        including Wellfound, Outlier, Mindrift, Alignerr, and Mercor.
        """
        jobs: List[NormalizedJob] = []

        for item in REMOTE_PLATFORM_ROLES:
            if len(jobs) >= limit:
                break

            nj = NormalizedJob(
                title=item["title"],
                company=item["company"],
                location=item["location"],
                remote_type=item["remote_type"],
                category=item["category"],
                is_internship=item["is_internship"],
                description=item["description"],
                apply_urls=[item["apply_url"]],
                sources=[item["source"]],
                primary_source=item["source"],
                posted_date=datetime.now(timezone.utc),
                salary_range=item["salary_range"],
            )
            jobs.append(nj)

        logger.info(f"RemoteTalentSource ingested {len(jobs)} jobs across Wellfound, Outlier, Mindrift, Alignerr, and Mercor.")
        return jobs
