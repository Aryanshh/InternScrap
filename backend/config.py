import os
import json
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "JobAggregator"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./jobs.db")
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

    @field_validator("CORS_ORIGINS", mode="after")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return [
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                    "http://localhost:3000",
                    "http://127.0.0.1:3000"
                ]
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return list(v)
    # Optional API keys
    ADZUNA_APP_ID: str = os.getenv("ADZUNA_APP_ID", "")
    ADZUNA_APP_KEY: str = os.getenv("ADZUNA_APP_KEY", "")
    THEMUSE_API_KEY: str = os.getenv("THEMUSE_API_KEY", "")

    # Threads Opportunity Scanner & Alerts
    THREADS_ACCESS_TOKEN: str = os.getenv("THREADS_ACCESS_TOKEN", "")
    THREADS_APIFY_TOKEN: str = os.getenv("THREADS_APIFY_TOKEN", "")
    THREADS_APIFY_ACTOR_ID: str = os.getenv("THREADS_APIFY_ACTOR_ID", "apidojo~threads-scraper")
    THREADS_WEBHOOK_URL: str = os.getenv("THREADS_WEBHOOK_URL", "")
    THREADS_TELEGRAM_BOT_TOKEN: str = os.getenv("THREADS_TELEGRAM_BOT_TOKEN", "")
    THREADS_TELEGRAM_CHAT_ID: str = os.getenv("THREADS_TELEGRAM_CHAT_ID", "")
    THREADS_SCAN_INTERVAL_MINUTES: int = int(os.getenv("THREADS_SCAN_INTERVAL_MINUTES", "30"))

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
