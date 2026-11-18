import { clsx } from 'clsx'
import { Check, CheckCheck, ChevronRight, Inbox } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useNotifications, useReadNotification, type Notification } from '../../api/client'
import { Button, Card, EmptyState, ErrorState, LoadingState, PageTitle } from '../../components/ui'
import { formatAgo, formatScore, scoreColor } from '../../lib/format'

type Filter = 'all' | 'unread' | 'read'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'unread', label: 'Chưa đọc' },
  { key: 'read', label: 'Đã đọc' },
]

/** Thông báo bài nộp (đẩy qua WebSocket, xem useTeacherSocket). Gom theo đề để nhiều em nộp cùng lúc vẫn dễ theo dõi. */
export function NotificationsPage() {
  const notifications = useNotifications()
  const markRead = useReadNotification()
  // Tab lọc lưu trên URL (?tab=unread) để quay lại trang vẫn giữ đúng tab
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab')
  const filter: Filter = tab === 'unread' || tab === 'read' ? tab : 'all'
  const setFilter = (key: Filter) => setParams(key === 'all' ? {} : { tab: key }, { replace: true })

  if (notifications.isPending) return <LoadingState />
  if (notifications.isError) return <ErrorState error={notifications.error} onRetry={() => notifications.refetch()} />

  const all = notifications.data
  const counts: Record<Filter, number> = {
    all: all.length,
    unread: all.filter((n) => !n.read).length,
    read: all.filter((n) => n.read).length,
  }
  const shown = all.filter((n) => filter === 'all' || (filter === 'read') === n.read)
  // Gom theo đề, giữ thứ tự mới nhất trước (thông báo đã sắp mới nhất trước)
  const groups = new Map<string, Notification[]>()
  for (const n of shown) groups.set(n.attempt.exam.exam_id, [...(groups.get(n.attempt.exam.exam_id) ?? []), n])

  return (
    <div className="mx-auto max-w-[960px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="Thông báo" description="Mỗi khi học sinh nộp bài, kết quả và chẩn đoán có ngay tại đây." />
        <Button variant="outline" icon={CheckCheck} disabled={!counts.unread} onClick={() => markRead.mutate(undefined)}>
          Đánh dấu tất cả đã đọc
        </Button>
      </div>

      <div className="flex gap-2" role="group" aria-label="Lọc thông báo">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={clsx(
              'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm',
              filter === key ? 'bg-indigo-50 font-semibold text-indigo-600' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {label}
            <span className="text-xs text-slate-500">{counts[key]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title={filter === 'all' ? 'Chưa có thông báo nào' : 'Không có thông báo trong mục này'}
            description="Khi học sinh nộp bài, thông báo sẽ hiện ở đây ngay lập tức."
          />
        </Card>
      ) : (
        [...groups.values()].map((items) => (
          <Card key={items[0]!.attempt.exam.exam_id} className="overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-6 py-4">
              <h2 className="text-[15px]">{items[0]!.attempt.exam.exam_title}</h2>
              <span className="text-xs text-slate-500">
                {items.length} bài nộp
                {items.some((n) => !n.read) && ` · ${items.filter((n) => !n.read).length} chưa đọc`}
              </span>
            </div>
            <ul className="divide-y divide-slate-200">
              {items.map((n) => (
                <li key={n.id}>
                  <NotificationRow notification={n} onRead={() => !n.read && markRead.mutate(n.id)} />
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  )
}

function NotificationRow({ notification, onRead }: { notification: Notification; onRead: () => void }) {
  const { attempt } = notification
  return (
    <div className="flex items-center hover:bg-slate-50">
      <Link
        to={`/teacher/attempts/${attempt.attempt_id}/diagnosis`}
        onClick={onRead}
        className="flex min-w-0 flex-1 items-center gap-4 py-3 pl-6"
      >
        <span
          className={clsx('size-2 shrink-0 rounded-full', notification.read ? 'bg-transparent' : 'bg-indigo-600')}
          aria-label={notification.read ? undefined : 'Chưa đọc'}
        />
        <div className="min-w-0 flex-1">
          <p className={clsx('text-sm text-slate-900', !notification.read && 'font-bold')}>
            {attempt.student.full_name} (Lớp {attempt.student.class_name}) nộp bài
          </p>
          <p className="text-xs text-slate-500">
            {notification.weak_skill_count} phần cần luyện · {notification.recommendation_count} học liệu đề xuất
          </p>
        </div>
        <span className={clsx('text-sm font-bold', scoreColor(attempt.total_score))}>{formatScore(attempt.total_score)}</span>
        <span className="w-20 text-right text-xs text-slate-500">{formatAgo(notification.created_at)}</span>
        <ChevronRight className="size-4 text-slate-400" />
      </Link>
      <span className="flex w-14 justify-center pr-2">
        {!notification.read && (
          <button
            type="button"
            onClick={onRead}
            aria-label={`Đánh dấu đã đọc: ${attempt.student.full_name}`}
            title="Đánh dấu đã đọc"
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
          >
            <Check className="size-4" />
          </button>
        )}
      </span>
    </div>
  )
}
