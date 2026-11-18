import { useEffect, useState } from 'react'
import type { Option } from '../../../api/client'

export type ExamDraft = {
  startedAt: string
  answers: Record<string, Option>
  flagged: string[]
  current: number
}

const storageKey = (studentId: string, examId: string) => `kltn.exam.${studentId}.${examId}`

const freshDraft = (): ExamDraft => ({ startedAt: toApiTime(new Date()), answers: {}, flagged: [], current: 0 })

/** "YYYY-MM-DD HH:mm:ss" theo giờ máy, đúng định dạng API. */
export function toApiTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** Bài làm dở của học sinh với đề này (nếu có), để danh sách đề hiện "Tiếp tục làm bài". */
export function savedDraft(studentId: string, examId: string): ExamDraft | null {
  return readDraft(storageKey(studentId, examId))
}

function readDraft(key: string): ExamDraft | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as ExamDraft) : null
  } catch {
    return null
  }
}

/** Bài làm dở được giữ trong trình duyệt để tải lại trang không mất đáp án. */
export function useExamDraft(studentId: string, examId: string) {
  const key = storageKey(studentId, examId)
  const [draft, setDraft] = useState<ExamDraft>(() => readDraft(key) ?? freshDraft())

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(draft))
    } catch {
      // Không lưu được thì vẫn làm bài bình thường trong phiên hiện tại
    }
  }, [key, draft])

  return {
    draft,
    /** Chọn đáp án; bấm lại đáp án đang chọn thì bỏ chọn */
    answer: (questionId: string, option: Option) =>
      setDraft((d) => {
        const answers = { ...d.answers }
        if (answers[questionId] === option) delete answers[questionId]
        else answers[questionId] = option
        return { ...d, answers }
      }),
    toggleFlag: (questionId: string) =>
      setDraft((d) => ({
        ...d,
        flagged: d.flagged.includes(questionId) ? d.flagged.filter((id) => id !== questionId) : [...d.flagged, questionId],
      })),
    goTo: (index: number) => setDraft((d) => ({ ...d, current: index })),
    /** Bỏ bài làm dở, bắt đầu lại với đồng hồ mới */
    restart: () => setDraft(freshDraft()),
    clear: () => {
      try {
        localStorage.removeItem(key)
      } catch {
        // bỏ qua
      }
    },
  }
}

/** Số giây còn lại, tính từ lúc bắt đầu làm bài. */
export function useCountdown(startedAt: string, durationMinutes: number): number {
  const deadline = new Date(startedAt.replace(' ', 'T')).getTime() + durationMinutes * 60_000
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return Math.max(0, Math.floor((deadline - now) / 1000))
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
