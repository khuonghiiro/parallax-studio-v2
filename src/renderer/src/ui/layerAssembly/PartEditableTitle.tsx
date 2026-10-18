import { useEffect, useState } from 'react'
import { IconPen } from '../icons'

/**
 * Tiêu đề đổi tên được: viền gạch đứt + biểu tượng bút chì để người dùng nhận ra ngay đây là ô sửa được,
 * không phải nhãn tĩnh. Chỉ ghi khi rời ô / Enter (1 bước hoàn tác), Esc để huỷ.
 */
export function PartEditableTitle({ value, onCommit, ariaLabel, placeholder, size = 'md' }: {
  value: string
  onCommit: (next: string) => void
  ariaLabel: string
  placeholder?: string
  size?: 'md' | 'sm'
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    const next = draft.trim()
    if (next && next !== value) onCommit(next)
    else setDraft(value)
  }
  return (
    <label className={`lw-editable lw-editable-${size}`} title={`${ariaLabel} — bấm để đổi tên, Enter để lưu`} onClick={(e) => e.stopPropagation()}>
      <input
        value={draft}
        aria-label={ariaLabel}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
          else if (e.key === 'Escape') { setDraft(value); (e.currentTarget as HTMLInputElement).blur() }
        }}
      />
      <IconPen className="lw-editable-pen" width={11} height={11} aria-hidden />
    </label>
  )
}
