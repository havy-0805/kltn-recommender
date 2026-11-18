import type { Option, Question } from '../api/client'

/** Nội dung một phương án; câu phát âm thì gạch chân phần cần so sánh (vị trí lấy từ API, như đề giấy). */
export function OptionText({ question, opt }: { question: Pick<Question, 'options' | 'underline'>; opt: Option }) {
  const text = question.options[opt] ?? ''
  const range = question.underline?.[opt]
  if (!range) return <span>{text}</span>
  const [start, end] = range
  // Một span bao ngoài: nút phương án dùng flex, các mảnh chữ rời sẽ bị giãn cách
  return (
    <span>
      {text.slice(0, start)}
      <u className="decoration-2 underline-offset-4">{text.slice(start, end)}</u>
      {text.slice(end)}
    </span>
  )
}
