from typing import Optional

from pydantic import BaseModel, Field


class ReviewIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=2000)


class ReassignIn(BaseModel):
    experiment_id: Optional[int] = None   # None => pick another random experiment from the exam
