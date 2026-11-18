import { clsx } from 'clsx'
import { Printer } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { useAttempt, useAttempts, useDiagnosis, type Attempt, type Diagnosis } from '../../api/client'
import { TeacherCrumbs } from '../../components/teacher'
import { Button, ErrorState, LinkButton, LoadingState } from '../../components/ui'
import { useTopK, viewQuery } from '../../hooks/useTopK'
import { parseRatio, strongGroups, unitName } from '../../lib/diagnosis'
import { formatDate, formatScore, gradeBand, levelLabel } from '../../lib/format'

/**
 * Phiếu kết quả chẩn đoán gửi phụ huynh và học sinh, vừa 1 trang A4.
 * Theo khung feed up / feed back / feed forward (Hattie & Timperley, 2007): kết quả chung, điểm mạnh trước,
 * phần cần luyện, rồi kế hoạch học tiếp. Không dùng mã kỹ năng, mã luật hay "Level" như trang của giáo viên.
 */
export function ReportPage() {
  const { attemptId } = useParams()
  const [topK] = useTopK()
  const attempt = useAttempt(attemptId)
  const diagnosis = useDiagnosis(attemptId, topK)
  const [printedAt] = useState(() => new Date().toISOString())
  const [comment, setComment] = useComment(attemptId)
  const history = useAttempts({ studentId: attempt.data?.student.student_id }, !!attempt.data)

  if (attempt.isPending || diagnosis.isPending) return <LoadingState />
  if (attempt.isError) return <ErrorState error={attempt.error} onRetry={() => attempt.refetch()} />
  if (diagnosis.isError) return <ErrorState error={diagnosis.error} onRetry={() => diagnosis.refetch()} />

  const a = attempt.data
  // Bài làm ngay trước bài này (nếu có) để thể hiện tiến bộ
  const previous = (history.data ?? [])
    .filter((h) => h.submitted_at < a.submitted_at)
    .sort((x, y) => y.submitted_at.localeCompare(x.submitted_at))[0]

  return (
    <div className="space-y-6">
      <div className="space-y-4 print:hidden">
        <TeacherCrumbs attempt={a} current="Phiếu kết quả" />
        <div className="flex flex-wrap items-center gap-4">
          <Button size="lg" icon={Printer} onClick={() => window.print()}>
            In phiếu
          </Button>
          <LinkButton to={`/teacher/attempts/${a.attempt_id}/diagnosis${viewQuery(topK)}`} variant="outline" size="lg">
            Quay lại chẩn đoán
          </LinkButton>
          <p className="text-[13px] text-slate-500">Phiếu dành cho phụ huynh và học sinh, vừa 1 trang A4.</p>
        </div>
        <label className="block max-w-[794px] space-y-1">
          <span className="text-[13px] font-semibold text-slate-700">
            Nhận xét của giáo viên (không bắt buộc, in ở mục 5; để trống thì in dòng kẻ để viết tay)
          </span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={COMMENT_MAX}
            rows={3}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
          <span className="block text-right text-xs text-slate-500">
            {comment.length}/{COMMENT_MAX} ký tự
          </span>
        </label>
      </div>
      <ReportSheet attempt={a} diagnosis={diagnosis.data} previous={previous} printedAt={printedAt} comment={comment} />
    </div>
  )
}

/** Giới hạn để phiếu vẫn vừa 1 trang A4 */
const COMMENT_MAX = 300

/** Nhận xét gõ trên máy, giữ trong trình duyệt theo từng bài làm để in lại không phải gõ lại. */
function useComment(attemptId: string | undefined) {
  const key = `kltn.report.comment.${attemptId}`
  const [comment, setComment] = useState(() => {
    try {
      return localStorage.getItem(key) ?? ''
    } catch {
      return ''
    }
  })
  useEffect(() => {
    try {
      if (comment) localStorage.setItem(key, comment)
      else localStorage.removeItem(key)
    } catch {
      // Không lưu được thì vẫn in được trong phiên hiện tại
    }
  }, [key, comment])
  return [comment, setComment] as const
}

const PARENT_TIPS = [
  'Hỏi con phần nào trong bài thấy khó nhất và vì sao.',
  'Cùng con lên lịch học các học liệu theo thứ tự ở mục 4, mỗi tuần 1–2 phần.',
  'Liên hệ giáo viên khi con gặp khó lúc tự học.',
]

export function ReportSheet({
  attempt: a,
  diagnosis: d,
  previous,
  printedAt,
  comment = '',
}: {
  attempt: Attempt
  diagnosis: Diagnosis
  previous?: Attempt
  printedAt: string
  comment?: string
}) {
  const strong = strongGroups(d)
  const weakGroups = new Set(d.weak_skills.filter((s) => s.scope === 'group').map((s) => s.skill_id))
  // Chỉ nêu "nhóm làm tốt nhất" khi đúng từ 60% số câu, tránh câu vô lý như "làm tốt nhất: đúng 0/4 câu"
  const best = [...d.group_stats]
    .filter((g) => g.total_q >= 2 && g.pass_rate >= 0.6 && !weakGroups.has(g.id))
    .sort((x, y) => y.pass_rate - x.pass_rate)[0]
  const focus = d.weak_skills.filter((s) => s.in_top_k)
  const others = d.weak_skills.filter((s) => !s.in_top_k)
  // Chuyên đề 1 câu chỉ đáng nhắc khi học sinh làm chưa đúng câu đó
  const unsure = d.insufficient_skills.filter((s) => parseRatio(s.error_stats).wrong > 0)
  // Phiếu phải vừa 1 trang A4: Top-K lớn thì chữ nhỏ lại một chút
  const compact = focus.length > 3
  const diff = previous ? a.total_score - previous.total_score : 0

  return (
    <article
      className={clsx(
        'mx-auto max-w-[794px] space-y-6 border border-slate-200 bg-white p-8 text-[13px] leading-normal text-slate-700 print:max-w-none print:space-y-3 print:border-0 print:p-0',
        compact ? 'print:space-y-2 print:text-[11px] print:leading-snug' : 'print:text-[12px]',
      )}
    >
      <header className="space-y-3 border-b-2 print:space-y-2 border-slate-900 pb-4">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-bold text-slate-900">TRUNG TÂM TRI THỨC</p>
          <p className="text-xs text-slate-500">Ngày in: {formatDate(printedAt)}</p>
        </div>
        <h1 className="text-center text-xl print:text-lg">PHIẾU KẾT QUẢ CHẨN ĐOÁN MÔN TIẾNG ANH</h1>
        <dl className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-slate-500">Học sinh</dt>
          <dd className="font-bold text-slate-900">{a.student.full_name}</dd>
          <dt className="text-slate-500">Lớp</dt>
          <dd className="text-slate-900">{a.student.class_name}</dd>
          <dt className="text-slate-500">Bài kiểm tra</dt>
          <dd className="text-slate-900">{a.exam.exam_title}</dd>
          <dt className="text-slate-500">Ngày làm</dt>
          <dd className="text-slate-900">{formatDate(a.submitted_at)}</dd>
        </dl>
        <p className="text-xs text-slate-500 italic">
          Phiếu cho biết phần đã vững, phần cần luyện và nên học gì tiếp; không phải bảng điểm hay học bạ.
        </p>
      </header>

      <Section no={1} title="Kết quả chung">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1">
          <p>
            Điểm: <span className="text-lg font-bold text-slate-900">{formatScore(a.total_score)}</span> / 10
          </p>
          <p>
            Xếp loại: <span className="font-bold text-slate-900">{gradeBand(a.total_score)}</span>
          </p>
          <p>
            Số câu đúng:{' '}
            <span className="font-bold text-slate-900">
              {a.correct_count}/{a.exam.total_questions}
            </span>
          </p>
        </div>
        {previous && (
          <p>
            So với bài trước ({previous.exam.exam_title}, {formatDate(previous.submitted_at)}):{' '}
            {formatScore(previous.total_score)} → {formatScore(a.total_score)} điểm
            {diff > 0 ? `, tăng ${formatScore(diff)} điểm.` : diff < 0 ? `, giảm ${formatScore(-diff)} điểm.` : ', không đổi.'}
            {previous.exam.exam_id !== a.exam.exam_id && ' Hai bài khác đề nên chỉ để tham khảo.'}
          </p>
        )}
      </Section>

      <Section no={2} title="Điểm mạnh">
        {strong.length ? (
          <ul className="grid list-disc grid-cols-2 gap-x-6 gap-y-1 pl-6">
            {strong.map((g) => (
              <li key={g.id}>
                {g.name}: đúng {g.correct_q}/{g.total_q} câu
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Chưa có nhóm kiến thức nào đúng từ 80% số câu.
            {best
              ? ` Nhóm làm tốt nhất: ${best.name} (đúng ${best.correct_q}/${best.total_q} câu).`
              : ' Cần ôn lại kiến thức nền ở hầu hết các phần.'}
          </p>
        )}
      </Section>

      <Section no={3} title="Phần cần luyện thêm">
        {focus.length === 0 ? (
          <p>Không có phần nào sai từ 2 câu và từ một nửa số câu trở lên.</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-6">
            {focus.map((s) => {
              const { wrong, total } = parseRatio(s.error_stats)
              return (
                <li key={s.skill_id}>
                  <span className="font-bold text-slate-900">{unitName(s)}</span>: chưa đúng {wrong}/{total} câu
                  {s.wrong_question_nos.length > 0 && ` (câu ${s.wrong_question_nos.join(', ')})`}
                  {parseRatio(s.easy_stats).wrong > 0 &&
                    (s.assigned_target_level === 1
                      ? ', có câu cơ bản nên cần ôn lại từ kiến thức nền'
                      : ', có sơ suất ở câu cơ bản')}
                  .
                </li>
              )
            })}
          </ol>
        )}
        {others.length > 0 && (
          <p>
            Phần khác cũng nên ôn sau: {others.slice(0, 5).map(unitName).join('; ')}
            {others.length > 5 ? ` và ${others.length - 5} phần khác (giáo viên có danh sách đầy đủ).` : '.'}
          </p>
        )}
        {unsure.length > 0 && (
          <p>Chưa đúng nhưng mới có 1 câu nên chưa kết luận: {unsure.map((s) => s.skill_name).join('; ')}.</p>
        )}
        {d.broad_weakness_activated && (
          <p>Điểm dưới 5 nên phiếu tính cả những phần sai từ 30% số câu, để không bỏ sót kiến thức nền.</p>
        )}
        <p className="text-xs text-slate-500 italic">
          Mỗi phần chỉ có vài câu nên đây là gợi ý để luyện thêm, chưa phải kết luận về năng lực.
        </p>
      </Section>

      <Section no={4} title="Kế hoạch học tiếp">
        {d.recommendations.length === 0 ? (
          <p>Tiếp tục luyện các đề tổng hợp để giữ phong độ.</p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-300 text-xs text-slate-500">
                <th className="py-1 pr-3 font-semibold">STT</th>
                <th className="py-1 pr-3 font-semibold">Phần cần luyện</th>
                <th className="py-1 pr-3 font-semibold">Học liệu trên hệ thống</th>
                <th className="py-1 font-semibold">Mức</th>
              </tr>
            </thead>
            <tbody>
              {d.recommendations.map((r, i) => (
                <tr key={r.material_id} className="border-b border-slate-200 align-top">
                  <td className="py-1 pr-3">{i + 1}</td>
                  <td className="py-1 pr-3">
                    {unitName(r)}
                    {r.tentative && <span className="text-slate-500"> (nên ôn thêm)</span>}
                  </td>
                  <td className="py-1 pr-3 text-slate-900">{r.material_title}</td>
                  <td className="py-1 whitespace-nowrap">{levelLabel[r.material_actual_level]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p>Học trên hệ thống ở mục "Học liệu đề xuất"; học xong, làm bài kiểm tra mới để xem tiến bộ.</p>
      </Section>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 print:break-inside-avoid">
        <Section no={5} title="Nhận xét của giáo viên">
          {comment.trim() ? (
            <p className="whitespace-pre-line text-slate-900">{comment.trim()}</p>
          ) : (
            <div className="space-y-6 pt-2">
              <div className="border-b border-dotted border-slate-400" />
              <div className="border-b border-dotted border-slate-400" />
              <div className="border-b border-dotted border-slate-400" />
            </div>
          )}
        </Section>
        <Section no={6} title="Gợi ý cho phụ huynh">
          <ul className="list-disc space-y-1 pl-6">
            {PARENT_TIPS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Section>
        <Signature role="Giáo viên" />
        <Signature role="Phụ huynh" />
      </div>
    </article>
  )
}

function Section({ no, title, children }: { no: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 print:break-inside-avoid">
      <h2 className="text-[15px]">
        {no}. {title}
      </h2>
      {children}
    </section>
  )
}

function Signature({ role }: { role: string }) {
  return (
    <div className="pb-12 text-center">
      <p className="font-bold text-slate-900">{role}</p>
      <p className="text-xs text-slate-500 italic">(Ký, ghi rõ họ tên)</p>
    </div>
  )
}
