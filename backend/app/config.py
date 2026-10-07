"""Central configuration. Every value can be overridden with an environment variable."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # .../backend


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


class Settings:
    APP_NAME = "PracSync API"

    # --- Security -------------------------------------------------------
    # CHANGE THIS for anything other than a local demo.
    SECRET_KEY = os.getenv("PRACSYNC_SECRET_KEY", "pracsync-dev-secret-change-me-before-real-use-0123456789")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("PRACSYNC_TOKEN_MINUTES", "480"))

    # --- Storage (SQLite now, PostgreSQL later: just change the URL) ----
    DATABASE_URL = os.getenv("PRACSYNC_DATABASE_URL", f"sqlite:///{(BASE_DIR / 'pracsync.db').as_posix()}")
    UPLOAD_DIR = Path(os.getenv("PRACSYNC_UPLOAD_DIR", str(BASE_DIR / "uploads")))

    # --- Uploads ---------------------------------------------------------
    MAX_UPLOAD_MB = int(os.getenv("PRACSYNC_MAX_UPLOAD_MB", "10"))
    ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".zip"}

    # --- CORS ------------------------------------------------------------
    CORS_ORIGINS = [
        o.strip()
        for o in os.getenv(
            "PRACSYNC_CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
        ).split(",")
        if o.strip()
    ]

    # --- Exam behaviour --------------------------------------------------
    ONLINE_WINDOW_SECONDS = 45      # a student is "online" if we heard from them within this window
    SUBMIT_GRACE_SECONDS = 3        # tolerance for network latency when submitting at the very end
    SEED_ON_STARTUP = _bool("PRACSYNC_SEED_ON_STARTUP", True)
    SEED_SAMPLE_ACTIVITY = _bool("PRACSYNC_SEED_SAMPLE_ACTIVITY", True)


settings = Settings()
