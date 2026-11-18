import { ArrowRight, ListChecks, Printer, TriangleAlert } from 'lucide-react'
import { useParams } from 'react-router'
import { useAttempt, useDiagnosis, type Attempt, type Diagnosis } from '../../api/client'
import { InsufficientSkillsNote, PassRateList, ScoreMismatchNote } from '../../components/diagnosis'
import { RankCircle, StudentHeaderCard, TeacherCrumbs, TopKSelect } from '../../components/teacher'
import { Badge, Card, ErrorState, LinkButton, LoadingState } from '../../components/ui'
import { useTopK, viewQuery } from '../../hooks/useTopK'
import { gapBreakdown, gapLabel, gapTone, mergedTopics, unitName, wrongDetail } from '../../lib/diagnosis'

/** Figma 2:150 – Phân tích chẩn đoán (giáo viên). Chỉ xem, không đổi trạng thái"đã chẩn đoán" của học sinh. */
export function TeacherDiagnosisPage() {
  const { attemptId } = useParams()
  const [topK] = useTopK()
  const attempt = useAttempt(attemptId)
  const diagnosis = useDiagnosis(attemptId, topK)

  if (attempt.isPending || diagnosis.isPending) return <LoadingState />
  if (attempt.isError) return <ErrorState error={attempt.error} onRetry={() => attempt.refetch()} />
  if (diagnosis.isError) return <ErrorState error={diagnosis.error} onRetry={() => diagnosis.refetch()} />
  return <Analysis attempt={attempt.data} diagnosis={diagnosis.data} topK={topK} />
}

function summary(d: Diagnosis): { title: string; detail: string } {
  switch (d.status) {
    case 'MASTERY':
      return {
        title: 'Học sinh đạt mức thành thạo',
        detail: 'Điểm cao và không có kỹ năng nào sai từ 2 câu và từ 50% trở lên; hệ thống gợi ý học liệu vận dụng cao.',
      }
    case 'NO_WEAK_SKILL':
      return {
        title: 'Không có điểm yếu rõ rệt',
        detail:
          'Không có kỹ năng nào sai từ 2 câu và từ 50% trở lên, điểm dưới 8; hệ thống gợi ý học liệu củng cố (mức Vận dụng) ' +
          'cho các chuyên đề còn sai nhiều câu nhất.',
      }
    case 'NO_DATA':
      return { title: 'Thiếu dữ liệu bài làm', detail: 'Lượt làm bài không có kết quả chi tiết theo câu.' }
    default:
      return {
        title: `Phát hiện ${d.total_weak_detected} kỹ năng cần lưu ý`,
        detail:
          `Gồm ${gapBreakdown(d.weak_skills)}.` +
          (d.broad_weakness_activated ? ' Điểm dưới 5 nên ngưỡng chẩn đoán được hạ xuống 30% (mất gốc diện rộng).' : ''),
      }
  }
}

function Analysis({ attempt, diagnosis, topK }: { attempt: Attempt; diagnosis: Diagnosis; topK: number }) {
  const { title, detail } = summary(diagnosis)
  const recs = diagnosis.recommendations
  const tentative = recs.filter((r) => r.tentative)
  const query = viewQuery(topK)
  const top = diagnosis.weak_skills.filter((s) => s.in_top_k)
  const others = diagnosis.weak_skills.filter((s) => !s.in_top_k)

  return (
    <div className="space-y-6">
      <TeacherCrumbs attempt={attempt} current="Chi tiết phân tích chẩn đoán" />
      <StudentHeaderCard
        attempt={attempt}
        actions={
          <>
            <LinkButton to={`/teacher/attempts/${attempt.attempt_id}/answers`} variant="outline" icon={ListChecks}>
              Xem bài làm
            </LinkButton>
            <LinkButton to={`/teacher/attempts/${attempt.attempt_id}/report${query}`} variant="outline" icon={Printer}>
              In phiếu kết quả
            </LinkButton>
            {recs.length > 0 && (
              <LinkButton to={`/teacher/attempts/${attempt.attempt_id}/recommendations${query}`} iconRight={ArrowRight}>
                Xem học liệu đề xuất
              </LinkButton>
            )}
          </>
        }
      />
      <ScoreMismatchNote diagnosis={diagnosis} />

      <div className="grid gap-6 xl:grid-cols-[1fr_460px]">
        <div className="min-w-0 space-y-6">
          <div className="flex items-start gap-4 rounded-md border border-amber-500 bg-amber-100 px-6 py-6">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-amber-600">
              <TriangleAlert className="size-5" />
            </span>
            <div>
              <p className="text-[17px] font-bold text-amber-800">{title}</p>
              <p className="text-sm text-amber-800">{detail}</p>
            </div>
          </div>

          {diagnosis.weak_skills.length > 0 && (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-6">
                <div>
                  <h2 className="text-lg">Điểm yếu cần ưu tiên</h2>
                  <p className="mt-1 text-[13px] text-slate-500">
                    {top.length} trong {diagnosis.total_weak_detected} điểm yếu, mỗi điểm yếu được gán 1 học liệu.
                  </p>
                </div>
                <TopKSelect weakCount={diagnosis.total_weak_detected} />
              </div>
              <ol className="divide-y divide-slate-200 border-t border-slate-200">
                {top.map((s, i) => {
                  const merged = mergedTopics(s)
                  return (
                    <li key={s.skill_id} className="flex items-start gap-4 px-6 py-4">
                      <RankCircle rank={i + 1} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-slate-900">{unitName(s)}</p>
                        <p className="mt-1 text-[13px] text-slate-600">{wrongDetail(s)}</p>
                        {merged && (
                          <p className="text-[13px] text-slate-500">
                            Mỗi chuyên đề chỉ có 1 câu nên gộp lại trong nhóm {s.skill_name}
                          </p>
                        )}
                      </div>
                      <Badge tone={gapTone(s.gap_type)}>{gapLabel(s.gap_type)}</Badge>
                    </li>
                  )
                })}
              </ol>
              {others.length > 0 && (
                <details className="border-t border-slate-200 px-6 py-4 text-[13px] text-slate-600">
                  <summary className="cursor-pointer font-semibold text-slate-700">
                    Xem {others.length} điểm yếu khác (chưa gán học liệu)
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {others.map((s) => (
                      <li key={s.skill_id} className="flex flex-wrap justify-between gap-x-4">
                        <span className="text-slate-900">{unitName(s)}</span>
                        <span className="text-slate-500">
                          {wrongDetail(s)} · {gapLabel(s.gap_type)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {tentative.length > 0 && (
                <div className="border-t border-slate-200 px-6 py-4 text-[13px] text-slate-600">
                  <p className="font-semibold text-slate-700">Nên ôn thêm (mới sai 1 câu, chưa kết luận là điểm yếu)</p>
                  <ul className="mt-2 space-y-1">
                    {tentative.map((r) => (
                      <li key={r.skill_id} className="flex flex-wrap justify-between gap-x-4">
                        <span className="text-slate-900">{unitName(r)}</span>
                        <span className="text-slate-500">{wrongDetail(r)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <details className="border-t border-slate-200 px-6 py-3 text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold text-slate-500">Cách hệ thống chẩn đoán</summary>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Chỉ chẩn đoán chuyên đề có từ 2 câu; chuyên đề 1 câu gộp lên nhóm kiến thức.</li>
                  <li>Điểm yếu: sai từ 2 câu và từ 50% số câu của phần đó.</li>
                  <li>Nếu chưa đủ 3 điểm yếu, phần sai 1 câu (từ 50%) được bù vào danh sách học liệu với nhãn "Nên ôn thêm".</li>
                  <li>"Cần ôn lại từ cơ bản": sai từ 50% câu cơ bản (với học sinh dưới 8 điểm).</li>
                  <li>
                    Thứ tự ưu tiên theo số câu sai, số câu cơ bản sai và mức quan trọng của từng phần (ngữ âm, ngữ pháp, từ vựng,
                    đọc hiểu).
                  </li>
                </ul>
              </details>
            </Card>
          )}

          <InsufficientSkillsNote skills={diagnosis.insufficient_skills} />
        </div>

        <div className="space-y-6">
          <PassRateList stats={diagnosis.group_stats} />
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase text-slate-500">Học liệu theo thứ tự ưu tiên</p>
            <ol className="mt-3 divide-y divide-slate-200">
              {recs.length ? (
                recs.map((r, i) => (
                  <li key={r.material_id} className="flex items-center gap-3 py-3">
                    <span className={i === 0 ? 'size-2 rounded-full bg-indigo-600' : 'size-2 rounded-full bg-slate-500'} />
                    <span className="text-sm text-slate-900">
                      {i + 1}. {unitName(r)} — {r.material_title}
                      {r.tentative && <span className="text-slate-500"> (nên ôn thêm)</span>}
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-500">Không có học liệu được gán.</li>
              )}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  )
}
