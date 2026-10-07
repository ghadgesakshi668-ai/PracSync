#!/usr/bin/env bash
cd backend && . venv/bin/activate && uvicorn app.main:app --reload --port 8000
