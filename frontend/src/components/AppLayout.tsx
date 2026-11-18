import { clsx } from 'clsx'
import { LogOut } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useLogout } from '../api/client'
import { academicYear } from '../lib/format'
import { Avatar } from './ui'

export type NavItem = { to: string; label: string; end?: boolean; count?: number }

type Props = {
  nav: NavItem[]
  user: { name: string; subtitle: string; avatarText?: string }
  /** Nội dung gắn vào header (vd. kết nối real-time của giáo viên) */
  extra?: ReactNode
}

export function AppLayout({ nav, user, extra }: Props) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] flex-wrap items-center gap-x-8 gap-y-2 px-4 py-2 sm:px-12 md:flex-nowrap">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo.svg" alt="" className="size-9" />
            <span className="hidden whitespace-nowrap text-lg font-bold text-slate-900 lg:inline">Trung tâm Tri Thức</span>
          </Link>
          {/* Điện thoại: menu xuống hàng riêng, đủ mọi mục (không cuộn ngang ẩn mục) */}
          <nav className="order-last flex w-full flex-wrap items-center gap-1 md:order-none md:w-auto md:flex-nowrap">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-[13px] font-bold transition-colors',
                    isActive ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-900',
                  )
                }
              >
                {item.label}
                {!!item.count && (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-indigo-600 text-[11px] text-white">
                    {item.count > 9 ? '9+' : item.count}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            {extra}
            <span className="hidden whitespace-nowrap text-[15px] text-slate-500 xl:inline">Năm học: {academicYear()}</span>
            <span className="hidden h-8 w-px bg-slate-200 xl:block" />
            <UserMenu {...user} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 print:max-w-none print:p-0">
        <Outlet />
      </main>
    </div>
  )
}

function UserMenu({ name, subtitle, avatarText }: Props['user']) {
  const [open, setOpen] = useState(false)
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 rounded-md py-1 text-left"
        aria-expanded={open}
      >
        <Avatar name={name} text={avatarText} size="sm" />
        <span className="hidden whitespace-nowrap sm:block">
          <span className="block text-[13px] font-bold text-slate-900">{name}</span>
          <span className="block text-[11px] text-slate-500">{subtitle}</span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-md border border-slate-200 bg-white p-1 shadow-popover">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              logout.mutate(undefined, { onSettled: () => navigate('/', { replace: true }) })
            }}
          >
            <LogOut className="size-4" /> Đăng xuất
          </button>
        </div>
      )}
    </div>
  )
}
