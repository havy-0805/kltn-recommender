import type { Recommendation } from '../api/client'
import {
  easySummary,
  errorPercent,
  firstName,
  gapTone,
  mergedTopics,
  parseRatio,
  plainReason,
  priorityBadge,
  studentReason,
  wrongDetail,
} from './diagnosis'

const rec = (over: Partial<Recommendation> = {}): Recommendation => ({
  skill_id: 'SK_PHON_PRON',
  skill_name: 'Phát âm',
  category: 'Ngữ âm',
  gap_type: 'Hổng kiến thức nền',
  error_stats: '2/3 (67%)',
  easy_stats: '1/2',
  priority_score: 7.5,
  assigned_target_level: 1,
  wrong_question_nos: [21, 33],
  scope: 'topic',
  member_topics: ['SK_PHON_PRON'],
  material_id: 'MAT_CD01',
  material_title: 'Chuyên đề Phát âm',
  material_actual_level: 1,
  material_skill_id: 'SK_PHON_PRON',
  matched_error_types: [],
  tentative: false,
  previous_wrong_times: 0,
  reason: 'Sai 2/3 (67%) ở các câu 21, 33',
  ...over,
})

describe('diagnosis helpers', () => {
  it('tách chuỗi thống kê của engine', () => {
    expect(parseRatio('2/3 (67%)')).toEqual({ wrong: 2, total: 3 })
    expect(parseRatio('0/0')).toEqual({ wrong: 0, total: 0 })
    expect(errorPercent({ error_stats: '1/3 (33%)' })).toBe(33)
  })

  it('mô tả câu cơ bản', () => {
    expect(easySummary({ easy_stats: '0/2' })).toBe('Không sai câu cơ bản nào')
    expect(easySummary({ easy_stats: '1/2' })).toBe('Chưa đúng 1/2 câu cơ bản')
    expect(easySummary({ easy_stats: '0/0' })).toBe('Không có câu cơ bản')
  })

  it('lý do đề xuất cho học sinh: ngắn, nêu câu sai, nhắc ôn nền khi sai câu dễ', () => {
    expect(studentReason(rec())).toBe(
      'Bạn chưa làm đúng 2/3 câu (câu 21, 33) ở phần này. Có câu cơ bản chưa đúng nên học liệu bắt đầu từ kiến thức nền.',
    )
    expect(studentReason(rec({ easy_stats: '0/0', wrong_question_nos: [] }))).toBe('Bạn chưa làm đúng 2/3 câu ở phần này.')
    expect(studentReason(rec({ scope: 'group' }))).not.toContain('gộp')
    expect(studentReason(rec({ matched_error_types: ['Phát âm đuôi -ed'] }))).toContain(
      'Học liệu luyện đúng dạng bạn sai: Phát âm đuôi -ed.',
    )
  })

  it('học liệu bồi dưỡng, củng cố: khen trước, không hiện "0/0 câu"', () => {
    const mastery = rec({ gap_type: 'Học sinh đạt mức độ thành thạo', error_stats: '1/3 (33%)', wrong_question_nos: [33] })
    expect(studentReason(mastery)).toBe(
      'Bạn làm bài rất tốt! Học liệu nâng cao giúp bạn chắc thêm phần này (còn 1/3 câu chưa đúng, câu 33).',
    )
    expect(
      studentReason(rec({ gap_type: 'Học sinh đạt mức độ thành thạo', error_stats: '0/0 (0%)', wrong_question_nos: [] })),
    ).toBe('Bạn làm bài rất tốt! Học liệu nâng cao giúp bạn hướng tới điểm 9–10.')
    expect(studentReason(rec({ gap_type: 'Luyện củng cố', error_stats: '1/3 (33%)', wrong_question_nos: [7] }))).toContain(
      'chỉ còn 1/3 câu chưa đúng (câu 7)',
    )
  })

  it('học liệu "nên ôn thêm" (BR-REC-07): nhãn riêng, lý do nói rõ chưa chắc là phần yếu', () => {
    const t = rec({ tentative: true, gap_type: 'Nên ôn thêm', error_stats: '1/2 (50%)', easy_stats: '0/1' })
    expect(studentReason(t)).toContain('Bạn mới chưa đúng 1 câu nên đây chưa phải phần yếu')
    expect(studentReason(rec())).not.toContain('chưa phải phần yếu')
    expect(priorityBadge(3, true)).toEqual({ label: '#3 Nên ôn thêm', tone: 'neutral' })
    expect(priorityBadge(1)).toEqual({ label: '#1 Học trước', tone: 'brand' })
  })

  it('bài này mới sai 1 câu nhưng bài trước cũng sai phần này: nói rõ để học sinh biết vì sao cần ôn', () => {
    const r = rec({ error_stats: '1/2 (50%)', wrong_question_nos: [5], previous_wrong_nos: [3, 12] })
    expect(studentReason(r)).toContain('Bài trước bạn cũng chưa đúng phần này (câu 3, 12)')
    expect(studentReason(rec())).not.toContain('Bài trước')
    const lap = rec({ error_stats: '1/2 (50%)', previous_wrong_nos: [7], previous_wrong_times: 3 })
    expect(studentReason(lap)).toContain('chưa đúng phần này ở 3 bài làm liên tiếp trước đó')
  })

  it('màu nhãn theo gap_type, nhãn lạ dùng màu trung tính', () => {
    expect(gapTone('Hổng kiến thức nền')).toBe('danger')
    expect(gapTone('Cải thiện mức vận dụng cao')).toBe('warning')
    expect(gapTone('Nhãn mới')).toBe('neutral')
  })

  it('nhãn ưu tiên và tên gọi', () => {
    expect(priorityBadge(1).label).toBe('#1 Học trước')
    expect(priorityBadge(3).label).toBe('#3 Luyện thêm')
    expect(firstName('Nguyễn Hà Nhi')).toBe('Hà Nhi')
  })
})

describe('lời lẽ cho giáo viên', () => {
  it('plainReason bỏ mã luật, đổi Level thành tên mức, ký hiệu so sánh thành lời', () => {
    expect(plainReason('Cấp độ: điểm 3.5 < 5.0 nên ôn nền tảng → Level 1.')).toBe(
      'Cấp độ: điểm 3.5 dưới 5 nên ôn nền tảng, chọn mức Cơ bản.',
    )
    expect(
      plainReason(
        'Cấp độ: điểm 7.25 trong khoảng 5.0–7.75 → Level 1; học liệu Level 1 không dạy dạng lỗi này nên chọn Level 2 có dạy (BR-REC-05b).',
      ),
    ).toBe(
      'Cấp độ: điểm 7.25 từ 5 đến dưới 8, chọn mức Cơ bản; học liệu mức Cơ bản không dạy dạng lỗi này nên chọn mức Vận dụng có dạy.',
    )
  })

  it('wrongDetail và mergedTopics', () => {
    const skill = {
      error_stats: '2/2 (100%)',
      easy_stats: '1/1',
      wrong_question_nos: [14, 24],
      scope: 'group' as const,
      reason:
        'Sai 2/2 (100%) ở các câu 14, 24; sai 1/1 câu cơ bản; gộp nhóm vì mỗi chuyên đề chỉ có 1 câu: Trạng từ chỉ tần suất, Dạng của động từ',
    }
    expect(wrongDetail(skill)).toBe('2/2 câu sai hoặc bỏ trống · câu 14, 24 · sai 1/1 câu cơ bản')
    expect(mergedTopics(skill)).toBe('Trạng từ chỉ tần suất, Dạng của động từ')
    expect(mergedTopics({ ...skill, scope: 'topic' })).toBeUndefined()
  })
})
