from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.constants import Difficulty


class ExperimentBase(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=5000)
    instructions: str = Field(default="", max_length=20000)
    difficulty: str = Difficulty.MEDIUM

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Title must be at least 3 characters.")
        return v

    @field_validator("difficulty")
    @classmethod
    def _difficulty(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in Difficulty.ALL:
            raise ValueError("Difficulty must be EASY, MEDIUM or HARD.")
        return v


class ExperimentCreate(ExperimentBase):
    pass


class ExperimentUpdate(ExperimentBase):
    pass
