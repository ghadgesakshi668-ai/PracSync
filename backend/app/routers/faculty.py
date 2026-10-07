from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import require_faculty
from app.constants import Role
from app.database import get_db
from app.models import Anomaly, Assignment, Experiment, Submission, User
from app.schemas.faculty import ReassignIn, ReviewIn
from app.services import anomaly_service, exam_service, monitor_service
from app.utils.time import iso, utcnow

router = APIRouter(prefix="/api/faculty", tags=["faculty"])


def _student_or_404(db: Session, student_id: int) -> User:
    st = db.get(User, student_id)
    if st is None or st.role != Role.STUDENT:
        raise HTTPException(404, "Student not found.")
    return st


@router.get("/overview")
def overview(exam_id: Optional[int] = Query(default=None), db: Session = Depends(get_db), _=Depends(require_faculty)):
    """Everything the dashboard / students page needs in ONE call (polled every few seconds)."""
    exam = monitor_service.resolve_exam(db, exam_id)
    if exam is None:
        return {"exam": None, "stats": monitor_service.build_stats([]), "students": [], "recent_events": []}
    rows = monitor_service.build_rows(db, exam)
    return {
        "exam": monitor_service.serialize_exam_brief(exam),
        "stats": monitor_service.build_stats(rows),
        "students": rows,
        "recent_events": monitor_service.recent_events(db, exam),
        "server_time": iso(utcnow()),
    }


@router.get("/exams/{exam_id}/students/{student_id}")
def student_detail(
    exam_id: int,
    student_id: int,
    include_heartbeats: bool = False,
    db: Session = Depends(get_db),
    _=Depends(require_faculty),
):
    exam = exam_service.get_exam_or_404(db, exam_id)
    student = _student_or_404(db, student_id)
    return monitor_service.student_detail(db, exam, student, include_heartbeats)


@router.post("/exams/{exam_id}/students/{student_id}/review")
def mark_reviewed(
    exam_id: int,
    student_id: int,
    payload: ReviewIn,
    db: Session = Depends(get_db),
    faculty: User = Depends(require_faculty),
):
    exam = exam_service.get_exam_or_404(db, exam_id)
    student = _student_or_404(db, student_id)
    row = anomaly_service.get_or_empty(db, student.id, exam.id) or anomaly_service.recompute(db, exam, student.id)
    row.reviewed = True
    row.reviewed_at = utcnow()
    row.reviewed_by = faculty.id
    row.review_note = (payload.note or "").strip() or None
    db.commit()
    return monitor_service.student_detail(db, exam, student)


@router.post("/exams/{exam_id}/students/{student_id}/reassign")
def reassign_experiment(
    exam_id: int,
    student_id: int,
    payload: ReassignIn,
    db: Session = Depends(get_db),
    faculty: User = Depends(require_faculty),
):
    exam = exam_service.get_exam_or_404(db, exam_id)
    student = _student_or_404(db, student_id)
    assignment = exam_service.get_assignment(db, student.id, exam.id)
    if assignment is None:
        raise HTTPException(409, "This student has not started the examination yet.")
    exam_service.reassign(db, exam, assignment, faculty, payload.experiment_id)
    return monitor_service.student_detail(db, exam, student)


@router.get("/anomalies")
def list_anomalies(exam_id: Optional[int] = Query(default=None), db: Session = Depends(get_db), _=Depends(require_faculty)):
    exam = monitor_service.resolve_exam(db, exam_id)
    if exam is None:
        return {"exam": None, "items": []}
    q = (
        select(Anomaly, User, Assignment, Experiment)
        .join(User, User.id == Anomaly.student_id)
        .join(Assignment, (Assignment.student_id == Anomaly.student_id) & (Assignment.exam_id == Anomaly.exam_id))
        .join(Experiment, Experiment.id == Assignment.experiment_id)
        .where(Anomaly.exam_id == exam.id)
        .order_by(Anomaly.score.desc(), User.name)
    )
    items = []
    for an, st, a, ex in db.execute(q).all():
        d = anomaly_service.serialize(an)
        d.update({"student_id": st.id, "student_name": st.name, "student_email": st.email,
                  "experiment_title": ex.title, "exam_state": exam_service.assignment_state(exam, a)})
        items.append(d)
    return {"exam": monitor_service.serialize_exam_brief(exam), "items": items}


@router.get("/submissions")
def list_submissions(exam_id: Optional[int] = Query(default=None), db: Session = Depends(get_db), _=Depends(require_faculty)):
    exam = monitor_service.resolve_exam(db, exam_id)
    if exam is None:
        return {"exam": None, "items": []}
    q = (
        select(Submission, User, Experiment)
        .join(User, User.id == Submission.student_id)
        .join(Experiment, Experiment.id == Submission.experiment_id)
        .where(Submission.exam_id == exam.id)
        .order_by(Submission.submitted_at.desc())
    )
    items = []
    for sub, st, ex in db.execute(q).all():
        d = monitor_service.serialize_submission(sub)
        an = anomaly_service.get_or_empty(db, st.id, exam.id)
        d.update({
            "student_name": st.name, "student_email": st.email, "experiment_title": ex.title,
            "anomaly_severity": an.severity if an else "NORMAL", "anomaly_score": an.score if an else 0,
        })
        items.append(d)
    return {"exam": monitor_service.serialize_exam_brief(exam), "items": items}
