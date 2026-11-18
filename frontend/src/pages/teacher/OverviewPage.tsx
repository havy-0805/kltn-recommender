import { BookOpen, BookX, CircleCheck, FileText, Target, TriangleAlert, Trophy, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useClasses, useOverview, type CountItem, type Overview } from '../../api/client'
import { PassRateList } from '../../components/diagnosis'
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageTitle, StatCard } from '../../components/ui'
import { formatScore, scoreColor } from '../../lib/format'

/** Tổng quan lớp: số liệu báo cáo cho giáo viên. Kết quả từng học sinh ở trang /teacher/students. */
export function OverviewPage() {
  const [params, setParams] = useSearchParams()
  const className = params.get('class') ?? undefined
  const classes = useClasses()
  const overview = useOverview(className)
  const classList = classes.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title="Tổng quan lớp"
          description={`${classList.length === 1 ? `Lớp ${classList[0]}. ` : ''}Kết quả kiểm tra và chẩn đoán của học sinh. Số liệu kỹ năng tính theo bài làm gần nhất của mỗi học sinh.`}
        />
        {classList.length > 1 && (
          <label className="inline-flex items-center gap-2 text-[13px] text-slate-500">
            Lớp
            <select
              value={className ?? ''}
              onChange={(e) => setParams(e.target.value ? { class: e.target.value } : {}, { replace: true })}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-[13px] font-semibold text-slate-900"
            >
              <option value="">Tất cả lớp</option>
              {classList.map((c) => (
                <option key={c} value={c}>
                  Lớp {c}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {overview.isPending ? (
        <LoadingState />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
      ) : overview.data.attempts === 0 ? (
        <Card>
          <EmptyState icon={FileText} title="Chưa có bài làm nào" description="Số liệu sẽ hiện khi học sinh nộp bài." />
        </Card>
      ) : (
        <Dashboard data={overview.data} />
      )}
    </div>
  )
}

function Dashboard({ data }: { data: Overview }) {
  const percent = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0)

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Users} value={data.students} label={`Học sinh · ${data.submitted_students} đã làm bài`} />
        <StatCard icon={FileText} tone="sky" value={data.attempts} label={`Lượt làm bài · ${data.exams_taken} đề kiểm tra`} />
        <StatCard
          icon={Trophy}
          tone="success"
          value={data.average_score === null ? '—' : `${formatScore(data.average_score)} / 10`}
          label="Điểm trung bình"
        />
        <StatCard
          icon={CircleCheck}
          tone="success"
          value={data.pass_rate === null ? '—' : `${Math.round(data.pass_rate * 100)}%`}
          label="Lượt làm bài đạt từ 5 điểm"
        />
        <StatCard icon={TriangleAlert} tone="danger" value={data.attention.length} label="Học sinh cần chú ý" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle title="Phân bố xếp loại" note={`Theo bài làm gần nhất của ${data.submitted_students} học sinh`} />
          <BarList
            items={data.score_bands}
            max={data.submitted_students}
            value={(b) => `${b.count} học sinh · ${percent(b.count, data.submitted_students)}%`}
          />
        </Card>
        <Card className="p-6">
          <SectionTitle
            title="So sánh giữa các đề"
            note="Mỗi đề: số lượt làm, số học sinh, điểm trung bình và tỷ lệ đạt từ 5 điểm trở lên"
          />
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="py-2">Đề kiểm tra</th>
                <th className="py-2 text-right">Lượt làm</th>
                <th className="py-2 text-right">Học sinh</th>
                <th className="py-2 text-right">Điểm TB</th>
                <th className="py-2 text-right">Đạt từ 5</th>
              </tr>
            </thead>
            <tbody>
              {data.exams.map((e) => (
                <tr key={e.exam_id} className="border-t border-slate-200">
                  <td className="py-3 pr-3 text-slate-900">{e.exam_title}</td>
                  <td className="py-3 text-right">{e.attempts}</td>
                  <td className="py-3 text-right">{e.students}</td>
                  <td className={`py-3 text-right font-semibold ${scoreColor(e.average_score)}`}>
                    {formatScore(e.average_score)}
                  </td>
                  <td className="py-3 text-right">{Math.round(e.pass_rate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {data.classes.length > 1 && (
        <Card className="p-6">
          <SectionTitle title="So sánh giữa các lớp" />
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="py-2">Lớp</th>
                <th className="py-2 text-right">Học sinh</th>
                <th className="py-2 text-right">Đã làm bài</th>
                <th className="py-2 text-right">Điểm trung bình</th>
              </tr>
            </thead>
            <tbody>
              {data.classes.map((c) => (
                <tr key={c.class_name} className="border-t border-slate-200">
                  <td className="py-3 font-semibold text-slate-900">Lớp {c.class_name}</td>
                  <td className="py-3 text-right">{c.students}</td>
                  <td className="py-3 text-right">
                    {c.submitted_students} ({percent(c.submitted_students, c.students)}%)
                  </td>
                  <td className="py-3 text-right font-semibold text-slate-900">
                    {c.average_score === null ? '—' : formatScore(c.average_score)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PassRateList stats={data.group_stats} title="Tỷ lệ đạt theo nhóm kiến thức" />
        <Card className="p-6">
          <SectionTitle
            icon={Target}
            title="Điểm yếu phổ biến"
            note={`Số học sinh bị chẩn đoán yếu, trên ${data.submitted_students} học sinh đã làm bài`}
          />
          <BarList
            items={data.common_weak_skills}
            max={data.submitted_students}
            value={(s) => `${s.count} học sinh · ${percent(s.count, data.submitted_students)}%`}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <Card className="min-w-0 overflow-hidden">
          <div className="px-6 pt-6">
            <SectionTitle
              icon={TriangleAlert}
              title="Học sinh cần chú ý"
              note="Điểm dưới 5 hoặc hổng kiến thức trên diện rộng ở bài làm gần nhất"
            />
          </div>
          {data.attention.length === 0 ? (
            <p className="px-6 py-6 text-sm text-slate-500">Không có học sinh nào dưới 5 điểm.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-y border-slate-200 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Học sinh</th>
                    <th className="px-3 py-3">Bài kiểm tra</th>
                    <th className="px-3 py-3 text-right">Điểm</th>
                    <th className="px-3 py-3 text-right">Điểm yếu</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.attention.map(({ attempt: a, weak_skill_count, broad_weakness }) => (
                    <tr key={a.attempt_id} className="border-t border-slate-200">
                      <td className="px-6 py-3">
                        <p className="font-semibold text-slate-900">{a.student.full_name}</p>
                        <p className="text-xs text-slate-500">Lớp {a.student.class_name}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{a.exam.exam_title}</td>
                      <td className={`px-3 py-3 text-right font-bold ${scoreColor(a.total_score)}`}>
                        {formatScore(a.total_score)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {weak_skill_count}
                        {broad_weakness && (
                          <Badge tone="danger" className="ml-2">
                            Diện rộng
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Link
                          to={`/teacher/attempts/${a.attempt_id}/diagnosis`}
                          className="text-sm font-bold whitespace-nowrap text-indigo-600 hover:underline"
                        >
                          Xem chẩn đoán
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <SectionTitle icon={BookOpen} title="Học liệu được đề xuất nhiều nhất" />
            <BarList items={data.top_materials} max={data.submitted_students} value={(m) => `${m.count} học sinh`} />
          </Card>
          <Card className="p-6">
            <SectionTitle
              icon={BookX}
              title="Chuyên đề thiếu học liệu"
              note="Điểm yếu trong Top 3 bị bỏ qua vì kho chưa có học liệu phù hợp. Cần bổ sung học liệu cho các chuyên đề này."
            />
            {data.missing_materials.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Kho đủ học liệu cho mọi điểm yếu trong Top 3.</p>
            ) : (
              <BarList
                items={data.missing_materials}
                max={data.submitted_students}
                value={(m) => `${m.count} học sinh không nhận học liệu`}
              />
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

function SectionTitle({ title, note, icon: Icon }: { title: string; note?: string; icon?: typeof Users }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-[17px]">
        {Icon && <Icon className="size-5 text-indigo-600" />}
        {title}
      </h2>
      {note && <p className="mt-1 text-[13px] text-slate-500">{note}</p>}
    </div>
  )
}

/** Thanh ngang một màu: độ dài theo số lượng, số liệu ghi bằng chữ bên phải. */
function BarList({ items, max, value }: { items: CountItem[]; max: number; value: (item: CountItem) => string }) {
  return (
    <ul className="mt-4 space-y-4">
      {items.map((item) => {
        const width = max ? (item.count / max) * 100 : 0
        return (
          <li key={item.id} title={`${item.name}: ${value(item)}`}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-900">{item.name}</span>
              <span className="shrink-0 text-[13px] text-slate-500">{value(item)}</span>
            </div>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-label={item.name}
              aria-valuenow={item.count}
            >
              <div className="h-full rounded-full bg-indigo-600" style={{ width: `${item.count ? Math.max(width, 2) : 0}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
