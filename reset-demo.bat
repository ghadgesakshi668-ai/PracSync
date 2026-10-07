@echo off
REM Wipes the database + uploads and re-creates fresh demo data. Stop the backend first.
cd backend
call venv\Scripts\activate
python seed_demo.py --reset
pause
