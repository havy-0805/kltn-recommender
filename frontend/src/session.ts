import { createContext, use } from 'react'
import type { Student } from './api/client'

/**
 * Học sinh của khu vực /student, do StudentArea cung cấp sau khi RequireRole đã xác thực.
 * Trang con đọc từ đây thay vì từ query `me`: khi phiên hết hạn, `me` thành null trước lúc
 * RequireRole kịp chuyển trang, nhưng context vẫn giữ học sinh hợp lệ cuối cùng.
 */
export const StudentContext = createContext<Student | null>(null)

export function useStudentId(): string {
  const student = use(StudentContext)
  if (!student) throw new Error('useStudentId chỉ dùng bên trong khu vực học sinh')
  return student.student_id
}
