from datetime import datetime, timedelta

from app.anomaly import Event, analyze

T0 = datetime(2026, 1, 1, 10, 0, 0)


def ev(t, s):
    return Event(t, T0 + timedelta(seconds=s), {})


def run(events, **kw):
    return analyze(events, exam_duration_minutes=60, **kw)


def test_empty_is_normal():
    r = run([])
    assert (r.score, r.severity) == (0, "NORMAL")


def test_weights_and_reasons():
    events = [ev("TAB_SWITCH", i * 300) for i in range(5)] + [ev("WINDOW_BLUR", 2000 + i * 300) for i in range(3)] + [ev("PASTE_ATTEMPT", 4000)]
    r = run(events)
    assert r.score == 50 + 15 + 10 and r.severity == "SUSPICIOUS"
    texts = " | ".join(x["text"] for x in r.reasons)
    assert "5 tab switches" in texts and "3 window focus losses" in texts and "1 paste attempt" in texts


def test_thresholds():
    assert run([ev("TAB_SWITCH", 0), ev("TAB_SWITCH", 1000), ev("TAB_SWITCH", 2000)]).severity == "WARNING"   # 30
    assert run([ev("TAB_SWITCH", 0), ev("TAB_SWITCH", 1000)]).severity == "NORMAL"                           # 20


def test_burst_rule():
    r = run([ev("TAB_SWITCH", 0), ev("TAB_SWITCH", 10), ev("TAB_SWITCH", 20)])
    assert r.score == 30 + 5 and any(x["code"] == "REPEATED_INTERACTION" for x in r.reasons)


def test_rapid_submission():
    r = run([], started_at=T0, submitted_at=T0 + timedelta(minutes=2))
    assert r.score == 15 and r.reasons[0]["code"] == "RAPID_SUBMISSION"
    assert run([], started_at=T0, submitted_at=T0 + timedelta(minutes=30)).score == 0


def test_cap_and_benign_file_dialog():
    assert run([ev("TAB_SWITCH", i * 1000) for i in range(30)]).score == 100
    e = Event("WINDOW_BLUR", T0, {"context": "file_dialog"})
    assert run([e]).score == 0
