import { useRef } from 'react'
import { Search, X } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** Focused when the page opens */
  autoFocus?: boolean
  className?: string
}

/** v4.3: the search field of a list (Docs, Snippets, Logs, Settings…): an icon, the field, a button to clear it */
export default function SearchInput({ value, onChange, placeholder, autoFocus, className }: Props) {
  const { t } = useI18n()
  const field = useRef<HTMLInputElement>(null)
  return (
    <div className={cn('flex h-9 min-w-0 items-center gap-2 rounded-control border border-line bg-canvas px-2.5 text-fg-muted transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25', className)}>
      {/* The label names the field only (the clear button stays outside it) */}
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <Search size={14} aria-hidden className="shrink-0" />
        <span className="sr-only">{placeholder}</span>
        <input ref={field} type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
          onKeyDown={e => { if (e.key === 'Escape' && value) { e.stopPropagation(); onChange('') } }}
          className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-muted [&::-webkit-search-cancel-button]:hidden" />
      </label>
      {value && (
        <button type="button" onClick={() => { onChange(''); field.current?.focus() }} title={t.common.clear} aria-label={t.common.clear} className="shrink-0 rounded text-fg-muted hover:text-fg">
          <X size={13} />
        </button>
      )}
    </div>
  )
}
