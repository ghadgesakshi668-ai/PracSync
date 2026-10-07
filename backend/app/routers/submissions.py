import mimetypes

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.constants import Role
from app.database import get_db
from app.models import Submission, User
from app.services.storage import storage

router = APIRouter(prefix="/api/submissions", tags=["submissions"])


@router.get("/{submission_id}/download")
def download(submission_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sub = db.get(Submission, submission_id)
    if sub is None:
        raise HTTPException(404, "Submission not found.")
    if user.role != Role.FACULTY and sub.student_id != user.id:
        raise HTTPException(403, "You do not have access to this submission.")
    path = storage.resolve(sub.file_path)
    if not path.is_file():
        raise HTTPException(404, "The stored file could not be found on the server.")
    media = mimetypes.guess_type(sub.file_name)[0] or "application/octet-stream"
    return FileResponse(path, filename=sub.file_name, media_type=media)
