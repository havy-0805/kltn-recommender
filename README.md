# Hệ thống khuyến nghị học liệu Tiếng Anh cá nhân hóa (KLTN)

Mã nguồn web đi kèm khóa luận tốt nghiệp. Học sinh lớp 9 làm bài kiểm tra trên web; hệ thống chấm điểm, chẩn đoán
điểm yếu theo ma trận kỹ năng bằng bộ quy tắc nghiệp vụ và đề xuất học liệu kèm lý do. Giáo viên xem tổng quan lớp,
kết quả từng học sinh và nhận thông báo theo thời gian thực khi học sinh nộp bài.

Bộ quy tắc hiện hành: `RULES_V4` trong `backend/engine.py`.

## Cấu trúc thư mục

```
backend/            Máy chủ API (Python 3.12, FastAPI) và thuật toán
  engine.py         Thuật toán chẩn đoán và đề xuất (bộ quy tắc BR-*)
  main.py           Các API REST và WebSocket thông báo
  store.py          Đọc, ghi CSDL và gọi thuật toán
  database.py       Tạo CSDL SQLite từ CSV
  auth.py           Đăng nhập, phiên làm việc
  schemas.py        Kiểu dữ liệu vào, ra của API
  sql/              Lược đồ CSDL và truy vấn Tổng quan lớp
  scripts/          Lệnh bảo trì dữ liệu (nạp lại CSDL, xuất CSV, tạo tài khoản, kiểm tra dữ liệu)
  tests/            Kiểm thử tự động (pytest)
frontend/           Giao diện (React, TypeScript, Vite, Tailwind CSS)
  src/pages/        Màn hình của học sinh và giáo viên
  src/components/   Thành phần giao diện dùng chung
  src/lib/          Diễn đạt kết quả cho học sinh, định dạng số liệu
  scripts/          Kiểm thử đầu cuối (Playwright)
data/               Dữ liệu mẫu (CSV), nội dung học liệu, ảnh minh họa
dev.sh              Chạy cả backend và frontend bằng một lệnh
Mở web.command      Bấm đúp để chạy trên macOS
```

## Chạy

### Cách 1: trên trình duyệt, không cần cài gì (GitHub Codespaces)

[![Mở trong GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/havy-0805/kltn-recommender?quickstart=1)

1. Đăng nhập GitHub, bấm nút trên rồi bấm **Create codespace**.
2. Lần đầu mất khoảng 3–5 phút để cài thư viện. Sau đó web tự chạy và mở tab mới ở cổng 5173. Nếu tab không tự mở:
   vào thẻ **Ports**, bấm biểu tượng quả địa cầu ở dòng **Web (5173)**.
3. Đăng nhập bằng tài khoản demo ở bảng bên dưới.

Codespaces tính vào hạn mức miễn phí hằng tháng của tài khoản GitHub mở nó. Dùng xong vào
https://github.com/codespaces để dừng hoặc xóa codespace.

### Cách 2: trên máy (Windows, macOS, Linux)

Cần cài sẵn **Python 3.12**, **uv** (`pip install uv`) và **Node.js 24**. Mở hai cửa sổ dòng lệnh tại thư mục dự án:

```bash
# Cửa sổ 1: máy chủ (http://localhost:8000/docs)
cd backend
uv sync
uv run uvicorn main:app

# Cửa sổ 2: giao diện
cd frontend
npm install
npm run dev
```

Mở http://localhost:5173. Trên macOS/Linux có thể chạy cả hai bằng `./dev.sh`; trên macOS bấm đúp **`Mở web.command`**.
Lần chạy đầu tự cài thư viện và tạo CSDL `data/kltn.sqlite` từ CSV.

### Tài khoản demo (mật khẩu chung `123456`)

| Vai trò | Tên đăng nhập | Ghi chú |
|---|---|---|
| Học sinh | `STU00001` … `STU00034` | mã học sinh |
| Giáo viên | `gv.khoi9` | xem toàn bộ khối 9 |

Để xem thông báo theo thời gian thực: mở một cửa sổ thường đăng nhập giáo viên, một cửa sổ ẩn danh đăng nhập học sinh
rồi nộp bài.

## Dữ liệu

- `data/Dữ liệu mẫu - *.csv`: dữ liệu thu từ cơ sở (đề, câu hỏi, chuyên đề, học liệu, học sinh, lượt làm bài, kết quả),
  đã ẩn danh.
- `data/Đề bổ sung - exam.csv`, `data/Đề bổ sung - question.csv`: đề chẩn đoán `EXAM_G9_TT_125` (đề thi thử vào 10
  THCS Thái Thịnh, mã 125).
- Cột `group_id`, `group_name` của bảng skill: chuyên đề → nhóm kiến thức, dùng để gộp chuyên đề chỉ có 1 câu và tính
  tỷ lệ đạt theo nhóm.
- `data/error_type.csv`, `data/material_error_type.csv` và cột `error_type` của bảng question: dạng lỗi trong từng
  chuyên đề, dạng lỗi học liệu có dạy và nhãn dạng lỗi của câu hỏi.
- `data/materials/<material_id>.json`: nội dung 125 học liệu (định dạng ở `data/materials/SCHEMA.md`).
- `data/passage.csv`, `question_media.csv`, `question_underline.csv`, `data/media/`: đoạn văn đọc hiểu, ảnh biển báo và
  phần gạch chân của câu hỏi.
- `data/student_profile.csv`: họ tên hiển thị (tên mẫu). `data/accounts.csv`: tài khoản đăng nhập, mật khẩu đã băm.
- `data/kltn.sqlite`: CSDL chính (lược đồ `backend/sql/schema.sql`), tạo tự động ở lần chạy đầu. Bài nộp, kết quả
  từng câu, thông báo và kết quả chẩn đoán được ghi vào đây trong một giao dịch.

Nhãn chuyên đề, dạng lỗi và nhóm kiến thức nằm trong CSV nên sửa được trên bảng tính mà không cần sửa mã nguồn.
Sửa xong thì nạp lại (tắt web trước), chạy trong thư mục `backend`:

```bash
uv run python -m scripts.init_db            # nạp lại CSV, giữ các lượt nộp trên web
uv run python -m scripts.init_db --reset    # về lại dữ liệu ban đầu
uv run python -m scripts.export_csv         # xuất CSDL ra CSV (data/export/)
uv run python -m scripts.validate_data      # kiểm tra chất lượng dữ liệu, độ phủ học liệu
uv run python -m scripts.create_accounts <mật_khẩu_mới>   # đổi mật khẩu chung rồi chạy lại init_db
```

## Kiểm thử

```bash
cd backend && uv run pytest && uv run ruff check . && uv run mypy .
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
```

Kiểm thử đầu cuối (Playwright, cần web đang chạy): `node frontend/scripts/e2e-student.mjs`,
`node frontend/scripts/e2e-teacher.mjs`.
