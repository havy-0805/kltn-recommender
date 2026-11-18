import { useSearchParams } from 'react-router'
import { DEFAULT_TOP_K } from '../api/client'

/** Top-K do giáo viên chọn, giữ trên URL để màn phân tích và màn đề xuất dùng chung. */
export function useTopK(): [number, (k: number) => void] {
  const [params, setParams] = useSearchParams()
  const topK = Number(params.get('top')) || DEFAULT_TOP_K
  return [
    topK,
    (k) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p)
          if (k === DEFAULT_TOP_K) next.delete('top')
          else next.set('top', String(k))
          return next
        },
        { replace: true },
      ),
  ]
}

/** Chuỗi query giữ Top-K khi chuyển giữa các màn giáo viên. */
export function viewQuery(topK: number): string {
  return topK === DEFAULT_TOP_K ? '' : `?top=${topK}`
}
