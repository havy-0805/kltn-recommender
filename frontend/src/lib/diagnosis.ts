import type { Attempt, Diagnosis, Recommendation, WeakSkill } from '../api/client'
import type { BadgeTone } from '../components/ui'
import { gradeBand, levelLabel } from './format'

/** Nhãn gap_type do engine sinh ra (BR-REC-04) -> màu hiển thị. */
const GAP_TONES: Record<string, BadgeTone> = {
  'Hổng kiến thức nền': 'danger',
  'Mức độ vận dụng yếu': 'warningOutline',
  'Sai sót kiến thức nền (Cục bộ)': 'warning',
  'Cải thiện mức vận dụng cao': 'warning',
  'Học sinh đạt mức độ thành thạo': 'success',
  'Luyện củng cố': 'brand',
  'Nên ôn thêm': 'neutral',
}

export function gapTone(gapType: string): BadgeTone {
  return GAP_TONES[gapType] ?? 'neutral'
}

/** Nhãn mức độ dễ hiểu cho học sinh, phụ huynh (engine giữ nguyên nhãn gốc trong lý do và báo cáo thẩm định). */
const GAP_LABELS: Record<string, string> = {
  'Hổng kiến thức nền': 'Cần ôn lại từ cơ bản',
  'Mức độ vận dụng yếu': 'Cần luyện thêm câu vận dụng',
  'Sai sót kiến thức nền (Cục bộ)': 'Còn sơ suất ở câu cơ bản',
  'Cải thiện mức vận dụng cao': 'Luyện thêm câu khó',
  'Học sinh đạt mức độ thành thạo': 'Đã thành thạo',
  'Luyện củng cố': 'Luyện củng cố',
  'Nên ôn thêm': 'Nên ôn thêm',
}

export const gapLabel = (gapType: string) => GAP_LABELS[gapType] ?? gapType

export type Ratio = { wrong: number; total: number }

/** "2/3 (67%)" hoặc "1/2" -> { wrong: 2, total: 3 } */
export function parseRatio(stats: string): Ratio {
  const [wrong = 0, total = 0] = stats.split(' ')[0]!.split('/').map(Number)
  return { wrong, total }
}

export function errorPercent(skill: Pick<WeakSkill, 'error_stats'>): number {
  const { wrong, total } = parseRatio(skill.error_stats)
  return total ? Math.round((wrong / total) * 100) : 0
}

export function wrongSummary(skill: Pick<WeakSkill, 'error_stats'>): string {
  const { wrong, total } = parseRatio(skill.error_stats)
  return `Bạn chưa làm đúng ${wrong}/${total} câu`
}

export function easySummary(skill: Pick<WeakSkill, 'easy_stats'>): string {
  const { wrong, total } = parseRatio(skill.easy_stats)
  if (total === 0) return 'Không có câu cơ bản'
  if (wrong === 0) return 'Không sai câu cơ bản nào'
  return `Chưa đúng ${wrong}/${total} câu cơ bản`
}

const questionList = (nos: number[]) => (nos.length ? ` (câu ${nos.join(', ')})` : '')

/** Câu "Vì sao nên học" trên thẻ học liệu của học sinh: ngắn, không dùng thuật ngữ của luật (bản đầy đủ ở phía giáo viên). */
export function studentReason(rec: Recommendation): string {
  const { wrong, total } = parseRatio(rec.error_stats)
  const easy = parseRatio(rec.easy_stats)
  const nos = questionList(rec.wrong_question_nos)
  // Học liệu bồi dưỡng (học sinh đã thành thạo) và luyện củng cố: khen trước, nêu câu còn chưa đúng nếu có
  if (rec.gap_type === 'Học sinh đạt mức độ thành thạo')
    return wrong
      ? `Bạn làm bài rất tốt! Học liệu nâng cao giúp bạn chắc thêm phần này (còn ${wrong}/${total} câu chưa đúng${rec.wrong_question_nos.length ? `, câu ${rec.wrong_question_nos.join(', ')}` : ''}).`
      : 'Bạn làm bài rất tốt! Học liệu nâng cao giúp bạn hướng tới điểm 9–10.'
  if (rec.gap_type === 'Luyện củng cố')
    return `Phần này bạn chỉ còn ${wrong}/${total} câu chưa đúng${nos}. Ôn lại một chút là chắc điểm hơn.`
  const parts = [`Bạn chưa làm đúng ${wrong}/${total} câu${questionList(rec.wrong_question_nos)} ở phần này.`]
  // BR-REC-07: mới sai 1 câu nên chưa kết luận là điểm yếu, chỉ gợi ý ôn thêm
  if (rec.tentative) parts.push('Bạn mới chưa đúng 1 câu nên đây chưa phải phần yếu, ôn thêm một chút cho chắc.')
  // Cộng dồn bằng chứng: bài này mới sai 1 câu nhưng bài trước cũng sai phần này
  if (rec.previous_wrong_nos?.length)
    parts.push(
      (rec.previous_wrong_times ?? 1) >= 2
        ? `Bạn đã chưa đúng phần này ở ${rec.previous_wrong_times} bài làm liên tiếp trước đó, nên cần ôn lại cho chắc.`
        : `Bài trước bạn cũng chưa đúng phần này${questionList(rec.previous_wrong_nos)}, nên cần ôn lại cho chắc.`,
    )
  if (easy.wrong > 0)
    parts.push(
      rec.material_actual_level === 1
        ? 'Có câu cơ bản chưa đúng nên học liệu bắt đầu từ kiến thức nền.'
        : 'Có câu cơ bản chưa đúng, học liệu giúp rà lại các bẫy thường gặp.',
    )
  if (rec.matched_error_types.length) parts.push(`Học liệu luyện đúng dạng bạn sai: ${rec.matched_error_types.join(', ')}.`)
  return parts.join(' ')
}

/** Thẻ học liệu: nhãn thứ hạng ưu tiên theo vị trí trong Top-K. */
export function priorityBadge(rank: number, tentative = false): { label: string; tone: BadgeTone } {
  if (tentative) return { label: `#${rank} Nên ôn thêm`, tone: 'neutral' }
  if (rank === 1) return { label: '#1 Học trước', tone: 'brand' }
  if (rank === 2) return { label: '#2 Học tiếp theo', tone: 'brand' }
  return { label: `#${rank} Luyện thêm`, tone: 'brand' }
}

/**
 * Nhóm kiến thức học sinh đã vững: từ 80% và có ít nhất 2 câu (cùng ngưỡng màu xanh của PassRateList).
 * Bỏ nhóm đang bị chẩn đoán yếu ở dạng gộp (scope = group, mã trùng mã nhóm) để không vừa khen vừa nhắc cùng một tên.
 */
export const strongGroups = (diagnosis: Diagnosis) =>
  diagnosis.group_stats.filter(
    (g) => g.total_q >= 2 && g.pass_rate >= 0.8 && !diagnosis.weak_skills.some((s) => s.scope === 'group' && s.skill_id === g.id),
  )

/** Lời nhắn đầu trang kết quả cho học sinh: nói phần đã vững trước, rồi mới đến phần cần luyện. */
export function advisorMessage(diagnosis: Diagnosis, firstName: string): string {
  const strong = strongGroups(diagnosis)
  const praise = strong.length ? `Bạn đã vững ${strong.length} nhóm kiến thức: ${strong.map((g) => g.name).join('; ')}. ` : ''
  switch (diagnosis.status) {
    case 'MASTERY':
      return `Chúc mừng ${firstName}! Bạn đã nắm vững các phần trong bài này. Thử sức với học liệu nâng cao để hướng tới điểm 9–10 nhé!`
    case 'NO_WEAK_SKILL':
      return `Chào ${firstName}! ${praise}Bạn không có phần nào sai nhiều. Ôn lại vài câu còn chưa đúng là chắc điểm hơn nhé!`
    case 'NO_DATA':
      return 'Bài làm này chưa có kết quả từng câu nên chưa phân tích được.'
    default: {
      const focus = diagnosis.weak_skills.filter((s) => s.in_top_k).length
      // Không dồn con số lớn vào câu mở đầu: chỉ nhấn vào vài phần ưu tiên, phần còn lại để sau
      const rest = diagnosis.total_weak_detected - focus
      return (
        `Chào ${firstName}! ${praise}` +
        `Bắt đầu với ${focus} phần nên luyện trước ở bên dưới nhé.` +
        (rest > 0 ? ` Vững các phần này rồi, bạn luyện tiếp ${rest} phần còn lại.` : '')
      )
    }
  }
}

export function firstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts.slice(-2).join(' ')
}

/** "KHÁ - GIỎI (9 - NHÓM 2)" trên thẻ học sinh của giáo viên. */
export const bandLabel = (a: Attempt) => `${gradeBand(a.total_score)} (${a.student.class_name})`.toUpperCase()

/** Tóm tắt số điểm yếu theo từng mức độ, vd. '2 điểm yếu "Cần ôn lại từ cơ bản", 1 điểm yếu "Luyện thêm câu khó"'. */
export function gapBreakdown(skills: Pick<WeakSkill, 'gap_type'>[]): string {
  const counts = new Map<string, number>()
  for (const s of skills) counts.set(s.gap_type, (counts.get(s.gap_type) ?? 0) + 1)
  return [...counts].map(([gap, n]) => `${n} điểm yếu "${gapLabel(gap)}"`).join(', ')
}

/**
 * Lý do gán học liệu của engine viết lại cho giáo viên dễ đọc: bỏ mã luật, "Level 2" thành "mức Vận dụng",
 * ký hiệu so sánh thành lời ("điểm 3.5 < 5.0 nên ôn nền tảng → Level 1" thành "điểm 3.5 dưới 5 nên ôn nền tảng, chọn mức Cơ bản").
 */
export function plainReason(reason: string): string {
  return reason
    .replace(/\s*\(BR-[^)]+\)/g, '')
    .replace(/ < 5\.0/g, ' dưới 5')
    .replace(/ ≥ 8\.0/g, ' từ 8 trở lên')
    .replace(/trong khoảng 5\.0–7\.75/g, 'từ 5 đến dưới 8')
    .replace(/ → Level/g, ', chọn Level')
    .replace(/Level (\d)/g, (_, n: string) => `mức ${levelLabel[Number(n)] ?? n}`)
}

/** Các chuyên đề 1 câu được gộp vào điểm yếu dạng nhóm (engine ghi ở cuối lý do chẩn đoán). */
export function mergedTopics(skill: Pick<WeakSkill, 'scope' | 'reason'>): string | undefined {
  if (skill.scope !== 'group') return undefined
  return /chỉ có 1 câu: ([^.]+)/.exec(skill.reason)?.[1]
}

/** Tên hiển thị của điểm yếu: nhóm gộp thì nêu các chuyên đề thành phần, để không trùng tên với thanh tỷ lệ của cả nhóm. */
export function unitName(skill: Pick<WeakSkill, 'scope' | 'reason' | 'skill_name'>): string {
  return mergedTopics(skill)?.split(', ').join(' và ') ?? skill.skill_name
}

/** Một dòng tóm tắt cho giáo viên: "3/3 câu sai hoặc bỏ trống · câu 21, 33, 34 · sai 2/2 câu cơ bản". */
export function wrongDetail(skill: Pick<WeakSkill, 'error_stats' | 'easy_stats' | 'wrong_question_nos'>): string {
  const { wrong, total } = parseRatio(skill.error_stats)
  const easy = parseRatio(skill.easy_stats)
  const parts = [`${wrong}/${total} câu sai hoặc bỏ trống`]
  if (skill.wrong_question_nos.length) parts.push(`câu ${skill.wrong_question_nos.join(', ')}`)
  if (easy.wrong > 0) parts.push(`sai ${easy.wrong}/${easy.total} câu cơ bản`)
  return parts.join(' · ')
}
