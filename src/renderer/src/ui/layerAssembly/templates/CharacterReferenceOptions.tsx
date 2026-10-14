import { useState } from 'react'
import type { CharacterPromptCustomBrief } from './characterPrompt'
import {
  PART_GROUP_OPTIONS,
  REFERENCE_MODE_OPTIONS,
  characterNegativePrompt
} from './characterPromptReference'
import { IconCopy } from '../../icons'

/**
 * Bảng chọn vai trò ảnh đính kèm + nhóm bộ phận + sao chép negative prompt.
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
  const mode = brief.referenceMode ?? 'layout'
  const group = brief.partGroup ?? 'all'
  const activeMode = REFERENCE_MODE_OPTIONS.find((m) => m.id === mode)
  const negative = characterNegativePrompt(mode)

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
      <div className="tpm-ref-row">
        <span className="tpm-field-label">Vai trò ảnh đính kèm:</span>
        <div className="tpm-preset-chips">
          {REFERENCE_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`tpm-preset-chip ${mode === opt.id ? 'active' : ''}`}
              onClick={() => onChange({ ...brief, referenceMode: opt.id })}
              title={opt.hint}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {activeMode && <div className="tpm-ref-hint">{activeMode.hint}</div>}

      <div className="tpm-ref-row">
        <span className="tpm-field-label">Tạo theo nhóm bộ phận:</span>
        <div className="tpm-preset-chips">
          {PART_GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`tpm-preset-chip ${group === opt.id ? 'active' : ''}`}
              onClick={() => onChange({ ...brief, partGroup: opt.id })}
              title="Mỗi lần tạo một nhóm bộ phận giúp AI vẽ phần bị che khuất đầy đủ hơn"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

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
