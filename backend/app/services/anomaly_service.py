"""Runs the anomaly engine for one (student, exam) and stores the latest result."""
import json
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.anomaly import DISCLAIMER, analyze
from app.constants import Severity
from app.models import Anomaly, Assignment, Exam, Submission
from app.services import activity_service
from app.utils.time import iso, utcnow


def recompute(db: Session, exam: Exam, student_id: int) -> Anomaly:
    assignment = db.scalar(
        select(Assignment).where(Assignment.student_id == student_id, Assignment.exam_id == exam.id)
    )
    submission = db.scalar(
        select(Submission).where(Submission.student_id == student_id, Submission.exam_id == exam.id)
    )
    events = activity_service.to_engine_events(activity_service.load_events(db, student_id, exam.id))
    result = analyze(
        events,
        exam_duration_minutes=exam.duration_minutes,
        started_at=assignment.assigned_at if assignment else None,
        submitted_at=submission.submitted_at if submission else None,
    )

    row = db.scalar(select(Anomaly).where(Anomaly.student_id == student_id, Anomaly.exam_id == exam.id))
    if row is None:
        row = Anomaly(student_id=student_id, exam_id=exam.id)
        db.add(row)
    elif row.reviewed and result.score > row.score:
        # New suspicious activity after faculty already reviewed -> needs another look.
        row.reviewed = False
    row.score = result.score
    row.severity = result.severity
    row.reasons = json.dumps(result.reasons)
    row.updated_at = utcnow()
    db.commit()
    return row


def get_or_empty(db: Session, student_id: int, exam_id: int) -> Optional[Anomaly]:
    return db.scalar(select(Anomaly).where(Anomaly.student_id == student_id, Anomaly.exam_id == exam_id))


def serialize(row: Optional[Anomaly]) -> Dict[str, Any]:
    if row is None:
        return {
            "id": None, "score": 0, "severity": Severity.NORMAL, "reasons": [], "reviewed": False,
            "reviewed_at": None, "review_note": None, "disclaimer": DISCLAIMER,
        }
    try:
        reasons = json.loads(row.reasons or "[]")
    except ValueError:
        reasons = []
    return {
        "id": row.id,
        "score": row.score,
        "severity": row.severity,
        "reasons": reasons,
        "reviewed": row.reviewed,
        "reviewed_at": iso(row.reviewed_at),
        "review_note": row.review_note,
        "disclaimer": DISCLAIMER,
    }
