import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "JobAggregator"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./jobs.db")
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]
    # Optional API keys
    ADZUNA_APP_ID: str = os.getenv("ADZUNA_APP_ID", "")
    ADZUNA_APP_KEY: str = os.getenv("ADZUNA_APP_KEY", "")
    THEMUSE_API_KEY: str = os.getenv("THEMUSE_API_KEY", "")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
