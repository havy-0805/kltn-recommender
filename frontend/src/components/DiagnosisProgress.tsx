import { clsx } from 'clsx'
import { Atom, CircleCheck, Clock3, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, ProgressBar } from './ui'

const STEPS = [
  { running: 'Đang đọc bài làm của bạn…', done: 'Đã đọc xong bài làm của bạn.' },
  { running: 'Đang xem bạn làm tốt phần nào, chưa tốt phần nào…', done: 'Đã xem xong từng phần kiến thức.' },
  { running: 'Đang tìm phần bạn nên luyện thêm…', done: '' },
]

const STEP_MS = 700

/**
 * Figma 94:7 / 94:61 – modal tiến trình chẩn đoán. Engine trả kết quả gần như tức thì,
 * nên các bước chạy tối thiểu STEP_MS mỗi bước để học sinh theo kịp.
 */
export function DiagnosisProgress({
  finished,
  weakCount,
  error,
  onClose,
  onRetry,
}: {
  finished: boolean
  weakCount: number
  error?: string
  onClose: () => void
  onRetry: () => void
}) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (step >= STEPS.length) return
    if (step === STEPS.length - 1 && !finished) return
    const timer = setTimeout(() => setStep((s) => s + 1), STEP_MS)
    return () => clearTimeout(timer)
  }, [step, finished])

  const done = step >= STEPS.length
  const percent = done ? 100 : Math.round((step / STEPS.length) * 100)
  const lastDone = weakCount ? `Đã tìm ra ${weakCount} phần bạn nên luyện thêm.` : 'Đã tổng hợp xong kết quả.'

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 px-4"
      role="dialog"
      aria-modal
      aria-live="polite"
    >
      <div className="w-full max-w-[540px] rounded-md bg-white p-8 shadow-popover">
        <span
          className={clsx(
            'mx-auto flex size-12 items-center justify-center rounded-full',
            done ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600',
          )}
        >
          {done ? <CircleCheck className="size-5" /> : <Atom className="size-5 animate-spin [animation-duration:3s]" />}
        </span>
        <h2 className="mt-4 text-center text-lg">
          {error ? 'Chưa chẩn đoán được' : done ? 'Đã phân tích xong bài làm' : 'Đang phân tích bài làm…'}
        </h2>
        <p className="mt-1 text-center text-[13px] text-slate-500">
          {error ?? (done ? 'Đã phân tích xong bài làm của bạn' : 'Đang phân tích bài làm của bạn')}
        </p>

        <div className="mt-6 flex items-center gap-4">
          <ProgressBar value={Math.max(percent, 2)} tone={done ? 'success' : 'brand'} />
          <span className={clsx('w-10 text-right text-[13px]', done ? 'text-emerald-600' : 'text-indigo-600')}>{percent}%</span>
        </div>

        <ul className="mt-6 space-y-3 border-t border-slate-200 pt-6 text-[13px]">
          {STEPS.map((s, i) => {
            const state = i < step ? 'done' : i === step ? 'running' : 'todo'
            return (
              <li
                key={s.running}
                className={clsx(
                  'flex items-center gap-3',
                  state === 'running' && 'font-semibold text-indigo-600',
                  state === 'todo' && 'text-slate-400',
                  state === 'done' && 'text-slate-700',
                )}
              >
                {state === 'done' ? (
                  <CircleCheck className="size-4 text-emerald-600" />
                ) : state === 'running' ? (
                  <Clock3 className="size-4" />
                ) : (
                  <span className="size-4 rounded-full border-2 border-slate-300" />
                )}
                {state === 'done' ? (i === STEPS.length - 1 ? lastDone : s.done) : s.running}
              </li>
            )
          })}
        </ul>

        {error ? (
          <Button className="mt-6 w-full" size="lg" onClick={onRetry}>
            Thử lại
          </Button>
        ) : (
          done && (
            <Button className="mt-6 w-full" size="lg" icon={Sparkles} onClick={onClose}>
              Xem báo cáo chi tiết
            </Button>
          )
        )}
      </div>
    </div>
  )
}
