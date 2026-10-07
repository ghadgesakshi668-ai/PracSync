"""
Re-create the demo data.

    python seed_demo.py --reset      wipe the database + uploads, then seed (use before a demo)
    python seed_demo.py              seed only if the database is empty
"""
import sys

from app.services.seed import run

if __name__ == "__main__":
    reset = "--reset" in sys.argv
    run(reset=reset)
    print("Database reset and seeded." if reset else "Seed check complete.")
    print("Faculty: faculty@pracsync.com / password123")
    print("Student: student@pracsync.com / password123")
