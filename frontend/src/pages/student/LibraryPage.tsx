import { ArrowRight, BookOpen, Layers, SignalHigh } from 'lucide-react'
import { useState } from 'react'
import { useLibrary, type LibraryItem } from '../../api/client'
import { Breadcrumb } from '../../components/Breadcrumb'
import { MultiSelect } from '../../components/MultiSelect'
import { Select } from '../../components/Select'
import { Badge, Card, EmptyState, ErrorState, LinkButton, LoadingState } from '../../components/ui'
import { filterLibrary, libraryCategories, type LibraryFilter } from '../../lib/library'
import { formatScore, levelLabel } from '../../lib/format'

const ALL = 'all'

/** Kho học liệu: toàn bộ học liệu, mở sẵn ở mức vừa sức theo điểm bài gần nhất (cùng mốc với luật BR-REC-04). */
export function LibraryPage() {
  const library = useLibrary()
  // null: chưa chọn, dùng mức gợi ý của hệ thống
  const [level, setLevel] = useState<LibraryFilter['level'] | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [weakOnly, setWeakOnly] = useState(false)

  if (library.isPending) return <LoadingState />
  if (library.isError) return <ErrorState error={library.error} onRetry={() => library.refetch()} />
  const { items, suggested_level: suggested, total_score: score } = library.data
  const effectiveLevel = level ?? suggested ?? ALL
  const shown = filterLibrary(items, { level: effectiveLevel, categories, weakOnly })
  const hasWeak = items.some((i) => i.weak)

  const levelOptions = [
    { value: ALL, label: 'Tất cả mức độ' },
    ...[1, 2, 3].map((n) => ({
      value: String(n),
      label: levelLabel[n] ?? String(n),
      description: n === suggested ? 'Vừa sức với điểm bài gần nhất của bạn' : undefined,
    })),
  ]
  const categoryOptions = libraryCategories(items).map((c) => ({ value: c, label: c }))

  return (
    <div className="space-y-4">
      <Breadcrumb back="/student" items={[{ label: 'Trang chủ', to: '/student' }, { label: 'Kho học liệu' }]} />

      <div className="space-y-2">
        <h1 className="text-[26px]">Kho học liệu</h1>
        <p className="text-[15px] text-slate-500">
          {suggested && score !== null
            ? `Kho đang mở ở mức ${levelLabel[suggested]}, vừa sức với điểm ${formatScore(score)} của bài gần nhất. ` +
              'Học liệu trong lộ trình của bạn và các phần bạn cần luyện được xếp lên đầu. Bạn có thể chọn mức khác để luyện thêm.'
            : 'Làm một bài kiểm tra và xem kết quả phân tích để hệ thống gợi ý mức học liệu vừa sức với bạn.'}
        </p>
      </div>

      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="w-full sm:w-64">
          <Select
            label="Mức độ"
            icon={SignalHigh}
            placeholder="Chọn mức độ"
            options={levelOptions}
            value={String(effectiveLevel)}
            onChange={(v) => setLevel(v === ALL ? ALL : (Number(v) as 1 | 2 | 3))}
          />
        </div>
        <div className="w-full sm:w-72">
          <MultiSelect
            label="Mảng kiến thức"
            icon={Layers}
            placeholder="Tất cả mảng kiến thức"
            options={categoryOptions}
            values={categories}
            onChange={setCategories}
          />
        </div>
        {hasWeak && (
          <label className="flex items-center gap-2 py-2 text-[13px] font-semibold text-slate-700">
            <input
              type="checkbox"
              className="size-4 accent-indigo-600"
              checked={weakOnly}
              onChange={(e) => setWeakOnly(e.target.checked)}
            />
            Chỉ phần tôi đang yếu
          </label>
        )}
      </Card>

      <p className="text-[13px] text-slate-500">Có {shown.length} học liệu</p>

      {shown.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((item) => (
            <LibraryCard key={item.material_id} item={item} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={BookOpen} title="Không có học liệu phù hợp" description="Hãy chọn mức độ hoặc mảng kiến thức khác." />
        </Card>
      )}
    </div>
  )
}

function LibraryCard({ item }: { item: LibraryItem }) {
  return (
    <Card className="flex flex-col gap-3 p-6">
      <div className="flex flex-wrap gap-2">
        <Badge tone="purple">{levelLabel[item.level]}</Badge>
        {item.recommended && <Badge tone="brand">Trong lộ trình của bạn</Badge>}
        {item.weak && <Badge tone="warning">Phần bạn cần luyện</Badge>}
      </div>
      <div className="flex-1">
        <h3 className="font-sans text-base font-semibold text-slate-900">{item.title}</h3>
        <p className="mt-1 text-[13px] text-slate-500">
          {item.skill_name} · {item.category}
        </p>
      </div>
      <div className="flex justify-end">
        <LinkButton to={`/student/practice/${item.material_id}?from=library`} iconRight={ArrowRight}>
          Học
        </LinkButton>
      </div>
    </Card>
  )
}
