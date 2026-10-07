"""
Local-disk file storage for submissions.

The rest of the app only talks to `storage` (save / resolve / delete), so swapping this class
for S3 / Azure Blob / GCS later does not touch any router code.
"""
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Tuple

from fastapi import HTTPException, UploadFile

from app.config import settings

_CHUNK = 1024 * 1024
_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


def safe_name(name: str) -> str:
    base = Path(name or "file").name
    cleaned = _SAFE.sub("_", base).strip("._") or "file"
    return cleaned[-100:]


def _check_signature(ext: str, head: bytes) -> bool:
    if ext == ".pdf":
        return head.startswith(b"%PDF")
    if ext in (".docx", ".zip"):
        return head.startswith(b"PK")
    if ext == ".txt":
        return b"\x00" not in head
    return False


class LocalStorage:
    def __init__(self, root: Path):
        self.root = root

    def _ensure(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def save_upload(self, upload: UploadFile, exam_id: int, student_id: int) -> Tuple[str, str]:
        """Validate and store an upload. Returns (relative_path, original_filename)."""
        original = (upload.filename or "").strip()
        ext = Path(original).suffix.lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            allowed = ", ".join(sorted(e.lstrip(".").upper() for e in settings.ALLOWED_EXTENSIONS))
            raise HTTPException(400, f"Unsupported file type. Allowed types: {allowed}.")

        max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
        rel = f"exam_{exam_id}/student_{student_id}_{stamp}_{safe_name(original)}"
        dest = self.root / rel
        self._ensure()
        dest.parent.mkdir(parents=True, exist_ok=True)

        size, head = 0, b""
        try:
            with open(dest, "wb") as out:
                while True:
                    chunk = upload.file.read(_CHUNK)
                    if not chunk:
                        break
                    if not head:
                        head = chunk[:8192]
                    size += len(chunk)
                    if size > max_bytes:
                        raise HTTPException(413, f"File is too large. Maximum size is {settings.MAX_UPLOAD_MB} MB.")
                    out.write(chunk)
            if size == 0:
                raise HTTPException(400, "The selected file is empty.")
            if not _check_signature(ext, head):
                raise HTTPException(400, f"The file content does not look like a valid {ext.lstrip('.').upper()} file.")
        except Exception:
            dest.unlink(missing_ok=True)
            raise
        return rel, original

    def save_text(self, text: str, exam_id: int, student_id: int, name: str = "answer.txt") -> Tuple[str, str]:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
        rel = f"exam_{exam_id}/student_{student_id}_{stamp}_{safe_name(name)}"
        dest = self.root / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(text, encoding="utf-8")
        return rel, name

    def resolve(self, rel: str) -> Path:
        root = self.root.resolve()
        path = (root / rel).resolve()
        if root not in path.parents and path != root:      # path-traversal guard
            raise HTTPException(400, "Invalid file path.")
        return path

    def delete(self, rel: str) -> None:
        try:
            self.resolve(rel).unlink(missing_ok=True)
        except HTTPException:
            pass


storage = LocalStorage(settings.UPLOAD_DIR)
