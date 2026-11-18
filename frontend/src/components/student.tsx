import { clsx } from 'clsx'
import { ArrowRight, CalendarDays, CircleCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import type { Attempt, Recommendation } from '../api/client'
import { gapLabel, gapTone, priorityBadge, studentReason, unitName } from '../lib/diagnosis'
import { formatDateTime, formatRelative, formatScore, levelLabel, scoreColor, studentGrade } from '../lib/format'
import { Avatar, Badge, Card, LinkButton } from './ui'

export function ReasonBox({ children }: { children: string }) {
  return (
    <div className="flex items-start gap-2 border-l-2 border-sky-200 pl-3 text-[13px] text-sky-700">
      <Sparkles className="mt-1 size-3.5 shrink-0" />
      <p>
        <span className="font-semibold">Vì sao nên học: </span>
        {children}
      </p>
    </div>
  )
}

export function RecommendationCard({
  rec,
  rank,
  badges = 'level',
}: {
  rec: Recommendation
  rank: number
  badges?: 'level' | 'priority'
}) {
  const priority = priorityBadge(rank, rec.tentative)
  return (
    <Card className="space-y-3 p-6">
      <div className="flex flex-wrap gap-2">
        {badges === 'priority' ? (
          <Badge tone={priority.tone}>{priority.label}</Badge>
        ) : (
          <>
            <Badge tone="purple">{levelLabel[rec.material_actual_level]}</Badge>
            <Badge tone={gapTone(rec.gap_type)}>{gapLabel(rec.gap_type)}</Badge>
          </>
        )}
      </div>
      <div>
        <h3 className="font-sans text-base font-semibold text-slate-900">{unitName(rec)}</h3>
        <p className="mt-1 text-[13px] text-slate-500">Học liệu: {rec.material_title}</p>
      </div>
      <ReasonBox>{studentReason(rec)}</ReasonBox>
      <div className="flex justify-end">
        <LinkButton to={`/student/practice/${rec.material_id}`} iconRight={ArrowRight}>
          Bắt đầu học
        </LinkButton>
      </div>
    </Card>
  )
}

export function DiagnosedBadge({ diagnosed }: { diagnosed: boolean }) {
  return diagnosed ? <Badge tone="success">Đã xem kết quả</Badge> : <Badge tone="purple">Chưa xem kết quả</Badge>
}

export function AttemptRow({ attempt, to }: { attempt: Attempt; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-4 border-b border-slate-200 px-2 py-4 last:border-b-0 hover:bg-slate-50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] text-slate-900">{attempt.exam.exam_title}</p>
        <p className="mt-1 text-xs text-slate-500">Nộp lúc: {formatRelative(attempt.submitted_at)}</p>
      </div>
      <DiagnosedBadge diagnosed={attempt.diagnosed} />
      <p className="w-16 text-right">
        <span className={clsx('text-lg font-bold', scoreColor(attempt.total_score))}>{formatScore(attempt.total_score)}</span>
        <span className="text-xs text-slate-500"> /10</span>
      </p>
    </Link>
  )
}

export function LatestExamCard({ attempt }: { attempt: Attempt }) {
  return (
    <Card className="w-full p-6 lg:w-[340px]">
      <p className="text-[11px] font-semibold uppercase text-slate-500">Bài thi gần nhất</p>
      <p className="mt-1 text-[17px] font-bold text-slate-900">{attempt.exam.exam_title}</p>
      <div className="my-4 h-px bg-slate-200" />
      <div className="flex items-end justify-between gap-3">
        <p>
          <span className={clsx('text-[32px] font-bold leading-none', scoreColor(attempt.total_score))}>
            {formatScore(attempt.total_score)}
          </span>
          <span className="text-lg text-slate-500"> / 10</span>
        </p>
        <Badge tone="grade">{studentGrade(attempt.total_score)}</Badge>
      </div>
      <p className="mt-2 text-xs text-slate-500">Thời lượng đề: {attempt.exam.duration_minutes} phút</p>
    </Card>
  )
}

/** Thẻ đầu màn chẩn đoán: học sinh + bài kiểm tra + điểm. */
export function AttemptProfileCard({ attempt }: { attempt: Attempt }) {
  return (
    <Card className="flex flex-wrap items-center gap-6 p-8">
      <Avatar name={attempt.student.full_name} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl">{attempt.student.full_name}</h1>
          <Badge>Lớp {attempt.student.class_name}</Badge>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-slate-500">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="size-4" /> Đã nộp: {formatDateTime(attempt.submitted_at)}
          </span>
          <span className="hidden size-1 rounded-full bg-slate-300 sm:inline-block" />
          <span className="inline-flex items-center gap-2 text-emerald-600">
            <CircleCheck className="size-4" /> Hoàn thành
          </span>
        </p>
      </div>
      <div className="text-right">
        <p className="text-[13px] text-slate-500">Bài kiểm tra đánh giá</p>
        <p className="text-lg font-bold text-slate-900">{attempt.exam.exam_title}</p>
      </div>
      <ScoreTile score={attempt.total_score} />
    </Card>
  )
}

export function ScoreTile({ score, className }: { score: number; className?: string }) {
  return (
    <div className={clsx('flex flex-col items-center rounded-md bg-indigo-50 px-6 py-3', className)}>
      <span className="text-[28px] font-bold leading-tight text-indigo-600">{formatScore(score)}</span>
      <span className="text-[11px] font-semibold text-indigo-600">Điểm số</span>
    </div>
  )
}
