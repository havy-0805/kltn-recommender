"""Xuất các bảng của CSDL data/kltn.sqlite ra CSV để dán lên Google Sheets hoặc gửi giáo viên.

    uv run python -m scripts.export_csv [thư_mục]   (mặc định data/export/)

Bảng attempt và result gồm cả lượt nộp trên web (cột source = 'web').
"""

import sys
from pathlib import Path

from database import DEFAULT_DATA_DIR, connect, db_path, read_table

TABLES = ('student', 'exam', 'skill', 'question', 'material', 'error_type', 'material_error_type', 'attempt', 'result',
          'notification', 'diagnosis', 'diagnosis_skill', 'recommendation')

if __name__ == '__main__':
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DATA_DIR / 'export'
    out.mkdir(parents=True, exist_ok=True)
    con = connect(db_path(DEFAULT_DATA_DIR))
    for name in TABLES:
        frame = read_table(con, name)
        frame.to_csv(out / f'{name}.csv', index=False, encoding='utf-8-sig')
        print(f'{name:20} {len(frame):5} dòng')
    con.close()
    print(out)
