#!/usr/bin/env bash
# One-time setup for macOS / Linux
set -e
(cd backend && python3 -m venv venv && . venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt)
(cd frontend && npm install)
echo "Setup complete. Run ./run-backend.sh and ./run-frontend.sh in two terminals."
