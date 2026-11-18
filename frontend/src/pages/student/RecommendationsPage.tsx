import { ArrowRight, BookOpen, RefreshCw } from 'lucide-react'
import { useParams } from 'react-router'
import { useAttempts, useDiagnosis } from '../../api/client'
import { Breadcrumb } from '../../components/Breadcrumb'
import { RecommendationCard } from '../../components/student'
import { Card, EmptyState, ErrorState, LinkButton, LoadingState } from '../../components/ui'
import { useStudentId } from '../../session'

/** Figma 81:556 – Đề xuất học liệu cho một lượt làm bài. */
export function RecommendationsPage() {
  const { attemptId } = useParams()
  return <RecommendationsView attemptId={attemptId} />
}

/** "Lộ trình ôn tập": đề xuất của lượt làm đã chẩn đoán gần nhất. */
export function RoadmapPage() {
  const studentId = useStudentId()
  const attempts = useAttempts({ studentId })

  if (attempts.isPending) return <LoadingState />
  if (attempts.isError) return <ErrorState error={attempts.error} onRetry={() => attempts.refetch()} />
  const latest = attempts.data.find((a) => a.diagnosed)
  if (!latest) {
    return (
      <Card>
        <EmptyState
          icon={BookOpen}
          title="Bạn chưa có lộ trình cá nhân"
          description="Hãy làm một bài kiểm tra và chạy chẩn đoán để hệ thống đề xuất học liệu phù hợp."
          action={
            <LinkButton to="/student/exams" iconRight={ArrowRight}>
              Làm bài kiểm tra
            </LinkButton>
          }
        />
      </Card>
    )
  }
  return <RecommendationsView attemptId={latest.attempt_id} />
}

function RecommendationsView({ attemptId }: { attemptId: string | undefined }) {
  const diagnosis = useDiagnosis(attemptId)

  if (diagnosis.isPending) return <LoadingState />
  if (diagnosis.isError) return <ErrorState error={diagnosis.error} onRetry={() => diagnosis.refetch()} />
  const { recommendations, status } = diagnosis.data
  const mastery = status === 'MASTERY'
  const consolidate = status === 'NO_WEAK_SKILL'

  return (
    <div className="space-y-4">
      <Breadcrumb back="/student" items={[{ label: 'Trang chủ', to: '/student' }, { label: 'Lộ trình ôn tập' }]} />

      <div className="space-y-2">
        <h1 className="text-[26px]">
          {mastery ? 'Học liệu nâng cao cho bạn' : consolidate ? 'Học liệu củng cố cho bạn' : 'Lộ trình ôn tập của bạn'}
        </h1>
        <p className="text-[15px] text-slate-500">
          {mastery
            ? 'Bạn làm bài rất tốt! Các học liệu nâng cao dưới đây giúp bạn hướng tới điểm 9–10.'
            : consolidate
              ? 'Bạn không có phần nào sai nhiều. Các học liệu dưới đây giúp bạn ôn lại vài câu còn chưa đúng.'
              : `${recommendations.length} học liệu cho những phần bạn nên luyện, xếp theo thứ tự nên học trước.` +
                (recommendations.some((r) => r.tentative)
                  ? ' Học liệu có nhãn “Nên ôn thêm” dành cho phần bạn mới chưa đúng 1 câu, ôn để chắc hơn.'
                  : '')}
        </p>
      </div>

      {recommendations.length ? (
        recommendations.map((rec, i) => <RecommendationCard key={rec.material_id} rec={rec} rank={i + 1} />)
      ) : (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="Chưa có học liệu phù hợp"
            description={
              status === 'DIAGNOSED' || consolidate
                ? 'Kho chưa có học liệu phù hợp cho những phần bạn cần luyện. Giáo viên sẽ bổ sung sớm.'
                : 'Bài này bạn làm rất tốt, chưa có phần nào cần luyện thêm.'
            }
          />
        </Card>
      )}

      <p className="flex items-center justify-center gap-2 text-xs text-slate-500">
        <RefreshCw className="size-3.5" /> Lộ trình được cập nhật sau mỗi bài kiểm tra mới
      </p>
    </div>
  )
}
