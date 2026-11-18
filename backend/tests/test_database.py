"""CSDL SQLite là kho chính: nạp từ CSV, giữ lượt nộp trên web khi nạp lại, ràng buộc khóa ngoại."""

import json
import sqlite3
from pathlib import Path

import pytest
from fastapi import FastAPI

from database import connect, db_path, init_database, read_table, web_rows
from main import create_app
from tests.conftest import login

EXAM = 'EXAM_G9_03'


def count(data_dir: Path, table: str) -> int:
    con = connect(db_path(data_dir))
    try:
        return int(con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0])
    finally:
        con.close()


def test_first_start_builds_database_from_csv(app: FastAPI, data_dir: Path) -> None:
    assert db_path(data_dir).exists()
    assert count(data_dir, 'attempt') == 51 and count(data_dir, 'result') == 2040
    assert count(data_dir, 'question') == 160 and count(data_dir, 'account') == 35
    # Kết quả chẩn đoán đã có trong CSDL ngay khi khởi động, truy vấn SQL tay cũng thấy
    assert count(data_dir, 'diagnosis') == 51


def test_reload_from_csv_keeps_web_attempts(app: FastAPI, data_dir: Path) -> None:
    login(app, 'student', 'STU00006').post('/api/attempts', json={'exam_id': EXAM, 'answers': {}})
    con = connect(db_path(data_dir))
    keep = web_rows(con)
    con.close()
    counts = init_database(data_dir, keep=keep)
    assert counts['attempt'] == 52 and counts['result'] == 2080 and counts['notification'] == 1
    reloaded = login(create_app(data_dir), 'student', 'STU00006')
    assert reloaded.get('/api/attempts').json()[0]['attempt_id'] == 'ATT_052'


def test_bad_csv_does_not_replace_working_database(app: FastAPI, data_dir: Path) -> None:
    before = db_path(data_dir).read_bytes()
    material = data_dir / 'Dữ liệu mẫu - material.csv'
    text = material.read_text(encoding='utf-8').rstrip('\r\n')
    material.write_text(text + '\r\nMAT_X,SK_KHONG_CO,Sai chuyên đề,2\r\n', encoding='utf-8')
    with pytest.raises(sqlite3.IntegrityError):
        init_database(data_dir)
    assert db_path(data_dir).read_bytes() == before


def test_legacy_state_json_is_migrated(data_dir: Path) -> None:
    runtime = data_dir / 'runtime'
    runtime.mkdir()
    results = [{'result_id': f'RES_9{i:03d}', 'attempt_id': 'ATT_052', 'question_id': f'G903_Q{i:02d}',
                'selected_opt': None, 'is_correct': 0} for i in range(1, 41)]
    state = {'attempts': [{'attempt_id': 'ATT_052', 'student_id': 'STU00006', 'exam_id': EXAM,
                           'started_at': '2026-11-07 20:00:00', 'submitted_at': '2026-11-07 20:30:00',
                           'total_score': 0.0}],
             'results': results, 'diagnosed': ['ATT_052'],
             'notifications': [{'id': 'NOTI_001', 'kind': 'attempt_submitted', 'created_at': '2026-11-07 20:30:00',
                                'read': True, 'attempt_id': 'ATT_052', 'weak_skill_count': 5,
                                'recommendation_count': 3}]}
    (runtime / 'state.json').write_text(json.dumps(state), encoding='utf-8')
    teacher = login(create_app(data_dir), 'teacher', 'gv.khoi9')
    assert teacher.get('/api/attempts/ATT_052').json()['diagnosed'] is True
    assert teacher.get('/api/notifications').json()[0]['read'] is True
    con = connect(db_path(data_dir))
    assert read_table(con, 'attempt').iloc[-1]['source'] == 'web'
    con.close()
