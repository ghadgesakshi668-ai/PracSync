# PracSync
**An Intelligent Platform for Automated and Secure Laboratory Practical Examinations**

PracSync is a working, browser-based prototype for running laboratory practical exams: faculty create exams and
experiments, students receive a **randomly assigned experiment**, work against a **server-enforced timer**, are
**monitored at browser level**, and submit digitally. Behaviour is turned into an **explainable anomaly score** that
faculty review in a live dashboard.

> **Scope note.** Complete application-level control or lockdown would require a dedicated lockdown browser or
> desktop agent and is outside the scope of the current browser-based prototype.

---

## 1. Features

| Area | What works |
|---|---|
| Authentication | bcrypt password hashing, JWT, protected routes, role-based authorisation (Faculty / Student) |
| Exam management | Create, edit, delete, start, end/reopen exams; choose which experiments belong to each exam |
| Experiment bank | Create, edit, view, delete experiments (title, description, instructions, difficulty) |
| Random allocation | One experiment picked at random per student and **stored**; refreshing never re-rolls it |
| Server timer | Deadline computed on the server; survives refresh; expiry blocks submission and activity logging |
| Activity monitoring | Tab switch, visibility change, window blur/focus, copy, paste, heartbeat → stored in `activity_logs` |
| Anomaly scoring | Transparent weighted rules, configurable in one file, with human-readable reasons |
| Faculty dashboard | Live stats, student monitoring table, recent activity feed (polls every 5 s) |
| Student detail | Experiment, status, submission, anomaly score/severity/reasons, activity timeline, review, reassign |
| Submission | PDF / DOCX / TXT / ZIP upload (type + size + content-signature checks) and/or workspace text; faculty download |
| Reassignment | Faculty can reassign an in-progress student (random or chosen); logged; student's screen updates itself |
| Demo data | 1 faculty, 10 students, 10 experiments, 2 exams, realistic sample history |

## 2. Architecture

```
React (Vite, Tailwind)  ──HTTP/JSON (axios, JWT)──►  FastAPI  ──SQLAlchemy──►  SQLite
   │  Page Visibility / focus / copy / paste events        │                       (pracsync.db)
   └──── POST /activity (+ heartbeat every 15 s) ─────────►│  anomaly engine (pure rules)
                                                           └──► uploads/ (local disk, swappable storage class)
```

```
backend/app/
  main.py            app, CORS, friendly error handlers
  config.py          settings (env-overridable)
  database.py        engine / session (SQLite WAL + foreign keys)
  models/            User, Exam, ExamExperiment, Experiment, Assignment, ActivityLog, Anomaly, Submission
  schemas/           Pydantic request validation
  auth/              bcrypt + JWT, role dependencies
  routers/           auth, exams, experiments, faculty, student, submissions
  services/          exam_service (timer + allocation), activity, anomaly, monitor (read models), storage, seed
  anomaly/           config.py (weights/thresholds)  +  engine.py (pure scoring function)
frontend/src/
  pages/ (faculty, student)  layouts/  components/  hooks/ (usePolling, useCountdown, useExamMonitor)
  services/ (axios API)  context/ (auth, toasts)  utils/
```

**Technology:** React 18, Vite 5, Tailwind CSS 3, React Router 6, Axios · Python, FastAPI, SQLAlchemy 2, Pydantic 2, PyJWT, bcrypt · SQLite.

## 3. Installation and running

**Requirements:** Python 3.10+, Node.js 18+ and npm.

### Windows (easiest)
```
setup.bat          (one time: creates venv, installs backend + frontend packages)
run-backend.bat    (window 1  →  http://127.0.0.1:8000)
run-frontend.bat   (window 2  →  http://localhost:5173)
```

### Manual — backend
```
cd backend
python -m venv venv
venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
### Manual — frontend
```
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173**. API docs (Swagger): http://127.0.0.1:8000/docs

### Database setup
Nothing to do. On first start the backend creates `backend/pracsync.db` and seeds demo data automatically.
To get a **fresh populated dashboard before a presentation**: stop the backend, then run `reset-demo.bat`
(or `python seed_demo.py --reset` inside `backend/`).

## 4. Demo credentials

| Role | Email | Password |
|---|---|---|
| Faculty | `faculty@pracsync.com` | `password123` |
| Student | `student@pracsync.com` | `password123` |
| More students | `rahul@`, `priya@`, `amit@`, `sneha@`, `karan@`, `neha@`, `rohan@`, `ananya@`, `vikram@` `pracsync.com` | `password123` |

The login page has "click to fill" buttons for the two main demo accounts.

## 5. Demo script (the full flow)

1. Log in as **faculty** → Dashboard shows 10 students, stats and the monitoring table (populated by seed data).
2. **Exams** → open *Data Mining & Big Data Practical* (draft, 5 experiments) → **Start exam**. *(Or click **New examination**, tick experiments, save, start.)*
3. Log out. Log in as **student@pracsync.com**.
4. Dashboard shows the available exam(s) → **Start exam** → an experiment is randomly assigned and the timer begins.
5. Refresh the page: same experiment, timer continues from the server value.
6. Type something in the workspace, then **switch to another browser tab** a few times, and click another window once. A banner tells the student it was recorded; the counters in the status bar rise.
7. (Optional) paste something into the workspace → paste attempt recorded.
8. Choose a file (PDF/DOCX/TXT/ZIP) → **Submit examination** → "Practical submitted successfully."
9. In another browser/window (or after logging out) log in as **faculty** → the dashboard updates itself every 5 s: the student is *Submitted*, anomaly badge changed.
10. Click the student → experiment, status, submission (download), **anomaly score, severity, reasons**, timeline.
11. Click **Mark as reviewed** (optional note). Try **Reassign experiment** on an active student such as Rahul.

> Tip: use two different browsers (or one normal + one private window) to be faculty and student at the same time.
> Note that the timeline entries you create are **real browser events**, not fake data. Only the *other* seeded students
> have pre-generated sample history (tagged `demo_seed`).

## 6. How the anomaly detection works

It is a **transparent rule-based scoring system, not machine learning.** Everything lives in
`backend/app/anomaly/config.py`.

| Signal | Points |
|---|---|
| Each tab switch | +10 |
| Each window focus loss (window blurred but tab still visible) | +5 |
| Each copy attempt | +10 |
| Each paste attempt | +10 |
| Burst of repeated unusual activity (≥3 flagged events within 60 s; max 3 bursts) | +5 per burst |
| Rapid submission (submitted in < 10 % of the allotted time) | +15 |
| **Maximum** | **100** |

Severity: **0–29 NORMAL · 30–59 WARNING · 60–100 SUSPICIOUS**.

* Every point is explained: e.g. `5 tab switches (+50)`, `3 window focus losses (+15)`, `1 paste attempt (+10)`.
* Score is recomputed on every non-heartbeat event and on submission, from the stored event log.
* A single tab switch is counted **once**: a blur that occurs because the tab became hidden is not double-counted.
* Focus loss caused by opening the **file-picker** is recorded but tagged `file_dialog` and **not scored**.
* If new suspicious activity raises the score after faculty reviewed it, the flag re-opens for review.
* **A flag means "potentially suspicious behaviour that requires faculty review". It never means the student cheated.**

## 7. Timer design (server-authoritative)

* A student's timer starts when they press *Start exam* (`assignments.assigned_at`).
* `deadline = assigned_at + duration`, cut short if faculty ends the exam. It is computed on the **server** on every request.
* The browser only displays the countdown and re-syncs to the server's `remaining_seconds` on every heartbeat (15 s).
  Changing the computer's clock has no effect.
* After the deadline the server rejects submissions (HTTP 403), draft saves and ignores activity events. A 3-second
  network grace applies only to natural expiry, never after faculty ends the exam.

## 8. Browser monitoring — limitations (please read)

What a normal browser **can** observe: tab visibility, window focus, copy / paste / cut events on the page, interaction counts, timing.

What it **cannot** do: see or control other applications (VS Code, WhatsApp, terminals…), detect a second device,
reliably block copy/paste, or stop a determined user. A tech-savvy student could also tamper with the client-side
telemetry. Complete application-level control or lockdown would require a dedicated lockdown browser or desktop agent
and is outside the scope of the current browser-based prototype. PracSync therefore treats all signals as
*indicators for human review*, never as proof.

## 9. Security considerations (prototype level — not production-grade)

* bcrypt password hashes; no plaintext passwords. JWT bearer tokens (8 h), verified on every request.
* Role checks on every route: students get HTTP 403 on all faculty endpoints and vice-versa.
* Pydantic input validation; uploads limited by extension, size (10 MB) and file signature; filenames sanitised; stored
  outside the web root and served only through an authenticated download endpoint with a path-traversal guard.
* CORS limited to the dev origins; server errors return a generic message (stack traces stay in the server log).
* **Before any real deployment:** set `PRACSYNC_SECRET_KEY`, use HTTPS, add rate-limiting / login lockout, move to PostgreSQL and object storage, add audit logging.

## 10. Configuration (optional environment variables)

`PRACSYNC_SECRET_KEY`, `PRACSYNC_DATABASE_URL`, `PRACSYNC_UPLOAD_DIR`, `PRACSYNC_MAX_UPLOAD_MB`, `PRACSYNC_CORS_ORIGINS`,
`PRACSYNC_SEED_ON_STARTUP` (default true), `PRACSYNC_SEED_SAMPLE_ACTIVITY` (default true; set false for an empty-history demo).

## 11. Tests

```
cd backend
pip install -r requirements.txt
python -m pytest -q
```
21 automated tests cover: login & JWT, bcrypt hashing, role-based access, exam/experiment CRUD and lifecycle, random
allocation and persistence, timer and expiry, faculty ending an exam, activity logging, ignored post-submission events,
anomaly rules and thresholds, file validation, submission, download permissions, review, reassignment and validation errors.

## 12. API overview

| Method & path | Who | Purpose |
|---|---|---|
| `POST /api/auth/login`, `GET /api/auth/me` | all | sign in / current user |
| `GET/POST/PUT/DELETE /api/exams…`, `POST /api/exams/{id}/start`, `/end` | faculty | exam management |
| `GET/POST/PUT/DELETE /api/experiments…` | faculty | experiment bank |
| `GET /api/faculty/overview?exam_id=` | faculty | stats + monitoring rows + recent events (polled) |
| `GET /api/faculty/exams/{e}/students/{s}` | faculty | full student detail & timeline |
| `POST …/review`, `POST …/reassign` | faculty | mark reviewed / reassign experiment |
| `GET /api/faculty/anomalies`, `/submissions` | faculty | lists |
| `GET /api/student/dashboard`, `POST /api/student/exams/{id}/start` | student | available exams, start (random allocation) |
| `GET …/session`, `PUT …/draft`, `POST …/activity`, `POST …/submit` | student | workspace, autosave, monitoring, submission |
| `GET /api/submissions/{id}/download` | faculty / owner | file download |

## 13. Troubleshooting

| Symptom | Fix |
|---|---|
| Login says "Cannot reach the PracSync server" | Backend is not running — start `run-backend.bat` |
| Port 8000 / 5173 busy | Close the old window, or run uvicorn with `--port 8001` and change the proxy target in `frontend/vite.config.js` |
| `pip install` fails on a very new Python | Use Python 3.11 or 3.12 |
| Dashboard looks empty/expired days later | Seed students' timers have run out — run `reset-demo.bat` before the demo |
| Want a totally clean start | Stop backend, delete `backend/pracsync.db*` and `backend/uploads/`, start again |

## 14. Future scope (NOT part of the current prototype)

Institutional SSO · advanced machine-learning anomaly detection · dedicated lockdown browser · desktop agent ·
OS-level application monitoring · webcam-based proctoring · cloud deployment · PostgreSQL · advanced analytics ·
automated practical evaluation.

## 15. Acknowledgement

This version rebuilds the earlier Flask prototype on a React + FastAPI architecture. Ideas carried over: debounced
blur detection, submit-time monitoring guard, and the data-mining experiment set (Apriori, DGIM, PageRank, K-Means, Decision Tree).
