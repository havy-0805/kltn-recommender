import { markTerms, wordTarget } from './passage'

const marked = (text: string, question: string) =>
  markTerms(text, [wordTarget(question)!])
    .map((s) => (s.mark ? `[${s.text}]` : s.text))
    .join('')

describe('in đậm từ được hỏi trong bài đọc', () => {
  it('nhận từ và vị trí đoạn từ đề bài', () => {
    expect(wordTarget('The word "punctuality" in paragraph 2 is CLOSEST in meaning to ______')).toEqual({
      term: 'punctuality',
      paragraph: 2,
    })
    expect(wordTarget('The word "simpler" in the first paragraph is CLOSEST in meaning to _____.')?.paragraph).toBe(1)
    expect(wordTarget('The phrase “in the first place” in the last paragraph is closest in meaning to')).toEqual({
      term: 'in the first place',
      paragraph: 'last',
    })
    expect(wordTarget('The word "expand" in the passage is OPPOSITE in meaning to ______')?.paragraph).toBeNull()
    expect(wordTarget('Mark the word whose underlined part differs from the other three in pronunciation.')).toBeNull()
    expect(wordTarget('Choose the phrase/sentence that best fits blank (37).')).toBeNull()
  })

  it('chỉ đánh dấu ở đoạn câu hỏi nêu, bỏ qua dòng tiêu đề', () => {
    const text = 'City Life\nThey like it. They stay.\nIn Tokyo they ride trains.'
    expect(marked(text, 'The word “they” in paragraph 2 refers to ______.')).toBe(
      'City Life\nThey like it. They stay.\nIn Tokyo [they] ride trains.',
    )
  })

  it('khớp nguyên từ, không phân biệt hoa thường; không thấy ở đoạn nêu thì đánh dấu cả bài', () => {
    expect(marked('Punctuality matters. We expanded, then expand.', 'The word "expand" in paragraph 3 is'))
      .toBe('Punctuality matters. We expanded, then [expand].')
    expect(marked('Punctuality matters.', 'The word "punctuality" in the passage')).toBe('[Punctuality] matters.')
    expect(marked('Investments in expanding transport.', 'The word "expand" in the passage')).toBe(
      'Investments in [expanding] transport.',
    )
  })
})
