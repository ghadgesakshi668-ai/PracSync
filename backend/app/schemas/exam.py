from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class ExamBase(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=5000)
    duration_minutes: int = Field(ge=5, le=300)
    experiment_ids: List[int] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Title must be at least 3 characters.")
        return v


class ExamCreate(ExamBase):
    pass


class ExamUpdate(ExamBase):
    pass


class ExamExperimentsUpdate(BaseModel):
    experiment_ids: List[int]
