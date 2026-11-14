import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.config import settings

logger = logging.getLogger(__name__)

import os
import shutil
import tempfile
from pathlib import Path

def _create_resilient_engine(primary_url: str):
    """
    Constructs an SQLAlchemy engine with automated driver normalization and fallback.
    Supports both psycopg (psycopg3) and psycopg2, and falls back to local SQLite
    if drivers are missing or incompatible so module import never raises ModuleNotFoundError.
    """
    clean_url = (primary_url or "").strip()
    if clean_url.startswith("postgres://"):
        clean_url = clean_url.replace("postgres://", "postgresql://", 1)

    # Auto-add sslmode=require for cloud PostgreSQL hosts (Supabase, Neon, Render) if omitted
    if "sslmode=" not in clean_url and any(h in clean_url for h in ("supabase.com", "supabase.co", "neon.tech", "render.com")):
        sep = "&" if "?" in clean_url else "?"
        clean_url = f"{clean_url}{sep}sslmode=require"

    if "pooler.supabase.com" in clean_url and "@" in clean_url:
        auth_part = clean_url.split("://", 1)[-1].split("@", 1)[0]
        if ":" not in auth_part:
            logger.warning(
                "Notice: Supabase Connection Pooler URL appears to be missing a password (:your_password). "
                "Expected format: postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require"
            )

    is_vercel = os.getenv("VERCEL") == "1" or not os.access(".", os.W_OK)
    if clean_url.startswith("sqlite"):
        if is_vercel and ("/tmp/" not in clean_url and "\\tmp\\" not in clean_url):
            tmp_db = Path(tempfile.gettempdir()) / "jobs.db"
            bundled_db = Path(__file__).resolve().parent.parent / "jobs.db"
            if not tmp_db.exists() and bundled_db.exists():
                try:
                    shutil.copy2(bundled_db, tmp_db)
                    logger.info(f"Copied bundled jobs.db to writable temp location: {tmp_db}")
                except Exception as copy_err:
                    logger.warning(f"Could not copy bundled jobs.db: {copy_err}")
            clean_url = f"sqlite:///{tmp_db.as_posix()}"
        return create_engine(clean_url, connect_args={"check_same_thread": False}, echo=False)

    candidates = [clean_url]
    # Build candidate alternatives for PostgreSQL drivers
    if "postgresql+psycopg://" in clean_url:
        candidates.append(clean_url.replace("postgresql+psycopg://", "postgresql+psycopg2://", 1))
        candidates.append(clean_url.replace("postgresql+psycopg://", "postgresql://", 1))
    elif "postgresql+psycopg2://" in clean_url:
        candidates.append(clean_url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1))
        candidates.append(clean_url.replace("postgresql+psycopg2://", "postgresql://", 1))
    elif clean_url.startswith("postgresql://"):
        candidates.append(clean_url.replace("postgresql://", "postgresql+psycopg://", 1))
        candidates.append(clean_url.replace("postgresql://", "postgresql+psycopg2://", 1))

    # Add local SQLite as ultimate fallback if PostgreSQL drivers are missing
    sqlite_fallback = "sqlite:////tmp/jobs.db" if is_vercel else "sqlite:///./jobs.db"
    candidates.append(sqlite_fallback)

    last_exc = None
    for cand in candidates:
        try:
            cand_args = {"check_same_thread": False} if cand.startswith("sqlite") else {}
            cand_kwargs = {"echo": False}
            if not cand.startswith("sqlite"):
                cand_kwargs["pool_pre_ping"] = True
                cand_kwargs["pool_recycle"] = 300
                cand_kwargs["pool_size"] = 5
                cand_kwargs["max_overflow"] = 10
            eng = create_engine(cand, connect_args=cand_args, **cand_kwargs)
            masked = cand.split("@")[-1] if "@" in cand else cand
            logger.info(f"Initialized database engine with: {masked}")
            return eng
        except (ModuleNotFoundError, ImportError) as mod_err:
            masked = cand.split("@")[-1] if "@" in cand else cand
            logger.warning(f"Database driver missing for {masked}: {mod_err}. Trying alternate...")
            last_exc = mod_err
        except Exception as exc:
            masked = cand.split("@")[-1] if "@" in cand else cand
            logger.warning(f"Could not initialize engine for {masked}: {exc}. Trying alternate...")
            last_exc = exc

    logger.error(f"All candidate engines failed ({last_exc}). Falling back to sqlite:///./jobs.db")
    return create_engine("sqlite:///./jobs.db", connect_args={"check_same_thread": False}, echo=False)


engine = _create_resilient_engine(settings.DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _migrate_table_columns(eng):
    """Safely adds newly defined columns to existing database tables if they do not yet exist."""
    new_columns = [
        ("user_profiles", "wellfound_url", "VARCHAR(255) DEFAULT 'https://wellfound.com/u/aryanshh'"),
        ("user_profiles", "twitter_url", "VARCHAR(255) DEFAULT 'https://x.com/aryanshh'"),
        ("user_profiles", "primary_role", "VARCHAR(120) DEFAULT 'Full-Stack Software Engineer'"),
        ("user_profiles", "years_of_experience", "INTEGER DEFAULT 3"),
        ("user_profiles", "notice_period", "VARCHAR(50) DEFAULT 'Immediately available'"),
        ("user_profiles", "relocation_open", "BOOLEAN DEFAULT FALSE"),
        ("user_profiles", "work_authorization", "VARCHAR(50) DEFAULT 'yes'"),
        ("user_profiles", "require_sponsorship", "VARCHAR(50) DEFAULT 'no'"),
        ("user_profiles", "citizenship_country", "VARCHAR(100) DEFAULT 'United States'"),
        ("user_profiles", "personal_pitch", "TEXT DEFAULT ''"),
        ("user_profiles", "proudest_project_highlight", "TEXT DEFAULT ''"),
        ("user_profiles", "eeo_gender", "VARCHAR(60) DEFAULT 'Decline to self-identify'"),
        ("user_profiles", "eeo_race", "VARCHAR(60) DEFAULT 'Decline to self-identify'"),
        ("user_profiles", "eeo_veteran", "VARCHAR(60) DEFAULT 'I am not a protected veteran'"),
        ("user_profiles", "eeo_disability", "VARCHAR(60) DEFAULT 'No, I do not have a disability'"),
        ("user_profiles", "custom_answers", "JSON DEFAULT '{}'"),
        ("user_profiles", "skills_with_years", "JSON DEFAULT '[]'"),
        ("users", "email", "VARCHAR(150)"),
    ]
    try:
        from sqlalchemy import inspect
        inspector = inspect(eng)
        existing_tables = set(inspector.get_table_names())
        for table, col, col_def in new_columns:
            if table in existing_tables:
                existing_cols = {c["name"] for c in inspector.get_columns(table)}
                if col not in existing_cols:
                    try:
                        with eng.connect() as conn:
                            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}"))
                            conn.commit()
                            logger.info(f"Added column {col} to {table}.")
                    except Exception as col_err:
                        logger.warning(f"Column migration warning for {table}.{col}: {col_err}")
    except Exception as inspect_err:
        logger.warning(f"Table inspection notice: {inspect_err}")


def init_db():
    """
    Safely verifies database connectivity and creates tables during application boot.
    If the remote PostgreSQL database is unreachable (e.g., direct IPv6 Supabase host
    on an IPv4-only cloud provider like Render), falls back to local SQLite so the
    container does not exit with status 1 and passes cloud health checks.
    """
    global engine, SessionLocal
    try:
        with engine.connect() as conn:
            pass
        Base.metadata.create_all(bind=engine)
        _migrate_table_columns(engine)
        logger.info("Database initialized successfully with primary DATABASE_URL.")
    except Exception as exc:
        logger.error(
            f"Failed to connect to primary database ({settings.DATABASE_URL}): {exc}\n"
            f"If using Supabase on Render: Render is IPv4-only and Supabase direct connection "
            f"(port 5432) is IPv6-only. Use the Supabase Connection Pooler URI (port 6543) instead:\n"
            f"postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require\n"
            f"Temporarily falling back to local SQLite (jobs.db) so the container stays healthy and online."
        )
        try:
            engine.dispose()
        except Exception:
            pass
        engine = create_engine("sqlite:///./jobs.db", connect_args={"check_same_thread": False}, echo=False)
        SessionLocal.configure(bind=engine)
        try:
            Base.metadata.create_all(bind=engine)
            _migrate_table_columns(engine)
            logger.info("Local SQLite fallback database initialized successfully.")
        except Exception as fallback_err:
            logger.error(f"Fallback SQLite table creation error: {fallback_err}")
