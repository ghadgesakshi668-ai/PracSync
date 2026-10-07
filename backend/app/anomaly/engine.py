"""
Rule-based, fully explainable behavioural anomaly scoring.

This is NOT a machine-learning model. It is a transparent weighted-rule system:

    score = min(max_score,  sum(event_weight x count)  +  rapid-submission rule  +  burst rule)

`analyze()` is a pure function (no database access), which makes it trivial to unit-test.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.anomaly.config import CONFIG, AnomalyConfig
from app.constants import Severity


@dataclass
class Event:
    event_type: str
    timestamp: datetime
    data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AnomalyResult:
    score: int
    severity: str
    reasons: List[Dict[str, Any]]
    counts: Dict[str, int]


def _plural(n: int, singular: str, plural: str) -> str:
    return f"{n} {singular if n == 1 else plural}"


_LABELS = {
    "TAB_SWITCH": ("tab switch", "tab switches"),
    "WINDOW_BLUR": ("window focus loss", "window focus losses"),
    "COPY_ATTEMPT": ("copy attempt", "copy attempts"),
    "PASTE_ATTEMPT": ("paste attempt", "paste attempts"),
}


def is_scored(event: Event, cfg: AnomalyConfig = CONFIG) -> bool:
    """An event counts only if it has a weight AND was not tagged as benign by the browser
    (e.g. the window lost focus only because the file-picker dialog opened)."""
    if event.event_type not in cfg.event_weights:
        return False
    return event.data.get("context") != "file_dialog"


def severity_for(score: int, cfg: AnomalyConfig = CONFIG) -> str:
    if score >= cfg.suspicious_threshold:
        return Severity.SUSPICIOUS
    if score >= cfg.warning_threshold:
        return Severity.WARNING
    return Severity.NORMAL


def count_bursts(timestamps: List[datetime], cfg: AnomalyConfig = CONFIG) -> int:
    """Greedy, non-overlapping count of clusters of >= burst_min_events within burst_window_seconds."""
    ts = sorted(timestamps)
    bursts, i, n = 0, 0, len(ts)
    while i < n:
        j = i
        while j < n and (ts[j] - ts[i]).total_seconds() <= cfg.burst_window_seconds:
            j += 1
        if j - i >= cfg.burst_min_events:
            bursts += 1
            i = j          # consume the whole burst so it is counted once
        else:
            i += 1
    return bursts


def count_scored_events(events: List[Event], cfg: AnomalyConfig = CONFIG) -> Dict[str, int]:
    counts = {k: 0 for k in cfg.event_weights}
    for e in events:
        if is_scored(e, cfg):
            counts[e.event_type] += 1
    return counts


def analyze(
    events: List[Event],
    *,
    exam_duration_minutes: int,
    started_at: Optional[datetime] = None,
    submitted_at: Optional[datetime] = None,
    cfg: AnomalyConfig = CONFIG,
) -> AnomalyResult:
    reasons: List[Dict[str, Any]] = []
    total = 0

    # 1) Per-event weights --------------------------------------------------
    counts = count_scored_events(events, cfg)
    for etype, weight in cfg.event_weights.items():
        n = counts[etype]
        if n:
            points = n * weight
            singular, plural = _LABELS.get(etype, (etype.lower(), etype.lower() + "s"))
            reasons.append(
                {"code": etype, "text": f"{_plural(n, singular, plural)} (+{points})", "count": n, "points": points}
            )
            total += points

    # 2) Burst rule (repeated unusual interaction) ----------------------------
    scored_ts = [e.timestamp for e in events if is_scored(e, cfg)]
    bursts = min(count_bursts(scored_ts, cfg), cfg.burst_max_count)
    if bursts:
        points = bursts * cfg.burst_points
        reasons.append(
            {
                "code": "REPEATED_INTERACTION",
                "text": (
                    f"{_plural(bursts, 'burst', 'bursts')} of repeated unusual activity "
                    f"({cfg.burst_min_events}+ flagged events within {cfg.burst_window_seconds}s) (+{points})"
                ),
                "count": bursts,
                "points": points,
            }
        )
        total += points

    # 3) Rapid submission rule -----------------------------------------------
    if submitted_at and started_at and exam_duration_minutes > 0:
        elapsed_min = (submitted_at - started_at).total_seconds() / 60.0
        limit_min = exam_duration_minutes * cfg.rapid_submission_fraction
        if elapsed_min < limit_min:
            reasons.append(
                {
                    "code": "RAPID_SUBMISSION",
                    "text": (
                        f"Submitted after {elapsed_min:.1f} min, under "
                        f"{int(cfg.rapid_submission_fraction * 100)}% of the allotted time (+{cfg.rapid_submission_points})"
                    ),
                    "count": 1,
                    "points": cfg.rapid_submission_points,
                }
            )
            total += cfg.rapid_submission_points

    score = max(0, min(cfg.max_score, total))
    return AnomalyResult(score=score, severity=severity_for(score, cfg), reasons=reasons, counts=counts)
