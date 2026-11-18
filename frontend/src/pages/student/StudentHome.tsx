import { ArrowRight, BookOpen, Clock } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAttempts, useDiagnosis, type Attempt } from '../../api/client'
import { AttemptRow, LatestExamCard, RecommendationCard } from '../../components/student'
import { Badge, Card, EmptyState, ErrorState, IconTile, LinkButton, LoadingState } from '../../components/ui'
import { studentAttemptLink } from '../../lib/routes'
import { useStudentId } from '../../session'

type Filter = 'all' | 'pending' | 'diagnosed'

/** Figma 81:536 (trước chẩn đoán) và 2047:298 (sau chẩn đoán). */
export function StudentHome() {
  const studentId = useStudentId()
  const attempts = useAttempts({ studentId })

  if (attempts.isPending) return <LoadingState />
  if (attempts.isError) return <ErrorState error={attempts.error} onRetry={() => attempts.refetch()} />

  const list = attempts.data
  const latest = list[0]
  const latestDiagnosed = list.find((a) => a.diagnosed)

  return (
    <div className="space-y-8">
      <Hero latest={latest} />
      <HistoryCard attempts={list} />
      {latestDiagnosed && <RoadmapCard attempt={latestDiagnosed} stale={latest !== latestDiagnosed} />}
    </div>
  )
}

function Hero({ latest }: { latest: Attempt | undefined }) {
  const pending = latest && !latest.diagnosed

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1 space-y-4">
        {!latest ? (
          <>
            <h1 className="text-[28px]">Chào mừng bạn đến Trung tâm Tri Thức!</h1>
            <p className="max-w-3xl text-[15px] text-slate-700">
              Làm bài kiểm tra đầu tiên để biết phần kiến thức nào bạn đã vững và phần nào cần luyện thêm.
            </p>
            <LinkButton to="/student/exams" size="lg" iconRight={ArrowRight}>
              Làm bài kiểm tra
            </LinkButton>
          </>
        ) : pending ? (
          <>
            <Badge tone="purple">Bài mới chưa xem kết quả</Badge>
            <h1 className="text-[28px]">Bạn vừa nộp bài {latest.exam.exam_title}</h1>
            <p className="max-w-3xl text-[15px] text-slate-700">
              Xem kết quả phân tích để biết bạn sai ở đâu và nên luyện gì tiếp.
            </p>
            <LinkButton to={`/student/attempts/${latest.attempt_id}/diagnosis`} size="lg" iconRight={ArrowRight}>
              Xem kết quả phân tích
            </LinkButton>
          </>
        ) : (
          <>
            <h1 className="text-[28px]">Lộ trình ôn tập đã cập nhật</h1>
            <p className="max-w-3xl text-[15px] text-slate-700">
              Dựa trên bài {latest.exam.exam_title}, đây là những phần bạn nên luyện tiếp.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <LinkButton to={`/student/attempts/${latest.attempt_id}/recommendations`} size="lg" iconRight={ArrowRight}>
                Xem lộ trình
              </LinkButton>
              <LinkButton to={`/student/attempts/${latest.attempt_id}/diagnosis`} size="lg" variant="outline">
                Xem kết quả phân tích
              </LinkButton>
            </div>
          </>
        )}
      </div>
      {latest && <LatestExamCard attempt={latest} />}
    </div>
  )
}

function HistoryCard({ attempts }: { attempts: Attempt[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const shown = attempts.filter((a) => filter === 'all' || (filter === 'diagnosed') === a.diagnosed).slice(0, 3)

  return (
    <Card className="p-8">
      <div className="mb-4 flex items-start gap-3">
        <IconTile icon={Clock} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg">Lịch sử làm bài gần đây</h2>
          <p className="text-[13px] text-slate-500">Các bài kiểm tra bạn đã nộp.</p>
        </div>
        <select
          aria-label="Lọc lịch sử"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-[13px] text-slate-700"
        >
          <option value="all">Tất cả</option>
          <option value="pending">Chưa xem kết quả</option>
          <option value="diagnosed">Đã xem kết quả</option>
        </select>
      </div>
      {shown.length ? (
        shown.map((a) => <AttemptRow key={a.attempt_id} attempt={a} to={studentAttemptLink(a)} />)
      ) : (
        <p className="py-6 text-center text-sm text-slate-500">Chưa có lượt làm bài nào.</p>
      )}
      <Link to="/student/history" className="mt-4 block text-center text-sm font-bold text-indigo-600 hover:underline">
        Xem tất cả
      </Link>
    </Card>
  )
}

function RoadmapCard({ attempt, stale }: { attempt: Attempt; stale: boolean }) {
  const diagnosis = useDiagnosis(attempt.attempt_id)
  const recs = diagnosis.data?.recommendations ?? []

  return (
    <section>
      <div className="mb-4 flex items-start gap-3">
        <IconTile icon={BookOpen} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg">Lộ trình ôn tập</h2>
          <p className="text-[13px] text-slate-500">
            {recs.length} học liệu chọn theo kết quả bài {attempt.exam.exam_title}
            {stale && ' (bài làm trước, bài mới nhất chưa xem kết quả)'}.
          </p>
        </div>
      </div>
      {diagnosis.isPending ? (
        <LoadingState />
      ) : recs.length ? (
        <div className="space-y-4">
          {recs.map((rec, i) => (
            <RecommendationCard key={rec.material_id} rec={rec} rank={i + 1} badges={stale ? 'priority' : 'level'} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="Chưa có học liệu đề xuất"
          description="Bài gần nhất bạn làm rất tốt, chưa có phần nào cần luyện thêm."
        />
      )}
    </section>
  )
}
