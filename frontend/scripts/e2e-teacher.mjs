// Luồng giáo viên + thông báo real-time: node scripts/e2e-teacher.mjs <out-dir>
// Cần backend chạy trên bản sao dữ liệu (DATA_DIR) vì script nộp một bài thật qua API.
import { chromium } from 'playwright'

const out = process.argv[2] ?? '.'
const base = process.env.APP_URL ?? 'http://localhost:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const shot = async (name) => {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(250) // chờ hiệu ứng CSS chạy xong
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
  console.log('✓', name)
}

// Mở thẳng trang cần đăng nhập: phải bị chuyển tới đăng nhập rồi quay lại đúng trang
await page.goto(`${base}/teacher/notifications`)
await page.getByLabel('Tên đăng nhập').fill('gv.khoi9')
await page.getByLabel('Mật khẩu', { exact: true }).fill('123456')
await page.getByRole('button', { name: 'Đăng nhập' }).click()
await page.getByText('Nhận thông báo trực tiếp').waitFor()

// Học sinh đăng nhập ở nơi khác và nộp bài trong lúc giáo viên đang mở trang
const loginRes = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ role: 'student', username: 'STU00006', password: '123456' }),
})
const cookie = loginRes.headers.getSetCookie()[0].split(';')[0]
const questions = await (await fetch(`${base}/api/exams/EXAM_G9_03/questions`, { headers: { cookie } })).json()
const answers = Object.fromEntries(questions.map((q, i) => [q.question_id, 'ABCD'[(i * 7) % 4]]))
const res = await fetch(`${base}/api/attempts`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', cookie },
  body: JSON.stringify({ exam_id: 'EXAM_G9_03', answers }),
})
const { attempt } = await res.json()

await page.getByRole('status').getByText('Bài nộp mới').waitFor({ timeout: 5000 })
await page.getByText('1 bài nộp · 1 chưa đọc').waitFor()
await shot('t01-notification-live')

await page.getByRole('status').getByRole('link', { name: 'Xem chẩn đoán' }).click()
await page.getByText(/Điểm yếu ưu tiên gán học liệu/).waitFor()
await shot('t02-diagnosis')

await page.getByLabel('Số chuyên đề đề xuất').selectOption('5')
await page.getByRole('link', { name: 'Xem học liệu đề xuất' }).click()
await page.getByRole('heading', { name: 'Học liệu đề xuất' }).waitFor()
await shot('t03-recommendations')

await page.getByRole('link', { name: 'Xem học liệu' }).first().click()
await page.getByRole('button', { name: /Lý thuyết trọng tâm/ }).waitFor()
await shot('t04-material')

await page.getByRole('banner').getByRole('link', { name: 'Tổng quan lớp' }).click()
await page.getByRole('heading', { name: 'Tổng quan lớp' }).waitFor()
await shot('t05-overview')

await page.getByRole('banner').getByRole('link', { name: 'Kết quả học sinh' }).click()
await page.getByRole('searchbox', { name: 'Tìm học sinh' }).fill('ha nhi')
await shot('t06-results-search')
await page.getByRole('link', { name: 'Nguyễn Hà Nhi' }).first().click()
await page.getByText(/Điểm yếu ưu tiên gán học liệu/).waitFor()
await shot('t07-results-open-student')

await page.getByRole('button', { name: /^Thông báo/ }).click()
await page.getByRole('link', { name: 'Xem tất cả thông báo' }).click()
await page.getByRole('heading', { name: 'Thông báo', exact: true }).waitFor()
await shot('t08-notifications-read')

await browser.close()
if (errors.length) {
  console.error('Lỗi trên trình duyệt:\n' + errors.join('\n'))
  process.exit(1)
}
