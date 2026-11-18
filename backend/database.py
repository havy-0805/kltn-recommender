"""CSDL SQLite data/kltn.sqlite: kho dữ liệu chính của hệ thống.

- Lược đồ ở sql/schema.sql; số liệu trang Tổng quan và Kết quả học sinh lấy bằng các câu lệnh trong sql/tong_quan.sql,
  chạy trực tiếp trên CSDL nên bài vừa nộp có ngay trong số liệu.
- CSV trong data/ chỉ là dữ liệu nạp ban đầu (init_database) và bản xuất ra Google Sheets (scripts/export_csv.py).
"""

from __future__ import annotations

import json
import re
import sqlite3
from collections.abc import Mapping, Sequence
from functools import cache
from pathlib import Path
from typing import Any

import pandas as pd

from engine import CSV_PREFIX, ERROR_TYPE_FILE, MATERIAL_ERROR_TYPE_FILE, SUPPLEMENT_PREFIX, Dataset
from schemas import Diagnosis

DEFAULT_DATA_DIR = Path(__file__).resolve().parents[1] / 'data'
SQL_DIR = Path(__file__).resolve().parent / 'sql'
SCHEMA_FILE = SQL_DIR / 'schema.sql'
SQL_FILE = SQL_DIR / 'tong_quan.sql'
DB_FILE = 'kltn.sqlite'
DIAGNOSIS_TABLES = ('diagnosis', 'diagnosis_skill', 'recommendation')

# Bảng nạp từ CSV, theo thứ tự khóa ngoại. Bảng gốc có thể có file "Đề bổ sung - <bảng>.csv" nối thêm vào sau.
SEED_FILES: dict[str, str] = {
    'student': f'{CSV_PREFIX}student.csv',
    'student_profile': 'student_profile.csv',
    'account': 'accounts.csv',
    'exam': f'{CSV_PREFIX}exam.csv',
    'skill': f'{CSV_PREFIX}skill.csv',
    'error_type': ERROR_TYPE_FILE,
    'question': f'{CSV_PREFIX}question.csv',
    'material': f'{CSV_PREFIX}material.csv',
    'material_error_type': MATERIAL_ERROR_TYPE_FILE,
    'passage': 'passage.csv',
    'question_media': 'question_media.csv',
    'question_underline': 'question_underline.csv',
    'attempt': f'{CSV_PREFIX}attempt.csv',
    'result': f'{CSV_PREFIX}result.csv',
}
OTHER_TABLES = ('notification', *DIAGNOSIS_TABLES)


def db_path(data_dir: Path) -> Path:
    return data_dir / DB_FILE


def connect(path: Path | str) -> sqlite3.Connection:
    # Máy chủ chạy một tiến trình; FastAPI có thể gọi từ luồng khác nên tắt kiểm tra luồng
    con = sqlite3.connect(path, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA foreign_keys = ON')
    return con


@cache
def queries() -> dict[str, str]:
    """Các câu lệnh trong file SQL, theo tên ở dòng "-- name: <tên>"."""
    parts = re.split(r'^-- name: (\w+)\s*$', SQL_FILE.read_text(encoding='utf-8'), flags=re.MULTILINE)
    return {name: body.strip() for name, body in zip(parts[1::2], parts[2::2], strict=True)}


def run(con: sqlite3.Connection, name: str, class_name: str | None, **params: Any) -> list[dict[str, Any]]:
    return [dict(row) for row in con.execute(queries()[name], {'class_name': class_name, **params})]


def table_columns(con: sqlite3.Connection, table: str) -> list[str]:
    return [str(r['name']) for r in con.execute(f'PRAGMA table_info("{table}")')]


def _value(v: Any) -> Any:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    return v.item() if hasattr(v, 'item') else v


def insert_rows(con: sqlite3.Connection, table: str, rows: Sequence[Mapping[Any, Any]]) -> None:
    """Chèn các dòng (dict), chỉ lấy cột có trong bảng; NaN thành NULL."""
    if not rows:
        return
    cols = [c for c in table_columns(con, table) if c in rows[0]]
    names = ', '.join(f'"{c}"' for c in cols)
    marks = ', '.join('?' for _ in cols)
    con.executemany(f'INSERT INTO "{table}" ({names}) VALUES ({marks})',
                    [[_value(r.get(c)) for c in cols] for r in rows])


def read_table(con: sqlite3.Connection, table: str) -> pd.DataFrame:
    """Đọc cả bảng theo đúng thứ tự dòng đã ghi."""
    return pd.read_sql_query(f'SELECT * FROM "{table}" ORDER BY rowid', con)


def _read_seed(data_dir: Path, table: str) -> pd.DataFrame | None:
    path = data_dir / SEED_FILES[table]
    if not path.exists():
        return None
    frame = pd.read_csv(path, dtype={'student_id': str, 'group': str}, keep_default_na=table != 'account')
    extra = data_dir / SEED_FILES[table].replace(CSV_PREFIX, SUPPLEMENT_PREFIX, 1)
    if SEED_FILES[table].startswith(CSV_PREFIX) and extra.exists():
        frame = pd.concat([frame, pd.read_csv(extra)], ignore_index=True)
    if table == 'question':
        # Số thứ tự câu trong đề (1..40) theo thứ tự dòng trong file
        frame['question_no'] = frame.groupby('exam_id').cumcount() + 1
    if table == 'account':
        frame['student_id'] = frame['student_id'].where(frame['student_id'] != '')
    if table == 'attempt':
        frame = frame.assign(source='seed', analysis_viewed=1)
    if table == 'result':
        frame['selected_opt'] = frame['selected_opt'].where(frame['selected_opt'].isin(list('ABCD')))
    return frame


def _legacy_state(data_dir: Path) -> dict[str, list[dict[str, Any]]]:
    """Lượt nộp trên web của bản cũ (data/runtime/state.json), chuyển sang CSDL ở lần khởi tạo đầu tiên."""
    path = data_dir / 'runtime' / 'state.json'
    if not path.exists():
        return {}
    state = json.loads(path.read_text(encoding='utf-8'))
    viewed = set(state.get('diagnosed', []))
    return {
        'attempt': [{**a, 'source': 'web', 'analysis_viewed': int(a['attempt_id'] in viewed)}
                    for a in state.get('attempts', [])],
        'result': state.get('results', []),
        'notification': [{'notification_id': n['id'], 'kind': n['kind'], 'created_at': n['created_at'],
                          'is_read': int(n['read']), 'attempt_id': n['attempt_id'],
                          'weak_skill_count': n['weak_skill_count'],
                          'recommendation_count': n['recommendation_count']}
                         for n in state.get('notifications', [])],
    }


def web_rows(con: sqlite3.Connection) -> dict[str, list[dict[str, Any]]]:
    """Lượt nộp trên web, kết quả từng câu của các lượt đó và thông báo đang có trong CSDL."""
    web = "attempt_id IN (SELECT attempt_id FROM attempt WHERE source = 'web')"
    return {
        'attempt': [dict(r) for r in con.execute("SELECT * FROM attempt WHERE source = 'web' ORDER BY rowid")],
        'result': [dict(r) for r in con.execute(f'SELECT * FROM result WHERE {web} ORDER BY rowid')],
        'notification': [dict(r) for r in con.execute('SELECT * FROM notification ORDER BY rowid')],
    }


def init_database(data_dir: Path, path: Path | None = None,
                  keep: dict[str, list[dict[str, Any]]] | None = None) -> dict[str, int]:
    """Tạo CSDL mới từ CSV trong data_dir, rồi chèn lại các lượt nộp trên web (keep, hoặc state.json của bản cũ).

    Ghi vào file tạm rồi mới thay file cũ, để lỗi dữ liệu (sai khóa ngoại, sai miền giá trị) không làm hỏng
    CSDL đang dùng. Trả về số dòng mỗi bảng.
    """
    path = path or db_path(data_dir)
    tmp = path.with_name(path.name + '.tmp')
    tmp.unlink(missing_ok=True)
    con = connect(tmp)
    try:
        with con:
            con.executescript(SCHEMA_FILE.read_text(encoding='utf-8'))
            for table in SEED_FILES:
                frame = _read_seed(data_dir, table)
                if frame is not None:
                    insert_rows(con, table, frame.to_dict('records'))
            for table, rows in (keep if keep is not None else _legacy_state(data_dir)).items():
                insert_rows(con, table, rows)
            con.executescript(queries()['views'])
        counts = {t: int(con.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0])
                  for t in (*SEED_FILES, *OTHER_TABLES)}
    finally:
        con.close()
    tmp.replace(path)
    return counts


def load_dataset_db(con: sqlite3.Connection) -> Dataset:
    """Các bảng thuật toán dùng, đọc từ CSDL."""
    return Dataset(
        student=read_table(con, 'student'),
        exam=read_table(con, 'exam'),
        skill=read_table(con, 'skill'),
        question=read_table(con, 'question'),
        material=read_table(con, 'material'),
        attempt=read_table(con, 'attempt').drop(columns=['source', 'analysis_viewed']),
        result=read_table(con, 'result'),
        error_type=read_table(con, 'error_type'),
        material_error_type=read_table(con, 'material_error_type'),
    )


def diagnosis_rows(d: Diagnosis, top_k: int) -> dict[str, list[dict[str, Any]]]:
    """Một lần chẩn đoán thành các dòng của 3 bảng kết quả."""
    skills = []
    for rank, w in enumerate(d.weak_skills, 1):
        wrong, total = (int(n) for n in w.error_stats.split(' ')[0].split('/'))
        skills.append(
            {
                'attempt_id': d.attempt_id,
                'priority_rank': rank,
                'unit_id': w.skill_id,
                'scope': w.scope,
                'gap_type': w.gap_type,
                'wrong_q': wrong,
                'total_q': total,
                'in_top_k': int(w.in_top_k),
            }
        )
    return {
        'diagnosis': [
            {
                'attempt_id': d.attempt_id,
                'rules_version': d.rules_version,
                'top_k': top_k,
                'status': d.status,
                'broad_weakness': int(d.broad_weakness_activated),
            }
        ],
        'diagnosis_skill': skills,
        'recommendation': [
            {'attempt_id': d.attempt_id, 'rank': rank, 'unit_id': r.skill_id, 'material_id': r.material_id}
            for rank, r in enumerate(d.recommendations, 1)
        ],
    }


def write_diagnosis(con: sqlite3.Connection, rows: dict[str, list[dict[str, Any]]], attempt_id: str) -> None:
    """Thay kết quả chẩn đoán của một lượt (gọi trong giao dịch của người gọi)."""
    for table in DIAGNOSIS_TABLES:
        con.execute(f'DELETE FROM "{table}" WHERE attempt_id = ?', (attempt_id,))
        insert_rows(con, table, rows[table])
