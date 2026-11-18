import { ArrowRight, GraduationCap, Users, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { IconTile } from '../../components/ui'
import { AuthCard } from './AuthCard'

/** Bước 1: chọn vai trò, sau đó sang màn đăng nhập của vai trò đó. */
export function RoleSelect() {
  return (
    <AuthCard title="Chào mừng bạn đến Trung tâm Tri Thức" description="Bạn đăng nhập với vai trò nào?">
      <div className="mt-6 grid gap-3">
        <RoleLink
          to="/login/student"
          icon={GraduationCap}
          label="Học sinh"
          hint="Làm bài kiểm tra, xem chẩn đoán và lộ trình ôn tập"
        />
        <RoleLink
          to="/login/teacher"
          icon={Users}
          label="Giáo viên"
          hint="Nhận thông báo bài nộp, tra cứu chẩn đoán của học sinh"
        />
      </div>
    </AuthCard>
  )
}

function RoleLink({ to, icon, label, hint }: { to: string; icon: LucideIcon; label: string; hint: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-md border border-slate-200 p-4 transition-colors hover:border-indigo-600 hover:bg-indigo-50"
    >
      <IconTile icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-slate-900">{label}</span>
        <span className="block text-[13px] text-slate-500">{hint}</span>
      </span>
      <ArrowRight className="size-4 text-slate-400 group-hover:text-indigo-600" />
    </Link>
  )
}
