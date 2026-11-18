import shutil
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from main import create_app

DATA_DIR = Path(__file__).resolve().parents[2] / 'data'
PASSWORD = '123456'


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    for f in DATA_DIR.glob('*.csv'):
        shutil.copy(f, tmp_path)
    shutil.copytree(DATA_DIR / 'materials', tmp_path / 'materials')
    shutil.copytree(DATA_DIR / 'media', tmp_path / 'media')
    return tmp_path


@pytest.fixture
def app(data_dir: Path) -> FastAPI:
    return create_app(data_dir)


def login(app: FastAPI, role: str, username: str) -> TestClient:
    client = TestClient(app)
    resp = client.post('/api/auth/login', json={'role': role, 'username': username, 'password': PASSWORD})
    assert resp.status_code == 200, resp.text
    return client


@pytest.fixture
def teacher(app: FastAPI) -> TestClient:
    return login(app, 'teacher', 'gv.khoi9')


@pytest.fixture
def student(app: FastAPI) -> TestClient:
    return login(app, 'student', 'STU00006')
