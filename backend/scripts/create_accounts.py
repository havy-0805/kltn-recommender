"""Sinh data/accounts.csv: mỗi học sinh một tài khoản (tên đăng nhập = mã học sinh) và tài khoản giáo viên khối 9.
Chạy xong thì `uv run python -m scripts.init_db` để nạp vào CSDL.

Dùng: uv run python -m scripts.create_accounts [mật_khẩu_chung]   (mặc định 123456, chỉ để demo)
"""

import sys
from pathlib import Path

import pandas as pd

from auth import hash_password

DATA_DIR = Path(__file__).resolve().parents[2] / 'data'
TEACHER = {'username': 'gv.khoi9', 'role': 'teacher', 'student_id': '', 'display_name': 'Giáo viên quản lý'}


def main(password: str) -> None:
    profiles = pd.read_csv(DATA_DIR / 'student_profile.csv', dtype=str)
    rows = [TEACHER] + [
        {'username': p['student_id'], 'role': 'student', 'student_id': p['student_id'], 'display_name': p['full_name']}
        for p in profiles.to_dict('records')
    ]
    accounts = pd.DataFrame(rows)
    accounts['password_hash'] = [hash_password(password) for _ in rows]
    accounts.to_csv(DATA_DIR / 'accounts.csv', index=False)
    print(f'Đã tạo {len(rows)} tài khoản vào {DATA_DIR / "accounts.csv"}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '123456')
