import { markTerms, wordTarget, type WordTarget } from '../lib/passage'

/** Bài đọc, in đậm từ mà các câu hỏi đang hỏi nghĩa (The word "..." in paragraph ...). */
export function PassageText({ text, questions, className }: { text: string; questions: string[]; className?: string }) {
  const targets = questions.map(wordTarget).filter((t): t is WordTarget => t !== null)
  return (
    <p className={className}>
      {markTerms(text, targets).map((s, i) =>
        s.mark ? (
          <strong key={i} className="font-bold text-slate-900">
            {s.text}
          </strong>
        ) : (
          s.text
        ),
      )}
    </p>
  )
}
