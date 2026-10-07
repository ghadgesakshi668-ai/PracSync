"""Builds the read-models the faculty UI needs (dashboard rows, student detail, lists)."""
from datetime import timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.constants import AssignmentStatus, ExamStatus, Role, Severity
from app.models import ActivityLog, Anomaly, Assignment, Exam, Experiment, Submission, User
from app.services import activity_service, anomaly_service, exam_service
from app.utils.time import iso, utcnow

NOT_STARTED = "NOT_STARTED"


def resolve_exam(db: Session, exam_id: Optional[int]) -> Optional[Exam]:
    if exam_id is not None:
        return exam_service.get_exam_or_404(db, exam_id)
    active = db.scalar(select(Exam).where(Exam.status == ExamStatus.ACTIVE).order_by(Exam.start_time.desc(), Exam.id.desc()))
    if active:
        return active
    return db.scalar(select(Exam).order_by(Exam.created_at.desc(), Exam.id.desc()))


def serialize_exam_brief(exam: Exam) -> Dict[str, Any]:
    return {
        "id": exam.id,
        "title": exam.title,
        "description": exam.description,
        "duration_minutes": exam.duration_minutes,
        "status": exam.status,
        "start_time": iso(exam.start_time),
        "end_time": iso(exam.end_time),
    }


def _submission_status(state: str, exam: Exam) -> str:
    if state == AssignmentStatus.SUBMITTED:
        return "SUBMITTED"
    if state == AssignmentStatus.EXPIRED or exam.status == ExamStatus.COMPLETED:
        return "NOT_SUBMITTED"
    return "PENDING"


def build_rows(db: Session, exam: Exam) -> List[Dict[str, Any]]:
    exam_service.sync_exam_assignments(db, exam)
    now = utcnow()
    students = list(db.scalars(select(User).where(User.role == Role.STUDENT).order_by(User.name)))
    assignments = {a.student_id: a for a in db.scalars(select(Assignment).where(Assignment.exam_id == exam.id))}
    anomalies = {a.student_id: a for a in db.scalars(select(Anomaly).where(Anomaly.exam_id == exam.id))}
    submissions = {s.student_id: s for s in db.scalars(select(Submission).where(Submission.exam_id == exam.id))}
    experiments = {e.id: e for e in db.scalars(select(Experiment))}
    last_seen = dict(
        db.execute(
            select(ActivityLog.student_id, func.max(ActivityLog.timestamp))
            .where(ActivityLog.exam_id == exam.id)
            .group_by(ActivityLog.student_id)
        ).all()
    )

    rows = []
    for st in students:
        a = assignments.get(st.id)
        an = anomalies.get(st.id)
        sub = submissions.get(st.id)
        state = exam_service.assignment_state(exam, a, now) if a else NOT_STARTED
        seen = last_seen.get(st.id)
        online = bool(
            state == AssignmentStatus.IN_PROGRESS
            and seen
            and (now - seen) <= timedelta(seconds=settings.ONLINE_WINDOW_SECONDS)
        )
        rows.append(
            {
                "student_id": st.id,
                "name": st.name,
                "email": st.email,
                "experiment_id": a.experiment_id if a else None,
                "experiment_title": experiments[a.experiment_id].title if a and a.experiment_id in experiments else None,
                "exam_state": state,
                "online": online,
                "last_seen": iso(seen),
                "remaining_seconds": exam_service.remaining_seconds(exam, a, now) if a and state == AssignmentStatus.IN_PROGRESS else None,
                "anomaly_score": an.score if an else 0,
                "anomaly_severity": an.severity if an else Severity.NORMAL,
                "anomaly_reviewed": an.reviewed if an else False,
                "submission_status": _submission_status(state, exam) if a else (
                    "NOT_SUBMITTED" if exam.status == ExamStatus.COMPLETED else "PENDING"
                ),
                "submitted_at": iso(sub.submitted_at) if sub else None,
            }
        )
    return rows


def build_stats(rows: List[Dict[str, Any]]) -> Dict[str, int]:
    total = len(rows)
    submitted = sum(1 for r in rows if r["exam_state"] == AssignmentStatus.SUBMITTED)
    return {
        "total_students": total,
        "active_students": sum(1 for r in rows if r["exam_state"] == AssignmentStatus.IN_PROGRESS),
        "online_students": sum(1 for r in rows if r["online"]),
        "submitted": submitted,
        "not_submitted": total - submitted,
        "not_started": sum(1 for r in rows if r["exam_state"] == NOT_STARTED),
        "warning": sum(1 for r in rows if r["anomaly_severity"] == Severity.WARNING),
        "flagged": sum(
            1 for r in rows if r["anomaly_severity"] == Severity.SUSPICIOUS and not r["anomaly_reviewed"]
        ),
    }


def recent_events(db: Session, exam: Exam, limit: int = 12) -> List[Dict[str, Any]]:
    q = (
        select(ActivityLog, User.name)
        .join(User, User.id == ActivityLog.student_id)
        .where(ActivityLog.exam_id == exam.id, ActivityLog.event_type != "HEARTBEAT")
        .order_by(ActivityLog.timestamp.desc(), ActivityLog.id.desc())
        .limit(limit)
    )
    out = []
    for log, name in db.execute(q).all():
        item = activity_service.serialize(log)
        item["student_id"] = log.student_id
        item["student_name"] = name
        out.append(item)
    return out


def serialize_submission(sub: Submission, with_text: bool = True) -> Dict[str, Any]:
    d = {
        "id": sub.id,
        "student_id": sub.student_id,
        "exam_id": sub.exam_id,
        "experiment_id": sub.experiment_id,
        "file_name": sub.file_name,
        "submitted_at": iso(sub.submitted_at),
        "status": sub.status,
    }
    if with_text:
        d["answer_text"] = sub.answer_text
    return d


def student_detail(db: Session, exam: Exam, student: User, include_heartbeats: bool = False) -> Dict[str, Any]:
    now = utcnow()
    a = exam_service.get_assignment(db, student.id, exam.id)
    if a:
        exam_service.sync_assignment(db, exam, a)
    state = exam_service.assignment_state(exam, a, now) if a else NOT_STARTED
    exp = db.get(Experiment, a.experiment_id) if a else None
    sub = db.scalar(select(Submission).where(Submission.student_id == student.id, Submission.exam_id == exam.id))
    an = anomaly_service.get_or_empty(db, student.id, exam.id)

    all_events = activity_service.load_events(db, student.id, exam.id, include_heartbeats=True)
    heartbeats = [e for e in all_events if e.event_type == "HEARTBEAT"]
    timeline_src = all_events if include_heartbeats else [e for e in all_events if e.event_type != "HEARTBEAT"]
    timeline = [activity_service.serialize(e) for e in timeline_src[-600:]]

    last_login = db.scalar(
        select(func.max(ActivityLog.timestamp)).where(ActivityLog.student_id == student.id, ActivityLog.event_type == "LOGIN")
    )
    last_seen = all_events[-1].timestamp if all_events else None

    return {
        "exam": serialize_exam_brief(exam),
        "student": {"id": student.id, "name": student.name, "email": student.email},
        "state": state,
        "online": bool(
            state == AssignmentStatus.IN_PROGRESS and last_seen and (now - last_seen).total_seconds() <= settings.ONLINE_WINDOW_SECONDS
        ),
        "last_seen": iso(last_seen),
        "last_login": iso(last_login),
        "assignment": (
            {
                "assigned_at": iso(a.assigned_at),
                "experiment": {"id": exp.id, "title": exp.title, "difficulty": exp.difficulty, "description": exp.description}
                if exp else None,
                "reassigned_count": a.reassigned_count,
                "remaining_seconds": exam_service.remaining_seconds(exam, a, now) if state == AssignmentStatus.IN_PROGRESS else 0,
                "draft_text": a.draft_text,
            }
            if a
            else None
        ),
        "submission_status": _submission_status(state, exam) if a else "PENDING",
        "submission": serialize_submission(sub) if sub else None,
        "anomaly": anomaly_service.serialize(an),
        "heartbeat_count": len(heartbeats),
        "timeline": timeline,
        "reassign_options": [
            {"id": e.id, "title": e.title} for e in exam_service.exam_experiments(db, exam)
        ],
    }
