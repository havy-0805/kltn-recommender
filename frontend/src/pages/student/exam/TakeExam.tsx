import { clsx } from 'clsx'
import { ArrowLeft, ArrowRight, BookOpen, Flag, ListChecks } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import type { Option } from '../../../api/client'
import { Badge, Button, Card } from '../../../components/ui'
import { OptionText } from '../../../components/OptionText'
import { PassageText } from '../../../components/PassageText'
import { QuestionMedia } from '../../../components/QuestionMedia'
import { useExamContext } from './examContext'
import { QuestionTile, TimerBox } from './ExamSession'
import { formatCountdown } from './useExamDraft'

const OPTIONS: Option[] = ['A', 'B', 'C', 'D']

/** Màn làm bài (Figma chưa có): dựng từ các component Ô câu hỏi và Câu hỏi trắc nghiệm. */
export function TakeExam() {
  const { exam, questions, draft, answer, toggleFlag, goTo, secondsLeft } = useExamContext()
  const navigate = useNavigate()
  const index = Math.min(draft.current, questions.length - 1)
  const question = questions[index]!
  const selected = draft.answers[question.question_id]
  const flagged = draft.flagged.includes(question.question_id)
  const answeredCount = questions.filter((q) => draft.answers[q.question_id]).length

  // Đổi câu thì đưa tiêu điểm về đầu câu hỏi: người dùng bàn phím không phải Tab qua cả lưới,
  // trên điện thoại bấm ô số dưới lưới thì cuộn lên câu hỏi
  const questionRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    questionRef.current?.focus({ preventScroll: true })
    // jsdom (test) không có matchMedia, scrollIntoView
    if (window.matchMedia?.('(max-width: 1023px)').matches) questionRef.current?.scrollIntoView?.({ block: 'start' })
  }, [index])

  // Phím mũi tên chuyển giữa các đáp án như một nhóm radio
  const onOptionKey = (e: React.KeyboardEvent, opt: Option) => {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = OPTIONS[(OPTIONS.indexOf(opt) + step + OPTIONS.length) % OPTIONS.length]!
    answer(question.question_id, next)
    ;(e.currentTarget.parentElement?.querySelector(`[data-opt="${next}"]`) as HTMLElement | null)?.focus()
  }

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-[13px] text-slate-500">
            <Badge tone="brand">Đang làm bài</Badge> {exam.exam_title}
          </p>
          <h1 ref={questionRef} tabIndex={-1} className="scroll-mt-36 text-[26px] outline-none">
            Câu {question.question_no} / {questions.length}
          </h1>
        </div>
        <TimerBox seconds={secondsLeft} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Câu có đoạn văn: màn rộng đặt đoạn văn bên trái, câu hỏi bên phải để không phải cuộn qua lại */}
        <Card className={clsx('p-4 sm:p-8', question.passage ? 'xl:grid xl:grid-cols-2 xl:gap-8' : 'flex flex-col')}>
          {question.passage && (
            <section
              className="mb-6 rounded-md border border-slate-200 bg-slate-50 px-6 py-4 xl:mb-0 xl:max-h-[70vh] xl:overflow-y-auto"
              aria-label="Đoạn văn"
            >
              <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-500">
                <BookOpen className="size-4" /> {question.passage.title} · dùng cho câu {question.passage.from_no}–
                {question.passage.to_no}
              </p>
              <PassageText
                text={question.passage.text}
                questions={[question.question_text]}
                className="mt-2 max-h-72 overflow-y-auto whitespace-pre-line text-[15px] leading-relaxed text-slate-800 xl:max-h-none"
              />
            </section>
          )}
          <div className="flex h-full flex-col">
            <div className="flex flex-col-reverse items-start justify-between gap-4 sm:flex-row">
              <p className="whitespace-pre-line text-[17px] leading-relaxed text-slate-900">{question.question_text}</p>
              <button
                type="button"
                onClick={() => toggleFlag(question.question_id)}
                aria-pressed={flagged}
                className={clsx(
                  'inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-[13px] font-semibold',
                  flagged ? 'border-amber-500 bg-amber-50 text-amber-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                )}
              >
                <Flag className="size-4" /> {flagged ? 'Đã đánh dấu' : 'Đánh dấu xem lại'}
              </button>
            </div>

            {question.media && (
              <div className="mt-6">
                <QuestionMedia media={question.media} />
              </div>
            )}
            <div className="mt-6 space-y-3" role="radiogroup" aria-label={`Đáp án câu ${question.question_no}`}>
              {OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  data-opt={opt}
                  aria-checked={selected === opt}
                  tabIndex={selected ? (selected === opt ? 0 : -1) : opt === 'A' ? 0 : -1}
                  onKeyDown={(e) => onOptionKey(e, opt)}
                  onClick={() => answer(question.question_id, opt)}
                  className={clsx(
                    'flex w-full items-center gap-4 rounded-md border px-4 py-3 text-left text-[15px] transition-colors',
                    selected === opt
                      ? 'border-indigo-600 bg-indigo-50 text-slate-900'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <span
                    className={clsx(
                      'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      selected === opt ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {opt}
                  </span>
                  <OptionText question={question} opt={opt} />
                </button>
              ))}
            </div>

            <div className="mt-auto flex justify-between pt-8">
              <Button variant="outline" icon={ArrowLeft} disabled={index === 0} onClick={() => goTo(index - 1)}>
                Câu trước
              </Button>
              {index < questions.length - 1 ? (
                <Button iconRight={ArrowRight} onClick={() => goTo(index + 1)}>
                  Câu tiếp theo
                </Button>
              ) : (
                <Button iconRight={ListChecks} onClick={() => navigate('review')}>
                  Rà soát bài làm
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="h-fit p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[15px] font-bold text-slate-900">Danh sách câu hỏi</p>
            <Badge tone="success">
              {answeredCount}/{questions.length}
            </Badge>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, i) => (
              <QuestionTile
                key={q.question_id}
                no={q.question_no}
                answered={!!draft.answers[q.question_id]}
                flagged={draft.flagged.includes(q.question_id)}
                active={i === index}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <Legend className="border-emerald-500 bg-emerald-50">Đã trả lời</Legend>
            <Legend className="border-2 border-amber-500 bg-amber-50">Đánh dấu</Legend>
            <Legend className="border-slate-200 bg-white">Chưa làm</Legend>
          </div>
          <Button className="mt-4 w-full" size="lg" icon={ListChecks} onClick={() => navigate('review')}>
            Rà soát &amp; nộp bài
          </Button>
        </Card>
      </div>

      {/* Điện thoại: đồng hồ và nút rà soát luôn nằm ở đáy màn hình */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-2 lg:hidden">
        <p className={clsx('text-sm font-bold', secondsLeft < 5 * 60 ? 'text-red-500' : 'text-indigo-600')} role="timer">
          Còn {formatCountdown(secondsLeft)} · {answeredCount}/{questions.length} câu
        </p>
        <Button icon={ListChecks} onClick={() => navigate('review')}>
          Rà soát
        </Button>
      </div>
    </div>
  )
}

function Legend({ className, children }: { className: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={clsx('size-3 rounded-md border', className)} /> {children}
    </span>
  )
}
