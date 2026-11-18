import { ArrowLeft, BarChart3, CalendarDays, History, Info, ListChecks, Star, UserRound } from 'lucide-react'
import { useParams } from 'react-router'
import { useAttempt, useAttempts, useDiagnosis, type Attempt, type Diagnosis } from '../../api/client'
import { Breadcrumb } from '../../components/Breadcrumb'
import { AttemptRow, DiagnosedBadge } from '../../components/student'
import { Badge, Card, EmptyState, ErrorState, LinkButton, LoadingState, PageTitle } from '../../components/ui'
import { errorPercent, gapLabel, gapTone, parseRatio, unitName } from '../../lib/diagnosis'
import { formatDateTime, formatScore } from '../../lib/format'
import { studentAttemptLink } from '../../lib/routes'
import { useStudentId } from '../../session'

export function HistoryPage() {
  const studentId = useStudentId()
  const attempts = useAttempts({ studentId })

  if (attempts.isPending) return <LoadingState />
  if (attempts.isError) return <ErrorState error={attempts.error} onRetry={() => attempts.refetch()} />

  return (
    <div className="space-y-6">
      <PageTitle title="Lịch sử học tập" description="Toàn bộ lượt làm bài và báo cáo chẩn đoán đã lưu." />
      <Card className="px-6 py-2">
        {attempts.data.length ? (
          attempts.data.map((a) => <AttemptRow key={a.attempt_id} attempt={a} to={studentAttemptLink(a)} />)
        ) : (
          <EmptyState icon={History} title="Chưa có lượt làm bài" description="Các bài bạn đã nộp sẽ hiện ở đây." />
        )}
      </Card>
    </div>
  )
}

/** Figma 92:4 – Lịch sử chẩn đoán (báo cáo lưu trữ của một lượt làm bài). */
export function HistoryDetailPage() {
  const { attemptId } = useParams()
  const attempt = useAttempt(attemptId)
  const diagnosis = useDiagnosis(attemptId)

  if (attempt.isPending || diagnosis.isPending) return <LoadingState />
  if (attempt.isError) return <ErrorState error={attempt.error} onRetry={() => attempt.refetch()} />
  if (diagnosis.isError) return <ErrorState error={diagnosis.error} onRetry={() => diagnosis.refetch()} />

  return <HistoryReport attempt={attempt.data} diagnosis={diagnosis.data} />
}

function HistoryReport({ attempt, diagnosis }: { attempt: Attempt; diagnosis: Diagnosis }) {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <Breadcrumb
        items={[
          { label: 'Trang chủ', to: '/student' },
          { label: 'Lịch sử học tập', to: '/student/history' },
          { label: 'Chi tiết lịch sử chẩn đoán' },
        ]}
      />

      <Card className="flex flex-wrap items-center justify-between gap-6 p-8">
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-slate-700">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
              <UserRound className="size-4" />
            </span>
            {attempt.student.full_name} - Lớp {attempt.student.class_name}
          </p>
          <h1 className="text-[28px]">{attempt.exam.exam_title}</h1>
          <p className="flex items-center gap-4 text-[15px] text-slate-500">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-4" /> Đã nộp: {formatDateTime(attempt.submitted_at)}
            </span>
            <DiagnosedBadge diagnosed={attempt.diagnosed} />
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex size-16 items-center justify-center rounded-full border-4 border-indigo-600 text-indigo-600">
            <Star className="size-6" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase text-indigo-600">Điểm số</p>
            <p>
              <span className="text-[32px] font-bold text-slate-900">{formatScore(attempt.total_score)}</span>
              <span className="text-lg text-slate-500"> / 10</span>
            </p>
          </div>
        </div>
      </Card>

      <div className="flex items-start gap-4 rounded-md border border-sky-200 bg-sky-50 px-6 py-6">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-sky-700">
          <Info className="size-5" />
        </span>
        <div>
          <p className="text-[15px] font-bold text-sky-800">Kết quả phân tích đã lưu</p>
          <p className="text-sm text-sky-800">
            {diagnosis.status === 'DIAGNOSED'
              ? `Bài làm này có ${diagnosis.total_weak_detected} phần cần luyện thêm.`
              : diagnosis.status === 'NO_WEAK_SKILL' && diagnosis.recommendations.length
                ? `Bạn không có phần nào sai nhiều; có ${diagnosis.recommendations.length} học liệu giúp bạn ôn lại cho chắc.`
                : 'Bài này bạn làm rất tốt, chưa có phần nào cần luyện thêm.'}
          </p>
        </div>
      </div>

      {diagnosis.weak_skills.length > 0 && (
        <Card className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[17px]">
              <BarChart3 className="size-5 text-indigo-600" /> Phần cần luyện thêm
            </h2>
            <span className="text-[13px] text-slate-500">Xếp theo thứ tự nên học trước</span>
          </div>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs font-bold uppercase text-slate-700">
                <tr>
                  <th className="px-4 py-3">Phần kiến thức</th>
                  <th className="px-4 py-3">Chưa đúng</th>
                  <th className="px-4 py-3">Đánh giá</th>
                </tr>
              </thead>
              <tbody>
                {diagnosis.weak_skills.map((s) => {
                  const { wrong, total } = parseRatio(s.error_stats)
                  return (
                    <tr key={s.skill_id} className="border-t border-slate-200">
                      <td className="px-4 py-4 text-slate-900">{unitName(s)}</td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="font-semibold text-slate-900">
                          {wrong}/{total} câu
                        </span>{' '}
                        <span className="text-[13px] text-red-800">({errorPercent(s)}%)</span>
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={gapTone(s.gap_type)}>{gapLabel(s.gap_type)}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <LinkButton to="/student" variant="outline" size="lg" icon={ArrowLeft}>
          Về trang chủ
        </LinkButton>
        <LinkButton to={`/student/attempts/${attempt.attempt_id}/answers`} variant="outline" size="lg" icon={ListChecks}>
          Xem lại bài làm
        </LinkButton>
        {diagnosis.recommendations.length > 0 && (
          <LinkButton to={`/student/attempts/${attempt.attempt_id}/recommendations`} size="lg">
            Xem học liệu đề xuất
          </LinkButton>
        )}
      </div>
    </div>
  )
}
