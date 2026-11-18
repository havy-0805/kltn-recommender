import type { Attempt, Role } from '../api/client'

export const ROLE_HOME: Record<Role, string> = { student: '/student', teacher: '/teacher' }

/** Lượt đã chẩn đoán mở báo cáo lưu trữ; lượt chưa chẩn đoán mở màn chạy chẩn đoán. */
export const studentAttemptLink = (a: Attempt) =>
  a.diagnosed ? `/student/history/${a.attempt_id}` : `/student/attempts/${a.attempt_id}/diagnosis`
