from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import require_student
from app.config import settings
from app.constants import AssignmentStatus, EventType, ExamStatus, SubmissionStatus
from app.database import get_db
from app.models import Assignment, Exam, Experiment, Submission, User
from app.schemas.activity import ActivityIn, DraftIn
from app.services import activity_service, anomaly_service, exam_service, monitor_service
from app.services.storage import storage
from app.utils.time import iso, utcnow
from datetime import timedelta

router = APIRouter(prefix="/api/student", tags=["student"])

SCORED_OR_MEANINGFUL = {"TAB_SWITCH", "WINDOW_BLUR", "COPY_ATTEMPT", "PASTE_ATTEMPT"}


def _card(db: Session, exam: Exam, student: User) -> dict:
    a = exam_service.get_assignment(db, student.id, exam.id)
    state = exam_service.sync_assignment(db, exam, a) if a else "NOT_STARTED"
    exp = db.get(Experiment, a.experiment_id) if a else None
    sub = db.scalar(select(Submission).where(Submission.student_id == student.id, Submission.exam_id == exam.id))
    can_start = a is None and exam.status == ExamStatus.ACTIVE
    return {
        "exam": monitor_service.serialize_exam_brief(exam),
        "state": state,                         # NOT_STARTED | IN_PROGRESS | SUBMITTED | EXPIRED
        "can_start": can_start,
        "experiment": {"id": exp.id, "title": exp.title, "difficulty": exp.difficulty} if exp else None,
        "remaining_seconds": exam_service.remaining_seconds(exam, a) if a and state == AssignmentStatus.IN_PROGRESS else None,
        "submission": monitor_service.serialize_submission(sub, with_text=False) if sub else None,
    }


def _visible_exams(db: Session, student: User):
    mine = select(Assignment.exam_id).where(Assignment.student_id == student.id)
    return list(
        db.scalars(
            select(Exam)
            .where((Exam.status == ExamStatus.ACTIVE) | (Exam.id.in_(mine)))
            .order_by(Exam.created_at.desc(), Exam.id.desc())
        )
    )


@router.get("/dashboard")
def dashboard(student: User = Depends(require_student), db: Session = Depends(get_db)):
    return {
        "student": {"id": student.id, "name": student.name, "email": student.email},
        "exams": [_card(db, e, student) for e in _visible_exams(db, student)],
        "server_time": iso(utcnow()),
    }


@router.get("/submissions")
def my_submissions(student: User = Depends(require_student), db: Session = Depends(get_db)):
    q = (
        select(Submission, Exam, Experiment)
        .join(Exam, Exam.id == Submission.exam_id)
        .join(Experiment, Experiment.id == Submission.experiment_id)
        .where(Submission.student_id == student.id)
        .order_by(Submission.submitted_at.desc())
    )
    items = []
    for sub, exam, exp in db.execute(q).all():
        d = monitor_service.serialize_submission(sub)
        d.update({"exam_title": exam.title, "experiment_title": exp.title})
        items.append(d)
    return {"items": items}


@router.post("/exams/{exam_id}/start")
def start_exam(exam_id: int, student: User = Depends(require_student), db: Session = Depends(get_db)):
    exam = exam_service.get_exam_or_404(db, exam_id)
    exam_service.start_exam_for_student(db, student, exam)
    return _card(db, exam, student)


@router.get("/exams/{exam_id}/session")
def session(exam_id: int, student: User = Depends(require_student), db: Session = Depends(get_db)):
    """Full workspace payload. The deadline always comes from the server, so a refresh never resets the clock."""
    exam = exam_service.get_exam_or_404(db, exam_id)
    a = exam_service.get_assignment(db, student.id, exam.id)
    if a is None:
        raise HTTPException(409, "You have not started this examination yet.")
    state = exam_service.sync_assignment(db, exam, a)
    exp = db.get(Experiment, a.experiment_id)
    sub = db.scalar(select(Submission).where(Submission.student_id == student.id, Submission.exam_id == exam.id))
    now = utcnow()
    return {
        "exam": monitor_service.serialize_exam_brief(exam),
        "student": {"id": student.id, "name": student.name},
        "state": state,
        "experiment": {
            "id": exp.id, "title": exp.title, "description": exp.description,
            "instructions": exp.instructions, "difficulty": exp.difficulty,
        },
        "reassigned_count": a.reassigned_count,
        "started_at": iso(a.assigned_at),
        "deadline": iso(exam_service.compute_deadline(exam, a)),
        "server_time": iso(now),
        "remaining_seconds": exam_service.remaining_seconds(exam, a, now),
        "draft_text": a.draft_text or "",
        "submission": monitor_service.serialize_submission(sub, with_text=False) if sub else None,
        "activity_summary": activity_service.summary(db, student.id, exam.id),
        "allowed_extensions": sorted(settings.ALLOWED_EXTENSIONS),
        "max_upload_mb": settings.MAX_UPLOAD_MB,
    }


@router.put("/exams/{exam_id}/draft")
def save_draft(exam_id: int, payload: DraftIn, student: User = Depends(require_student), db: Session = Depends(get_db)):
    exam = exam_service.get_exam_or_404(db, exam_id)
    a = exam_service.get_assignment(db, student.id, exam.id)
    if a is None:
        raise HTTPException(409, "You have not started this examination yet.")
    if exam_service.sync_assignment(db, exam, a) != AssignmentStatus.IN_PROGRESS:
        raise HTTPException(409, "This examination is no longer accepting changes.")
    a.draft_text = payload.text
    db.commit()
    return {"saved_at": iso(utcnow())}


@router.post("/exams/{exam_id}/activity")
def post_activity(exam_id: int, payload: ActivityIn, student: User = Depends(require_student), db: Session = Depends(get_db)):
    exam = exam_service.get_exam_or_404(db, exam_id)
    a = exam_service.get_assignment(db, student.id, exam.id)
    if a is None:
        raise HTTPException(409, "You have not started this examination yet.")
    state = exam_service.sync_assignment(db, exam, a)
    base = {
        "state": state,
        "remaining_seconds": exam_service.remaining_seconds(exam, a),
        "server_time": iso(utcnow()),
        "experiment_id": a.experiment_id,
        "reassigned_count": a.reassigned_count,
    }
    # Events after submission / expiry are ignored (so e.g. leaving the page after submitting is never flagged).
    if state != AssignmentStatus.IN_PROGRESS:
        return {**base, "recorded": False}

    activity_service.record_event(db, student.id, exam.id, payload.event_type, payload.event_data)
    if payload.event_type != EventType.HEARTBEAT:
        anomaly_service.recompute(db, exam, student.id)
    return {**base, "recorded": True, "summary": activity_service.summary(db, student.id, exam.id)}


@router.post("/exams/{exam_id}/submit")
def submit(
    exam_id: int,
    answer_text: str = Form(default=""),
    file: Optional[UploadFile] = File(default=None),
    student: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    exam = exam_service.get_exam_or_404(db, exam_id)
    a = exam_service.get_assignment(db, student.id, exam.id)
    if a is None:
        raise HTTPException(409, "You have not started this examination yet.")

    if a.status == AssignmentStatus.SUBMITTED:
        raise HTTPException(409, "You have already submitted this examination.")
    now = utcnow()
    # Small network-latency grace applies only to natural timer expiry, never after faculty ends the exam.
    grace = timedelta(seconds=settings.SUBMIT_GRACE_SECONDS) if exam.status == ExamStatus.ACTIVE else timedelta(0)
    if now > exam_service.compute_deadline(exam, a) + grace:
        exam_service.sync_assignment(db, exam, a)
        raise HTTPException(403, "Time is up. This examination has expired and can no longer be submitted.")

    has_file = file is not None and bool((file.filename or "").strip())
    text = (answer_text or "").strip()
    if not has_file and not text:
        raise HTTPException(400, "Upload a solution file or write an answer in the workspace before submitting.")

    if has_file:
        rel, original = storage.save_upload(file, exam.id, student.id)
    else:
        rel, original = storage.save_text(text, exam.id, student.id, "workspace_answer.txt")

    sub = Submission(
        student_id=student.id, exam_id=exam.id, experiment_id=a.experiment_id,
        file_name=original, file_path=rel, answer_text=text or None,
        submitted_at=now, status=SubmissionStatus.SUBMITTED,
    )
    db.add(sub)
    a.status = AssignmentStatus.SUBMITTED
    if text:
        a.draft_text = text
    db.commit()

    activity_service.record_event(db, student.id, exam.id, EventType.SUBMISSION, {"file_name": original})
    anomaly_service.recompute(db, exam, student.id)   # lets the rapid-submission rule run
    return {"message": "Practical submitted successfully.", "submission": monitor_service.serialize_submission(sub, with_text=False)}
