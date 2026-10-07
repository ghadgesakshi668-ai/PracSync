from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator

from app.constants import CLIENT_EVENT_TYPES


class ActivityIn(BaseModel):
    event_type: str
    event_data: Optional[Dict[str, Any]] = Field(default=None)

    @field_validator("event_type")
    @classmethod
    def _type(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in CLIENT_EVENT_TYPES:
            raise ValueError("Unsupported event type.")
        return v


class DraftIn(BaseModel):
    text: str = Field(default="", max_length=200000)
