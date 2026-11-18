import { clsx } from 'clsx'
import { Check, ChevronDown, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

type Option = { value: string; label: string }

type Props = {
  label: string
  icon: LucideIcon
  placeholder: string
  options: Option[]
  values: string[]
  onChange: (values: string[]) => void
}

function Dot({ checked }: { checked: boolean }) {
  return (
    <span
      className={clsx(
        'flex size-4 shrink-0 items-center justify-center rounded-full border',
        checked ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white',
      )}
    >
      {checked && <Check className="size-3 text-white" strokeWidth={3} />}
    </span>
  )
}

/** Ô lọc đa chọn có checkbox — cùng kiểu dáng với Select. */
export function MultiSelect({ label, icon: Icon, placeholder, options, values, onChange }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = (value: string) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value])

  const buttonLabel =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? placeholder)
        : `${values.length} mảng đã chọn`

  return (
    <div ref={root} className="relative space-y-2">
      <span id={`${id}-label`} className="block text-[13px] font-semibold text-slate-700">
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'flex h-[46px] w-full items-center gap-3 rounded-md border bg-white px-4 text-left text-[15px]',
          open ? 'border-indigo-600' : 'border-slate-200',
          values.length > 0 ? 'text-slate-900' : 'text-slate-400',
        )}
      >
        <Icon className="size-[18px] text-slate-500" />
        <span className="flex-1 truncate">{buttonLabel}</span>
        {values.length > 0 && (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold leading-none text-white">
            {values.length}
          </span>
        )}
        <ChevronDown className={clsx('size-4 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby={`${id}-label`}
          className="absolute inset-x-0 z-20 mt-2 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-popover"
        >
          {/* Tất cả */}
          <li
            role="option"
            aria-selected={values.length === 0}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange([])}
            className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-3 hover:bg-indigo-50"
          >
            <Dot checked={values.length === 0} />
            <span className="text-sm font-semibold text-slate-900">Tất cả</span>
          </li>
          <li aria-hidden className="my-1 border-t border-slate-100" />
          {options.map((option) => {
            const checked = values.includes(option.value)
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={checked}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggle(option.value)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-3 hover:bg-indigo-50"
              >
                <Dot checked={checked} />
                <span className="text-sm font-semibold text-slate-900">{option.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
