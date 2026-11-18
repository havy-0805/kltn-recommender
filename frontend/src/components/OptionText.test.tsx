import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { Question } from '../api/client'
import { OptionText } from './OptionText'

it('câu phát âm gạch chân đúng phần cần so sánh, câu thường giữ nguyên', () => {
  const q = {
    options: { A: 'access', B: 'paradise', C: 'package', D: 'variety' },
    underline: { A: [0, 1], B: [1, 2], C: [1, 2], D: [1, 2] },
  } satisfies Pick<Question, 'options' | 'underline'>
  const { container } = render(<OptionText question={q} opt="B" />)
  expect(container.textContent).toBe('paradise')
  expect(container.querySelector('u')?.textContent).toBe('a')

  const plain = render(<OptionText question={{ options: q.options, underline: null }} opt="A" />)
  expect(plain.container.querySelector('u')).toBeNull()
})
