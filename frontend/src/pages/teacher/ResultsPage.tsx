import { Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useClasses, useOverview, useResults, type AttemptSummary } from '../../api/client'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageTitle } from '../../components/ui'
import { formatDateTime, formatScore, scoreColor } from '../../lib/format'

type Sort = 'score' | 'score-desc' | 'name' | 'recent'

const SORTS: Record<Sort, { label: string; compare: (a: AttemptSummary, b: AttemptSummary) => number }> = {
  score: { label: 'Điểm thấp trước', compare: (a, b) => a.attempt.total_score - b.attempt.total_score },
  'score-desc': { label: 'Điểm cao trước', compare: (a, b) => b.attempt.total_score - a.attempt.total_score },
  name: { label: 'Tên A–Z', compare: (a, b) => byName(a).localeCompare(byName(b), 'vi') },
  recent: { label: 'Nộp gần đây', compare: (a, b) => b.attempt.submitted_at.localeCompare(a.attempt.submitted_at) },
}

// Người Việt xếp theo tên (chữ cuối), rồi mới đến họ đệm
const byName = (r: AttemptSummary) => {
  const parts = r.attempt.student.full_name.split(' ')
  return `${parts.at(-1)} ${parts.join(' ')}`
}

/** Bỏ dấu để tìm "nhi" ra "Nhi", "ha nhi" ra "Hà Nhi". */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()

/** Kết quả học sinh: bảng cả lớp, lọc theo đề, tìm theo tên; bấm tên để xem chẩn đoán chi tiết. */
export function ResultsPage() {
  const [params, setParams] = useSearchParams()
  const className = params.get('class') ?? undefined
  const examParam = params.get('exam') ?? undefined
  const q = params.get('q') ?? ''
  const sort = (params.get('sort') as Sort | null) ?? 'score'

  const classes = useClasses()
  const overview = useOverview(className)
  // Mã đề không có trong danh sách (gõ sai trên URL) thì bỏ qua, để ô lọc và bảng luôn khớp nhau
  const examId = overview.data && !overview.data.exams.some((e) => e.exam_id === examParam) ? undefined : examParam
  const results = useResults({ className, examId })

  const update = (name: string, value: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (value) next.set(name, value)
        else next.delete(name)
        return next
      },
      { replace: true },
    )

  const rows = (results.data ?? [])
    .filter((r) => fold(r.attempt.student.full_name).includes(fold(q.trim())))
    .sort(SORTS[sort in SORTS ? sort : 'score'].compare)
  const selectClass = 'h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900'

  return (
    <div className="space-y-6">
      <PageTitle
        title="Kết quả học sinh"
        description="Mặc định là bài làm gần nhất của mỗi học sinh. Chọn một đề để xem mọi lượt làm đề đó. Bấm tên học sinh để xem chẩn đoán chi tiết."
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[240px] flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Tìm học sinh"
            placeholder="Tìm theo tên học sinh"
            value={q}
            onChange={(e) => update('q', e.target.value)}
            className="h-10 w-full rounded-md border border-slate-200 bg-white pr-3 pl-8 text-sm text-slate-900"
          />
        </label>
        {(classes.data?.length ?? 0) > 1 && (
          <select
            aria-label="Lớp"
            value={className ?? ''}
            onChange={(e) => update('class', e.target.value)}
            className={selectClass}
          >
            <option value="">Tất cả lớp</option>
            {classes.data!.map((c) => (
              <option key={c} value={c}>
                Lớp {c}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Đề kiểm tra"
          value={examId ?? ''}
          onChange={(e) => update('exam', e.target.value)}
          className={selectClass}
        >
          <option value="">Bài gần nhất của mỗi học sinh</option>
          {(overview.data?.exams ?? []).map((e) => (
            <option key={e.exam_id} value={e.exam_id}>
              {e.exam_title}
            </option>
          ))}
        </select>
        <select aria-label="Sắp xếp" value={sort} onChange={(e) => update('sort', e.target.value)} className={selectClass}>
          {Object.entries(SORTS).map(([key, s]) => (
            <option key={key} value={key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {results.isPending ? (
        <LoadingState />
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      ) : (
        <Card className="overflow-hidden">
          <p className="px-6 py-3 text-[13px] text-slate-500">
            {rows.length} {examId ? 'lượt làm bài' : 'học sinh'}
            {q && ` khớp "${q}"`}
          </p>
          {rows.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Không có kết quả"
              description="Thử bỏ bớt bộ lọc hoặc tìm tên khác."
              action={
                <Button variant="outline" onClick={() => setParams({}, { replace: true })}>
                  Xóa bộ lọc
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-y border-slate-200 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Học sinh</th>
                    <th className="px-3 py-3">Đề kiểm tra</th>
                    <th className="px-3 py-3 text-right">Điểm</th>
                    <th className="px-3 py-3 text-right">Câu đúng</th>
                    <th className="px-3 py-3 text-right">Số phần cần luyện</th>
                    <th className="px-6 py-3">Nộp lúc</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ attempt: a, weak_skill_count, broad_weakness }) => (
                    <tr key={a.attempt_id} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <Link
                          to={`/teacher/attempts/${a.attempt_id}/diagnosis`}
                          className="font-semibold text-indigo-600 hover:underline"
                        >
                          {a.student.full_name}
                        </Link>
                        <p className="text-xs text-slate-500">Lớp {a.student.class_name}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{a.exam.exam_title}</td>
                      <td className={`px-3 py-3 text-right font-bold ${scoreColor(a.total_score)}`}>
                        {formatScore(a.total_score)}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700">
                        {a.correct_count}/{a.exam.total_questions}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {weak_skill_count}
                        {broad_weakness && (
                          <Badge tone="danger" className="ml-2">
                            Diện rộng
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-slate-500">{formatDateTime(a.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
