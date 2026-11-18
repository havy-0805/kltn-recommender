import { clsx } from 'clsx'
import { CircleHelp, Layers, TriangleAlert } from 'lucide-react'
import type { Diagnosis, InsufficientSkill, PassRate } from '../api/client'
import { formatScore } from '../lib/format'
import { Card } from './ui'

/** Dưới 50% là lỗ hổng (BR-DIAG-01), từ 80% coi là vững; nhóm 1 câu chưa đủ để đánh giá (BR-DIAG-00). */
function rateTone(rate: number, totalQ: number): { bar: string; text: string } {
  if (totalQ < 2) return { bar: 'bg-slate-400', text: 'text-slate-500' }
  if (rate < 0.5) return { bar: 'bg-red-500', text: 'text-red-500' }
  if (rate < 0.8) return { bar: 'bg-amber-500', text: 'text-amber-600' }
  return { bar: 'bg-emerald-600', text: 'text-emerald-600' }
}

/** Chú thích màu lấy đúng hàm tô màu của thanh nên luôn khớp. */
const RATE_LEGEND = [
  { label: 'Dưới 50%', rate: 0, totalQ: 2 },
  { label: '50–79%', rate: 0.5, totalQ: 2 },
  { label: 'Từ 80%', rate: 0.8, totalQ: 2 },
  { label: 'Chỉ 1 câu, chưa đủ đánh giá', rate: 0, totalQ: 1 },
]

/** Tỷ lệ đạt theo nhóm kiến thức (engine trả về sắp từ thấp đến cao). */
export function PassRateList({ stats, title = 'Tỷ lệ đạt theo nhóm kiến thức' }: { stats: PassRate[]; title?: string }) {
  if (stats.length === 0) return null
  return (
    <Card className="p-6">
      <p className="flex items-center gap-2 text-[17px] font-bold text-slate-900">
        <Layers className="size-5 text-indigo-600" /> {title}
      </p>
      <ul className="mt-4 space-y-4">
        {stats.map((s) => {
          const percent = Math.round(s.pass_rate * 100)
          const tone = rateTone(s.pass_rate, s.total_q)
          return (
            <li key={s.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-slate-900">
                  {s.name}
                  {s.total_q < 2 && <span className="text-slate-500"> (chỉ 1 câu, chưa đủ để đánh giá)</span>}
                </span>
                <span className="shrink-0 text-[13px] text-slate-500">
                  {s.correct_q}/{s.total_q} câu · <span className={clsx('font-semibold', tone.text)}>{percent}%</span>
                </span>
              </div>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-label={s.name}
                aria-valuenow={percent}
              >
                <div className={clsx('h-full rounded-full', tone.bar)} style={{ width: `${Math.max(percent, 2)}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500" aria-label="Chú thích màu">
        {RATE_LEGEND.map((item) => (
          <li key={item.label} className="inline-flex items-center gap-2">
            <span className={clsx('h-2 w-4 rounded-full', rateTone(item.rate, item.totalQ).bar)} aria-hidden />
            {item.label}
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** BR-DIAG-00: chuyên đề chỉ có 1 câu trong đề, chưa đủ căn cứ để kết luận là lỗ hổng. */
export function InsufficientSkillsNote({ skills }: { skills: InsufficientSkill[] }) {
  if (skills.length === 0) return null
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-6 py-6">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <CircleHelp className="size-4" /> Chưa đủ dữ liệu để kết luận ({skills.length} chuyên đề)
      </p>
      <p className="mt-1 text-[13px] text-slate-500">
        Đề chỉ có 1 câu cho mỗi chuyên đề dưới đây, nên hệ thống chưa kết luận là lỗ hổng (cần ít nhất 2 câu).
      </p>
      <ul className="mt-3 space-y-2 text-[13px] text-slate-700">
        {skills.map((s) => (
          <li key={s.skill_id}>
            • {s.skill_name}: {s.wrong_question_nos.length ? `chưa đúng câu ${s.wrong_question_nos.join(', ')}` : 'làm đúng'}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** BR-EDGE-12: điểm ghi nhận lệch với điểm tính lại từ từng câu. */
export function ScoreMismatchNote({ diagnosis }: { diagnosis: Diagnosis }) {
  if (diagnosis.score_verified) return null
  return (
    <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
      <TriangleAlert className="mt-1 size-4 shrink-0" />
      Điểm ghi nhận ({formatScore(diagnosis.recorded_score)}) không khớp với kết quả từng câu. Hệ thống dùng điểm tính lại{' '}
      {formatScore(diagnosis.total_score)} để chẩn đoán.
    </p>
  )
}
