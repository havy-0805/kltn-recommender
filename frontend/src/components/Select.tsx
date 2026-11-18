import { clsx } from 'clsx'
import { Check, ChevronDown, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

export type SelectOption = { value: string; label: string; description?: string }

type Props = {
  label: string
  icon: LucideIcon
  placeholder: string
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  optionIcon?: LucideIcon
}

/** Figma Molecules/Trường chọn: ô chọn có biểu tượng, danh sách thả xuống có dòng phụ. */
export function Select({ label, icon: Icon, placeholder, options, value, onChange, disabled, optionIcon: OptionIcon }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const openList = () => {
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    )
    setOpen(true)
  }

  const choose = (option: SelectOption | undefined) => {
    if (option) onChange(option.value)
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'Enter', ''].includes(e.key)) {
        e.preventDefault()
        openList()
      }
      return
    }
    if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'ArrowDown') setActive((i) => Math.min(options.length - 1, i + 1))
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1))
    else if (e.key === 'Enter' || e.key === '') choose(options[active])
    else return
    e.preventDefault()
  }

  return (
    <div ref={root} className="relative space-y-2">
      <span id={`${id}-label`} className="block text-[13px] font-semibold text-slate-700">
        {label}
      </span>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={clsx(
          'flex h-[46px] w-full items-center gap-3 rounded-md border bg-white px-4 text-left text-[15px]',
          open ? 'border-indigo-600' : 'border-slate-200',
          disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : 'text-slate-900',
        )}
      >
        <Icon className="size-[18px] text-slate-500" />
        <span id={`${id}-value`} className="flex-1 truncate">
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={clsx('size-4 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute inset-x-0 z-20 mt-2 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-popover"
        >
          {options.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">Không có lựa chọn</li>}
          {options.map((option, i) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(option)}
              className={clsx('flex cursor-pointer items-center gap-3 rounded-md px-3 py-3', i === active && 'bg-indigo-50')}
            >
              {OptionIcon && (
                <span className="inline-flex size-8 items-center justify-center rounded-md bg-white text-indigo-600">
                  <OptionIcon className="size-4" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                {option.description && <span className="block text-xs text-slate-500">{option.description}</span>}
              </span>
              {option.value === value && <Check className="size-4 text-indigo-600" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
