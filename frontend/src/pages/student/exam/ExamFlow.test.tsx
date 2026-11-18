import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../../App'
import { ME_STUDENT, STUDENT, mockApi, renderApp } from '../../../test/render'

const EXAM = {
  exam_id: 'EX',
  exam_title: 'Đề thử',
  academic_year: '2025-2026',
  grade: 9,
  duration_minutes: 60,
  total_questions: 2,
}
const QUESTIONS = [
  { question_id: 'Q1', question_no: 1, question_text: 'She ___ a student.', options: { A: 'is', B: 'are', C: 'am', D: 'be' } },
  { question_id: 'Q2', question_no: 2, question_text: 'They ___ here.', options: { A: 'is', B: 'are', C: 'am', D: 'be' } },
]
const ATTEMPT = {
  attempt_id: 'ATT_052',
  student: STUDENT,
  exam: EXAM,
  total_score: 5,
  correct_count: 1,
  started_at: '2026-10-24 10:00:00',
  submitted_at: '2026-10-24 10:20:00',
  diagnosed: false,
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

it('làm bài, rà soát, nộp: câu bỏ trống gửi null và chuyển sang màn nộp thành công', async () => {
  const calls = mockApi({
    'GET /api/auth/me': ME_STUDENT,
    'GET /api/exams/EX': EXAM,
    'GET /api/exams/EX/questions': QUESTIONS,
    'POST /api/attempts': { attempt: ATTEMPT, notification: {} },
    'GET /api/attempts/ATT_052': ATTEMPT,
  })
  renderApp(<App />, '/student/exams/EX')

  await userEvent.click(await screen.findByRole('radio', { name: /is$/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Đánh dấu xem lại' }))
  await userEvent.click(screen.getByRole('button', { name: /Rà soát & nộp bài/ }))

  expect(await screen.findByText('Còn 1 câu chưa trả lời')).toBeInTheDocument()
  // Câu cần xem lại hiện cả nội dung câu hỏi lẫn đáp án đã chọn
  expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Đã chọn: A. is')).toBeInTheDocument()
  expect(screen.getAllByText('She ___ a student.').length).toBeGreaterThan(0)

  await userEvent.click(screen.getByRole('button', { name: 'Nộp bài' }))
  // Còn câu trống thì phải xác nhận trước khi nộp
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Còn 1 câu chưa trả lời')
  await userEvent.dblClick(screen.getByRole('button', { name: 'Vẫn nộp bài' }))
  expect(await screen.findByText('Nộp bài thành công!')).toBeInTheDocument()

  // Nhấp đúp chỉ gửi 1 lần
  expect(calls.filter((c) => c.key === 'POST /api/attempts')).toHaveLength(1)
  const submit = calls.find((c) => c.key === 'POST /api/attempts')
  expect(submit?.body).toEqual(expect.objectContaining({ exam_id: 'EX', answers: { Q1: 'A', Q2: null } }))
  expect(submit?.body).not.toHaveProperty('student_id')
  expect(localStorage.getItem('kltn.exam.STU00006.EX')).toBeNull()
})

it('bài làm dở đã hết giờ: hỏi học sinh, không tự nộp; chọn làm lại thì xóa đáp án cũ', async () => {
  localStorage.setItem(
    'kltn.exam.STU00006.EX',
    JSON.stringify({ startedAt: '2020-01-01 08:00:00', answers: { Q2: 'B' }, flagged: [], current: 1 }),
  )
  const calls = mockApi({ 'GET /api/auth/me': ME_STUDENT, 'GET /api/exams/EX': EXAM, 'GET /api/exams/EX/questions': QUESTIONS })
  renderApp(<App />, '/student/exams/EX')

  expect(await screen.findByText('Bài làm dở đã hết giờ')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Nộp 1 câu đã làm' })).toBeInTheDocument()
  expect(calls.some((c) => c.key === 'POST /api/attempts')).toBe(false)

  await userEvent.click(screen.getByRole('button', { name: 'Làm lại từ đầu' }))
  expect(await screen.findByText('She ___ a student.')).toBeInTheDocument()
  expect(screen.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true)
})

it('bấm lại đáp án đang chọn thì bỏ chọn; rời màn làm bài thì hỏi xác nhận', async () => {
  mockApi({ 'GET /api/auth/me': ME_STUDENT, 'GET /api/exams/EX': EXAM, 'GET /api/exams/EX/questions': QUESTIONS })
  renderApp(<App />, '/student/exams/EX')
  const option = await screen.findByRole('radio', { name: /is$/ })
  await userEvent.click(option)
  expect(option).toHaveAttribute('aria-checked', 'true')
  await userEvent.click(option)
  expect(option).toHaveAttribute('aria-checked', 'false')

  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  await userEvent.click(screen.getByRole('link', { name: 'Trang chủ' }))
  expect(confirm).toHaveBeenCalled()
  expect(screen.getByText('She ___ a student.')).toBeInTheDocument()
  confirm.mockRestore()
})

it('giữ bài làm dở khi tải lại trang', async () => {
  localStorage.setItem(
    'kltn.exam.STU00006.EX',
    JSON.stringify({ startedAt: '2099-01-01 00:00:00', answers: { Q2: 'B' }, flagged: [], current: 1 }),
  )
  mockApi({ 'GET /api/auth/me': ME_STUDENT, 'GET /api/exams/EX': EXAM, 'GET /api/exams/EX/questions': QUESTIONS })
  renderApp(<App />, '/student/exams/EX')

  expect(await screen.findByText('They ___ here.')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: /are$/ })).toHaveAttribute('aria-checked', 'true')
})

it('câu đọc hiểu hiện đoạn văn dùng chung', async () => {
  const passage = { passage_id: 'P1', title: 'Bài đọc hiểu', from_no: 2, to_no: 2, text: 'Long ago, people travelled on foot.' }
  mockApi({
    'GET /api/auth/me': ME_STUDENT,
    'GET /api/exams/EX': EXAM,
    'GET /api/exams/EX/questions': [QUESTIONS[0], { ...QUESTIONS[1], passage }],
  })
  renderApp(<App />, '/student/exams/EX')

  await screen.findByText('She ___ a student.')
  expect(screen.queryByRole('region', { name: 'Đoạn văn' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Câu tiếp theo' }))
  expect(screen.getByRole('region', { name: 'Đoạn văn' })).toHaveTextContent('Long ago, people travelled on foot.')
  expect(screen.getByText(/dùng cho câu 2–/)).toBeInTheDocument()
})

it('xem lại bài làm: lọc câu sai / chưa làm, hiện đáp án đúng và giải thích', async () => {
  const review = (no: number, selected: 'A' | 'B' | null, correct: 'A' | 'B') => ({
    question: QUESTIONS[no - 1],
    selected_opt: selected,
    correct_opt: correct,
    is_correct: selected === correct,
    explanation: `Giải thích câu ${no}`,
    skill_name: 'Thì hiện tại đơn',
  })
  mockApi({
    'GET /api/auth/me': ME_STUDENT,
    'GET /api/attempts/ATT_052': ATTEMPT,
    'GET /api/attempts/ATT_052/answers': [review(1, 'A', 'A'), review(2, null, 'B')],
  })
  renderApp(<App />, '/student/attempts/ATT_052/answers')

  expect(await screen.findByRole('link', { name: 'Câu 1: Đúng' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Câu 2: Chưa làm' })).toBeInTheDocument()
  expect(screen.getByText('Bạn chọn')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: /Chưa làm/ }))
  expect(screen.queryByRole('heading', { name: 'Câu 1' })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Câu 2' })).toBeInTheDocument()
  expect(screen.getByText('Bạn chưa chọn đáp án cho câu này.')).toBeInTheDocument()
  expect(screen.getByText('Giải thích câu 2')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: /Câu chưa đúng/ }))
  expect(screen.getByText('Không có câu nào trong mục này.')).toBeInTheDocument()
})

it('câu biển báo hiện ảnh, câu thông báo hiện khung chữ', async () => {
  const sign = {
    ...QUESTIONS[0],
    question_text: 'What does the sign mean?',
    media: { kind: 'sign', src: '/api/media/signs/cam-coi.svg', text: null, alt: 'Biển cấm bấm còi' },
  }
  const notice = {
    ...QUESTIONS[1],
    question_text: 'What does the notice say?',
    media: { kind: 'notice', src: null, text: 'Super Weekly Saver Ticket', alt: 'Thông báo ở nhà ga' },
  }
  mockApi({
    'GET /api/auth/me': ME_STUDENT,
    'GET /api/exams/EX': EXAM,
    'GET /api/exams/EX/questions': [sign, notice],
  })
  renderApp(<App />, '/student/exams/EX')

  expect(await screen.findByRole('img', { name: 'Biển cấm bấm còi' })).toHaveAttribute('src', '/api/media/signs/cam-coi.svg')
  await userEvent.click(screen.getByRole('button', { name: /Câu tiếp theo/ }))
  expect(await screen.findByText('Super Weekly Saver Ticket')).toBeInTheDocument()
})
