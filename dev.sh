#!/usr/bin/env bash
# Bật backend (cổng 8000) + frontend (cổng 5173) rồi mở trình duyệt. Ctrl+C hoặc đóng cửa sổ để tắt.
set -euo pipefail
cd "$(dirname "$0")"
URL=http://localhost:5173
# Mở trình duyệt nếu máy có lệnh mở (macOS: open, Linux: xdg-open); trên Codespaces cổng 5173 tự được chuyển tiếp
open_url() { if command -v open >/dev/null; then open "$1"; elif command -v xdg-open >/dev/null; then xdg-open "$1" >/dev/null 2>&1 || true; fi; }

# Web đang chạy sẵn thì chỉ cần mở trình duyệt
if curl -s -o /dev/null "$URL"; then
  echo "Web đang chạy sẵn, mở $URL"
  open_url "$URL"
  exit 0
fi

# Lần đầu (hoặc sau khi xóa thư mục thư viện): cài thư viện
[ -d backend/.venv ] || (echo "Cài thư viện backend…" && cd backend && uv sync)
[ -d frontend/node_modules ] || (echo "Cài thư viện frontend…" && cd frontend && npm install)

# exec vào thẳng chương trình server để lệnh tắt bên dưới tắt đúng server, không để sót tiến trình con
(cd backend && exec .venv/bin/uvicorn main:app --port 8000) &
BACKEND=$!
(cd frontend && exec node_modules/.bin/vite --port 5173 --strictPort) &
FRONTEND=$!
trap 'echo; echo "Đang tắt web…"; kill $BACKEND $FRONTEND 2>/dev/null' EXIT INT TERM

echo "Đang khởi động…"
for _ in $(seq 1 60); do
  if curl -s "$URL/api/auth/me" | grep -q null; then break; fi
  sleep 0.5
done
open_url "$URL"
echo
echo "Web đang chạy tại $URL — giữ cửa sổ này mở trong lúc dùng. Ctrl+C để tắt."
wait
