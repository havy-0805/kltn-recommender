import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import type { Overview } from '../../api/client'
import { ME_TEACHER, STUDENT, mockApi, renderApp } from '../../test/render'

const EXAM = {
  exam_id: 'EX',
  exam_title: 'Đề khảo sát',
  academic_year: '2025-2026',
  grade: 9,
  duration_minutes: 60,
  total_questions: 40,
}
const ATTEMPT = {
  attempt_id: 'ATT_037',
  student: STUDENT,
  exam: EXAM,
  total_score: 8.5,
  correct_count: 34,
  started_at: '2026-09-21 14:00:00',
  submitted_at: '2026-09-21 14:55:00',
  diagnosed: true,
}
const SKILL = {
  skill_id: 'SK_PHON_PRON',
  skill_name: 'Phát âm',
  category: 'Ngữ âm',
  gap_type: 'Sai sót kiến thức nền (Cục bộ)',
  error_stats: '2/3 (67%)',
  easy_stats: '1/2',
  priority_score: 7.5,
  assigned_target_level: 2,
  wrong_question_nos: [21, 33],
  scope: 'topic',
  member_topics: ['SK_PHON_PRON'],
  reason: 'Sai 2/3 (67%) ở các câu 21, 33; sai 1/2 câu cơ bản',
}
const DIAGNOSIS = {
  attempt_id: 'ATT_037',
  student_id: 'STU00006',
  exam_id: 'EX',
  total_score: 8.5,
  status: 'DIAGNOSED',
  total_weak_detected: 1,
  broad_weakness_activated: false,
  weak_skills: [{ ...SKILL, in_top_k: true, has_material: true }],
  recommendations: [
    {
      ...SKILL,
      material_id: 'MAT_PRON_02',
      material_title: 'Luyện phát âm nâng cao',
      material_actual_level: 2,
      material_skill_id: 'SK_PHON_PRON',
      matched_error_types: [],
    },
  ],
  rules_version: 'v4',
  recorded_score: 8.5,
  score_verified: true,
  category_stats: [{ id: 'Ngữ âm', name: 'Ngữ âm', correct_q: 1, total_q: 3, pass_rate: 0.3333 }],
  group_stats: [{ id: 'GRP_PHON', name: 'Ngữ âm: phát âm và trọng âm', correct_q: 1, total_q: 3, pass_rate: 0.3333 }],
  insufficient_skills: [
    { skill_id: 'SK_WISH', skill_name: 'Câu ước', category: 'Ngữ pháp', error_stats: '1/1 (100%)', wrong_question_nos: [9] },
  ],
}

/** WebSocket giả: test tự đẩy tin nhắn qua FakeSocket.last.emit(...) */
class FakeSocket {
  static last: FakeSocket | undefined
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  constructor() {
    FakeSocket.last = this
    queueMicrotask(() => this.onopen?.())
  }
  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
  close() {}
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeSocket)
})
afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

it('kết quả học sinh: bảng cả lớp, tìm theo tên không dấu, bấm tên mở chẩn đoán', async () => {
  const other = {
    ...ATTEMPT,
    attempt_id: 'ATT_040',
    total_score: 4.5,
    student: { student_id: 'STU00009', full_name: 'Lê Minh Đức', class_name: '9 - Nhóm 2' },
  }
  mockApi({
    'GET /api/auth/me': ME_TEACHER,
    'GET /api/notifications': [],
    'GET /api/classes': ['9 - Nhóm 2'],
    'GET /api/overview': OVERVIEW,
    'GET /api/results': [
      { attempt: other, weak_skill_count: 9, broad_weakness: true },
      { attempt: ATTEMPT, weak_skill_count: 1, broad_weakness: false },
    ],
    'GET /api/attempts/ATT_037': ATTEMPT,
    'GET /api/attempts/ATT_037/diagnosis?top_k=3': DIAGNOSIS,
  })
  renderApp(<App />, '/teacher/students')

  // Điểm thấp trước; một lớp thì không có ô chọn lớp
  const links = await screen.findAllByRole('link', { name: /Lê Minh Đức|Nguyễn Hà Nhi/ })
  expect(links.map((l) => l.textContent)).toEqual(['Lê Minh Đức', 'Nguyễn Hà Nhi'])
  expect(screen.getByText('2 học sinh')).toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Lớp' })).not.toBeInTheDocument()

  await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm học sinh' }), 'ha nhi')
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Lê Minh Đức' })).not.toBeInTheDocument())

  await userEvent.click(screen.getByRole('link', { name: 'Nguyễn Hà Nhi' }))
  expect(await screen.findByText('Phát hiện 1 kỹ năng cần lưu ý')).toBeInTheDocument()
  expect(screen.getByText('2/3 câu sai hoặc bỏ trống · câu 21, 33 · sai 1/2 câu cơ bản')).toBeInTheDocument()
  expect(screen.queryByText('SK_PHON_PRON')).not.toBeInTheDocument()
  expect(screen.getByText(/1\. Phát âm — Luyện phát âm nâng cao/)).toBeInTheDocument()
  // Góp ý của giảng viên: tỷ lệ đạt theo nhóm, chuyên đề 1 câu không kết luận
  expect(screen.getByText('Tỷ lệ đạt theo nhóm kiến thức')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Ngữ âm: phát âm và trọng âm' })).toHaveAttribute('aria-valuenow', '33')
  expect(screen.getByText(/Chưa đủ dữ liệu để kết luận \(1 chuyên đề\)/)).toBeInTheDocument()
  expect(screen.getByText(/Câu ước:\s+chưa đúng câu 9/)).toBeInTheDocument()
})

it('trang chẩn đoán: chuyển sang bài làm khác của cùng học sinh', async () => {
  const older = { ...ATTEMPT, attempt_id: 'ATT_020', total_score: 6, submitted_at: '2026-09-01 14:55:00' }
  mockApi({
    'GET /api/auth/me': ME_TEACHER,
    'GET /api/notifications': [],
    'GET /api/attempts/ATT_037': ATTEMPT,
    'GET /api/attempts/ATT_037/diagnosis?top_k=3': DIAGNOSIS,
    'GET /api/attempts/ATT_020': older,
    'GET /api/attempts/ATT_020/diagnosis?top_k=3': { ...DIAGNOSIS, attempt_id: 'ATT_020', total_score: 6, recorded_score: 6 },
    [`GET /api/attempts?student_id=${STUDENT.student_id}`]: [older, ATTEMPT],
  })
  renderApp(<App />, '/teacher/attempts/ATT_037/diagnosis')

  const select = await screen.findByRole('combobox', { name: 'Bài làm khác của học sinh này' })
  // Mới nhất trước, đang chọn bài đang xem
  expect(
    within(select)
      .getAllByRole('option')
      .map((o) => o.getAttribute('value')),
  ).toEqual(['ATT_037', 'ATT_020'])
  expect(select).toHaveValue('ATT_037')

  await userEvent.selectOptions(select, 'ATT_020')
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Bài làm khác của học sinh này' })).toHaveValue('ATT_020'))
  expect(screen.getAllByText(/^6([.,]0)?$/).length).toBeGreaterThan(0)
})

it('phiếu kết quả: điểm mạnh, phần cần luyện, kế hoạch học, so với bài trước; không có mã kỹ thuật', async () => {
  const older = { ...ATTEMPT, attempt_id: 'ATT_020', total_score: 7.25, submitted_at: '2026-08-16 16:00:00' }
  const diagnosis = {
    ...DIAGNOSIS,
    group_stats: [
      ...DIAGNOSIS.group_stats,
      { id: 'GRP_READ', name: 'Đọc hiểu đoạn văn', correct_q: 9, total_q: 10, pass_rate: 0.9 },
      { id: 'GRP_WRITE', name: 'Tổ chức văn bản', correct_q: 5, total_q: 6, pass_rate: 0.83 },
    ],
    // Nhóm gộp đang bị chẩn đoán yếu thì không được khen ở mục điểm mạnh
    weak_skills: [
      ...DIAGNOSIS.weak_skills,
      { ...SKILL, skill_id: 'GRP_WRITE', skill_name: 'Tổ chức văn bản', scope: 'group', in_top_k: false, has_material: true },
    ],
  }
  mockApi({
    'GET /api/auth/me': ME_TEACHER,
    'GET /api/notifications': [],
    'GET /api/attempts/ATT_037': ATTEMPT,
    'GET /api/attempts/ATT_037/diagnosis?top_k=3': diagnosis,
    [`GET /api/attempts?student_id=${STUDENT.student_id}`]: [older, ATTEMPT],
  })
  renderApp(<App />, '/teacher/attempts/ATT_037/report')

  expect(await screen.findByRole('heading', { name: 'PHIẾU KẾT QUẢ CHẨN ĐOÁN MÔN TIẾNG ANH' })).toBeInTheDocument()
  expect(await screen.findByText(/7\.25 → 8\.5 điểm, tăng 1\.25 điểm/)).toBeInTheDocument()
  expect(screen.getByText('Đọc hiểu đoạn văn: đúng 9/10 câu')).toBeInTheDocument()
  expect(screen.queryByText(/Tổ chức văn bản: đúng/)).not.toBeInTheDocument()
  expect(screen.getByText('Phần khác cũng nên ôn sau: Tổ chức văn bản.')).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: 'Luyện phát âm nâng cao' })).toBeInTheDocument()
  expect(screen.getByText(/Chưa đúng nhưng mới có 1 câu nên chưa kết luận: Câu ước/)).toBeInTheDocument()
  const sheet = screen.getByRole('article')
  expect(sheet.textContent).not.toMatch(/SK_|GRP_|BR-|Level/)
  expect(screen.getByRole('button', { name: 'In phiếu' })).toBeInTheDocument()

  // Nhận xét gõ trên máy được in ở mục 5 thay cho dòng kẻ
  await userEvent.type(screen.getByRole('textbox', { name: /Nhận xét của giáo viên/ }), 'Em tiến bộ rõ ở phần đọc.')
  expect(within(sheet).getByText('Em tiến bộ rõ ở phần đọc.')).toBeInTheDocument()
})

const OVERVIEW: Overview = {
  class_name: null,
  students: 34,
  submitted_students: 33,
  attempts: 51,
  exams_taken: 3,
  average_score: 6.56,
  pass_rate: 0.9,
  score_bands: [
    { id: 'Tốt', name: 'Tốt', count: 0 },
    { id: 'Chưa đạt', name: 'Chưa đạt', count: 5 },
  ],
  classes: [{ class_name: '9 - Nhóm 2', students: 34, submitted_students: 33, average_score: 6.56 }],
  exams: [
    {
      exam_id: 'EXAM_G9_03',
      exam_title: 'Đề Khảo sát đầu năm - THCS Cổ Nhuế 2',
      attempts: 28,
      students: 28,
      average_score: 6.32,
      pass_rate: 0.86,
    },
  ],
  group_stats: [{ id: 'GRP_PHON', name: 'Ngữ âm: phát âm và trọng âm', correct_q: 62, total_q: 136, pass_rate: 0.456 }],
  common_weak_skills: [{ id: 'SK_PREPOSITION', name: 'Giới từ và cụm giới từ', count: 23 }],
  top_materials: [{ id: 'MAT_CD24', name: 'Chuyên đề Giới từ', count: 18 }],
  missing_materials: [{ id: 'SK_COMM_FUNC', name: 'Chức năng giao tiếp', count: 2 }],
  attention: [{ attempt: ATTEMPT, weak_skill_count: 6, broad_weakness: true }],
}

it('tổng quan lớp: thẻ số liệu, điểm yếu phổ biến, học sinh cần chú ý', async () => {
  mockApi({
    'GET /api/auth/me': ME_TEACHER,
    'GET /api/notifications': [],
    'GET /api/classes': ['9 - Nhóm 2'],
    'GET /api/overview': OVERVIEW,
  })
  renderApp(<App />, '/teacher')

  expect(await screen.findByText('Học sinh · 33 đã làm bài')).toBeInTheDocument()
  expect(screen.getByText('6.56 / 10')).toBeInTheDocument()
  expect(screen.getByText('23 học sinh · 70%')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Xem chẩn đoán' })).toHaveAttribute('href', '/teacher/attempts/ATT_037/diagnosis')
  expect(screen.getByRole('link', { name: 'Kết quả học sinh' })).toHaveAttribute('href', '/teacher/students')
  // Một lớp: không có ô lọc lớp, không có bảng so sánh lớp; có bảng so sánh giữa các đề
  expect(await screen.findByText(/^Lớp 9 - Nhóm 2\. /)).toBeInTheDocument()
  expect(screen.queryByLabelText('Lớp')).not.toBeInTheDocument()
  expect(screen.queryByText('So sánh giữa các lớp')).not.toBeInTheDocument()
  expect(screen.getByText('So sánh giữa các đề')).toBeInTheDocument()
  // Điểm yếu Top 3 bị bỏ qua vì thiếu học liệu (BR-REC-06): giáo viên biết cần bổ sung chuyên đề nào
  expect(screen.getByText('Chuyên đề thiếu học liệu')).toBeInTheDocument()
  expect(screen.getByText('2 học sinh không nhận học liệu')).toBeInTheDocument()
})

it('tổng quan lớp: kho đủ học liệu thì báo không có chuyên đề thiếu', async () => {
  mockApi({
    'GET /api/auth/me': ME_TEACHER,
    'GET /api/notifications': [],
    'GET /api/classes': ['9 - Nhóm 2'],
    'GET /api/overview': { ...OVERVIEW, missing_materials: [] },
  })
  renderApp(<App />, '/teacher')
  expect(await screen.findByText('Kho đủ học liệu cho mọi điểm yếu trong Top 3.')).toBeInTheDocument()
})

it('nhận bài nộp real-time: hiện toast và tăng số thông báo chưa đọc', async () => {
  mockApi({ 'GET /api/auth/me': ME_TEACHER, 'GET /api/notifications': [], 'GET /api/classes': [] })
  renderApp(<App />, '/teacher/notifications')
  expect(await screen.findByText('Chưa có thông báo nào')).toBeInTheDocument()

  await act(async () => {
    FakeSocket.last!.emit({
      type: 'notification',
      data: {
        id: 'NOTI_001',
        kind: 'attempt_submitted',
        created_at: '2026-10-24 10:00:00',
        read: false,
        attempt: ATTEMPT,
        weak_skill_count: 1,
        recommendation_count: 1,
      },
    })
  })

  const toast = await screen.findByRole('status')
  expect(within(toast).getByText(/Nguyễn Hà Nhi \(Lớp 9 - Nhóm 2\) vừa hoàn thành/)).toBeInTheDocument()
  // Trang thông báo gom theo đề
  expect(screen.getByText('1 bài nộp · 1 chưa đọc')).toBeInTheDocument()
  const bell = screen.getByRole('button', { name: 'Thông báo, 1 chưa đọc' })
  expect(within(bell).getByText('1')).toBeInTheDocument()
  await userEvent.click(bell)
  const preview = screen.getByRole('link', { name: 'Xem tất cả thông báo' }).parentElement!
  expect(within(preview).getByRole('link', { name: /Nguyễn Hà Nhi \(Lớp 9 - Nhóm 2\) nộp bài: 8.5\/10/ })).toHaveAttribute(
    'href',
    '/teacher/attempts/ATT_037/diagnosis',
  )
  expect(screen.getByRole('link', { name: 'Xem tất cả thông báo' })).toHaveAttribute('href', '/teacher/notifications')
})

it('nhiều học sinh nộp liên tiếp: gộp thành một toast tóm tắt', async () => {
  mockApi({ 'GET /api/auth/me': ME_TEACHER, 'GET /api/notifications': [] })
  renderApp(<App />, '/teacher/notifications')
  await screen.findByText('Chưa có thông báo nào')
  const names = ['Nguyễn Hà Nhi', 'Lê Minh Đức', 'Trần An', 'Phạm Bình', 'Đỗ Chi']
  act(() => {
    names.forEach((full_name, i) =>
      FakeSocket.last!.emit({
        type: 'notification',
        data: {
          id: `NOTI_1${i}`,
          kind: 'attempt_submitted',
          created_at: '2026-10-24 10:00:00',
          read: false,
          attempt: { ...ATTEMPT, attempt_id: `ATT_1${i}`, student: { ...STUDENT, student_id: `STU1${i}`, full_name } },
          weak_skill_count: 1,
          recommendation_count: 1,
        },
      }),
    )
  })
  const toasts = screen.getAllByRole('status')
  expect(toasts).toHaveLength(1)
  expect(within(toasts[0]!).getByText('5 học sinh vừa nộp bài')).toBeInTheDocument()
  expect(within(toasts[0]!).getByText('Đỗ Chi, Phạm Bình, Trần An và 2 học sinh khác.')).toBeInTheDocument()
})

it('toast tự đóng sau 12 giây, dừng đếm khi rê chuột vào', async () => {
  mockApi({ 'GET /api/auth/me': ME_TEACHER, 'GET /api/notifications': [] })
  renderApp(<App />, '/teacher/notifications')
  await screen.findByText('Chưa có thông báo nào')
  vi.useFakeTimers()
  try {
    act(() => {
      FakeSocket.last!.emit({
        type: 'notification',
        data: {
          id: 'NOTI_002',
          kind: 'attempt_submitted',
          created_at: '2026-10-24 10:00:00',
          read: false,
          attempt: ATTEMPT,
          weak_skill_count: 1,
          recommendation_count: 1,
        },
      })
    })
    const toast = screen.getByRole('status')
    act(() => toast.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
    act(() => vi.advanceTimersByTime(20_000))
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => toast.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })))
    act(() => vi.advanceTimersByTime(12_100))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})
