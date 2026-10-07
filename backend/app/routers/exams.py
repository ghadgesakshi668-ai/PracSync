from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.deps import require_faculty
from app.constants import ExamStatus
from app.database import get_db
from app.models import Assignment, Exam, ExamExperiment, Experiment, Submission, User
from app.schemas.exam import ExamCreate, ExamExperimentsUpdate, ExamUpdate
from app.services import exam_service
from app.services.storage import storage
from app.utils.time import iso, utcnow

router = APIRouter(prefix="/api/exams", tags=["exams"])


def _ser(db: Session, exam: Exam) -> dict:
    exps = exam_service.exam_experiments(db, exam)
    assigned = db.scalar(select(func.count()).select_from(Assignment).where(Assignment.exam_id == exam.id)) or 0
    submitted = db.scalar(select(func.count()).select_from(Submission).where(Submission.exam_id == exam.id)) or 0
    return {
        "id": exam.id,
        "title": exam.title,
        "description": exam.description,
        "duration_minutes": exam.duration_minutes,
        "status": exam.status,
        "start_time": iso(exam.start_time),
        "end_time": iso(exam.end_time),
        "created_at": iso(exam.created_at),
        "experiment_ids": [e.id for e in exps],
        "experiments": [{"id": e.id, "title": e.title, "difficulty": e.difficulty} for e in exps],
        "assigned_count": assigned,
        "submitted_count": submitted,
    }


def _set_experiments(db: Session, exam: Exam, ids: List[int]) -> None:
    unique = list(dict.fromkeys(ids))
    if unique:
        found = set(db.scalars(select(Experiment.id).where(Experiment.id.in_(unique))))
        missing = [i for i in unique if i not in found]
        if missing:
            raise HTTPException(400, f"Unknown experiment id(s): {missing}")
    current = {l.experiment_id: l for l in exam.links}
    for eid, link in current.items():
        if eid not in unique:
            exam.links.remove(link)
    for eid in unique:
        if eid not in current:
            exam.links.append(ExamExperiment(experiment_id=eid))


@router.get("", dependencies=[Depends(require_faculty)])
def list_exams(db: Session = Depends(get_db)):
    return [_ser(db, e) for e in db.scalars(select(Exam).order_by(Exam.created_at.desc(), Exam.id.desc()))]


@router.get("/{exam_id}", dependencies=[Depends(require_faculty)])
def get_exam(exam_id: int, db: Session = Depends(get_db)):
    return _ser(db, exam_service.get_exam_or_404(db, exam_id))


@router.post("", status_code=201)
def create_exam(payload: ExamCreate, faculty: User = Depends(require_faculty), db: Session = Depends(get_db)):
    exam = Exam(
        title=payload.title, description=payload.description,
        duration_minutes=payload.duration_minutes, status=ExamStatus.DRAFT, created_by=faculty.id,
    )
    db.add(exam)
    db.flush()
    _set_experiments(db, exam, payload.experiment_ids)
    db.commit()
    db.refresh(exam)
    return _ser(db, exam)


@router.put("/{exam_id}", dependencies=[Depends(require_faculty)])
def update_exam(exam_id: int, payload: ExamUpdate, db: Session = Depends(get_db)):
    exam = exam_service.get_exam_or_404(db, exam_id)
    if payload.duration_minutes != exam.duration_minutes and exam.status != ExamStatus.DRAFT:
        raise HTTPException(409, "Duration can only be changed while the exam is a draft.")
    exam.title, exam.description, exam.duration_minutes = payload.title, payload.description, payload.duration_minutes
    _set_experiments(db, exam, payload.experiment_ids)
    db.commit()
    return _ser(db, exam)


@router.put("/{exam_id}/experiments", dependencies=[Depends(require_faculty)])
def update_exam_experiments(exam_id: int, payload: ExamExperimentsUpdate, db: Session = Depends(get_db)):
    exam = exam_service.get_exam_or_404(db, exam_id)
    _set_experiments(db, exam, payload.experiment_ids)
    db.commit()
    return _ser(db, exam)


@router.delete("/{exam_id}", dependencies=[Depends(require_faculty)])
def delete_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = exam_service.get_exam_or_404(db, exam_id)
    if exam.status == ExamStatus.ACTIVE:
        raise HTTPException(409, "End the examination before deleting it.")
    files = list(db.scalars(select(Submission.file_path).where(Submission.exam_id == exam.id)))
    db.delete(exam)
    db.commit()
    for rel in files:
        storage.delete(rel)
    return {"message": "Examination deleted."}


@router.post("/{exam_id}/start", dependencies=[Depends(require_faculty)])
def start_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = exam_service.get_exam_or_404(db, exam_id)
    if exam.status == ExamStatus.ACTIVE:
        raise HTTPException(409, "This examination is already active.")
    if not exam_service.exam_experiments(db, exam):
        raise HTTPException(400, "Add at least one experiment before starting the examination.")
    if exam.status == ExamStatus.DRAFT or exam.start_time is None:
        exam.start_time = utcnow()
    exam.status = ExamStatus.ACTIVE
    exam.end_time = None
    db.commit()
    exam_service.sync_exam_assignments(db, exam)
    return _ser(db, exam)


@router.post("/{exam_id}/end", dependencies=[Depends(require_faculty)])
def end_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = exam_service.get_exam_or_404(db, exam_id)
    if exam.status != ExamStatus.ACTIVE:
        raise HTTPException(409, "Only an active examination can be ended.")
    exam.status = ExamStatus.COMPLETED
    exam.end_time = utcnow()
    db.commit()
    exam_service.sync_exam_assignments(db, exam)
    return _ser(db, exam)
