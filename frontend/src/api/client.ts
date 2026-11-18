import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from './schema'

type Schemas = components['schemas']
export type Student = Schemas['Student']
export type Exam = Schemas['Exam']
export type Question = Schemas['Question']
export type Attempt = Schemas['Attempt']
export type AnswerReview = Schemas['AnswerReview']
export type Diagnosis = Schemas['Diagnosis']
export type WeakSkill = Schemas['WeakSkill']
export type Recommendation = Schemas['Recommendation']
export type PassRate = Schemas['PassRate']
export type InsufficientSkill = Schemas['InsufficientSkill']
export type Notification = Schemas['Notification']
export type Overview = Schemas['Overview']
export type CountItem = Schemas['CountItem']
export type AttemptSummary = Schemas['AttemptSummary']
export type SubmitRequest = Schemas['SubmitRequest']
export type SubmitResponse = Schemas['SubmitResponse']
export type MaterialContent = Schemas['MaterialContent']
export type Library = Schemas['Library']
export type LibraryItem = Schemas['LibraryItem']
export type Me = Schemas['Me']
export type Role = Me['role']
export type ExerciseSet = Schemas['ExerciseSet']
export type Exercise = Schemas['Exercise']
export type Option = NonNullable<SubmitRequest['answers'][string]>

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: unknown } | null
    const detail = typeof body?.detail === 'string' ? body.detail : `Lỗi máy chủ (${res.status})`
    throw new ApiError(res.status, detail)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

/** Số chuyên đề đề xuất mặc định (top_k của engine). */
export const DEFAULT_TOP_K = 3

const query = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter((e): e is [string, string | number] => e[1] !== undefined)
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : ''
}

export const api = {
  me: () => request<Me | null>('/api/auth/me'),
  login: (body: { role: Role; username: string; password: string }) =>
    request<Me>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  classes: () => request<string[]>('/api/classes'),
  overview: (className?: string) => request<Overview>(`/api/overview${query({ class_name: className })}`),
  results: (filter: { className?: string; examId?: string }) =>
    request<AttemptSummary[]>(`/api/results${query({ class_name: filter.className, exam_id: filter.examId })}`),
  students: (className?: string) => request<Student[]>(`/api/students${query({ class_name: className })}`),
  student: (id: string) => request<Student>(`/api/students/${id}`),
  exams: () => request<Exam[]>('/api/exams'),
  exam: (id: string) => request<Exam>(`/api/exams/${id}`),
  questions: (examId: string) => request<Question[]>(`/api/exams/${examId}/questions`),
  attempts: (filter: { studentId?: string; className?: string }) =>
    request<Attempt[]>(`/api/attempts${query({ student_id: filter.studentId, class_name: filter.className })}`),
  attempt: (id: string) => request<Attempt>(`/api/attempts/${id}`),
  answers: (id: string) => request<AnswerReview[]>(`/api/attempts/${id}/answers`),
  diagnosis: (id: string, topK = DEFAULT_TOP_K) => request<Diagnosis>(`/api/attempts/${id}/diagnosis${query({ top_k: topK })}`),
  runDiagnosis: (id: string) => request<Diagnosis>(`/api/attempts/${id}/diagnosis`, { method: 'POST' }),
  submit: (body: SubmitRequest) => request<SubmitResponse>('/api/attempts', { method: 'POST', body: JSON.stringify(body) }),
  material: (id: string) => request<MaterialContent>(`/api/materials/${id}`),
  library: (attemptId?: string) => request<Library>(`/api/materials${query({ attempt_id: attemptId })}`),
  notifications: () => request<Notification[]>('/api/notifications'),
  readNotification: (id: string) => request<void>(`/api/notifications/${id}/read`, { method: 'POST' }),
  readAllNotifications: () => request<void>('/api/notifications/read-all', { method: 'POST' }),
}

export const keys = {
  me: ['me'] as const,
  classes: ['classes'] as const,
  overview: (className?: string) => ['overview', className ?? 'all'] as const,
  results: (filter: { className?: string; examId?: string }) => ['results', filter] as const,
  students: (className?: string) => ['students', className ?? 'all'] as const,
  student: (id: string) => ['student', id] as const,
  exams: ['exams'] as const,
  exam: (id: string) => ['exam', id] as const,
  questions: (examId: string) => ['questions', examId] as const,
  attempts: (filter: { studentId?: string; className?: string }) => ['attempts', filter] as const,
  attempt: (id: string) => ['attempt', id] as const,
  answers: (id: string) => ['answers', id] as const,
  diagnosis: (id: string, topK = DEFAULT_TOP_K) => ['diagnosis', id, topK] as const,
  material: (id: string) => ['material', id] as const,
  library: (attemptId?: string) => ['library', attemptId ?? 'latest'] as const,
  notifications: ['notifications'] as const,
}

/** Người dùng đang đăng nhập; null khi chưa đăng nhập hoặc phiên đã hết hạn. */
export const useMe = () =>
  useQuery({
    queryKey: keys.me,
    queryFn: api.me,
    staleTime: Infinity,
  })

export const useLogin = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.login,
    onSuccess: (me) => {
      // Xóa dữ liệu của phiên trước (nếu có) rồi mới ghi người dùng mới
      qc.clear()
      qc.setQueryData(keys.me, me)
    },
  })
}

export const useLogout = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      qc.clear()
      qc.setQueryData(keys.me, null)
    },
  })
}

export const useClasses = () => useQuery({ queryKey: keys.classes, queryFn: api.classes })

export const useStudents = (className?: string, enabled = true) =>
  useQuery({ queryKey: keys.students(className), queryFn: () => api.students(className), enabled })

export const useStudent = (id: string | undefined) =>
  useQuery({ queryKey: keys.student(id ?? ''), queryFn: () => api.student(id!), enabled: !!id })

export const useExams = () => useQuery({ queryKey: keys.exams, queryFn: api.exams })

export const useExam = (id: string | undefined) =>
  useQuery({ queryKey: keys.exam(id ?? ''), queryFn: () => api.exam(id!), enabled: !!id })

export const useQuestions = (examId: string | undefined) =>
  useQuery({
    queryKey: keys.questions(examId ?? ''),
    queryFn: () => api.questions(examId!),
    enabled: !!examId,
    staleTime: Infinity,
  })

/** Số liệu tổng quan cho giáo viên; bài nộp mới (qua WebSocket) làm mới lại. */
export const useOverview = (className?: string) =>
  useQuery({ queryKey: keys.overview(className), queryFn: () => api.overview(className) })

export const useResults = (filter: { className?: string; examId?: string }) =>
  useQuery({ queryKey: keys.results(filter), queryFn: () => api.results(filter) })

export const useAttempts = (filter: { studentId?: string; className?: string }, enabled = true) =>
  useQuery({ queryKey: keys.attempts(filter), queryFn: () => api.attempts(filter), enabled })

export const useAttempt = (id: string | undefined) =>
  useQuery({ queryKey: keys.attempt(id ?? ''), queryFn: () => api.attempt(id!), enabled: !!id })

/** Bài đã nộp không đổi nữa nên không cần tải lại. */
export const useAnswers = (id: string | undefined) =>
  useQuery({ queryKey: keys.answers(id ?? ''), queryFn: () => api.answers(id!), enabled: !!id, staleTime: Infinity })

export const useDiagnosis = (id: string | undefined, topK = DEFAULT_TOP_K) =>
  useQuery({
    queryKey: keys.diagnosis(id ?? '', topK),
    queryFn: () => api.diagnosis(id!, topK),
    enabled: !!id,
  })

export const useMaterial = (id: string | undefined) =>
  useQuery({ queryKey: keys.material(id ?? ''), queryFn: () => api.material(id!), enabled: !!id, staleTime: Infinity })

/** Kho học liệu; không truyền lượt làm bài thì máy chủ lấy lượt đã xem kết quả gần nhất của học sinh. */
export const useLibrary = (attemptId?: string) =>
  useQuery({ queryKey: keys.library(attemptId), queryFn: () => api.library(attemptId) })

export const useNotifications = () => useQuery({ queryKey: keys.notifications, queryFn: api.notifications })

/** Sau mọi thay đổi trạng thái lượt làm, làm mới danh sách và chi tiết liên quan. */
const useInvalidateAttempts = () => {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['attempts'] }),
      qc.invalidateQueries({ queryKey: ['library'] }),
      qc.invalidateQueries({ queryKey: ['attempt'] }),
      qc.invalidateQueries({ queryKey: keys.notifications }),
    ])
}

export const useSubmitAttempt = () => {
  const invalidate = useInvalidateAttempts()
  return useMutation({ mutationFn: api.submit, onSuccess: invalidate })
}

export const useRunDiagnosis = () => {
  const qc = useQueryClient()
  const invalidate = useInvalidateAttempts()
  return useMutation({
    mutationFn: api.runDiagnosis,
    onSuccess: (data) => {
      qc.setQueryData(keys.diagnosis(data.attempt_id), data)
      return invalidate()
    },
  })
}

export const useReadNotification = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id?: string) => (id ? api.readNotification(id) : api.readAllNotifications()),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  })
}
