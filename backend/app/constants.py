"""String constants shared across the backend (plain strings so they store cleanly in SQLite)."""


class Role:
    FACULTY = "FACULTY"
    STUDENT = "STUDENT"


class ExamStatus:
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"


class AssignmentStatus:
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    EXPIRED = "EXPIRED"


class EventType:
    # Sent by the browser
    TAB_SWITCH = "TAB_SWITCH"
    WINDOW_BLUR = "WINDOW_BLUR"
    WINDOW_FOCUS = "WINDOW_FOCUS"
    VISIBILITY_CHANGE = "VISIBILITY_CHANGE"
    COPY_ATTEMPT = "COPY_ATTEMPT"
    PASTE_ATTEMPT = "PASTE_ATTEMPT"
    HEARTBEAT = "HEARTBEAT"
    # Written only by the server
    LOGIN = "LOGIN"
    EXAM_START = "EXAM_START"
    SUBMISSION = "SUBMISSION"
    EXPERIMENT_REASSIGNED = "EXPERIMENT_REASSIGNED"


CLIENT_EVENT_TYPES = {
    EventType.TAB_SWITCH,
    EventType.WINDOW_BLUR,
    EventType.WINDOW_FOCUS,
    EventType.VISIBILITY_CHANGE,
    EventType.COPY_ATTEMPT,
    EventType.PASTE_ATTEMPT,
    EventType.HEARTBEAT,
}


class Severity:
    NORMAL = "NORMAL"
    WARNING = "WARNING"
    SUSPICIOUS = "SUSPICIOUS"


class Difficulty:
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"
    ALL = ("EASY", "MEDIUM", "HARD")


class SubmissionStatus:
    SUBMITTED = "SUBMITTED"
