import { clsx } from 'clsx'
import { ArrowRight, Bell, BellRing, X } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useNotifications, useReadNotification, type Notification } from '../../api/client'
import { AppLayout, type NavItem } from '../../components/AppLayout'
import { useTeacherSocket, type SocketStatus } from '../../hooks/useTeacherSocket'
import { formatAgo, formatScore, scoreColor } from '../../lib/format'

const TOAST_MS = 12_000

export function TeacherArea() {
  const notifications = useNotifications()
  // Bài nộp mới chưa đóng toast; nhiều bài liên tiếp thì gộp thành một toast tóm tắt
  const [toasts, setToasts] = useState<Notification[]>([])
  const status = useTeacherSocket((n) => setToasts((t) => [n, ...t]))
  const dismissAll = () => setToasts([])

  const unread = notifications.data?.filter((n) => !n.read).length ?? 0
  const nav: NavItem[] = [
    { to: '/teacher', label: 'Tổng quan lớp', end: true },
    { to: '/teacher/students', label: 'Kết quả học sinh' },
  ]

  return (
    <>
      <AppLayout
        nav={nav}
        user={{ name: 'Giáo viên quản lý', subtitle: 'Khối 9', avatarText: 'GV' }}
        extra={
          <>
            <ConnectionDot status={status} />
            <NotificationBell notifications={notifications.data ?? []} unread={unread} />
          </>
        }
      />
      {/* Góc trên bên phải, dưới thanh đầu trang: không che các nút hành động ở cuối trang */}
      <div
        className="fixed top-24 right-4 z-50 flex w-[min(380px,calc(100vw-32px))] flex-col gap-3 sm:right-6 print:hidden"
        aria-live="polite"
      >
        {toasts.length === 1 && <SubmissionToast key={toasts[0]!.id} notification={toasts[0]!} onDismiss={dismissAll} />}
        {toasts.length > 1 && <SummaryToast key={toasts[0]!.id} notifications={toasts} onDismiss={dismissAll} />}
      </div>
    </>
  )
}

const STATUS_TEXT: Record<SocketStatus, string> = {
  online: 'Nhận thông báo trực tiếp',
  connecting: 'Đang kết nối…',
  offline: 'Mất kết nối, đang thử lại',
}

function ConnectionDot({ status }: { status: SocketStatus }) {
  return (
    <span className="hidden items-center gap-2 text-xs text-slate-500 xl:inline-flex" title={STATUS_TEXT[status]}>
      <span
        className={clsx(
          'size-2 rounded-full',
          status === 'online' && 'bg-emerald-500',
          status === 'connecting' && 'animate-pulse bg-amber-500',
          status === 'offline' && 'bg-red-500',
        )}
      />
      {STATUS_TEXT[status]}
    </span>
  )
}

const BELL_PREVIEW = 5

/** Chuông thông báo ở header: số chưa đọc và danh sách bài nộp mới nhất; xem đủ ở trang Thông báo. */
function NotificationBell({ notifications, unread }: { notifications: Notification[]; unread: number }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const markRead = useReadNotification()

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex size-10 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-4 font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[360px] max-w-[calc(100vw-32px)] rounded-md border border-slate-200 bg-white shadow-popover">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">Thông báo</p>
            {unread > 0 && <span className="text-xs text-slate-500">{unread} chưa đọc</span>}
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Chưa có thông báo nào</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {notifications.slice(0, BELL_PREVIEW).map((n) => (
                <li key={n.id}>
                  <Link
                    to={`/teacher/attempts/${n.attempt.attempt_id}/diagnosis`}
                    onClick={() => {
                      if (!n.read) markRead.mutate(n.id)
                      setOpen(false)
                    }}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <span
                      className={clsx('mt-2 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-indigo-600')}
                      aria-label={n.read ? undefined : 'Chưa đọc'}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={clsx('block text-[13px] text-slate-900', !n.read && 'font-bold')}>
                        {n.attempt.student.full_name} (Lớp {n.attempt.student.class_name}) nộp bài:{' '}
                        {formatScore(n.attempt.total_score)}/10
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {n.attempt.exam.exam_title} · {formatAgo(n.created_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/teacher/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-200 px-4 py-3 text-center text-[13px] font-bold text-indigo-600 hover:bg-slate-50"
          >
            Xem tất cả thông báo
          </Link>
        </div>
      )}
    </div>
  )
}

const SUMMARY_NAMES = 3

/** Toast tự đóng sau TOAST_MS; dừng đếm khi giáo viên rê chuột hoặc dùng phím trong toast. */
function useToastTimer(onDismiss: () => void) {
  const expire = useEffectEvent(onDismiss)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => expire(), TOAST_MS)
    return () => clearTimeout(timer)
  }, [paused])
  return {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocus: () => setPaused(true),
    onBlur: () => setPaused(false),
  }
}

/** Nhiều học sinh nộp bài liên tiếp: một toast tóm tắt thay vì xếp chồng nhiều toast. */
function SummaryToast({ notifications, onDismiss }: { notifications: Notification[]; onDismiss: () => void }) {
  const pause = useToastTimer(onDismiss)

  const names = notifications.slice(0, SUMMARY_NAMES).map((n) => n.attempt.student.full_name)
  const more = notifications.length - names.length
  return (
    <div role="status" className="rounded-md border border-indigo-200 bg-white p-4 shadow-popover" {...pause}>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white">
          <BellRing className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">{notifications.length} học sinh vừa nộp bài</p>
          <p className="mt-1 text-[13px] text-slate-700">
            {names.join(', ')}
            {more > 0 && ` và ${more} học sinh khác`}.
          </p>
          <Link
            to="/teacher/notifications"
            onClick={onDismiss}
            className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-indigo-600 hover:underline"
          >
            Xem thông báo <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <button type="button" aria-label="Đóng" onClick={onDismiss} className="text-slate-400 hover:text-slate-700">
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}

function SubmissionToast({ notification, onDismiss }: { notification: Notification; onDismiss: () => void }) {
  const { attempt } = notification
  const markRead = useReadNotification()

  const pause = useToastTimer(onDismiss)

  return (
    <div role="status" className="rounded-md border border-indigo-200 bg-white p-4 shadow-popover" {...pause}>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white">
          <BellRing className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">Bài nộp mới</p>
          <p className="mt-1 text-[13px] text-slate-700">
            {attempt.student.full_name} (Lớp {attempt.student.class_name}) vừa hoàn thành “{attempt.exam.exam_title}” với{' '}
            <span className={clsx('font-semibold', scoreColor(attempt.total_score))}>{formatScore(attempt.total_score)}/10</span>.
          </p>
          <Link
            to={`/teacher/attempts/${attempt.attempt_id}/diagnosis`}
            onClick={() => {
              markRead.mutate(notification.id)
              onDismiss()
            }}
            className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-indigo-600 hover:underline"
          >
            Xem chẩn đoán <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <button type="button" aria-label="Đóng" onClick={onDismiss} className="text-slate-400 hover:text-slate-700">
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
