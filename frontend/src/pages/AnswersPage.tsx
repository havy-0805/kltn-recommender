import { clsx } from 'clsx'
import { BookOpen, Check, Lightbulb, X } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { useAnswers, useAttempt, type AnswerReview, type Attempt } from '../api/client'
import { Breadcrumb, type Crumb } from '../components/Breadcrumb'
import { OptionText } from '../components/OptionText'
import { PassageText } from '../components/PassageText'
import { QuestionMedia } from '../components/QuestionMedia'
import { Badge, Card, ErrorState, LoadingState, type BadgeTone } from '../components/ui'
import { formatDateTime, formatScore } from '../lib/format'

type Status = 'correct' | 'wrong' | 'blank'
type Filter = 'all' | Status

const STATUS: Record<Status, { label: string; tone: BadgeTone; tile: string }> = {
  correct: { label: 'Đúng', tone: 'success', tile: 'border-emerald-600 bg-emerald-50 text-emerald-700' },
  wrong: { label: 'Chưa đúng', tone: 'danger', tile: 'border-red-500 bg-red-50 text-red-600' },
  blank: { label: 'Chưa làm', tone: 'neutral', tile: 'border-dashed border-slate-400 bg-white text-slate-500' },
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'wrong', label: 'Câu chưa đúng' },
  { key: 'blank', label: 'Chưa làm' },
  { key: 'correct', label: 'Câu đúng' },
]

const statusOf = (r: AnswerReview): Status => (r.selected_opt === null ? 'blank' : r.is_correct ? 'correct' : 'wrong')

/** Xem lại bài đã nộp: câu nào đúng, sai, chưa làm; đáp án đúng và lời giải. Dùng cho cả học sinh và giáo viên. */
export function AnswersPage({ role }: { role: 'student' | 'teacher' }) {
  const { attemptId } = useParams()
  const attempt = useAttempt(attemptId)
  const answers = useAnswers(attemptId)

  if (attempt.isPending || answers.isPending) return <LoadingState />
  if (attempt.isError) return <ErrorState error={attempt.error} onRetry={() => attempt.refetch()} />
  if (answers.isError) return <ErrorState error={answers.error} onRetry={() => answers.refetch()} />
  return <Answers attempt={attempt.data} answers={answers.data} crumbs={crumbsFor(role, attempt.data)} role={role} />
}

function crumbsFor(role: 'student' | 'teacher', a: Attempt): Crumb[] {
  if (role === 'teacher')
    return [
      { label: 'Kết quả học sinh', to: '/teacher/students' },
      { label: a.student.full_name, to: `/teacher/attempts/${a.attempt_id}/diagnosis` },
      { label: 'Bài làm' },
    ]
  return [
    { label: 'Trang chủ', to: '/student' },
    { label: 'Kết quả phân tích', to: `/student/attempts/${a.attempt_id}/diagnosis` },
    { label: 'Xem lại bài làm' },
  ]
}

function Answers({
  attempt,
  answers,
  crumbs,
  role,
}: {
  attempt: Attempt
  answers: AnswerReview[]
  crumbs: Crumb[]
  role: 'student' | 'teacher'
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const counts: Record<Filter, number> = { all: answers.length, correct: 0, wrong: 0, blank: 0 }
  for (const r of answers) counts[statusOf(r)] += 1
  const shown = answers.filter((r) => filter === 'all' || statusOf(r) === filter)

  return (
    <div className="mx-auto max-w-[1080px] space-y-6">
      <Breadcrumb items={crumbs} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[26px]">Xem lại bài làm</h1>
          <p className="text-sm text-slate-500">
            {attempt.student.full_name} · {attempt.exam.exam_title} · nộp lúc {formatDateTime(attempt.submitted_at)}
          </p>
        </div>
        <p className="text-sm text-slate-500">
          Điểm <span className="text-2xl font-bold text-slate-900">{formatScore(attempt.total_score)}</span> / 10
        </p>
      </div>

      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc câu hỏi">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={clsx(
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                filter === key ? 'bg-indigo-50 font-semibold text-indigo-600' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {label}
              <span className="text-xs text-slate-500">{counts[key]}</span>
            </button>
          ))}
        </div>
        <nav aria-label="Bảng câu hỏi" className="grid grid-cols-8 gap-2 sm:grid-cols-10 lg:grid-cols-20">
          {answers.map((r) => {
            const status = statusOf(r)
            const dimmed = filter !== 'all' && filter !== status
            return (
              <a
                key={r.question.question_id}
                href={`#cau-${r.question.question_no}`}
                onClick={() => filter !== 'all' && filter !== status && setFilter('all')}
                aria-label={`Câu ${r.question.question_no}: ${STATUS[status].label}`}
                className={clsx(
                  'inline-flex h-9 items-center justify-center rounded-md border text-[13px] font-semibold',
                  STATUS[status].tile,
                  dimmed && 'opacity-30',
                )}
              >
                {r.question.question_no}
              </a>
            )
          })}
        </nav>
        <ul className="flex flex-wrap gap-4 text-xs text-slate-600" aria-label="Chú thích">
          {(['correct', 'wrong', 'blank'] as const).map((s) => (
            <li key={s} className="inline-flex items-center gap-2">
              <span className={clsx('size-3 rounded-md border', STATUS[s].tile)} /> {STATUS[s].label}
            </li>
          ))}
        </ul>
      </Card>

      {shown.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">Không có câu nào trong mục này.</Card>
      ) : (
        shown.map((r) => <AnswerCard key={r.question.question_id} review={r} role={role} />)
      )}
    </div>
  )
}

function AnswerCard({ review: r, role }: { review: AnswerReview; role: 'student' | 'teacher' }) {
  const status = statusOf(r)
  const who = role === 'student' ? 'Bạn' : 'Học sinh'
  const { question: q } = r
  return (
    <Card id={`cau-${q.question_no}`} className="scroll-mt-24 space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[15px]">Câu {q.question_no}</h2>
        <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
        <span className="text-[13px] text-slate-500">{r.skill_name}</span>
      </div>
      {q.passage && (
        <details className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-slate-500">
            <BookOpen className="size-4" /> {q.passage.title} · dùng cho câu {q.passage.from_no}–{q.passage.to_no}
          </summary>
          <PassageText
            text={q.passage.text}
            questions={[q.question_text]}
            className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-800"
          />
        </details>
      )}
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-900">{q.question_text}</p>
      <QuestionMedia media={q.media} />
      <ul className="space-y-2">
        {(['A', 'B', 'C', 'D'] as const).map((opt) => {
          const correct = opt === r.correct_opt
          const chosen = opt === r.selected_opt
          return (
            <li
              key={opt}
              className={clsx(
                'flex items-center gap-3 rounded-md border px-4 py-2 text-sm',
                correct ? 'border-emerald-600 bg-emerald-50' : chosen ? 'border-red-500 bg-red-50' : 'border-slate-200',
              )}
            >
              <span className="w-4 font-bold text-slate-500">{opt}</span>
              <span className="flex-1 text-slate-800">
                <OptionText question={q} opt={opt} />
              </span>
              {chosen && (
                <span className={clsx('text-xs font-semibold', correct ? 'text-emerald-700' : 'text-red-600')}>{who} chọn</span>
              )}
              {correct ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <Check className="size-4" /> Đáp án đúng
                </span>
              ) : (
                chosen && <X className="size-4 text-red-500" aria-label="Sai" />
              )}
            </li>
          )
        })}
      </ul>
      {status === 'blank' && <p className="text-[13px] text-slate-500">{who} chưa chọn đáp án cho câu này.</p>}
      {r.explanation && (
        <p className="flex gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm text-slate-700">
          <Lightbulb className="mt-1 size-4 shrink-0 text-amber-600" />
          <span>
            <span className="font-semibold">Giải thích: </span>
            {r.explanation}
          </span>
        </p>
      )}
    </Card>
  )
}
