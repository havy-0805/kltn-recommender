import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { createQueryClient } from '../api/queryClient'

export const STUDENT = { student_id: 'STU00006', full_name: 'Nguyễn Hà Nhi', class_name: '9 - Nhóm 2' }
export const ME_STUDENT = { username: 'STU00006', role: 'student', display_name: STUDENT.full_name, student: STUDENT }
export const ME_TEACHER = { username: 'gv.khoi9', role: 'teacher', display_name: 'Giáo viên quản lý', student: null }

/** Giả lập API: map"METHOD /path?query" -> body JSON hoặc ErrorReply. */
export function mockApi(routes: Record<string, unknown>) {
  const calls: { key: string; body: unknown }[] = []
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${input}`
    calls.push({ key, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined })
    if (!(key in routes)) return new Response(JSON.stringify({ detail: `Chưa mock ${key}` }), { status: 404 })
    const route = routes[key]
    if (route instanceof ErrorReply) return new Response(JSON.stringify({ detail: route.detail }), { status: route.status })
    return new Response(JSON.stringify(route), { status: 200 })
  })
  return calls
}

/** Phản hồi lỗi giả cho mockApi, vd. new ErrorReply(401,'Sai tên đăng nhập hoặc mật khẩu'). */
export class ErrorReply {
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    this.status = status
    this.detail = detail
  }
}

export function renderApp(ui: ReactElement, path = '/') {
  const client = createQueryClient({ retry: false })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}
