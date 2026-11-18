import { clsx } from 'clsx'
import { AlertCircle, Loader2, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../api/client'
import { initials } from '../lib/format'

type ButtonVariant = 'primary' | 'outline' | 'ghost'
type ButtonSize = 'md' | 'lg'

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-md font-bold transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ' +
  'disabled:cursor-not-allowed'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300 disabled:',
  outline: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-slate-500 hover:text-slate-900',
}

const buttonSizes: Record<ButtonSize, string> = {
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
}

function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return clsx(buttonBase, buttonVariants[variant], buttonSizes[size], className)
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  iconRight?: LucideIcon
  loading?: boolean
}

export function Button({ variant, size, icon: Icon, iconRight: IconRight, loading, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={buttonClass(variant, size, className)} disabled={loading || rest.disabled} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon && <Icon className="size-4" />}
      {children}
      {IconRight && <IconRight className="size-4" />}
    </button>
  )
}

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  iconRight?: LucideIcon
}

export function LinkButton({ variant, size, icon: Icon, iconRight: IconRight, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {Icon && <Icon className="size-4" />}
      {children}
      {IconRight && <IconRight className="size-4" />}
    </Link>
  )
}

export function Card({ className, children, ...rest }: ComponentProps<'div'>) {
  return (
    <div className={clsx('rounded-md border border-slate-200 bg-white', className)} {...rest}>
      {children}
    </div>
  )
}

export type BadgeTone = 'brand' | 'success' | 'grade' | 'purple' | 'neutral' | 'warning' | 'warningOutline' | 'danger'

const badgeTones: Record<BadgeTone, string> = {
  brand: 'bg-indigo-50 text-indigo-600',
  success: 'bg-emerald-100 text-emerald-600',
  grade: 'bg-[#e6f4ea] text-[#0d7a56]',
  purple: 'bg-purple-100 text-purple-800',
  neutral: 'rounded-md border border-slate-200 bg-slate-50 text-slate-700',
  warning: 'bg-amber-100 text-amber-600',
  warningOutline: 'rounded-md border border-amber-300 bg-amber-100 text-amber-800',
  danger: 'rounded-md bg-red-100 text-red-800',
}

export function Badge({ tone = 'brand', className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold',
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export type IconTone = 'brand' | 'success' | 'warning' | 'danger' | 'violet' | 'sky'

const iconTones: Record<IconTone, string> = {
  brand: 'bg-indigo-50 text-indigo-600',
  success: 'bg-emerald-100 text-emerald-600',
  warning: 'bg-amber-100 text-amber-600',
  danger: 'bg-red-100 text-red-500',
  violet: 'bg-violet-50 text-violet-500',
  sky: 'bg-sky-50 text-sky-700',
}

export function IconTile({ icon: Icon, tone = 'brand', size = 'md' }: { icon: LucideIcon; tone?: IconTone; size?: 'sm' | 'md' }) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-md',
        size === 'sm' ? 'size-8' : 'size-10',
        iconTones[tone],
      )}
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-[18px]'} />
    </span>
  )
}

export function StatCard({ icon, tone, value, label }: { icon: LucideIcon; tone?: IconTone; value: ReactNode; label: string }) {
  return (
    <Card className="flex items-center gap-3 px-4 py-4">
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0">
        <div className="text-xl font-bold text-slate-900">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </Card>
  )
}

export function Avatar({
  name,
  text,
  size = 'md',
  ring,
}: {
  name: string
  text?: string
  size?: 'sm' | 'md' | 'lg'
  ring?: boolean
}) {
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-50 font-bold text-indigo-600',
        size === 'sm' && 'size-9 text-sm',
        size === 'md' && 'size-12 text-base',
        size === 'lg' && 'size-16 text-2xl',
        ring && 'border-2 border-indigo-600 bg-white',
      )}
    >
      {text ?? initials(name)}
    </span>
  )
}

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'success' }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={value}>
      <div
        className={clsx(
          'h-full rounded-full transition-[width] duration-500',
          tone === 'brand' ? 'bg-indigo-600' : 'bg-emerald-600',
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function PageTitle({ title, description, eyebrow }: { title: string; description?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="space-y-2">
      {eyebrow}
      <h1 className="text-[26px] leading-tight">{title}</h1>
      {description && <p className="text-sm text-slate-500">{description}</p>}
    </div>
  )
}

export function LoadingState({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  // Không có quyền hoặc không tồn tại: thử lại cũng vô ích, đưa người dùng về trang chủ
  const status = error instanceof ApiError ? error.status : undefined
  const final = status === 403 || status === 404
  const message =
    status === 404
      ? 'Không tìm thấy dữ liệu này. Đường dẫn có thể đã sai hoặc bài làm không còn.'
      : error instanceof Error
        ? error.message
        : 'Đã có lỗi xảy ra'
  return (
    <Card className="mx-auto my-16 flex max-w-md flex-col items-center gap-3 p-8 text-center">
      <IconTile icon={AlertCircle} tone="danger" />
      <p className="text-sm text-slate-700">{message}</p>
      {final ? (
        <LinkButton to="/" variant="outline">
          Về trang chủ
        </LinkButton>
      ) : (
        onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Thử lại
          </Button>
        )
      )}
    </Card>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <IconTile icon={icon} />
      <p className="font-bold text-slate-900">{title}</p>
      {description && <p className="max-w-md text-sm text-slate-500">{description}</p>}
      {action}
    </div>
  )
}
