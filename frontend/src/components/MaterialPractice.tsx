import { clsx } from 'clsx'
import { ArrowLeft, ArrowRight, BookOpenCheck, ChevronDown, ExternalLink, Lightbulb, RefreshCw, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useMaterial, type Exercise, type ExerciseSet, type MaterialContent, type Option } from '../api/client'
import { levelLabel } from '../lib/format'
import { Breadcrumb, type Crumb } from './Breadcrumb'
import { PassageText } from './PassageText'
import { Badge, Button, Card, ErrorState, LoadingState } from './ui'

const OPTIONS: Option[] = ['A', 'B', 'C', 'D']

type SetState = { answers: Record<number, Option>; checked: boolean }

type Nav = {
  crumbs: Crumb[]
  back: { to: string; label: string }
  /** Giáo viên xem học liệu: được hiện đáp án ngay, không có lời nhắn dành cho học sinh */
  teacher?: { studentName: string }
  /** Học sinh: khóa localStorage để tải lại trang không mất đáp án đã chọn */
  storageKey?: string
}

type Progress = { page: number; states: Record<number, SetState> }

function readProgress(key: string | undefined): Progress | null {
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Progress) : null
  } catch {
    return null
  }
}

/** Figma 2047:599 – Luyện chuyên đề. Nội dung lấy từ data/materials/<material_id>.json. Dùng chung cho học sinh và giáo viên. */
export function MaterialPractice({ materialId, ...nav }: Nav & { materialId: string | undefined }) {
  const material = useMaterial(materialId)

  if (material.isPending) return <LoadingState label="Đang tải học liệu…" />
  if (material.isError) return <ErrorState error={material.error} onRetry={() => material.refetch()} />
  return <Practice key={material.data.material_id} material={material.data} {...nav} />
}

function Practice({ material, crumbs, back, teacher, storageKey }: Nav & { material: MaterialContent }) {
  const navigate = useNavigate()
  const [saved] = useState(() => readProgress(storageKey))
  const [page, setPage] = useState(saved?.page ?? 0)
  const [states, setStates] = useState<Record<number, SetState>>(saved?.states ?? {})
  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify({ page, states }))
    } catch {
      // Không lưu được thì vẫn luyện bình thường trong phiên hiện tại
    }
  }, [storageKey, page, states])
  const sets = material.exercise_sets
  const set = sets[page]!
  const state = states[page] ?? { answers: {}, checked: false }
  const update = (next: SetState) => setStates((s) => ({ ...s, [page]: next }))

  return (
    <div className="space-y-4">
      <Breadcrumb back={back.to} items={crumbs} />

      <Card className="space-y-2 px-6 py-4">
        <h1 className="font-sans text-[17px] font-semibold">{material.title}</h1>
        <p className="text-[13px] text-slate-500">{material.summary}</p>
        <Badge tone="purple">{levelLabel[material.target_level]}</Badge>
        {teacher && <p className="text-[13px] text-slate-500">Học liệu được đề xuất cho học sinh {teacher.studentName}.</p>}
      </Card>

      <TheoryPanel material={material} />

      <Card className="p-6 sm:p-8">
        <h2 className="text-[20px]">{set.title}</h2>
        <p className="mt-3 text-[13px] font-semibold text-slate-900">{set.instructions}</p>
        <ExerciseSetView set={set} state={state} onChange={update} teacher={!!teacher} />
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="lg" icon={ArrowLeft} onClick={() => navigate(back.to)}>
          {back.label}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" aria-label="Bộ trước" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ArrowLeft className="size-4" />
          </Button>
          <span className="rounded-md border border-indigo-300 bg-indigo-50 px-6 py-2 text-sm font-bold text-slate-700">
            Phần {page + 1}/{sets.length}
          </span>
          <Button
            variant="outline"
            aria-label="Bộ tiếp theo"
            disabled={page === sets.length - 1}
            onClick={() => setPage(page + 1)}
          >
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
      {!teacher && (
        <p className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <RefreshCw className="size-3.5" /> Hệ thống sẽ cập nhật lộ trình sau mỗi bài kiểm tra mới
        </p>
      )}
    </div>
  )
}

function TheoryPanel({ material }: { material: MaterialContent }) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-6 py-4 text-left"
      >
        <BookOpenCheck className="size-5 text-indigo-600" />
        <span className="flex-1 text-[15px] font-bold text-slate-900">Lý thuyết trọng tâm &amp; Mẹo làm bài</span>
        <ChevronDown className={clsx('size-4 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid gap-6 border-t border-slate-200 px-6 py-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {material.theory.map((section) => (
              <section key={section.heading}>
                <h3 className="text-[15px]">{section.heading}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-slate-700">
                  {section.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <div className="mt-2 space-y-1">
                  {section.examples.map((ex) => (
                    <p key={ex.en} className="rounded-md bg-slate-50 px-3 py-2 text-[13px]">
                      <span className="text-slate-900">{ex.en}</span>
                      <span className="text-slate-500"> — {ex.vi}</span>
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <aside className="h-fit space-y-3 rounded-md bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-800">
              <Lightbulb className="size-4" /> Mẹo làm bài
            </p>
            <ul className="list-disc space-y-2 pl-6 text-[13px] text-amber-900">
              {material.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="border-t border-amber-300 pt-3 text-xs text-slate-500">
              <p className="mb-1 font-semibold">Nguồn tham khảo</p>
              {material.references.map((r) => (
                <a
                  key={r.url}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-indigo-600"
                >
                  <ExternalLink className="size-3" /> {r.title}
                </a>
              ))}
            </div>
          </aside>
        </div>
      )}
    </Card>
  )
}

function ExerciseSetView({
  set,
  state,
  onChange,
  teacher,
}: {
  set: ExerciseSet
  state: SetState
  onChange: (s: SetState) => void
  teacher: boolean
}) {
  const answeredAll = set.questions.every((q) => state.answers[q.no])
  const correct = set.questions.filter((q) => state.answers[q.no] === q.answer).length

  const questions = (
    <div className="space-y-4">
      {set.questions.map((q) => (
        <QuestionBlock
          key={q.no}
          q={q}
          selected={state.answers[q.no]}
          checked={state.checked}
          onSelect={(opt) => onChange({ ...state, answers: { ...state.answers, [q.no]: opt } })}
        />
      ))}
    </div>
  )

  return (
    <div className="mt-4 space-y-6">
      {set.passage ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <PassageText
            text={set.passage}
            questions={set.questions.map((q) => q.question)}
            className="whitespace-pre-line text-[14px] leading-relaxed text-slate-700"
          />
          {questions}
        </div>
      ) : (
        questions
      )}

      {state.checked ? (
        <div className="space-y-3 rounded-md bg-indigo-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-bold text-slate-900">Đáp án &amp; Hướng dẫn giải</p>
            {!teacher && (
              <Badge tone={correct === set.questions.length ? 'success' : 'brand'}>
                Đúng {correct}/{set.questions.length} câu
              </Badge>
            )}
          </div>
          {set.questions.map((q) => (
            <p key={q.no} className="text-[13px] text-slate-700">
              <span className="font-semibold">
                Câu {q.no}: {q.answer}
              </span>{' '}
              — {q.explanation}
            </p>
          ))}
          <Button variant="outline" icon={RotateCcw} onClick={() => onChange({ answers: {}, checked: false })}>
            Làm lại bộ này
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled={!answeredAll && !teacher} onClick={() => onChange({ ...state, checked: true })}>
            {teacher ? 'Hiện đáp án' : 'Kiểm tra đáp án'}
          </Button>
          {!answeredAll && !teacher && <span className="text-[13px] text-slate-500">Trả lời hết các câu để xem đáp án.</span>}
        </div>
      )}
    </div>
  )
}

function QuestionBlock({
  q,
  selected,
  checked,
  onSelect,
}: {
  q: Exercise
  selected: Option | undefined
  checked: boolean
  onSelect: (opt: Option) => void
}) {
  return (
    <div>
      <p className="whitespace-pre-line text-[14px] font-semibold text-slate-900">
        {q.no}. {q.question}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={`Câu ${q.no}`}>
        {OPTIONS.map((opt) => {
          const isAnswer = checked && opt === q.answer
          const isWrongPick = checked && opt === selected && opt !== q.answer
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={selected === opt}
              disabled={checked}
              onClick={() => onSelect(opt)}
              className={clsx(
                'cursor-pointer rounded-md border px-3 py-2 text-left text-[14px] transition-colors disabled:cursor-default',
                isAnswer && 'border-emerald-500 bg-emerald-50 text-emerald-800',
                isWrongPick && 'border-red-500 bg-red-100 text-red-800',
                !isAnswer && !isWrongPick && selected === opt && 'border-indigo-600 bg-indigo-50 text-slate-900',
                !isAnswer && !isWrongPick && selected !== opt && 'border-slate-200 text-slate-700 hover:bg-slate-50',
              )}
            >
              {opt}. {q.options[opt]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
