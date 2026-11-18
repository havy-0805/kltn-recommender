import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { Link } from 'react-router'

export type Crumb = { label: string; to?: string }

export function Breadcrumb({ items, back }: { items: Crumb[]; back?: string }) {
  return (
    <nav aria-label="Đường dẫn" className="flex items-center gap-3 text-[13px]">
      {back && (
        <Link
          to={back}
          aria-label="Quay lại"
          className="inline-flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
        >
          <ArrowLeft className="size-4" />
        </Link>
      )}
      {items.map((item, i) => (
        <Fragment key={item.label}>
          {i > 0 && <ChevronRight className="size-3.5 text-slate-500" />}
          {item.to ? (
            <Link to={item.to} className="text-slate-500 hover:text-slate-900">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="font-semibold text-indigo-600">
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
