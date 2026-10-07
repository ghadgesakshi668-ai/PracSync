"""
PracSync anomaly-scoring configuration.

Everything that influences a student's score lives in this one file, so it is easy to
explain in a viva and easy to tune. Change a number here, restart the backend, and the
next recomputation uses it.

IMPORTANT: a high score means "potentially suspicious behaviour that needs faculty
review". It does NOT mean the student cheated.
"""
from dataclasses import dataclass, field
from typing import Dict


@dataclass(frozen=True)
class AnomalyConfig:
    # Points added for EACH occurrence of the event.
    event_weights: Dict[str, int] = field(
        default_factory=lambda: {
            "TAB_SWITCH": 10,
            "WINDOW_BLUR": 5,
            "COPY_ATTEMPT": 10,
            "PASTE_ATTEMPT": 10,
        }
    )

    # Rule: submitting suspiciously fast.
    # Triggered when the student submits in less than this fraction of the allotted time.
    rapid_submission_fraction: float = 0.10
    rapid_submission_points: int = 15

    # Rule: bursts of repeated unusual interaction.
    # A "burst" = at least `burst_min_events` scored events inside `burst_window_seconds`.
    burst_window_seconds: int = 60
    burst_min_events: int = 3
    burst_points: int = 5          # per burst
    burst_max_count: int = 3       # at most this many bursts are counted

    # Final score is clamped to this value.
    max_score: int = 100

    # Severity thresholds (inclusive lower bounds).
    warning_threshold: int = 30
    suspicious_threshold: int = 60


CONFIG = AnomalyConfig()

DISCLAIMER = (
    "An anomaly flag means potentially suspicious behaviour that requires faculty review. "
    "It is not proof that the student cheated."
)
