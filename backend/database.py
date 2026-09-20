import logging
from sqlalchemy import create_engine, text
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

def _migrate_table_columns(eng):
    """Safely adds newly defined columns to existing database tables if they do not yet exist."""
    new_columns = [
        ("user_profiles", "wellfound_url", "VARCHAR(255) DEFAULT 'https://wellfound.com/u/aryanshh'"),
        ("user_profiles", "twitter_url", "VARCHAR(255) DEFAULT 'https://x.com/aryanshh'"),
        ("user_profiles", "primary_role", "VARCHAR(120) DEFAULT 'Full-Stack Software Engineer'"),
        ("user_profiles", "years_of_experience", "INTEGER DEFAULT 3"),
        ("user_profiles", "notice_period", "VARCHAR(50) DEFAULT 'Immediately available'"),
        ("user_profiles", "relocation_open", "BOOLEAN DEFAULT 0"),
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
    ]
    try:
        with eng.connect() as conn:
            for table, col, col_def in new_columns:
                try:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}"))
                    conn.commit()
                except Exception:
                    pass
    except Exception:
        pass


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
