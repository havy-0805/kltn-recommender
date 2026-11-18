import { ArrowRight, CircleCheck, CircleX, ListChecks, Timer } from 'lucide-react'
import { useParams } from 'react-router'
import { useAttempt } from '../../api/client'
import { Card, ErrorState, LinkButton, LoadingState, StatCard } from '../../components/ui'
import { formatScore, parseTime } from '../../lib/format'

/** Figma 107:8390 – Nộp bài thành công: điểm, số câu đúng/sai, thời gian làm và bước tiếp theo */
export function SubmittedPage() {
  const { attemptId } = useParams()
  const attempt = useAttempt(attemptId)

  if (attempt.isPending) return <LoadingState />
  if (attempt.isError) return <ErrorState error={attempt.error} onRetry={() => attempt.refetch()} />
  const a = attempt.data
  const wrong = a.exam.total_questions - a.correct_count
  const minutes = Math.max(1, Math.round((parseTime(a.submitted_at).getTime() - parseTime(a.started_at).getTime()) / 60000))

  return (
    <div className="mx-auto max-w-[1232px] space-y-4">
      <div className="flex flex-wrap items-center gap-8 rounded-md border border-slate-200 bg-white px-8 py-8">
        <span className="inline-flex size-[72px] items-center justify-center rounded-full border-4 border-emerald-200 bg-emerald-100 text-emerald-600">
          <CircleCheck className="size-8" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-[32px]">Nộp bài thành công!</h1>
          <p className="text-[15px] text-slate-500">{a.exam.exam_title}</p>
        </div>
        <div className="flex w-52 flex-col items-center border-l border-slate-200 py-4">
          <span className="text-xs font-semibold text-indigo-600">Điểm của bạn</span>
          <span className="text-[48px] font-bold leading-none text-indigo-600">{formatScore(a.total_score)}</span>
          <span className="mt-1 text-[15px] font-bold text-slate-500">/ 10</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={ListChecks}
          tone="success"
          value={`${a.correct_count} / ${a.exam.total_questions}`}
          label="Câu trả lời đúng"
        />
        <StatCard icon={CircleX} tone="danger" value={`${wrong} câu`} label="Câu chưa đúng hoặc bỏ trống" />
        <StatCard
          icon={Timer}
          value={minutes > a.exam.duration_minutes ? 'Quá giờ' : `${minutes} phút`}
          label={`Thời gian làm bài (tối đa ${a.exam.duration_minutes} phút)`}
        />
      </div>

      <Card className="flex flex-wrap items-center gap-4 px-6 py-6">
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold text-slate-900">Xem phần nào đã vững, phần nào nên luyện tiếp</p>
          <p className="mt-1 text-sm text-slate-500">
            Kết quả phân tích cho biết phần kiến thức bạn đã vững, phần cần luyện thêm và học liệu phù hợp.
          </p>
        </div>
        <LinkButton to={`/student/attempts/${a.attempt_id}/answers`} variant="outline" size="lg" icon={ListChecks}>
          Xem lại bài làm
        </LinkButton>
        <LinkButton to={`/student/attempts/${a.attempt_id}/diagnosis`} size="lg" iconRight={ArrowRight}>
          Xem kết quả phân tích
        </LinkButton>
      </Card>
    </div>
  )
}
