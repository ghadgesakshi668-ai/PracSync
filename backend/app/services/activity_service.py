"""Writing and summarising activity-log events."""
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.anomaly import Event
from app.anomaly.engine import count_scored_events
from app.models import ActivityLog
from app.utils.time import utcnow


def _dump(data: Optional[Dict[str, Any]]) -> Optional[str]:
    if not data:
        return None
    text = json.dumps(data, default=str)
    return text if len(text) <= 1000 else json.dumps({"truncated": True})


def parse_data(raw: Optional[str]) -> Dict[str, Any]:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
        return value if isinstance(value, dict) else {}
    except (ValueError, TypeError):
        return {}


def record_event(
    db: Session,
    student_id: int,
    exam_id: Optional[int],
    event_type: str,
    data: Optional[Dict[str, Any]] = None,
    timestamp: Optional[datetime] = None,
) -> ActivityLog:
    log = ActivityLog(
        student_id=student_id,
        exam_id=exam_id,
        event_type=event_type,
        event_data=_dump(data),
        timestamp=timestamp or utcnow(),
    )
    db.add(log)
    db.commit()
    return log


def load_events(db: Session, student_id: int, exam_id: int, include_heartbeats: bool = True) -> List[ActivityLog]:
    q = select(ActivityLog).where(ActivityLog.student_id == student_id, ActivityLog.exam_id == exam_id)
    if not include_heartbeats:
        q = q.where(ActivityLog.event_type != "HEARTBEAT")
    return list(db.scalars(q.order_by(ActivityLog.timestamp, ActivityLog.id)))


def to_engine_events(rows: List[ActivityLog]) -> List[Event]:
    return [Event(r.event_type, r.timestamp, parse_data(r.event_data)) for r in rows]


def summary(db: Session, student_id: int, exam_id: int) -> Dict[str, int]:
    """Counts of the scored behaviours, shown to the student for transparency."""
    rows = load_events(db, student_id, exam_id, include_heartbeats=False)
    counts = count_scored_events(to_engine_events(rows))
    return {
        "tab_switches": counts.get("TAB_SWITCH", 0),
        "window_blurs": counts.get("WINDOW_BLUR", 0),
        "copy_attempts": counts.get("COPY_ATTEMPT", 0),
        "paste_attempts": counts.get("PASTE_ATTEMPT", 0),
    }


def serialize(log: ActivityLog) -> Dict[str, Any]:
    from app.utils.time import iso

    return {
        "id": log.id,
        "event_type": log.event_type,
        "event_data": parse_data(log.event_data),
        "timestamp": iso(log.timestamp),
    }
