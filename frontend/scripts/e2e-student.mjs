// Đi hết luồng học sinh trên app đang chạy và chụp từng màn: node scripts/e2e-student.mjs <out-dir>
// Cần backend chạy trên bản sao dữ liệu (DATA_DIR) để không ghi bài nộp thử vào data/ thật.
import { chromium } from 'playwright'

const out = process.argv[2] ?? '.'
const base = process.env.APP_URL ?? 'http://localhost:5173'
const examId = process.env.EXAM_ID ?? 'EXAM_G9_03'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('401') && errors.push(m.text()))
const shot = async (name) => {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(250) // chờ hiệu ứng CSS chạy xong
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
  console.log('✓', name)
}

await page.goto(base)
await shot('00-role-select')
await page.getByRole('link', { name: /Học sinh/ }).click()
await page.getByLabel('Mã học sinh').fill('STU00006')
await page.getByLabel('Mật khẩu', { exact: true }).fill('wrong')
await page.getByRole('button', { name: 'Đăng nhập' }).click()
await page.getByRole('alert').waitFor()
await shot('00-login-error')
await page.getByLabel('Mật khẩu', { exact: true }).fill('123456')
await page.getByRole('button', { name: 'Đăng nhập' }).click()
await page.getByText('Lịch sử làm bài gần đây').waitFor()
await shot('01-home-before')

await page.getByRole('banner').getByRole('link', { name: 'Bài kiểm tra' }).click()
await shot('02-exams')
await page.locator(`a[href="/student/exams/${examId}"]`).click()
await page.getByRole('radio', { name: /^A/ }).first().waitFor()
for (let i = 0; i < 40; i++) {
  const options = page.getByRole('radiogroup').getByRole('radio')
  await options.nth(i % 4).click()
  if (i === 2 || i === 11) await page.getByRole('button', { name: 'Đánh dấu xem lại' }).click()
  if (i === 5) await shot('03-take-exam')
  if (i === 35) await shot('03b-take-exam-q36')
  if (i < 39) await page.getByRole('button', { name: 'Câu tiếp theo' }).click()
}
await page.getByRole('button', { name: 'Rà soát bài làm' }).click()
await page.getByRole('heading', { name: 'Rà soát bài làm trước khi nộp' }).waitFor()
await shot('04-review')
await page.getByRole('button', { name: 'Nộp bài' }).click()
await page.getByText('Nộp bài thành công!').waitFor()
await shot('05-submitted')

await page.getByRole('link', { name: 'Xem kết quả phân tích' }).click()
await page.getByRole('dialog').waitFor()
await page.screenshot({ path: `${out}/06-loading.png` })
await page.getByRole('button', { name: 'Xem báo cáo chi tiết' }).waitFor()
await page.screenshot({ path: `${out}/07-loading-done.png` })
await page.getByRole('button', { name: 'Xem báo cáo chi tiết' }).click()
await shot('08-diagnosis')

const cta = page.getByRole('link', { name: /Xem học liệu (đề xuất|nâng cao)/ })
if (await cta.count()) {
  await cta.click()
  await shot('09-recommendations')
  await page.getByRole('link', { name: 'Bắt đầu học' }).first().click()
  await page.getByRole('button', { name: /Lý thuyết trọng tâm/ }).click()
  await shot('10-practice')
}

await page.getByRole('banner').getByRole('link', { name: 'Trang chủ' }).click()
await shot('11-home-after')
await page.getByRole('banner').getByRole('link', { name: 'Lịch sử học tập' }).click()
await page.locator('a[href^="/student/history/"]').nth(1).click()
await page.getByText('Phần cần luyện thêm', { exact: true }).waitFor()
await shot('12-history-detail')

await browser.close()
if (errors.length) {
  console.error('Lỗi trên trình duyệt:\n' + errors.join('\n'))
  process.exit(1)
}
