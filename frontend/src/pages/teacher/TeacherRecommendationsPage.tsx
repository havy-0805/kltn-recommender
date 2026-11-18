import { ArrowRight, CircleHelp, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useAttempt, useDiagnosis, type Attempt, type Diagnosis } from '../../api/client'
import { MaterialPractice } from '../../components/MaterialPractice'
import { RankCircle, TeacherCrumbs, TopKSelect } from '../../components/teacher'
import { Avatar, Badge, Card, EmptyState, ErrorState, LinkButton, LoadingState, PageTitle } from '../../components/ui'
import { useTopK, viewQuery } from '../../hooks/useTopK'
import { errorPercent, gapLabel, plainReason, unitName } from '../../lib/diagnosis'
import { formatScore, gradeBand, levelLabel } from '../../lib/format'

/** Figma 2:383 – Kết quả đề xuất (giáo viên); nút in mở phiếu kết quả (ReportPage). */
export function TeacherRecommendationsPage() {
  const { attemptId } = useParams()
  const [topK] = useTopK()
  const attempt = useAttempt(attemptId)
  const diagnosis = useDiagnosis(attemptId, topK)

  if (attempt.isPending || diagnosis.isPending) return <LoadingState />
  if (attempt.isError) return <ErrorState error={attempt.error} onRetry={() => attempt.refetch()} />
  if (diagnosis.isError) return <ErrorState error={diagnosis.error} onRetry={() => diagnosis.refetch()} />
  return <Report attempt={attempt.data} diagnosis={diagnosis.data} topK={topK} />
}

function Report({ attempt, diagnosis, topK }: { attempt: Attempt; diagnosis: Diagnosis; topK: number }) {
  const recs = diagnosis.recommendations
  const query = viewQuery(topK)
  const top = diagnosis.weak_skills.filter((s) => s.in_top_k)

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <TeacherCrumbs attempt={attempt} current="Học liệu đề xuất" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title="Học liệu đề xuất"
          description={`${attempt.student.full_name} · ${recsSummary(recs.length, recs.filter((r) => r.tentative).length)} (bài ${attempt.exam.exam_title} có ${diagnosis.total_weak_detected} điểm yếu).`}
        />
        {diagnosis.weak_skills.length > 0 && (
          <div className="print:hidden">
            <TopKSelect weakCount={diagnosis.total_weak_detected} />
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_460px]">
        <div className="min-w-0 space-y-4">
          {recs.length === 0 && (
            <Card>
              <EmptyState
                icon={CircleHelp}
                title="Không có học liệu được gán"
                description="Kho học liệu chưa có tài liệu phù hợp cấp độ cho các kỹ năng này."
              />
            </Card>
          )}
          {recs.map((rec, i) => (
            <Card key={rec.material_id} className="space-y-4 p-8 print:break-inside-avoid">
              <div className="flex flex-wrap items-start gap-3">
                <RankCircle rank={i + 1} size="md" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg">
                    {i + 1}. {unitName(rec)}
                  </h2>
                  <p className="text-[13px] text-slate-500">Học liệu: {rec.material_title}</p>
                </div>
                <Badge tone="neutral">{levelLabel[rec.material_actual_level]}</Badge>
                <Badge tone="brand" className="rounded-md">
                  {gapLabel(rec.gap_type)}
                </Badge>
              </div>
              <div className="border-l-4 border-indigo-600 pl-4">
                <p className="flex items-center gap-2 text-xs font-bold uppercase text-indigo-600">
                  <CircleHelp className="size-4" /> Lý do hệ thống đề xuất
                </p>
                <p className="mt-2 text-sm text-slate-700">{plainReason(rec.reason)}</p>
              </div>
              <div className="flex justify-end print:hidden">
                <LinkButton
                  to={`/teacher/attempts/${attempt.attempt_id}/materials/${rec.material_id}${query}`}
                  iconRight={ArrowRight}
                >
                  Xem học liệu
                </LinkButton>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Avatar name={attempt.student.full_name} ring />
              <div>
                <p className="text-lg font-bold text-slate-900">{attempt.student.full_name}</p>
                <p className="text-[13px] text-slate-500">
                  Lớp {attempt.student.class_name} · {gradeBand(attempt.total_score)}
                </p>
              </div>
            </div>
            <div className="my-4 h-px bg-slate-200" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] text-slate-500">{attempt.exam.exam_title}</p>
                <p className="text-sm text-slate-700">Điểm bài làm</p>
              </div>
              <p className="rounded-md bg-indigo-50 px-3 py-2">
                <span className="text-xl font-bold text-indigo-600">{formatScore(attempt.total_score)}</span>
                <span className="text-xs text-slate-500"> / 10</span>
              </p>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase text-slate-500">Điểm yếu ưu tiên</p>
            <ul className="mt-2 divide-y divide-slate-200">
              {top.map((s) => (
                <li key={s.skill_id} className="flex items-center gap-3 py-3 text-sm">
                  <span
                    className={errorPercent(s) >= 75 ? 'size-2 rounded-full bg-red-500' : 'size-2 rounded-full bg-orange-500'}
                  />
                  <span className="flex-1 text-slate-900">{unitName(s)}</span>
                  <span className={errorPercent(s) >= 75 ? 'font-semibold text-red-500' : 'font-semibold text-orange-500'}>
                    {errorPercent(s)}% chưa đúng
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 border-t border-slate-200 pt-6 print:hidden">
        <LinkButton
          to={`/teacher/attempts/${attempt.attempt_id}/report${query}`}
          variant="outline"
          size="lg"
          icon={Printer}
          className="border-indigo-600 text-indigo-600"
        >
          In phiếu kết quả
        </LinkButton>
        <Link
          to={`/teacher/attempts/${attempt.attempt_id}/diagnosis${query}`}
          className="text-sm font-bold text-slate-500 hover:text-slate-900"
        >
          Quay lại chẩn đoán
        </Link>
      </div>
    </div>
  )
}

export function TeacherMaterialPage() {
  const { attemptId, materialId } = useParams()
  const [topK] = useTopK()
  const attempt = useAttempt(attemptId)
  const backTo = `/teacher/attempts/${attemptId}/recommendations${viewQuery(topK)}`
  if (attempt.isPending) return <LoadingState />
  if (attempt.isError) return <ErrorState error={attempt.error} />
  const name = attempt.data.student.full_name
  return (
    <MaterialPractice
      materialId={materialId}
      crumbs={[
        { label: 'Kết quả học sinh', to: '/teacher/students' },
        { label: name, to: `/teacher/attempts/${attemptId}/diagnosis${viewQuery(topK)}` },
        { label: 'Học liệu đề xuất', to: backTo },
        { label: 'Xem học liệu' },
      ]}
      back={{ to: backTo, label: 'Quay lại học liệu đề xuất' }}
      teacher={{ studentName: name }}
    />
  )
}

/** "3 học liệu cho 3 điểm yếu ưu tiên nhất" hoặc "3 học liệu: 2 cho điểm yếu, 1 nên ôn thêm" (BR-REC-07). */
function recsSummary(total: number, tentative: number): string {
  if (!tentative) return `${total} học liệu cho ${total} điểm yếu ưu tiên nhất`
  return `${total} học liệu: ${total - tentative} cho điểm yếu, ${tentative} nên ôn thêm (phần mới sai 1 câu)`
}
