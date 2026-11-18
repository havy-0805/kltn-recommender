import { formatAgo, formatDateTime, formatRelative, formatScore, gradeBand, initials } from './format'

describe('format', () => {
  it('định dạng thời gian như thiết kế', () => {
    expect(formatDateTime('2026-09-21 14:55:00')).toBe('21/09/2026 14:55')
    expect(formatRelative('2026-08-10 16:20:00', new Date('2026-10-24T10:00:00'))).toBe('10/08/2026 16:20')
    expect(formatRelative('2026-10-24 08:05:00', new Date('2026-10-24T10:00:00'))).toBe('Hôm nay, 08:05')
  })

  it('hiển thị thời gian tương đối cho thông báo', () => {
    const now = new Date('2026-10-24T10:00:00')
    expect(formatAgo('2026-10-24 09:59:40', now)).toBe('Vừa xong')
    expect(formatAgo('2026-10-24 09:45:00', now)).toBe('15 phút trước')
    expect(formatAgo('2026-10-24 08:30:00', now)).toBe('08:30')
    expect(formatAgo('2026-10-23 20:00:00', now)).toBe('Hôm qua')
  })

  it('rút gọn điểm và xếp loại', () => {
    expect(formatScore(8.5)).toBe('8.5')
    expect(formatScore(7.75)).toBe('7.75')
    expect(formatScore(10)).toBe('10')
    expect(gradeBand(8.5)).toBe('Khá')
    expect(gradeBand(9)).toBe('Tốt')
    expect(gradeBand(6.9)).toBe('Đạt')
    expect(gradeBand(4.75)).toBe('Chưa đạt')
  })

  it('lấy chữ viết tắt từ họ tên', () => {
    expect(initials('Nguyễn Hà Nhi')).toBe('HN')
    expect(initials('Minh')).toBe('M')
  })
})
