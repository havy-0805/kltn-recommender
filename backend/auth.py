"""Đăng nhập và phân quyền: tài khoản trong bảng account của CSDL, phiên là token ký HMAC trong cookie HttpOnly."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

Role = Literal['student', 'teacher']

COOKIE_NAME = 'kltn_session'
SESSION_SECONDS = 8 * 3600
_SCRYPT = {'n': 2**14, 'r': 8, 'p': 1}


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f'scrypt${salt.hex()}${digest.hex()}'


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_hex, digest_hex = stored.split('$')
    except ValueError:
        return False
    expected = hash_password(password, bytes.fromhex(salt_hex)).split('$')[2]
    return hmac.compare_digest(expected, digest_hex)


@dataclass(frozen=True)
class User:
    username: str
    role: Role
    display_name: str
    student_id: str | None


class Accounts:
    def __init__(self, data_dir: Path, con: sqlite3.Connection) -> None:
        self._rows: dict[str, dict[str, str]] = {
            str(r['username']).lower(): {k: '' if r[k] is None else str(r[k]) for k in r.keys()}
            for r in con.execute('SELECT * FROM account')
        }
        self._secret = self._load_secret(data_dir / 'runtime' / 'session.key')

    @staticmethod
    def _load_secret(path: Path) -> bytes:
        # Khóa ký phiên sinh một lần và giữ lại, để khởi động lại server không đăng xuất mọi người
        if path.exists():
            return path.read_bytes()
        path.parent.mkdir(parents=True, exist_ok=True)
        key = secrets.token_bytes(32)
        path.write_bytes(key)
        return key

    def _user(self, row: dict[str, str]) -> User:
        role: Role = 'teacher' if row['role'] == 'teacher' else 'student'
        return User(row['username'], role, row['display_name'], row['student_id'] or None)

    def authenticate(self, role: Role, username: str, password: str) -> User | None:
        row = self._rows.get(username.strip().lower())
        # Luôn băm mật khẩu kể cả khi sai tên, để thời gian phản hồi không lộ tài khoản nào tồn tại
        ok = verify_password(password, row['password_hash'] if row else hash_password('x'))
        if not row or not ok or row['role'] != role:
            return None
        return self._user(row)

    def issue(self, user: User, now: float | None = None) -> str:
        payload = {'u': user.username, 'exp': int((now or time.time()) + SESSION_SECONDS)}
        body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
        sig = hmac.new(self._secret, body.encode(), hashlib.sha256).hexdigest()
        return f'{body}.{sig}'

    def resolve(self, token: str | None, now: float | None = None) -> User | None:
        if not token or '.' not in token:
            return None
        body, sig = token.rsplit('.', 1)
        expected = hmac.new(self._secret, body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        try:
            payload = json.loads(base64.urlsafe_b64decode(body))
        except ValueError:
            return None
        if payload.get('exp', 0) < (now or time.time()):
            return None
        row = self._rows.get(str(payload.get('u', '')).lower())
        return self._user(row) if row else None
