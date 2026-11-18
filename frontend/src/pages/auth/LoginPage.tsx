import { ArrowLeft, Eye, EyeOff, KeyRound, LogIn, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { useLogin, type Role } from '../../api/client'
import { Button } from '../../components/ui'
import { ROLE_HOME } from '../../lib/routes'
import { AuthCard } from './AuthCard'

const COPY: Record<Role, { title: string; userLabel: string; placeholder: string }> = {
  student: { title: 'Đăng nhập học sinh', userLabel: 'Mã học sinh', placeholder: 'VD: STU00006' },
  teacher: { title: 'Đăng nhập giáo viên', userLabel: 'Tên đăng nhập', placeholder: 'VD: gv.khoi9' },
}

/** Bước 2: đăng nhập theo vai trò đã chọn. Đăng nhập xong quay lại trang đang mở dở (nếu bị chuyển tới đây vì hết phiên). */
export function LoginPage() {
  const { role } = useParams()
  if (role !== 'student' && role !== 'teacher') return <Navigate to="/" replace />
  return <LoginForm key={role} role={role} />
}

function LoginForm({ role }: { role: Role }) {
  const copy = COPY[role]
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from
  const login = useLogin()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate(
      { role, username: username.trim(), password },
      { onSuccess: () => navigate(from?.startsWith(ROLE_HOME[role]) ? from : ROLE_HOME[role], { replace: true }) },
    )
  }

  return (
    <AuthCard title={copy.title} description="Nhập tài khoản được nhà trường cấp để tiếp tục.">
      <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
        <label className="block space-y-2">
          <span className="text-[13px] font-semibold text-slate-700">{copy.userLabel}</span>
          <span className="flex h-11 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 focus-within:border-indigo-600">
            <UserRound className="size-4 text-slate-500" />
            <input
              name="username"
              autoComplete="username"
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={copy.placeholder}
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </span>
        </label>
        <label className="block space-y-2">
          <span className="text-[13px] font-semibold text-slate-700">Mật khẩu</span>
          <span className="flex h-11 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 focus-within:border-indigo-600">
            <KeyRound className="size-4 text-slate-500" />
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-900 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="text-slate-400 hover:text-slate-700"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </label>

        {login.isError && (
          <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-[13px] text-red-800">
            {login.error.message}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          icon={LogIn}
          loading={login.isPending}
          disabled={!username.trim() || !password}
        >
          Đăng nhập
        </Button>
      </form>
      <Link to="/" className="mt-4 inline-flex items-center gap-2 text-[13px] text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Chọn vai trò khác
      </Link>
    </AuthCard>
  )
}
