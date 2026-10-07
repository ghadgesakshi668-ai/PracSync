from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.deps import require_faculty
from app.database import get_db
from app.models import Assignment, ExamExperiment, Experiment
from app.schemas.experiment import ExperimentCreate, ExperimentUpdate
from app.utils.time import iso

router = APIRouter(prefix="/api/experiments", tags=["experiments"], dependencies=[Depends(require_faculty)])


def _ser(e: Experiment, exams_count: int = 0, assigned_count: int = 0) -> dict:
    return {
        "id": e.id,
        "title": e.title,
        "description": e.description,
        "instructions": e.instructions,
        "difficulty": e.difficulty,
        "created_at": iso(e.created_at),
        "exams_count": exams_count,
        "assigned_count": assigned_count,
    }


def _get(db: Session, experiment_id: int) -> Experiment:
    e = db.get(Experiment, experiment_id)
    if e is None:
        raise HTTPException(404, "Experiment not found.")
    return e


@router.get("")
def list_experiments(db: Session = Depends(get_db)):
    exams_counts = dict(db.execute(select(ExamExperiment.experiment_id, func.count()).group_by(ExamExperiment.experiment_id)).all())
    assigned_counts = dict(db.execute(select(Assignment.experiment_id, func.count()).group_by(Assignment.experiment_id)).all())
    return [
        _ser(e, exams_counts.get(e.id, 0), assigned_counts.get(e.id, 0))
        for e in db.scalars(select(Experiment).order_by(Experiment.id))
    ]


@router.post("", status_code=201)
def create_experiment(payload: ExperimentCreate, db: Session = Depends(get_db)):
    e = Experiment(**payload.model_dump())
    db.add(e)
    db.commit()
    return _ser(e)


@router.put("/{experiment_id}")
def update_experiment(experiment_id: int, payload: ExperimentUpdate, db: Session = Depends(get_db)):
    e = _get(db, experiment_id)
    for k, v in payload.model_dump().items():
        setattr(e, k, v)
    db.commit()
    return _ser(e)


@router.delete("/{experiment_id}")
def delete_experiment(experiment_id: int, db: Session = Depends(get_db)):
    e = _get(db, experiment_id)
    used = db.scalar(select(func.count()).select_from(Assignment).where(Assignment.experiment_id == e.id))
    if used:
        raise HTTPException(409, "This experiment has already been assigned to students and cannot be deleted.")
    db.delete(e)
    db.commit()
    return {"message": "Experiment deleted."}
