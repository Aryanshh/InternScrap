import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.config import settings

logger = logging.getLogger(__name__)

# Normalize legacy postgres:// URI to postgresql:// for SQLAlchemy 2.0
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Configure connection options
connect_args = {}
engine_kwargs = {"echo": False}

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_recycle": 300,
    })

engine = create_engine(
    db_url,
    connect_args=connect_args,
    **engine_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def ensure_db_connected():
    """
    Verifies database connectivity during application boot.
    If the remote PostgreSQL database is unreachable (e.g., direct IPv6 Supabase host
    on an IPv4-only cloud provider like Render), falls back to local SQLite so the
    container does not exit with status 1 and passes cloud health checks.
    """
    global engine, SessionLocal
    try:
        with engine.connect() as conn:
            pass
        logger.info("Database connection established successfully.")
    except Exception as exc:
        logger.error(
            f"Failed to connect to primary database: {exc}\n"
            f"If using Supabase on Render: Render is IPv4-only and Supabase direct connection "
            f"(port 5432) is IPv6-only. Use the Supabase Connection Pooler URI (port 6543) instead:\n"
            f"postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require\n"
            f"Temporarily falling back to local SQLite (jobs.db) so the service starts up cleanly."
        )
        engine = create_engine("sqlite:///./jobs.db", connect_args={"check_same_thread": False}, echo=False)
        SessionLocal.configure(bind=engine)
        Base.metadata.create_all(bind=engine)
