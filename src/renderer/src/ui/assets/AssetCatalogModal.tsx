import { useEffect, useState } from 'react'
import { IconCheck, IconCode, IconFolder, IconRefresh, IconX } from '../icons'

interface AssetCatalogModalProps {
  isOpen: boolean
  onClose: () => void
  initialJson: string
  onSave: (jsonContent: string) => Promise<boolean>
  onOpenFolder: () => void
  title?: string
  description?: string
  folderLabel?: string
  sampleTemplate?: string
}

const SAMPLE_TEMPLATE = `{
  "categories": [
    {
      "id": "all",
      "folder": "",
      "title": "Tất cả tài nguyên",
      "icon": "all",
      "description": "Toàn bộ tài nguyên có sẵn trong thư mục assets"
    },
    {
      "id": "city",
      "folder": "city",
      "title": "Thành phố & Đô thị",
      "icon": "city",
      "description": "Ảnh phong cảnh thành phố, đường phố mưa đêm, ban công và nhà chọc trời"
    },
    {
      "id": "demos",
      "folder": "demos",
      "title": "Hiệu ứng & Hoạt ảnh (VFX)",
      "icon": "sparkles",
      "description": "Hoạt ảnh GIF ngọn lửa trại, quả cầu hologram, cổng năng lượng và đom đóm"
    },
    {
      "id": "audio",
      "folder": "audio",
      "title": "Âm thanh & Nhạc nền",
      "icon": "music",
      "description": "Nhạc nền, tiếng chuông ambient và hiệu ứng âm thanh cho phân cảnh"
    }
  ]
}`

export function AssetCatalogModal({
  isOpen,
  onClose,
  initialJson,
  onSave,
  onOpenFolder,
  title = 'Cấu hình Danh mục Tài nguyên (assets/manifest.json)',
  description = 'Định nghĩa mapping giữa folder (thư mục tiếng Anh/không dấu) và title (tên tiếng Việt hiển thị), icon và description (mô tả tooltip).',
  folderLabel = 'Mở thư mục assets',
  sampleTemplate = SAMPLE_TEMPLATE
}: AssetCatalogModalProps) {
  const [text, setText] = useState(initialJson)
  const [syntaxError, setSyntaxError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setText(initialJson)
      setSyntaxError(null)
    }
  }, [isOpen, initialJson])

  if (!isOpen) return null

  const validateSyntax = (val: string): boolean => {
    try {
      const parsed = JSON.parse(val)
      if (!parsed || !Array.isArray(parsed.categories)) {
        setSyntaxError('Cấu trúc JSON cần có mảng thuộc tính "categories"')
        return false
      }
      setSyntaxError(null)
      return true
    } catch (e) {
      setSyntaxError((e as Error).message)
      return false
    }
  }

  const handleChange = (val: string): void => {
    setText(val)
    validateSyntax(val)
  }

  const handleFormat = (): void => {
    try {
      const parsed = JSON.parse(text)
      setText(JSON.stringify(parsed, null, 2))
      setSyntaxError(null)
    } catch (e) {
      setSyntaxError((e as Error).message)
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!validateSyntax(text)) return
    setSaving(true)
    const ok = await onSave(text)
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <div className="manifest-modal-backdrop" onClick={onClose}>
      <div className="manifest-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="manifest-modal-header">
          <IconCode width={16} height={16} />
          <span>{title}</span>
          <span className="spacer" />
          <button type="button" className="btn sm icon ghost" onClick={onClose} title="Đóng">
            <IconX />
          </button>
        </div>

        <div className="manifest-modal-body">
          <div style={{ color: 'var(--text-dim)', fontSize: '11px', lineHeight: 1.4 }}>
            {description}
          </div>

          <textarea
            className="manifest-editor-textarea"
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            spellCheck={false}
          />

          <div className="manifest-status-row">
            {syntaxError ? (
              <div className="manifest-status-msg error">⚠️ {syntaxError}</div>
            ) : (
              <div className="manifest-status-msg ok">
                <IconCheck width={14} height={14} /> JSON hợp lệ
              </div>
            )}
          </div>
        </div>

        <div className="manifest-modal-footer">
          <button type="button" className="btn sm" onClick={onOpenFolder} title={folderLabel}>
            <IconFolder width={14} height={14} /> {folderLabel}
          </button>
          <button type="button" className="btn sm" onClick={handleFormat} title="Format làm đẹp JSON">
            <IconRefresh width={14} height={14} /> Định dạng
          </button>
          <button type="button" className="btn sm ghost" onClick={() => handleChange(sampleTemplate)} title="Dùng mẫu chuẩn">
            Mẫu chuẩn
          </button>
          <span className="spacer" />
          <button type="button" className="btn sm" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="btn sm primary"
            onClick={handleSave}
            disabled={saving || syntaxError !== null}
          >
            {saving ? 'Đang lưu...' : 'Lưu & Cập nhật'}
          </button>
        </div>
      </div>
    </div>
  )
}
