import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="pracsync_test_")
os.environ["PRACSYNC_DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["PRACSYNC_UPLOAD_DIR"] = f"{_tmp}/uploads"
os.environ["PRACSYNC_SEED_SAMPLE_ACTIVITY"] = "true"

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.seed import reset_database, run


@pytest.fixture()
def client():
    reset_database()
    run(reset=False)
    with TestClient(app) as c:
        yield c


def login(client, email, password="password123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def faculty(client):
    return login(client, "faculty@pracsync.com")


@pytest.fixture()
def student(client):
    return login(client, "student@pracsync.com")
