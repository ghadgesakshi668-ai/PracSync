"""Demo data. Run `python seed_demo.py --reset` before a presentation for a fresh, populated dashboard."""
import shutil
from datetime import timedelta
from typing import Dict, List

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.config import settings
from app.constants import AssignmentStatus, EventType, ExamStatus, Role
from app.database import Base, SessionLocal, engine
from app.models import Assignment, Exam, ExamExperiment, Experiment, Submission, User
from app.services import activity_service, anomaly_service
from app.services.storage import storage
from app.utils.time import utcnow

PASSWORD = "password123"

FACULTY = ("Prof.Manila Gupta", "faculty@pracsync.com")
STUDENTS = [
    ("Demo Student", "student@pracsync.com"),
    ("Rahul Verma", "rahul@pracsync.com"),
    ("Priya Nair", "priya@pracsync.com"),
    ("Amit Kulkarni", "amit@pracsync.com"),
    ("Sneha Patil", "sneha@pracsync.com"),
    ("Karan Mehta", "karan@pracsync.com"),
    ("Neha Joshi", "neha@pracsync.com"),
    ("Rohan Desai", "rohan@pracsync.com"),
    ("Ananya Iyer", "ananya@pracsync.com"),
    ("Vikram Singh", "vikram@pracsync.com"),
]

DBMS_EXPERIMENTS = [
    ("SQL Joins", "EASY",
     "Write SQL queries that combine data from multiple tables using different join types.",
     "Given the tables EMPLOYEE(emp_id, name, dept_id, salary) and DEPARTMENT(dept_id, dept_name, location):\n"
     "1. Create both tables and insert at least 6 employee rows and 3 department rows (leave one department empty).\n"
     "2. Write an INNER JOIN listing every employee with their department name.\n"
     "3. Write a LEFT JOIN that also shows departments with no employees.\n"
     "4. Write a SELF JOIN that finds employees earning more than the average salary of their department.\n"
     "Submit the SQL script and a screenshot of each query's output."),
    ("Database Normalization", "MEDIUM",
     "Normalize an unnormalized relation up to Boyce-Codd Normal Form.",
     "You are given the unnormalized relation ORDERS(order_id, order_date, customer_id, customer_name, customer_city, "
     "product_id, product_name, unit_price, quantity).\n"
     "1. List all functional dependencies.\n"
     "2. Convert the relation to 1NF, 2NF and 3NF, showing the resulting relations at each step.\n"
     "3. Check for BCNF violations and decompose if required.\n"
     "4. Write CREATE TABLE statements with primary and foreign keys for the final schema."),
    ("ER Diagram", "MEDIUM",
     "Design an Entity-Relationship diagram for a real-world scenario and map it to relational tables.",
     "Design an ER diagram for a Library Management System with Books, Members, Authors, Publishers and Loans.\n"
     "1. Identify entities, attributes, keys and relationship cardinalities.\n"
     "2. Show at least one many-to-many relationship and one weak entity.\n"
     "3. Draw the diagram (any tool) and export it as an image or PDF.\n"
     "4. Convert the ER diagram into relational tables."),
    ("PL/SQL Procedure", "HARD",
     "Create stored procedures that use parameters, cursors and exception handling.",
     "Using the table ACCOUNT(acc_no, holder_name, balance):\n"
     "1. Write a procedure TRANSFER_FUNDS(from_acc, to_acc, amount) that moves money atomically.\n"
     "2. Raise a user-defined exception when the balance is insufficient or an account does not exist.\n"
     "3. Write a second procedure that uses an explicit cursor to print every account with a balance below 1000.\n"
     "4. Show test calls and their output."),
    ("Database Trigger", "HARD",
     "Create database triggers that enforce rules and maintain an audit trail automatically.",
     "Using the table STUDENT_MARKS(student_id, subject, marks):\n"
     "1. Create an audit table MARKS_AUDIT(audit_id, student_id, old_marks, new_marks, changed_on).\n"
     "2. Write an AFTER UPDATE trigger that records every change of marks in MARKS_AUDIT.\n"
     "3. Write a BEFORE INSERT trigger that rejects marks outside the range 0-100.\n"
     "4. Demonstrate both triggers with test statements and show the results."),
]

DATA_EXPERIMENTS = [
    ("Apriori Algorithm", "MEDIUM", "Implement the Apriori algorithm for frequent itemset mining.",
     "1. Use the provided market-basket transactions (or create 10+ of your own).\n"
     "2. Implement Apriori with a configurable minimum support.\n"
     "3. Print the frequent itemsets at every level and generate association rules with confidence.\n"
     "4. Explain how candidate pruning works in your implementation."),
    ("DGIM Algorithm", "HARD", "Implement the DGIM algorithm to estimate the number of 1s in a sliding window of a bit stream.",
     "1. Simulate a binary stream of at least 1000 bits.\n"
     "2. Maintain DGIM buckets (sizes are powers of two, at most two buckets per size).\n"
     "3. Estimate the count of 1s in the last k bits and compare it against the exact count.\n"
     "4. Report the error for several window sizes."),
    ("PageRank", "MEDIUM", "Implement PageRank to rank the nodes of a directed graph.",
     "1. Represent a directed graph of at least 6 nodes.\n"
     "2. Implement iterative PageRank with a damping factor of 0.85.\n"
     "3. Stop when ranks converge and print the final ranking.\n"
     "4. Show how a dangling node (no outgoing links) is handled."),
    ("K-Means Clustering", "EASY", "Implement K-Means clustering on a given dataset.",
     "1. Load or generate a 2-D dataset with at least 50 points.\n"
     "2. Implement K-Means from scratch (no ML libraries) for a chosen k.\n"
     "3. Plot the clusters and centroids.\n"
     "4. Use the elbow method to justify your choice of k."),
    ("Decision Tree", "MEDIUM", "Implement a decision tree classifier using information gain.",
     "1. Use a small categorical dataset (e.g. the classic 'play tennis' data).\n"
     "2. Implement entropy and information gain.\n"
     "3. Build the tree recursively and print it.\n"
     "4. Classify two unseen examples and explain the path taken."),
]


def reset_database() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    shutil.rmtree(settings.UPLOAD_DIR, ignore_errors=True)


def _event(db: Session, student: User, exam: Exam, etype: str, at, data=None) -> None:
    payload = dict(data or {})
    payload["demo_seed"] = True
    activity_service.record_event(db, student.id, exam.id, etype, payload, timestamp=at)


def seed_database(db: Session, sample_activity: bool = True) -> None:
    """Idempotent: does nothing if users already exist."""
    if db.scalar(select(User.id).limit(1)) is not None:
        return
    pw = hash_password(PASSWORD)

    faculty = User(name=FACULTY[0], email=FACULTY[1], password_hash=pw, role=Role.FACULTY)
    students: Dict[str, User] = {}
    db.add(faculty)
    for name, email in STUDENTS:
        u = User(name=name, email=email, password_hash=pw, role=Role.STUDENT)
        students[name.split()[0]] = u
        db.add(u)

    exps: Dict[str, Experiment] = {}
    for title, diff, desc, instr in DBMS_EXPERIMENTS + [(t, d, ds, i) for t, d, ds, i in DATA_EXPERIMENTS]:
        e = Experiment(title=title, difficulty=diff, description=desc, instructions=instr)
        exps[title] = e
        db.add(e)
    db.flush()

    now = utcnow()
    exam1 = Exam(
        title="DBMS Practical Examination",
        description="End-semester laboratory examination for Database Management Systems. "
                    "You will be assigned one experiment at random.",
        duration_minutes=90, status=ExamStatus.ACTIVE, start_time=now - timedelta(minutes=35), created_by=faculty.id,
    )
    exam2 = Exam(
        title="Data Mining & Big Data Practical",
        description="Practical examination on mining algorithms (draft - start it from the Exams page to demo).",
        duration_minutes=60, status=ExamStatus.DRAFT, created_by=faculty.id,
    )
    db.add_all([exam1, exam2])
    db.flush()
    for t, *_ in DBMS_EXPERIMENTS:
        db.add(ExamExperiment(exam_id=exam1.id, experiment_id=exps[t].id))
    for t, *_ in DATA_EXPERIMENTS:
        db.add(ExamExperiment(exam_id=exam2.id, experiment_id=exps[t].id))
    db.commit()

    if not sample_activity:
        return

    # ---- sample history for other students (clearly tagged demo_seed in event_data) ----
    def start(name: str, exp_title: str, minutes_ago: int) -> Assignment:
        st = students[name]
        a = Assignment(student_id=st.id, exam_id=exam1.id, experiment_id=exps[exp_title].id,
                       assigned_at=now - timedelta(minutes=minutes_ago), status=AssignmentStatus.IN_PROGRESS)
        db.add(a)
        db.commit()
        _event(db, st, exam1, EventType.EXAM_START, a.assigned_at, {"experiment": exp_title})
        return a

    def beats(name: str, minutes_ago: int, until_seconds_ago: int = 8) -> None:
        st = students[name]
        t = now - timedelta(minutes=minutes_ago)
        end = now - timedelta(seconds=until_seconds_ago)
        step = timedelta(minutes=3)
        while t < end:
            _event(db, st, exam1, EventType.HEARTBEAT, t)
            t += step
        _event(db, st, exam1, EventType.HEARTBEAT, end)

    def at(m: float):
        return now - timedelta(minutes=m)

    def submit(name: str, a: Assignment, minutes_ago: int, text: str) -> None:
        st = students[name]
        rel, fname = storage.save_text(text, exam1.id, st.id, f"{name.lower()}_solution.txt")
        db.add(Submission(student_id=st.id, exam_id=exam1.id, experiment_id=a.experiment_id, file_name=fname,
                          file_path=rel, answer_text=text, submitted_at=at(minutes_ago)))
        a.status = AssignmentStatus.SUBMITTED
        db.commit()
        _event(db, st, exam1, EventType.SUBMISSION, at(minutes_ago), {"file_name": fname})

    # Rahul - working normally
    start("Rahul", "SQL Joins", 22)
    beats("Rahul", 22)

    # Priya - clearly suspicious (tab switches, focus losses, paste)
    start("Priya", "Database Trigger", 26)
    beats("Priya", 26)
    for m in (20.0, 19.6, 19.3):
        _event(db, students["Priya"], exam1, EventType.TAB_SWITCH, at(m), {"visibility": "hidden"})
    _event(db, students["Priya"], exam1, EventType.WINDOW_BLUR, at(17), {})
    _event(db, students["Priya"], exam1, EventType.WINDOW_BLUR, at(16.5), {})
    _event(db, students["Priya"], exam1, EventType.PASTE_ATTEMPT, at(14), {"chars": 412})
    for m in (11.0, 10.7):
        _event(db, students["Priya"], exam1, EventType.TAB_SWITCH, at(m), {"visibility": "hidden"})
    _event(db, students["Priya"], exam1, EventType.WINDOW_BLUR, at(8), {})

    # Amit - finished cleanly
    a = start("Amit", "Database Normalization", 40)
    beats("Amit", 40, until_seconds_ago=12 * 60)
    submit("Amit", a, 12, "1NF/2NF/3NF decomposition of ORDERS\n\nCUSTOMER(customer_id, name, city)\nPRODUCT(product_id, name, unit_price)\n"
                          "ORDERS(order_id, order_date, customer_id)\nORDER_ITEM(order_id, product_id, quantity)\n")

    # Sneha - borderline (warning)
    start("Sneha", "ER Diagram", 15)
    beats("Sneha", 15)
    for m in (12.0, 9.0, 5.0):
        _event(db, students["Sneha"], exam1, EventType.TAB_SWITCH, at(m), {"visibility": "hidden"})
    _event(db, students["Sneha"], exam1, EventType.WINDOW_BLUR, at(3), {})
    _event(db, students["Sneha"], exam1, EventType.COPY_ATTEMPT, at(2), {})

    # Karan - submitted, but with suspicious behaviour (flagged for review)
    a = start("Karan", "PL/SQL Procedure", 55)
    beats("Karan", 55, until_seconds_ago=5 * 60)
    for m in (40.0, 39.5, 39.2, 30.0):
        _event(db, students["Karan"], exam1, EventType.TAB_SWITCH, at(m), {"visibility": "hidden"})
    _event(db, students["Karan"], exam1, EventType.WINDOW_BLUR, at(25), {})
    _event(db, students["Karan"], exam1, EventType.WINDOW_BLUR, at(24), {})
    _event(db, students["Karan"], exam1, EventType.PASTE_ATTEMPT, at(22), {"chars": 980})
    _event(db, students["Karan"], exam1, EventType.PASTE_ATTEMPT, at(21.5), {"chars": 310})
    submit("Karan", a, 5, "CREATE OR REPLACE PROCEDURE transfer_funds(p_from NUMBER, p_to NUMBER, p_amt NUMBER) AS\nBEGIN\n  -- see attached logic\n  NULL;\nEND;\n/")

    # Neha - normal, in progress
    start("Neha", "SQL Joins", 8)
    beats("Neha", 8)

    for name in ("Rahul", "Priya", "Amit", "Sneha", "Karan", "Neha"):
        anomaly_service.recompute(db, exam1, students[name].id)


def run(reset: bool = False) -> None:
    from app.database import init_db

    if reset:
        reset_database()
    else:
        init_db()
    with SessionLocal() as db:
        seed_database(db, sample_activity=settings.SEED_SAMPLE_ACTIVITY)
