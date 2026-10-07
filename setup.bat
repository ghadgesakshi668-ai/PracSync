@echo off
REM One-time setup for Windows. Run from the PracSync folder.
echo === Backend setup ===
cd backend
python -m venv venv
call venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cd ..
echo === Frontend setup ===
cd frontend
call npm install
cd ..
echo.
echo Setup complete. Now run run-backend.bat and run-frontend.bat in two separate windows.
pause
