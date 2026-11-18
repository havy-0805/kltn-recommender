import type { Question } from '../api/client'

/** Hình biển báo hoặc tờ thông báo đi kèm câu hỏi (thay cho ảnh trong đề giấy). */
export function QuestionMedia({ media }: { media: Question['media'] }) {
  if (!media) return null
  if (media.kind === 'sign' && media.src)
    return (
      <figure className="flex justify-center">
        <img src={media.src} alt={media.alt} className="size-40" />
      </figure>
    )
  return (
    <figure aria-label={media.alt} className="flex justify-center">
      <p className="max-w-md border-2 border-slate-800 bg-white px-6 py-4 text-center text-[15px] font-medium whitespace-pre-line text-slate-900 italic">
        {media.text}
      </p>
    </figure>
  )
}
