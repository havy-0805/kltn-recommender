/** Từ / cụm từ mà câu hỏi đọc hiểu hỏi nghĩa, vd. The word "punctuality" in paragraph 2 is CLOSEST in meaning to. */
export type WordTarget = { term: string; paragraph: number | 'last' | null }
export type Segment = { text: string; mark: boolean }

const TARGET = /\b(?:word|phrase)\s*["“‘']([^"”’']+)["”’']/i
const PARA_NUM = /\bparagraph\s+(\d+)/i
const PARA_ORD = /\bthe\s+(first|second|third|fourth|fifth|last)\s+paragraph\b/i
const ORDINAL: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 }

export function wordTarget(question: string): WordTarget | null {
  const m = TARGET.exec(question)
  if (!m?.[1]) return null
  const num = PARA_NUM.exec(question)?.[1]
  const ord = PARA_ORD.exec(question)?.[1]?.toLowerCase()
  const paragraph = num ? Number(num) : ord === 'last' ? 'last' : ord ? (ORDINAL[ord] ?? null) : null
  return { term: m[1].trim(), paragraph }
}

type Range = { start: number; end: number }

/** Các đoạn của bài đọc (mỗi dòng không trống là một đoạn); dòng đầu ngắn, không có dấu kết câu là tiêu đề, không tính. */
function paragraphs(text: string): Range[] {
  const lines: Range[] = []
  let start = 0
  for (const line of text.split('\n')) {
    if (line.trim()) lines.push({ start, end: start + line.length })
    start += line.length + 1
  }
  const first = lines[0] && text.slice(lines[0].start, lines[0].end).trim()
  if (lines.length > 1 && first && first.length < 80 && !/[.!?:"”]$/.test(first)) lines.shift()
  return lines
}

function find(text: string, pattern: string): Range[] {
  return [...text.matchAll(new RegExp(`(?<!\\p{L})(?:${pattern})(?!\\p{L})`, 'giu'))].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }))
}

/** Khớp nguyên từ; không thấy thì khớp dạng biến đổi (đề G902_Q35 hỏi "expand", bài đọc viết "expanding"). */
function matches(text: string, term: string): Range[] {
  const p = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  const exact = find(text, p)
  if (exact.length || /\s/.test(term)) return exact
  return find(text, `${p}(?:s|es|d|ed|ing)${term.endsWith('e') ? `|${p.slice(0, -1)}ing` : ''}`)
}

/** Tách bài đọc thành các đoạn chữ, đánh dấu từ được hỏi; ưu tiên đúng đoạn câu hỏi nêu, không thấy thì đánh dấu cả bài. */
export function markTerms(text: string, targets: WordTarget[]): Segment[] {
  const paras = paragraphs(text)
  const marks: Range[] = []
  for (const t of targets) {
    const all = matches(text, t.term)
    const para = t.paragraph === 'last' ? paras.at(-1) : t.paragraph ? paras[t.paragraph - 1] : undefined
    const inPara = para ? all.filter((m) => m.start >= para.start && m.end <= para.end) : []
    marks.push(...(inPara.length ? inPara : all))
  }
  marks.sort((a, b) => a.start - b.start)
  const out: Segment[] = []
  let pos = 0
  for (const m of marks) {
    if (m.start < pos) continue
    if (m.start > pos) out.push({ text: text.slice(pos, m.start), mark: false })
    out.push({ text: text.slice(m.start, m.end), mark: true })
    pos = m.end
  }
  if (pos < text.length) out.push({ text: text.slice(pos), mark: false })
  return out
}
