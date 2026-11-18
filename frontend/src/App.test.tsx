import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { ErrorReply, ME_STUDENT, ME_TEACHER, mockApi, renderApp } from './test/render'

const NOT_LOGGED_IN = null
const EMPTY_STUDENT_HOME = { 'GET /api/attempts?student_id=STU00006': [] }

afterEach(() => vi.unstubAllGlobals())

async function fillLogin(username: string, password: string) {
  await userEvent.type(await screen.findByLabelText(/Mã học sinh|Tên đăng nhập/), username)
  await userEvent.type(screen.getByLabelText('Mật khẩu'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
}

describe('đăng nhập', () => {
  it('chọn vai trò học sinh rồi đăng nhập bằng mã học sinh', async () => {
    const calls = mockApi({
      'GET /api/auth/me': NOT_LOGGED_IN,
      'POST /api/auth/login': ME_STUDENT,
      ...EMPTY_STUDENT_HOME,
    })
    renderApp(<App />)

    await userEvent.click(await screen.findByRole('link', { name: /Học sinh/ }))
    expect(screen.getByRole('heading', { name: 'Đăng nhập học sinh' })).toBeInTheDocument()
    await fillLogin('STU00006', '123456')

    expect(await screen.findByText('Lớp 9 - Nhóm 2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('aria-current', 'page')
    expect(calls.find((c) => c.key === 'POST /api/auth/login')?.body).toEqual({
      role: 'student',
      username: 'STU00006',
      password: '123456',
    })
  })

  it('sai mật khẩu thì báo lỗi và ở lại trang đăng nhập', async () => {
    mockApi({
      'GET /api/auth/me': NOT_LOGGED_IN,
      'POST /api/auth/login': new ErrorReply(401, 'Sai tên đăng nhập hoặc mật khẩu'),
    })
    renderApp(<App />, '/login/teacher')

    await fillLogin('gv.khoi9', 'sai')
    expect(await screen.findByRole('alert')).toHaveTextContent('Sai tên đăng nhập hoặc mật khẩu')
    expect(screen.getByRole('heading', { name: 'Đăng nhập giáo viên' })).toBeInTheDocument()
  })

  it('mở trang cần đăng nhập thì chuyển tới đăng nhập, xong quay lại đúng trang đó', async () => {
    mockApi({
      'GET /api/auth/me': NOT_LOGGED_IN,
      'POST /api/auth/login': ME_STUDENT,
      ...EMPTY_STUDENT_HOME,
    })
    renderApp(<App />, '/student/history')

    await fillLogin('STU00006', '123456')
    expect(await screen.findByRole('heading', { name: 'Lịch sử học tập' })).toBeInTheDocument()
  })

  it('giáo viên mở khu vực học sinh thì về khu vực giáo viên', async () => {
    mockApi({ 'GET /api/auth/me': ME_TEACHER, 'GET /api/notifications': [], 'GET /api/classes': [] })
    renderApp(<App />, '/student')
    expect(await screen.findByRole('heading', { name: 'Tổng quan lớp' })).toBeInTheDocument()
  })

  it('đăng xuất thì về màn chọn vai trò', async () => {
    mockApi({ 'GET /api/auth/me': ME_STUDENT, 'POST /api/auth/logout': null, ...EMPTY_STUDENT_HOME })
    renderApp(<App />, '/student')

    await userEvent.click(await screen.findByRole('button', { name: /Nguyễn Hà Nhi/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }))
    expect(await screen.findByText('Bạn đăng nhập với vai trò nào?')).toBeInTheDocument()
  })

  it('phiên hết hạn giữa chừng (API trả 401) thì quay về trang đăng nhập', async () => {
    mockApi({
      'GET /api/auth/me': ME_STUDENT,
      'GET /api/attempts?student_id=STU00006': new ErrorReply(401, 'Bạn chưa đăng nhập hoặc phiên đã hết hạn'),
    })
    renderApp(<App />, '/student')
    expect(await screen.findByRole('heading', { name: 'Đăng nhập học sinh' })).toBeInTheDocument()
  })
})
