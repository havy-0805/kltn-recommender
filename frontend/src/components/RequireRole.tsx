import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useMe, type Role } from '../api/client'
import { ROLE_HOME } from '../lib/routes'
import { ErrorState, LoadingState } from './ui'

/** Chưa đăng nhập: sang trang đăng nhập (nhớ trang đang mở). Sai vai trò: về khu vực của vai trò thật. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const me = useMe()
  const location = useLocation()

  if (me.isPending) return <LoadingState />
  if (me.isError) return <ErrorState error={me.error} onRetry={() => me.refetch()} />
  if (!me.data) return <Navigate to={`/login/${role}`} replace state={{ from: location.pathname + location.search }} />
  if (me.data.role !== role) return <Navigate to={ROLE_HOME[me.data.role]} replace />
  return children
}
