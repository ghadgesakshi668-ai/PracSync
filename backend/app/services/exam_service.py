"""Exam / assignment business rules, including the SERVER-SIDE timer."""
import random
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.constants import AssignmentStatus, EventType, ExamStatus
from app.models import Assignment, Exam, ExamExperiment, Experiment, User
from app.services import activity_service
from app.utils.time import utcnow


def get_exam_or_404(db: Session, exam_id: int) -> Exam:
    exam = db.get(Exam, exam_id)
    if exam is None:
        raise HTTPException(404, "Examination not found.")
    return exam


def get_assignment(db: Session, student_id: int, exam_id: int) -> Optional[Assignment]:
    return db.scalar(select(Assignment).where(Assignment.student_id == student_id, Assignment.exam_id == exam_id))


def exam_experiments(db: Session, exam: Exam) -> List[Experiment]:
    return list(
        db.scalars(
            select(Experiment)
            .join(ExamExperiment, ExamExperiment.experiment_id == Experiment.id)
            .where(ExamExperiment.exam_id == exam.id)
            .order_by(Experiment.id)
        )
    )


# ---------------------------------------------------------------- timer ---
def compute_deadline(exam: Exam, assignment: Assignment) -> datetime:
    """A student's deadline = their start time + exam duration, cut short if faculty ended the exam."""
    deadline = assignment.assigned_at + timedelta(minutes=exam.duration_minutes)
    if exam.status == ExamStatus.COMPLETED and exam.end_time is not None:
        deadline = min(deadline, exam.end_time)
    return deadline


def remaining_seconds(exam: Exam, assignment: Assignment, now: Optional[datetime] = None) -> int:
    now = now or utcnow()
    return max(0, int((compute_deadline(exam, assignment) - now).total_seconds()))


def assignment_state(exam: Exam, assignment: Assignment, now: Optional[datetime] = None) -> str:
    """IN_PROGRESS | SUBMITTED | EXPIRED, derived from timestamps (never trusts the browser)."""
    now = now or utcnow()
    if assignment.status == AssignmentStatus.SUBMITTED:
        return AssignmentStatus.SUBMITTED
    if now >= compute_deadline(exam, assignment):
        return AssignmentStatus.EXPIRED
    return AssignmentStatus.IN_PROGRESS


def sync_assignment(db: Session, exam: Exam, assignment: Assignment) -> str:
    """Persist the derived state on the row (lazy expiry) and return it."""
    state = assignment_state(exam, assignment)
    if assignment.status != state:
        assignment.status = state
        db.commit()
    return state


def sync_exam_assignments(db: Session, exam: Exam) -> None:
    changed = False
    for a in db.scalars(select(Assignment).where(Assignment.exam_id == exam.id)):
        state = assignment_state(exam, a)
        if a.status != state:
            a.status = state
            changed = True
    if changed:
        db.commit()


# ------------------------------------------------------------ allocation ---
def start_exam_for_student(db: Session, student: User, exam: Exam) -> Assignment:
    """Idempotent: returns the existing assignment if there is one, else creates it ONCE."""
    existing = get_assignment(db, student.id, exam.id)
    if existing:
        sync_assignment(db, exam, existing)
        return existing

    if exam.status != ExamStatus.ACTIVE:
        raise HTTPException(409, "This examination is not active. Wait for your faculty to start it.")

    experiments = exam_experiments(db, exam)
    if not experiments:
        raise HTTPException(400, "This examination has no experiments configured yet.")

    chosen = random.choice(experiments)
    assignment = Assignment(
        student_id=student.id,
        exam_id=exam.id,
        experiment_id=chosen.id,
        assigned_at=utcnow(),
        status=AssignmentStatus.IN_PROGRESS,
    )
    db.add(assignment)
    try:
        db.commit()
    except IntegrityError:           # two simultaneous requests: keep the first, discard ours
        db.rollback()
        existing = get_assignment(db, student.id, exam.id)
        if existing:
            return existing
        raise
    activity_service.record_event(
        db, student.id, exam.id, EventType.EXAM_START, {"experiment_id": chosen.id, "experiment": chosen.title}
    )
    return assignment


def reassign(db: Session, exam: Exam, assignment: Assignment, faculty: User, experiment_id: Optional[int]) -> Experiment:
    state = assignment_state(exam, assignment)
    if state != AssignmentStatus.IN_PROGRESS:
        raise HTTPException(409, "Only students who are currently in progress can be reassigned.")
    options = exam_experiments(db, exam)
    by_id = {e.id: e for e in options}
    old = by_id.get(assignment.experiment_id) or db.get(Experiment, assignment.experiment_id)

    if experiment_id is None:
        candidates = [e for e in options if e.id != assignment.experiment_id]
        if not candidates:
            raise HTTPException(400, "There is no other experiment in this exam to reassign to.")
        new = random.choice(candidates)
    else:
        new = by_id.get(experiment_id)
        if new is None:
            raise HTTPException(400, "That experiment is not part of this examination.")
        if new.id == assignment.experiment_id:
            raise HTTPException(400, "The student already has that experiment.")

    assignment.experiment_id = new.id
    assignment.reassigned_count += 1
    db.commit()
    activity_service.record_event(
        db,
        assignment.student_id,
        exam.id,
        EventType.EXPERIMENT_REASSIGNED,
        {"from": old.title if old else None, "to": new.title, "by": faculty.name},
    )
    return new
