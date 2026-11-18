/** API trả thời gian dạng "YYYY-MM-DD HH:mm:ss" (giờ địa phương). */
export function parseTime(value: string): Date {
  return new Date(value.replace(' ', 'T'))
}

const pad = (n: number) => String(n).padStart(2, '0')

export function formatDate(value: string): string {
  const d = parseTime(value)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function formatClock(value: string): string {
  const d = parseTime(value)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "21/09/2026 14:55": ngày trước, giờ sau như các LMS thông dụng */
export function formatDateTime(value: string): string {
  return `${formatDate(value)} ${formatClock(value)}`
}

/** "Hôm nay, 14:55", "Hôm qua, 08:30" hoặc "21/09/2026 14:55" trong thẻ lịch sử. */
export function formatRelative(value: string, now = new Date()): string {
  const d = parseTime(value)
  if (d.toDateString() === now.toDateString()) return `Hôm nay, ${formatClock(value)}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `Hôm qua, ${formatClock(value)}`
  return formatDateTime(value)
}

/** Thông báo: "Vừa xong", "5 phút trước", "08:30", "Hôm qua"... */
export function formatAgo(value: string, now = new Date()): string {
  const d = parseTime(value)
  const minutes = Math.floor((now.getTime() - d.getTime()) / 60_000)
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  if (d.toDateString() === now.toDateString()) return formatClock(value)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Hôm qua'
  return formatDate(value)
}

export function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : String(Number(score.toFixed(2)))
}

/**
 * Mức của một bài kiểm tra, dùng 4 mức Tốt / Khá / Đạt / Chưa đạt như Thông tư 22/2021 (THCS):
 * 9 – 10 Tốt, 7 – 8.9 Khá, 5 – 6.9 Đạt, dưới 5 Chưa đạt. Giống câu score_bands trong sql/tong_quan.sql.
 */
export function gradeBand(score: number): string {
  if (score >= 9) return 'Tốt'
  if (score >= 7) return 'Khá'
  if (score >= 5) return 'Đạt'
  return 'Chưa đạt'
}

/** Màu điểm theo mức: Tốt, Khá xanh lá; Đạt vàng cam; Chưa đạt đỏ. */
export function scoreColor(score: number): string {
  if (score >= 7) return 'text-emerald-600'
  if (score >= 5) return 'text-amber-500'
  return 'text-red-500'
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const last = parts.at(-1) ?? ''
  const prev = parts.length > 1 ? (parts.at(-2) ?? '') : ''
  return (prev.charAt(0) + last.charAt(0)).toUpperCase()
}

export const levelLabel: Record<number, string> = {
  1: 'Cơ bản',
  2: 'Vận dụng',
  3: 'Vận dụng cao',
}

/** Năm học bắt đầu từ tháng 8: tháng 11/2026 thuộc năm học 2026 - 2027. */
export function academicYear(now = new Date()): string {
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  return `${start} - ${start + 1}`
}

/** Xếp loại hiển thị cho học sinh: giữ bốn mức của Thông tư 22, riêng mức "Chưa đạt" nói theo hướng động viên. */
export function studentGrade(score: number): string {
  const band = gradeBand(score)
  return band === 'Chưa đạt' ? 'Cố gắng thêm nhé' : band
}
