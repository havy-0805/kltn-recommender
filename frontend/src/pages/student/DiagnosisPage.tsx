import { Activity, AlertCircle, ArrowRight, Info, Lightbulb, ListChecks, PartyPopper, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useAttempt, useDiagnosis, useRunDiagnosis, type Attempt, type Diagnosis, type WeakSkill } from '../../api/client'
import { DiagnosisProgress } from '../../components/DiagnosisProgress'
import { InsufficientSkillsNote, PassRateList, ScoreMismatchNote } from '../../components/diagnosis'
import { AttemptProfileCard } from '../../components/student'
import { Badge, Button, Card, ErrorState, LinkButton, LoadingState } from '../../components/ui'
import { advisorMessage, easySummary, firstName, gapLabel, gapTone, unitName, wrongSummary } from '../../lib/diagnosis'

/** Figma 81:546 – Phân tích chẩn đoán (kèm modal Loading 94:7 → 94:61 khi chẩn đoán lần đầu). */
export function DiagnosisPage() {
  const { attemptId = '' } = useParams()
  const attempt = useAttempt(attemptId)

  if (attempt.isPending) return <LoadingState />
  if (attempt.isError) return <ErrorState error={attempt.error} onRetry={() => attempt.refetch()} />
  return <DiagnosisBody key={attempt.data.attempt_id} attempt={attempt.data} />
}

function DiagnosisBody({ attempt }: { attempt: Attempt }) {
  // Chốt chế độ lúc mở trang: chẩn đoán xong thì`diagnosed` đổi thành true,
  // nhưng modal tiến trình phải ở lại tới khi học sinh bấm"Xem báo cáo chi tiết".
  const [firstRun] = useState(!attempt.diagnosed)
  return firstRun ? <FirstRun attempt={attempt} /> : <DiagnosedView attempt={attempt} />
}

/** Lượt làm chưa chẩn đoán: chạy chẩn đoán, hiện modal tiến trình phủ lên khung xương. */
function FirstRun({ attempt }: { attempt: Attempt }) {
  const run = useRunDiagnosis()
  const [closed, setClosed] = useState(false)
  const { mutate } = run

  useEffect(() => {
    mutate(attempt.attempt_id)
  }, [mutate, attempt.attempt_id])

  return (
    <>
      {run.data && closed ? <Report attempt={attempt} diagnosis={run.data} /> : <Skeleton attempt={attempt} />}
      {!closed && (
        <DiagnosisProgress
          finished={run.isSuccess}
          weakCount={run.data?.total_weak_detected ?? 0}
          error={run.isError ? run.error.message : undefined}
          onRetry={() => mutate(attempt.attempt_id)}
          onClose={() => setClosed(true)}
        />
      )}
    </>
  )
}

function DiagnosedView({ attempt }: { attempt: Attempt }) {
  const diagnosis = useDiagnosis(attempt.attempt_id)
  if (diagnosis.isPending) return <Skeleton attempt={attempt} />
  if (diagnosis.isError) return <ErrorState error={diagnosis.error} onRetry={() => diagnosis.refetch()} />
  return <Report attempt={attempt} diagnosis={diagnosis.data} />
}

function Skeleton({ attempt }: { attempt: Attempt }) {
  return (
    <div className="space-y-6" aria-hidden>
      <AttemptProfileCard attempt={attempt} />
      <Card className="space-y-4 p-6">
        <p className="text-[17px] font-bold text-slate-900">Phần bạn cần luyện thêm</p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-4 animate-pulse rounded-full bg-slate-200" />
        ))}
      </Card>
    </div>
  )
}

function Report({ attempt, diagnosis }: { attempt: Attempt; diagnosis: Diagnosis }) {
  const [showAll, setShowAll] = useState(false)
  const name = firstName(attempt.student.full_name)
  const top = diagnosis.weak_skills.filter((s) => s.in_top_k)
  const rest = diagnosis.weak_skills.filter((s) => !s.in_top_k)
  const recommendationsUrl = `/student/attempts/${attempt.attempt_id}/recommendations`

  return (
    <div className="space-y-8">
      <AttemptProfileCard attempt={attempt} />

      <div className="flex items-start gap-4 rounded-md border border-slate-200 bg-white px-6 py-6">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          {diagnosis.status === 'MASTERY' ? <PartyPopper className="size-5" /> : <Lightbulb className="size-5" />}
        </span>
        <div>
          <p className="text-[17px] font-bold text-slate-900">Nhận xét bài làm</p>
          <p className="mt-1 text-sm text-slate-700">{advisorMessage(diagnosis, name)}</p>
        </div>
      </div>

      <ScoreMismatchNote diagnosis={diagnosis} />
      <PassRateList stats={diagnosis.group_stats} />

      {diagnosis.status === 'DIAGNOSED' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg">
              <Activity className="size-5 text-indigo-600" /> Phần bạn cần luyện thêm
            </h2>
            <LinkButton to={`/student/attempts/${attempt.attempt_id}/answers`} variant="outline" icon={ListChecks}>
              Xem lại bài làm
            </LinkButton>
          </div>
          {diagnosis.broad_weakness_activated && (
            <p className="flex items-center gap-2 text-[13px] text-slate-500">
              <Info className="size-4" /> Điểm dưới 5 nên kể cả phần sai từ 30% số câu cũng được liệt kê, để bạn không bỏ sót.
            </p>
          )}
          {top.map((skill) => (
            <WeakSkillCard key={skill.skill_id} skill={skill} />
          ))}
          {rest.length > 0 &&
            (showAll ? (
              rest.map((skill) => <WeakSkillCard key={skill.skill_id} skill={skill} />)
            ) : (
              <Button variant="ghost" onClick={() => setShowAll(true)}>
                Xem thêm {rest.length} phần khác
              </Button>
            ))}
        </section>
      )}

      <InsufficientSkillsNote skills={diagnosis.insufficient_skills} />

      <div className="flex flex-col items-center gap-3 pt-2">
        {diagnosis.recommendations.length > 0 ? (
          <>
            <LinkButton to={recommendationsUrl} size="lg" icon={Sparkles} className="h-[52px] px-8 text-[17px]">
              {diagnosis.status === 'MASTERY'
                ? 'Xem học liệu nâng cao'
                : diagnosis.status === 'NO_WEAK_SKILL'
                  ? 'Xem học liệu củng cố'
                  : 'Xem học liệu đề xuất'}
            </LinkButton>
            <p className="flex items-center gap-2 text-[13px] text-slate-500">
              <Info className="size-4" /> Mỗi học liệu kèm lý do vì sao phù hợp với bạn
            </p>
          </>
        ) : (
          <LinkButton to="/student/exams" size="lg" iconRight={ArrowRight}>
            Làm thêm bài kiểm tra
          </LinkButton>
        )}
      </div>
    </div>
  )
}

function WeakSkillCard({ skill }: { skill: WeakSkill }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4 px-6 py-6">
        <div>
          <h3 className="font-sans text-[17px] font-semibold text-slate-900">{unitName(skill)}</h3>
          {skill.scope === 'group' && (
            <p className="mt-1 text-[13px] text-slate-500">
              Mỗi phần chỉ có 1 câu nên được xét chung (thuộc nhóm {skill.skill_name})
            </p>
          )}
        </div>
        <Badge tone={gapTone(skill.gap_type)}>{gapLabel(skill.gap_type)}</Badge>
      </div>
      <div className="mx-6 flex flex-wrap justify-between gap-2 border-t border-slate-200 py-4 text-[13px] text-slate-700">
        <span className="inline-flex items-center gap-2">
          <AlertCircle className="size-4" /> {wrongSummary(skill)}
        </span>
        <span className="inline-flex items-center gap-2">
          <AlertCircle className="size-4" /> {easySummary(skill)}
        </span>
      </div>
    </Card>
  )
}
