import { ArrowRight, FileText, ListChecks, PlayCircle, Timer } from 'lucide-react'
import { useAttempts, useExams } from '../../api/client'
import { Badge, Card, ErrorState, IconTile, LinkButton, LoadingState, PageTitle } from '../../components/ui'
import { formatDate, formatScore } from '../../lib/format'
import { useStudentId } from '../../session'
import { savedDraft } from './exam/useExamDraft'

/** Danh sách đề (Figma chưa có màn này): chọn đề để vào màn làm bài. */
export function ExamsPage() {
  const studentId = useStudentId()
  const exams = useExams()
  const attempts = useAttempts({ studentId })

  if (exams.isPending || attempts.isPending) return <LoadingState />
  if (exams.isError) return <ErrorState error={exams.error} onRetry={() => exams.refetch()} />
  if (attempts.isError) return <ErrorState error={attempts.error} onRetry={() => attempts.refetch()} />

  return (
    <div className="space-y-6">
      <PageTitle
        title="Bài kiểm tra"
        description="Chọn một đề để làm bài. Làm xong, bạn sẽ biết mình đã vững phần nào và nên ôn gì tiếp."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {exams.data.map((exam) => {
          const last = attempts.data.find((a) => a.exam.exam_id === exam.exam_id)
          const draft = savedDraft(studentId, exam.exam_id)
          const draftCount = draft ? Object.keys(draft.answers).length : 0
          return (
            <Card key={exam.exam_id} className="flex flex-col p-6">
              <div className="flex items-start gap-3">
                <IconTile icon={FileText} />
                <div className="min-w-0">
                  <h2 className="text-[17px]">{exam.exam_title}</h2>
                  <p className="text-xs text-slate-500">
                    Năm học {exam.academic_year} · Lớp {exam.grade}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-4 text-[13px] text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <ListChecks className="size-4" /> {exam.total_questions} câu
                </span>
                <span className="inline-flex items-center gap-2">
                  <Timer className="size-4" /> {exam.duration_minutes} phút
                </span>
              </div>
              <div className="mt-4 flex min-h-6 flex-wrap gap-2">
                {draft && <Badge tone="warning">Đang làm dở · đã trả lời {draftCount} câu</Badge>}
                {last && (
                  <Badge tone="grade">
                    Lần gần nhất: {formatScore(last.total_score)}/10 · {formatDate(last.submitted_at)}
                  </Badge>
                )}
              </div>
              <LinkButton
                to={`/student/exams/${exam.exam_id}`}
                className="mt-4 w-full"
                icon={last && !draft ? undefined : PlayCircle}
                iconRight={last && !draft ? ArrowRight : undefined}
                variant={last && !draft ? 'outline' : 'primary'}
              >
                {draft ? 'Tiếp tục làm bài' : last ? 'Làm lại' : 'Bắt đầu làm bài'}
              </LinkButton>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
