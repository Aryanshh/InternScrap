from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.database import Base, engine
from backend.routes.jobs import router as jobs_router
from backend.routes.resumes import router as resumes_router
from backend.routes.tailoring import router as tailoring_router
from backend.routes.tracker import router as tracker_router
from backend.routes.scheduler import router as scheduler_router
from backend.routes.profile import router as profile_router
from backend.routes.auto_apply import router as auto_apply_router
from backend.routes.auth import router as auth_router, seed_default_users
from backend.services.scheduler import start_scheduler, shutdown_scheduler
import backend.models # Ensure models are loaded

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables
    Base.metadata.create_all(bind=engine)
    # Seed default login accounts and profiles: demo, Aryanshh, Nishtha
    from backend.database import SessionLocal
    from backend.routes.profile import seed_all_profiles
    db = SessionLocal()
    try:
        seed_default_users(db)
        seed_all_profiles(db)
    finally:
        db.close()
    start_scheduler()
    yield
    shutdown_scheduler()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Job & Internship Aggregator API with ToS-compliant multi-source ingestion",
    version="1.0.0",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for dev/testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs_router)
app.include_router(resumes_router)
app.include_router(tailoring_router)
app.include_router(tracker_router)
app.include_router(scheduler_router)
app.include_router(profile_router)
app.include_router(auto_apply_router)
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "status": "healthy",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
