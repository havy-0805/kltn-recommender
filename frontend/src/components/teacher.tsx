import { clsx } from 'clsx'
import { FileText, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAttempts, type Attempt } from '../api/client'
import { useTopK } from '../hooks/useTopK'
import { formatDateTime, formatScore, gradeBand } from '../lib/format'
import { Breadcrumb } from './Breadcrumb'
import { Avatar, Badge, Card } from './ui'

/** Về bảng kết quả học sinh; bấm tên thì lọc sẵn theo tên học sinh đó. */
const resultsUrl = (a: Attempt, withStudent: boolean) =>
  `/teacher/students${withStudent ? `?q=${encodeURIComponent(a.student.full_name)}` : ''}`

export function TeacherCrumbs({ attempt, current }: { attempt: Attempt; current: string }) {
  return (
    <Breadcrumb
      items={[
        { label: 'Kết quả học sinh', to: resultsUrl(attempt, false) },
        { label: attempt.student.full_name, to: resultsUrl(attempt, true) },
        { label: current },
      ]}
    />
  )
}

/** Số điểm yếu được gán học liệu. Lựa chọn vượt quá số điểm yếu phát hiện được thì khóa, vì không đổi kết quả. */
export function TopKSelect({ weakCount }: { weakCount: number }) {
  const [topK, setTopK] = useTopK()
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-slate-500">
      Số học liệu đề xuất
      <select
        value={topK}
        onChange={(e) => setTopK(Number(e.target.value))}
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-[13px] font-semibold text-slate-900"
      >
        {[3, 4, 5].map((k) => (
          <option key={k} value={k} disabled={k > 3 && k > weakCount}>
            {k} học liệu
          </option>
        ))}
      </select>
    </label>
  )
}

export function StudentHeaderCard({ attempt, actions }: { attempt: Attempt; actions?: ReactNode }) {
  return (
    <Card className="flex flex-wrap items-center gap-6 p-8">
      <Avatar name={attempt.student.full_name} size="lg" ring />
      <div className="min-w-0 flex-1 basis-[280px] space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl">{attempt.student.full_name}</h1>
          <Badge className="rounded-md text-[11px]">{gradeBand(attempt.total_score)}</Badge>
          <Badge tone="neutral" className="rounded-md text-[11px]">
            Lớp {attempt.student.class_name}
          </Badge>
        </div>
        <p className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span className="inline-flex items-center gap-2 text-slate-700">
            <FileText className="size-4" /> {attempt.exam.exam_title}
          </span>
          <span className="h-4 w-px bg-slate-200" />
          <span>Đã nộp: {formatDateTime(attempt.submitted_at)}</span>
        </p>
        <AttemptSwitch attempt={attempt} />
      </div>
      <div className="flex items-center gap-4">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-indigo-600 text-white">
          <Star className="size-5" />
        </span>
        <div>
          <p className="text-xs font-semibold text-indigo-600">Tổng điểm đạt được</p>
          <p>
            <span className="text-2xl font-bold text-slate-900">{formatScore(attempt.total_score)}</span>
            <span className="text-sm text-slate-500"> / 10</span>
          </p>
        </div>
      </div>
      {actions && <div className="flex w-full flex-wrap gap-3 border-t border-slate-200 pt-4">{actions}</div>}
    </Card>
  )
}

/** Chuyển giữa các bài làm của cùng học sinh (mới nhất trước), giữ nguyên trang đang xem. Chỉ hiện khi có từ 2 bài. */
function AttemptSwitch({ attempt }: { attempt: Attempt }) {
  const attempts = useAttempts({ studentId: attempt.student.student_id })
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const list = [...(attempts.data ?? [])].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
  if (list.length < 2) return null

  return (
    <label className="flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
      Bài làm khác của học sinh này
      <select
        aria-label="Bài làm khác của học sinh này"
        value={attempt.attempt_id}
        onChange={(e) => navigate(pathname.replace(attempt.attempt_id, e.target.value) + search)}
        className="h-9 w-full min-w-0 rounded-md sm:w-auto border border-slate-200 bg-white px-2 text-[13px] font-semibold text-slate-900"
      >
        {list.map((a, i) => (
          <option key={a.attempt_id} value={a.attempt_id}>
            {a.exam.exam_title} · {formatScore(a.total_score)} điểm · {formatDateTime(a.submitted_at)}
            {i === 0 ? ' (gần nhất)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

const RANK_STYLES = ['bg-red-100 text-red-500', 'bg-orange-100 text-orange-500', 'bg-indigo-50 text-indigo-600']

export function RankCircle({ rank, size = 'sm' }: { rank: number; size?: 'sm' | 'md' }) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold',
        size === 'sm' ? 'size-7 text-xs' : 'size-8 text-sm',
        RANK_STYLES[rank - 1] ?? 'bg-slate-100 text-slate-500',
      )}
    >
      {rank}
    </span>
  )
}
