import { ArrowLeft, ArrowRight, CircleCheck, CircleDashed, Flag, ListChecks, Send, ShieldCheck } from 'lucide-react'
import { clsx } from 'clsx'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { OptionText } from '../../../components/OptionText'
import { Badge, Button, Card, StatCard } from '../../../components/ui'
import { useExamContext } from './examContext'
import { QuestionTile, TimerBox } from './ExamSession'

/** Figma 107:8171 – Rà soát bài làm trước khi nộp */
export function ReviewExam() {
  const { exam, questions, draft, goTo, secondsLeft, submit, submitting, submitError } = useExamContext()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)

  const answered = questions.filter((q) => draft.answers[q.question_id])
  const unanswered = questions.filter((q) => !draft.answers[q.question_id])
  const flagged = questions.filter((q) => draft.flagged.includes(q.question_id))
  const toReview = [...flagged, ...unanswered.filter((q) => !draft.flagged.includes(q.question_id))]

  const openQuestion = (questionId: string) => {
    goTo(questions.findIndex((q) => q.question_id === questionId))
    navigate('..')
  }

  return (
    <div className="mx-auto max-w-[1312px] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-[13px] text-slate-500">
            <Badge tone="success">Bước cuối</Badge> {exam.exam_title}
          </p>
          <h1 className="text-[26px]">Rà soát bài làm trước khi nộp</h1>
          <p className="text-sm text-slate-500">
            Kiểm tra lại trạng thái {questions.length} câu. Bạn vẫn có thể quay lại bài làm để thay đổi đáp án.
          </p>
        </div>
        <TimerBox seconds={secondsLeft} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ListChecks} value={`${questions.length} câu`} label="Tổng số câu" />
        <StatCard icon={CircleCheck} tone="success" value={`${answered.length} / ${questions.length}`} label="Đã trả lời" />
        <StatCard icon={CircleDashed} value={`${unanswered.length} câu`} label="Chưa trả lời" />
        <StatCard icon={Flag} tone="warning" value={`${flagged.length} câu`} label="Đã đánh dấu" />
      </div>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[17px]">
              {unanswered.length ? `Tóm tắt ${questions.length} câu` : `Tóm tắt đủ ${questions.length} câu`}
            </h2>
            <p className="text-xs text-slate-500">
              Ô xanh là câu đã có đáp án. Viền vàng là câu được đánh dấu xem lại. Bấm vào ô để mở câu đó.
            </p>
          </div>
          <Badge tone={unanswered.length ? 'warning' : 'success'}>
            {answered.length}/{questions.length} đã trả lời
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3">
          {questions.map((q) => (
            <QuestionTile
              key={q.question_id}
              no={q.question_no}
              answered={!!draft.answers[q.question_id]}
              flagged={draft.flagged.includes(q.question_id)}
              onClick={() => openQuestion(q.question_id)}
            />
          ))}
        </div>
      </Card>

      {toReview.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[17px]">
              <Flag className="size-4 text-amber-500" /> Câu cần xem lại
            </h2>
            <span className="text-xs text-slate-500">
              {flagged.length} câu đã đánh dấu · {unanswered.length} câu chưa trả lời
            </span>
          </div>
          {toReview.map((q) => {
            const choice = draft.answers[q.question_id]
            const isFlagged = draft.flagged.includes(q.question_id)
            // Hiện cả câu hỏi để rà nhanh, không phải mở lại từng câu
            return (
              <Card key={q.question_id} className="flex items-start gap-4 px-4 py-3">
                <span
                  className={clsx(
                    'inline-flex size-10 shrink-0 items-center justify-center rounded-md text-[15px] font-bold',
                    isFlagged ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-700',
                  )}
                  title={isFlagged ? 'Đã đánh dấu' : 'Chưa trả lời'}
                >
                  {String(q.question_no).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm text-slate-900">{q.question_text}</p>
                  <p className={clsx('mt-1 text-[13px]', choice ? 'text-slate-500' : 'font-semibold text-red-500')}>
                    {choice ? (
                      <>
                        Đã chọn: {choice}. <OptionText question={q} opt={choice} />
                      </>
                    ) : (
                      'Chưa chọn đáp án'
                    )}
                  </p>
                </div>
                <Button variant="outline" icon={ArrowRight} onClick={() => openQuestion(q.question_id)}>
                  Sửa
                </Button>
              </Card>
            )
          })}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-md border border-indigo-200 bg-indigo-50 px-6 py-4">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-white text-indigo-600">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-slate-900">
            {unanswered.length
              ? `Còn ${unanswered.length} câu chưa trả lời`
              : `Đã trả lời đủ ${questions.length}/${questions.length} câu`}
          </p>
          <p className="text-xs text-slate-500">
            {unanswered.length
              ? 'Bạn vẫn nộp được bài, câu bỏ trống sẽ tính là chưa đúng. Sau khi nộp sẽ không sửa được đáp án.'
              : 'Sau khi nộp sẽ không sửa được đáp án.'}
          </p>
          {submitError != null && (
            <p className="mt-1 text-xs text-red-500">
              Nộp bài chưa thành công: {submitError instanceof Error ? submitError.message : 'lỗi không xác định'}. Hãy thử lại.
            </p>
          )}
        </div>
        <Button variant="outline" size="lg" icon={ArrowLeft} onClick={() => navigate('..')}>
          Quay lại làm bài
        </Button>
        <Button size="lg" icon={Send} loading={submitting} onClick={() => (unanswered.length ? setConfirming(true) : submit())}>
          Nộp bài
        </Button>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-[440px] space-y-4 rounded-md border border-slate-200 bg-white p-6"
          >
            <h2 id="confirm-title" className="text-[17px]">
              Còn {unanswered.length} câu chưa trả lời
            </h2>
            <p className="text-sm text-slate-600">
              Câu bỏ trống sẽ tính là sai và không sửa được sau khi nộp. Bạn có chắc muốn nộp bài bây giờ?
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="outline" autoFocus onClick={() => setConfirming(false)}>
                Quay lại làm tiếp
              </Button>
              <Button icon={Send} loading={submitting} onClick={submit}>
                Vẫn nộp bài
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
