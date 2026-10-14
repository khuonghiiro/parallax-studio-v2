import { useState } from 'react'
import type { CharacterPromptCustomBrief } from './characterPrompt'
import {
  PART_GROUP_OPTIONS,
  REFERENCE_MODE_OPTIONS,
  SHEET_STYLE_OPTIONS,
  characterNegativePrompt
} from './characterPromptReference'
import { granularNegativePrompt } from './granularCharacterPrompt'
import { IconCopy } from '../../icons'

function ChipRow<T extends string>({
  label,
  options,
  value,
  onSelect
}: {
  label: string
  options: Array<{ id: T; label: string; hint?: string }>
  value: T
  onSelect: (id: T) => void
}) {
  return (
    <div className="tpm-ref-row">
      <span className="tpm-field-label">{label}</span>
      <div className="tpm-preset-chips">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`tpm-preset-chip ${value === opt.id ? 'active' : ''}`}
            onClick={() => onSelect(opt.id)}
            title={opt.hint}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Bảng chọn kiểu sheet + vai trò ảnh đính kèm + nhóm bộ phận + sao chép negative prompt.
 * Mục đích: tránh AI coi ảnh mẫu là ảnh cần sửa (img2img) thay vì chỉ tham khảo bố cục.
 */
export function CharacterReferenceOptions({
  brief,
  onChange
}: {
  brief: CharacterPromptCustomBrief
  onChange: (next: CharacterPromptCustomBrief) => void
}) {
  const [negCopied, setNegCopied] = useState(false)
  const style = brief.sheetStyle ?? 'template'
  const mode = brief.referenceMode ?? 'layout'
  const group = brief.partGroup ?? 'all'
  const hints = [
    SHEET_STYLE_OPTIONS.find((s) => s.id === style)?.hint,
    REFERENCE_MODE_OPTIONS.find((m) => m.id === mode)?.hint
  ].filter(Boolean)
  const negative = style === 'granular' ? granularNegativePrompt(mode) : characterNegativePrompt(mode)

  const copyNegative = async () => {
    try {
      await navigator.clipboard.writeText(negative)
      setNegCopied(true)
      setTimeout(() => setNegCopied(false), 2000)
    } catch {
      // clipboard không khả dụng — bỏ qua
    }
  }

  return (
    <div className="tpm-reference-options" id="template-prompt-reference-options">
      <ChipRow
        label="Kiểu sheet:"
        options={SHEET_STYLE_OPTIONS}
        value={style}
        onSelect={(id) => onChange({ ...brief, sheetStyle: id })}
      />
      <ChipRow
        label="Vai trò ảnh đính kèm:"
        options={REFERENCE_MODE_OPTIONS}
        value={mode}
        onSelect={(id) => onChange({ ...brief, referenceMode: id })}
      />
      <ChipRow
        label="Tạo theo nhóm bộ phận:"
        options={PART_GROUP_OPTIONS}
        value={group}
        onSelect={(id) => onChange({ ...brief, partGroup: id })}
      />
      {hints.map((h) => (
        <div key={h} className="tpm-ref-hint">• {h}</div>
      ))}
      <div className="tpm-ref-row tpm-negative-row">
        <span className="tpm-field-label">Negative prompt:</span>
        <code className="tpm-negative-text">{negative}</code>
        <button type="button" className="btn sm" onClick={copyNegative} title="Sao chép negative prompt">
          {negCopied ? '✓ Đã chép' : <><IconCopy width={12} height={12} /> Chép</>}
        </button>
      </div>
    </div>
  )
}
