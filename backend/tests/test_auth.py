import time
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from auth import COOKIE_NAME, SESSION_SECONDS, Accounts, hash_password, verify_password
from database import connect, db_path
from tests.conftest import PASSWORD, login


def test_password_hash_roundtrip() -> None:
    stored = hash_password('123456')
    assert stored.startswith('scrypt$')
    assert verify_password('123456', stored)
    assert not verify_password('1234567', stored)
    assert not verify_password('123456', 'hỏng')


def test_login_sets_httponly_cookie_and_me(app: FastAPI) -> None:
    client = TestClient(app)
    resp = client.post('/api/auth/login', json={'role': 'student', 'username': 'stu00006', 'password': PASSWORD})
    assert resp.status_code == 200
    student = {'student_id': 'STU00006', 'full_name': 'Nguyễn Hà Nhi', 'class_name': '9 - Nhóm 2'}
    assert resp.json()['student'] == student
    assert 'httponly' in resp.headers['set-cookie'].lower()
    assert client.get('/api/auth/me').json()['username'] == 'STU00006'

    assert client.post('/api/auth/logout').status_code == 204
    assert client.get('/api/auth/me').json() is None


@pytest.mark.parametrize(('role', 'username', 'password'), [
    ('student', 'STU00006', 'sai-mat-khau'),
    ('student', 'STU99999', PASSWORD),
    ('teacher', 'STU00006', PASSWORD),   # đúng mật khẩu nhưng sai vai trò
    ('student', 'gv.khoi9', PASSWORD),
])
def test_login_rejects_bad_credentials(app: FastAPI, role: str, username: str, password: str) -> None:
    resp = TestClient(app).post('/api/auth/login', json={'role': role, 'username': username, 'password': password})
    assert resp.status_code == 401
    assert resp.json()['detail'] == 'Sai tên đăng nhập hoặc mật khẩu'
    assert 'set-cookie' not in resp.headers


def test_every_api_requires_login(app: FastAPI) -> None:
    anonymous = TestClient(app)
    for path in ['/api/exams', '/api/attempts', '/api/attempts/ATT_003/diagnosis', '/api/materials/MAT_CD01',
                 '/api/classes', '/api/notifications']:
        assert anonymous.get(path).status_code == 401, path
    assert anonymous.post('/api/attempts', json={'exam_id': 'EXAM_G9_03', 'answers': {}}).status_code == 401


def test_student_sees_only_own_data(app: FastAPI) -> None:
    nhi = login(app, 'student', 'STU00006')
    assert nhi.get('/api/attempts', params={'student_id': 'STU00003'}).status_code == 403
    assert nhi.get('/api/attempts/ATT_003').status_code == 403            # lượt làm của STU00003
    assert nhi.get('/api/attempts/ATT_003/diagnosis').status_code == 403
    assert nhi.get('/api/students/STU00003').status_code == 403
    assert nhi.get('/api/classes').status_code == 403
    assert nhi.get('/api/notifications').status_code == 403


def test_teacher_cannot_submit_or_run_first_diagnosis(app: FastAPI) -> None:
    teacher = login(app, 'teacher', 'gv.khoi9')
    assert teacher.post('/api/attempts', json={'exam_id': 'EXAM_G9_03', 'answers': {}}).status_code == 403
    assert teacher.post('/api/attempts/ATT_003/diagnosis').status_code == 403
    assert teacher.get('/api/attempts/ATT_003/diagnosis').status_code == 200


def test_websocket_only_for_teacher(app: FastAPI) -> None:
    for client in (TestClient(app), login(app, 'student', 'STU00006')):
        with pytest.raises(WebSocketDisconnect) as err, client.websocket_connect('/ws/teacher') as ws:
            ws.receive_json()
        assert err.value.code == 4401


def test_tampered_or_expired_token_is_rejected(app: FastAPI, data_dir: Path) -> None:
    client = login(app, 'student', 'STU00006')
    token = client.cookies[COOKIE_NAME]
    body, sig = token.rsplit('.', 1)
    forged = TestClient(app, cookies={COOKIE_NAME: f'{body}.{"0" * len(sig)}'})
    assert forged.get('/api/auth/me').json() is None
    assert forged.get('/api/exams').status_code == 401

    con = connect(db_path(data_dir))
    accounts = Accounts(data_dir, con)
    con.close()
    user = accounts.resolve(token)
    assert user is not None
    assert accounts.resolve(token, now=time.time() + SESSION_SECONDS + 1) is None
