"""Tạo hoặc nạp lại CSDL data/kltn.sqlite từ các file CSV trong data/.

Dùng khi sửa dữ liệu danh mục (đề, câu hỏi, chuyên đề, học liệu...) trên Google Sheets rồi tải CSV về.
Lượt nộp trên web và thông báo đang có trong CSDL được giữ lại; kết quả chẩn đoán tính lại khi máy chủ khởi động.
Dừng máy chủ trước khi chạy.

    uv run python -m scripts.init_db            # nạp lại, giữ lượt nộp trên web
    uv run python -m scripts.init_db --reset    # xóa sạch lượt nộp trên web (trở về dữ liệu thu từ cơ sở)
"""

import sys

from database import DEFAULT_DATA_DIR, connect, db_path, init_database, web_rows

if __name__ == '__main__':
    path = db_path(DEFAULT_DATA_DIR)
    keep = {}
    if path.exists() and '--reset' not in sys.argv:
        con = connect(path)
        keep = web_rows(con)
        con.close()
    counts = init_database(DEFAULT_DATA_DIR, keep=keep)
    for name, n in counts.items():
        print(f'{name:20} {n:5} dòng')
    print(f"{path} (giữ {len(keep.get('attempt', []))} lượt nộp trên web)")
