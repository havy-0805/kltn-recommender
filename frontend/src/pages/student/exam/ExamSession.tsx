import { clsx } from 'clsx'
import { Clock, RotateCcw, Send, TimerOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router'
import { useExam, useQuestions, useSubmitAttempt, type Exam, type Option, type Question } from '../../../api/client'
import { Button, Card, ErrorState, LoadingState } from '../../../components/ui'
import { formatDateTime } from '../../../lib/format'
import { useStudentId } from '../../../session'
import type { ExamContext } from './examContext'
import { formatCountdown, useCountdown, useExamDraft } from './useExamDraft'

/** Khung chung cho màn làm bài và màn rà soát: giữ đề, đáp án nháp, đồng hồ và thao tác nộp. */
export function ExamSession() {
  const { examId = '' } = useParams()
  const exam = useExam(examId)
  const questions = useQuestions(examId)

  if (exam.isPending || questions.isPending) return <LoadingState label="Đang tải đề thi…" />
  if (exam.isError) return <ErrorState error={exam.error} />
  if (questions.isError) return <ErrorState error={questions.error} />
  return <ExamRunner exam={exam.data} questions={questions.data} />
}

function ExamRunner({ exam, questions }: { exam: Exam; questions: Question[] }) {
  const studentId = useStudentId()
  const navigate = useNavigate()
  const draftApi = useExamDraft(studentId, exam.exam_id)
  const secondsLeft = useCountdown(draftApi.draft.startedAt, exam.duration_minutes)
  const submission = useSubmitAttempt()
  // Bài làm dở đã hết giờ từ trước khi mở lại đề: hỏi học sinh thay vì tự nộp
  const [expiredOnOpen, setExpiredOnOpen] = useState(() => secondsLeft === 0)
  // isPending chỉ cập nhật sau lần render kế tiếp, nên nhấp đúp vẫn gửi 2 lần: chặn bằng ref
  const submitLock = useRef(false)

  const submit = () => {
    if (submitLock.current) return
    submitLock.current = true
    const answers: Record<string, Option | null> = {}
    for (const q of questions) answers[q.question_id] = draftApi.draft.answers[q.question_id] ?? null
    submission.mutate(
      { exam_id: exam.exam_id, started_at: draftApi.draft.startedAt, answers },
      {
        onSuccess: ({ attempt }) => {
          draftApi.clear()
          navigate(`/student/attempts/${attempt.attempt_id}/submitted`, { replace: true })
        },
        onError: () => {
          submitLock.current = false
        },
      },
    )
  }

  // Hết giờ trong lúc đang làm thì tự nộp (chỉ một lần)
  const autoSubmitted = useRef(false)
  useEffect(() => {
    if (!expiredOnOpen && secondsLeft === 0 && !autoSubmitted.current) {
      autoSubmitted.current = true
      submit()
    }
  })

  useLeaveWarning(exam.exam_id, !expiredOnOpen)

  if (expiredOnOpen) {
    const answered = questions.filter((q) => draftApi.draft.answers[q.question_id]).length
    return (
      <Card className="mx-auto max-w-[640px] space-y-4 p-8">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <TimerOff className="size-6" />
        </span>
        <h1 className="text-[22px]">Bài làm dở đã hết giờ</h1>
        <p className="text-sm text-slate-600">
          Bạn bắt đầu đề <b>{exam.exam_title}</b> lúc {formatDateTime(draftApi.draft.startedAt)} và đã quá {exam.duration_minutes}{' '}
          phút làm bài. Lúc đó bạn đã trả lời {answered}/{questions.length} câu.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            icon={RotateCcw}
            onClick={() => {
              draftApi.restart()
              setExpiredOnOpen(false)
            }}
          >
            Làm lại từ đầu
          </Button>
          <Button size="lg" variant="outline" icon={Send} loading={submission.isPending} onClick={submit}>
            Nộp {answered} câu đã làm
          </Button>
        </div>
        {submission.error != null && <p className="text-xs text-red-500">Nộp bài chưa thành công. Hãy thử lại.</p>}
      </Card>
    )
  }

  const context: ExamContext = {
    ...draftApi,
    exam,
    questions,
    secondsLeft,
    submit,
    submitting: submission.isPending,
    submitError: submission.error,
  }
  return <Outlet context={context} />
}

const LEAVE_MESSAGE = 'Bạn đang làm bài. Đáp án đã được lưu nhưng đồng hồ vẫn chạy. Bạn có chắc muốn rời trang?'

/**
 * Cảnh báo khi rời màn làm bài: tải lại / đóng tab (beforeunload) và bấm link trong web.
 * Bắt sự kiện click ở pha capture trên document, trước khi Link của react-router xử lý.
 */
function useLeaveWarning(examId: string, active: boolean) {
  useEffect(() => {
    if (!active) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href]')
      if (!(link instanceof HTMLAnchorElement) || link.origin !== window.location.origin) return
      if (link.pathname.startsWith(`/student/exams/${examId}`)) return
      if (!window.confirm(LEAVE_MESSAGE)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [examId, active])
}

export function TimerBox({ seconds }: { seconds: number }) {
  const urgent = seconds < 5 * 60
  return (
    <div
      className={clsx(
        'flex items-center gap-4 rounded-md border px-6 py-4',
        urgent ? 'border-red-500 bg-red-100' : 'border-indigo-600 bg-indigo-50',
      )}
      role="timer"
      aria-label="Thời gian còn lại"
    >
      <Clock className={clsx('size-5', urgent ? 'text-red-500' : 'text-indigo-600')} />
      <div>
        <p className="text-[11px] text-slate-500">Thời gian còn lại</p>
        <p className={clsx('text-[22px] font-bold leading-tight', urgent ? 'text-red-500' : 'text-indigo-600')}>
          {formatCountdown(seconds)}
        </p>
      </div>
    </div>
  )
}

/** Ô số câu trên lưới tóm tắt: nền xanh = đã trả lời, viền vàng = đánh dấu (vẫn giữ nền xanh nếu đã trả lời), trắng = chưa làm. */
export function QuestionTile({
  no,
  answered,
  flagged,
  active,
  onClick,
}: {
  no: number
  answered: boolean
  flagged: boolean
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Câu ${no}${answered ? ', đã trả lời' : ''}${flagged ? ', đã đánh dấu' : ''}`}
      className={clsx(
        'h-10 w-12 rounded-md border text-[13px] font-bold transition-colors',
        flagged && answered
          ? 'border-2 border-amber-500 bg-emerald-50 text-emerald-700'
          : flagged
            ? 'border-2 border-amber-500 bg-amber-50 text-amber-600'
            : answered
              ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
        active && 'outline-2 outline-offset-2 outline-indigo-600',
      )}
    >
      {no}
    </button>
  )
}
