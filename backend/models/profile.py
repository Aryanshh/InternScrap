import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, JSON, Float, Integer, Boolean
from backend.database import Base

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(String(36), primary_key=True, default="default_user")
    full_name = Column(String(120), default="Aryanshh Srivastava")
    email = Column(String(120), default="candidate@example.com")
    phone = Column(String(50), default="+1 (555) 019-2834")
    location = Column(String(120), default="San Francisco, CA / Remote Worldwide")
    headline = Column(String(160), default="Full-Stack Software Engineer & AI Alignment Evaluator")
    bio = Column(
        Text,
        default=(
            "Software engineer with expertise in React, TypeScript, Python, FastAPI, and distributed systems. "
            "Passionate about building robust web applications, fine-tuning LLM benchmarks, and working with frontier tech startups."
        ),
    )
    github_url = Column(String(255), default="https://github.com/aryansharma")
    linkedin_url = Column(String(255), default="https://linkedin.com/in/aryansharma")
    portfolio_url = Column(String(255), default="https://aryansharma.dev")

    # Preferences
    desired_work_mode = Column(String(50), default="remote")  # remote, hybrid, on-site, any
    min_salary = Column(Integer, default=110000)
    min_hourly_rate = Column(Float, default=45.0)
    target_platforms = Column(
        JSON,
        default=lambda: ["Wellfound", "Outlier", "Mercor", "Alignerr", "Mindrift", "RemoteOK"],
    )

    # Structured Career Data
    skills = Column(
        JSON,
        default=lambda: [
            "Python",
            "TypeScript",
            "JavaScript",
            "React",
            "FastAPI",
            "Node.js",
            "PostgreSQL",
            "Docker",
            "Git",
            "Tailwind CSS",
            "REST APIs",
            "SQL",
            "PyTorch",
            "Prompt Engineering",
            "RLHF",
        ],
    )
    experience = Column(
        JSON,
        default=lambda: [
            {
                "company": "TechNova Solutions",
                "role": "Full-Stack Software Engineer",
                "location": "Remote",
                "start_date": "Jun 2023",
                "end_date": "Present",
                "bullets": [
                    "Architected high-throughput REST APIs in FastAPI and PostgreSQL, serving 120k daily requests with sub-50ms latency.",
                    "Engineered modern responsive frontends with React, TypeScript, and Tailwind CSS, improving load speed by 38%.",
                    "Implemented CI/CD automated test pipelines using Docker and GitHub Actions, reducing release cycle time by 45%.",
                ],
            },
            {
                "company": "DataSphere AI",
                "role": "AI Research & Evaluation Contractor",
                "location": "Remote",
                "start_date": "Jan 2023",
                "end_date": "May 2023",
                "bullets": [
                    "Evaluated and benchmarked reasoning capabilities of frontier generative AI coding models across Python, C++, and SQL.",
                    "Designed adversarial test cases and human-in-the-loop evaluation pipelines for RLHF alignment.",
                ],
            },
        ],
    )
    education = Column(
        JSON,
        default=lambda: [
            {
                "institution": "University of California, Berkeley",
                "degree": "B.S. in Computer Science",
                "grad_year": "2024",
                "gpa": "3.85 / 4.0",
            }
        ],
    )

    # Notifications & Alerts
    digest_enabled = Column(Boolean, default=True)
    digest_frequency = Column(String(50), default="4h")
    digest_min_score = Column(Float, default=70.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
