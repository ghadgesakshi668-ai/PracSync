from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.utils.time import utcnow


class Assignment(Base):
    """One row per (student, exam). Created when the student starts the exam; never regenerated."""

    __tablename__ = "assignments"
    __table_args__ = (UniqueConstraint("student_id", "exam_id", name="uq_assignment_student_exam"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    experiment_id: Mapped[int] = mapped_column(ForeignKey("experiments.id"))
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)  # also the student's timer start
    status: Mapped[str] = mapped_column(String(12), default="IN_PROGRESS")   # IN_PROGRESS | SUBMITTED | EXPIRED
    draft_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)   # autosaved workspace text
    reassigned_count: Mapped[int] = mapped_column(Integer, default=0)
