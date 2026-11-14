"""
Vercel Serverless Function entrypoint for InternScrap FastAPI backend.
"""
import os
import sys
import shutil
import tempfile
from pathlib import Path

# Add project root to sys.path so backend modules import cleanly
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# On Vercel, filesystem is read-only except /tmp.
# Copy seed jobs.db to /tmp/jobs.db if using default sqlite so database is writable
is_serverless = os.getenv("VERCEL") == "1" or not os.access(ROOT_DIR, os.W_OK)
if is_serverless and not os.getenv("DATABASE_URL"):
    tmp_db = Path(tempfile.gettempdir()) / "jobs.db"
    bundled_db = ROOT_DIR / "jobs.db"
    if not tmp_db.exists() and bundled_db.exists():
        try:
            shutil.copy2(bundled_db, tmp_db)
        except Exception:
            pass
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp_db.as_posix()}"

from backend.main import app
