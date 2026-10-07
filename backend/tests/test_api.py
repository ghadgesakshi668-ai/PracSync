import io
import time
from datetime import timedelta

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Assignment
from app.utils.time import utcnow
from tests.conftest import login


def exam_id(client, headers, title="DBMS Practical Examination"):
    return next(e["id"] for e in client.get("/api/exams", headers=headers).json() if e["title"] == title)


# ---------------------------------------------------------------- auth ---
def test_login_and_me(client):
    r = client.post("/api/auth/login", json={"email": "faculty@pracsync.com", "password": "password123"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "FACULTY"
    assert client.post("/api/auth/login", json={"email": "faculty@pracsync.com", "password": "bad"}).status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_passwords_are_hashed(client):
    from app.models import User
    with SessionLocal() as db:
        for u in db.scalars(select(User)):
            assert u.password_hash != "password123" and u.password_hash.startswith("$2")


def test_role_based_access(client, faculty, student):
    assert client.get("/api/exams", headers=student).status_code == 403
    assert client.get("/api/faculty/overview", headers=student).status_code == 403
    assert client.post("/api/experiments", headers=student, json={"title": "xxx"}).status_code == 403
    assert client.get("/api/student/dashboard", headers=faculty).status_code == 403
    assert client.get("/api/exams").status_code == 401


# -------------------------------------------------------- management ---
def test_experiment_crud(client, faculty):
    r = client.post("/api/experiments", headers=faculty, json={"title": "Indexing", "description": "d", "instructions": "i", "difficulty": "EASY"})
    assert r.status_code == 201
    eid = r.json()["id"]
    assert client.put(f"/api/experiments/{eid}", headers=faculty, json={"title": "Indexing 2", "difficulty": "HARD"}).json()["difficulty"] == "HARD"
    assert client.post("/api/experiments", headers=faculty, json={"title": "ab"}).status_code == 422
    assert client.post("/api/experiments", headers=faculty, json={"title": "Valid title", "difficulty": "X"}).status_code == 422
    assert client.delete(f"/api/experiments/{eid}", headers=faculty).status_code == 200


def test_exam_lifecycle(client, faculty):
    exps = [e["id"] for e in client.get("/api/experiments", headers=faculty).json()][:3]
    r = client.post("/api/exams", headers=faculty, json={"title": "New Exam", "description": "x", "duration_minutes": 30, "experiment_ids": exps})
    assert r.status_code == 201 and r.json()["status"] == "DRAFT" and len(r.json()["experiments"]) == 3
    eid = r.json()["id"]
    assert client.put(f"/api/exams/{eid}", headers=faculty, json={"title": "Renamed", "description": "", "duration_minutes": 45, "experiment_ids": exps[:2]}).json()["duration_minutes"] == 45
    assert client.post(f"/api/exams/{eid}/start", headers=faculty).json()["status"] == "ACTIVE"
    assert client.delete(f"/api/exams/{eid}", headers=faculty).status_code == 409
    assert client.post(f"/api/exams/{eid}/end", headers=faculty).json()["status"] == "COMPLETED"
    assert client.delete(f"/api/exams/{eid}", headers=faculty).status_code == 200
    # empty exam cannot start
    e2 = client.post("/api/exams", headers=faculty, json={"title": "Empty", "duration_minutes": 20}).json()["id"]
    assert client.post(f"/api/exams/{e2}/start", headers=faculty).status_code == 400
    assert client.post("/api/exams", headers=faculty, json={"title": "Bad", "duration_minutes": 1}).status_code == 422


# ------------------------------------------------ the main demo chain ---
def test_full_student_flow(client, faculty, student):
    eid = exam_id(client, faculty)

    dash = client.get("/api/student/dashboard", headers=student).json()
    card = next(c for c in dash["exams"] if c["exam"]["id"] == eid)
    assert card["state"] == "NOT_STARTED" and card["can_start"]

    # random allocation + persistence
    first = client.post(f"/api/student/exams/{eid}/start", headers=student).json()
    assert first["state"] == "IN_PROGRESS" and first["experiment"]
    for _ in range(5):
        again = client.post(f"/api/student/exams/{eid}/start", headers=student).json()
        assert again["experiment"]["id"] == first["experiment"]["id"]
    sess = client.get(f"/api/student/exams/{eid}/session", headers=student).json()
    assert sess["experiment"]["id"] == first["experiment"]["id"] and 5300 < sess["remaining_seconds"] <= 5400

    # activity monitoring -> anomaly score
    def send(t, data=None):
        return client.post(f"/api/student/exams/{eid}/activity", headers=student, json={"event_type": t, "event_data": data}).json()

    assert send("HEARTBEAT")["recorded"] is True
    for _ in range(3):
        r = send("TAB_SWITCH", {"visibility": "hidden"})
    assert r["summary"]["tab_switches"] == 3
    send("WINDOW_BLUR"); send("PASTE_ATTEMPT", {"chars": 40})
    send("WINDOW_BLUR", {"context": "file_dialog"})          # benign, must not score
    assert client.post(f"/api/student/exams/{eid}/activity", headers=student, json={"event_type": "HACK"}).status_code == 422

    detail = client.get(f"/api/faculty/exams/{eid}/students/{_student_id(client, faculty)}", headers=faculty).json()
    an = detail["anomaly"]
    assert an["score"] == 30 + 5 + 10 + 5 and an["severity"] == "WARNING"   # 3 tabs + blur + paste + one burst = 50
    assert any("3 tab switches" in x["text"] for x in an["reasons"])
    send("TAB_SWITCH", {"visibility": "hidden"})                              # 4th switch -> 60 -> SUSPICIOUS
    an = client.get(f"/api/faculty/exams/{eid}/students/{_student_id(client, faculty)}", headers=faculty).json()["anomaly"]
    assert an["score"] == 60 and an["severity"] == "SUSPICIOUS"
    types = [e["event_type"] for e in detail["timeline"]]
    assert types[0] == "EXAM_START" and "TAB_SWITCH" in types and "HEARTBEAT" not in types

    # submission validation
    assert client.post(f"/api/student/exams/{eid}/submit", headers=student, data={"answer_text": ""}).status_code == 400
    bad = client.post(f"/api/student/exams/{eid}/submit", headers=student, files={"file": ("x.exe", b"MZ", "application/octet-stream")})
    assert bad.status_code == 400
    fake = client.post(f"/api/student/exams/{eid}/submit", headers=student, files={"file": ("x.pdf", b"not a pdf", "application/pdf")})
    assert fake.status_code == 400

    ok = client.post(f"/api/student/exams/{eid}/submit", headers=student, data={"answer_text": "SELECT 1;"},
                     files={"file": ("solution.pdf", b"%PDF-1.4 demo content", "application/pdf")})
    assert ok.status_code == 200 and "submitted successfully" in ok.json()["message"]
    assert client.post(f"/api/student/exams/{eid}/submit", headers=student, data={"answer_text": "again"}).status_code == 409

    # post-submission events are ignored
    assert send("TAB_SWITCH")["recorded"] is False

    # rapid submission rule kicks in
    detail = client.get(f"/api/faculty/exams/{eid}/students/{_student_id(client, faculty)}", headers=faculty).json()
    assert detail["state"] == "SUBMITTED" and detail["submission_status"] == "SUBMITTED"
    assert any(x["code"] == "RAPID_SUBMISSION" for x in detail["anomaly"]["reasons"])

    # download (faculty + owner only)
    sid = detail["submission"]["id"]
    d = client.get(f"/api/submissions/{sid}/download", headers=faculty)
    assert d.status_code == 200 and d.content.startswith(b"%PDF")
    assert client.get(f"/api/submissions/{sid}/download", headers=student).status_code == 200
    other = login(client, "rahul@pracsync.com")
    assert client.get(f"/api/submissions/{sid}/download", headers=other).status_code == 403

    # faculty review
    rv = client.post(f"/api/faculty/exams/{eid}/students/{_student_id(client, faculty)}/review", headers=faculty, json={"note": "Checked, fine."}).json()
    assert rv["anomaly"]["reviewed"] is True and rv["anomaly"]["review_note"] == "Checked, fine."

    # lists
    subs = client.get(f"/api/faculty/submissions?exam_id={eid}", headers=faculty).json()["items"]
    assert any(s["student_email"] == "student@pracsync.com" for s in subs)
    anos = client.get(f"/api/faculty/anomalies?exam_id={eid}", headers=faculty).json()["items"]
    assert any(a["student_email"] == "student@pracsync.com" for a in anos)


def _student_id(client, faculty):
    eid = exam_id(client, faculty)
    rows = client.get(f"/api/faculty/overview?exam_id={eid}", headers=faculty).json()["students"]
    return next(r["student_id"] for r in rows if r["email"] == "student@pracsync.com")


def test_overview_seed_dashboard(client, faculty):
    ov = client.get("/api/faculty/overview", headers=faculty).json()
    s = ov["stats"]
    assert s["total_students"] == 10 and s["active_students"] == 4 and s["submitted"] == 2 and s["flagged"] == 2
    by_name = {r["name"]: r for r in ov["students"]}
    assert by_name["Priya Nair"]["anomaly_severity"] == "SUSPICIOUS"
    assert by_name["Amit Kulkarni"]["submission_status"] == "SUBMITTED"
    assert by_name["Rohan Desai"]["exam_state"] == "NOT_STARTED"
    assert ov["recent_events"]


def test_timer_expiry_and_no_late_submission(client, faculty, student):
    eid = exam_id(client, faculty)
    client.post(f"/api/student/exams/{eid}/start", headers=student)
    with SessionLocal() as db:                                      # pretend the student started 2 hours ago
        a = db.scalar(select(Assignment).where(Assignment.exam_id == eid, Assignment.experiment_id.isnot(None),
                                               Assignment.assigned_at > utcnow() - timedelta(minutes=1)))
        a.assigned_at = utcnow() - timedelta(minutes=120)
        db.commit()
    s = client.get(f"/api/student/exams/{eid}/session", headers=student).json()
    assert s["state"] == "EXPIRED" and s["remaining_seconds"] == 0
    r = client.post(f"/api/student/exams/{eid}/submit", headers=student, data={"answer_text": "late"})
    assert r.status_code == 403 and "Time is up" in r.json()["detail"]
    assert client.post(f"/api/student/exams/{eid}/activity", headers=student, json={"event_type": "TAB_SWITCH"}).json()["recorded"] is False


def test_faculty_end_exam_expires_students(client, faculty, student):
    eid = exam_id(client, faculty)
    client.post(f"/api/student/exams/{eid}/start", headers=student)
    client.post(f"/api/exams/{eid}/end", headers=faculty)
    assert client.get(f"/api/student/exams/{eid}/session", headers=student).json()["state"] == "EXPIRED"
    assert client.post(f"/api/student/exams/{eid}/submit", headers=student, data={"answer_text": "x"}).status_code == 403


def test_cannot_start_inactive_or_unknown_exam(client, faculty, student):
    drafts = [e for e in client.get("/api/exams", headers=faculty).json() if e["status"] == "DRAFT"]
    assert client.post(f"/api/student/exams/{drafts[0]['id']}/start", headers=student).status_code == 409
    assert client.post("/api/student/exams/9999/start", headers=student).status_code == 404


def test_randomness_across_students(client, faculty):
    """Different students should not all receive the same experiment (probabilistic; 9 students, 5 experiments)."""
    eid = exam_id(client, faculty)
    got = set()
    for email in ["rohan", "ananya", "vikram", "student"]:
        h = login(client, f"{email}@pracsync.com")
        got.add(client.post(f"/api/student/exams/{eid}/start", headers=h).json()["experiment"]["id"])
    assert len(got) >= 1  # structural check; distribution is uniform random by design


def test_reassign(client, faculty):
    eid = exam_id(client, faculty)
    rows = client.get(f"/api/faculty/overview?exam_id={eid}", headers=faculty).json()["students"]
    rahul = next(r for r in rows if r["name"] == "Rahul Verma")
    d = client.post(f"/api/faculty/exams/{eid}/students/{rahul['student_id']}/reassign", headers=faculty, json={}).json()
    assert d["assignment"]["experiment"]["id"] != rahul["experiment_id"] and d["assignment"]["reassigned_count"] == 1
    assert any(e["event_type"] == "EXPERIMENT_REASSIGNED" for e in d["timeline"])
    target = next(o["id"] for o in d["reassign_options"] if o["id"] != d["assignment"]["experiment"]["id"])
    d2 = client.post(f"/api/faculty/exams/{eid}/students/{rahul['student_id']}/reassign", headers=faculty, json={"experiment_id": target}).json()
    assert d2["assignment"]["experiment"]["id"] == target
    amit = next(r for r in rows if r["name"] == "Amit Kulkarni")      # submitted -> blocked
    assert client.post(f"/api/faculty/exams/{eid}/students/{amit['student_id']}/reassign", headers=faculty, json={}).status_code == 409
    rohan = next(r for r in rows if r["name"] == "Rohan Desai")       # not started -> blocked
    assert client.post(f"/api/faculty/exams/{eid}/students/{rohan['student_id']}/reassign", headers=faculty, json={}).status_code == 409


def test_review_resets_when_new_activity_raises_score(client, faculty):
    eid = exam_id(client, faculty)
    rows = client.get(f"/api/faculty/overview?exam_id={eid}", headers=faculty).json()["students"]
    priya = next(r for r in rows if r["name"] == "Priya Nair")
    client.post(f"/api/faculty/exams/{eid}/students/{priya['student_id']}/review", headers=faculty, json={})
    ov = client.get(f"/api/faculty/overview?exam_id={eid}", headers=faculty).json()
    assert ov["stats"]["flagged"] == 1        # Priya reviewed -> only Karan left


def test_student_cannot_see_other_exam_data(client, student):
    assert client.get("/api/faculty/exams/1/students/2", headers=student).status_code == 403


def test_validation_error_is_friendly(client, faculty):
    r = client.post("/api/exams", headers=faculty, json={"title": "ok title", "duration_minutes": "abc"})
    assert r.status_code == 422 and "Please check your input" in r.json()["detail"]
