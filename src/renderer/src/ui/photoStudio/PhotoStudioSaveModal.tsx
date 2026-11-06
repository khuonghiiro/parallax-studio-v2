import React, { useState, useMemo } from 'react'
import { useAssetManifestStore } from '../../store/assetManifest'
import { IconSave, IconX, IconPlus, IconDownload } from '../icons'

export interface PhotoStudioSaveModalProps {
  isOpen: boolean
  onClose: () => void
  previewDataUrl: string
  defaultName: string
  imageSize: { w: number; h: number }
  onSaveToLibrary: (opts: {
    fileName: string
    title: string
    category: string
    addToScene: boolean
  }) => Promise<void>
  onDownloadFile: (fileName: string) => void
}

export function PhotoStudioSaveModal({
  isOpen,
  onClose,
  previewDataUrl,
  defaultName,
  imageSize,
  onSaveToLibrary,
  onDownloadFile
}: PhotoStudioSaveModalProps) {
  const [fileName, setFileName] = useState(() => {
    const clean = (defaultName || 'photo_export').replace(/\.[^/.]+$/, '')
    return `${clean}_clean.png`
  })
  const [title, setTitle] = useState(() => {
    return (defaultName || 'Ảnh mới').replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
  })
  const [category, setCategory] = useState<string>('uploads')
  const [addToScene, setAddToScene] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  // Đọc danh mục chủ đề động từ modular manifest builtin.json
  const builtinModule = useAssetManifestStore((s) => s.modules?.builtin)
  const categories = useMemo(() => {
    const list = builtinModule?.categories || []
    if (list.length === 0) {
      return [
        { id: 'uploads', title: 'Tài nguyên tải lên', folder: 'uploads' },
        { id: 'characters', title: 'Nhân vật', folder: 'characters' },
        { id: 'props', title: 'Đạo cụ', folder: 'props' },
        { id: 'nature', title: 'Thiên nhiên', folder: 'nature' },
        { id: 'effects', title: 'Hiệu ứng', folder: 'effects' }
      ]
    }
    return list.filter((c) => c.status !== 'deleted')
  }, [builtinModule])

  if (!isOpen) return null

  const handleSave = async (add: boolean) => {
    if (isSaving) return
    setIsSaving(true)
    try {
      await onSaveToLibrary({
        fileName: fileName.trim() || 'asset_clean.png',
        title: title.trim() || 'Ảnh mới',
        category,
        addToScene: add
      })
      onClose()
    } catch (err) {
      console.error('[PhotoStudioSaveModal] Save error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="ps-modal-backdrop" onPointerDown={onClose}>
      <div
        className="ps-save-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ps-save-title"
        onPointerDown={(e) => e.stopPropagation()}
        data-mcp-region="photo_editor_save_modal"
        data-mcp-dialog
      >
        {/* Header */}
        <div className="ps-modal-header">
          <div className="ps-modal-title" id="ps-save-title">
            <IconSave width={16} height={16} style={{ color: 'var(--accent)' }} />
            <span>Lưu Ảnh & Thêm Vào Thư Viện Tài Nguyên</span>
          </div>
          <button type="button" className="ps-icon-btn" onClick={onClose} title="Đóng">
            <IconX width={14} height={14} />
          </button>
        </div>

        {/* Body */}
        <div className="ps-modal-body">
          {/* Cột trái: Thumbnail preview */}
          <div className="ps-save-preview-box">
            <div className="ps-save-preview-checker">
              {previewDataUrl ? (
                <img src={previewDataUrl} alt="Xem trước kết quả" className="ps-save-img" />
              ) : (
                <div className="ps-save-placeholder">Đang chuẩn bị ảnh…</div>
              )}
            </div>
            <div className="ps-save-dimensions">
              {imageSize.w} × {imageSize.h} px · PNG Trong suốt (RGBA)
            </div>
          </div>

          {/* Cột phải: Form thông số lưu chuẩn manifest */}
          <div className="ps-save-form">
            <div className="ps-form-field">
              <label htmlFor="ps-input-filename" className="ps-field-label">Tên tệp lưu (.png):</label>
              <input
                id="ps-input-filename"
                type="text"
                className="ps-field-input"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="VD: chibi_hero_clean.png"
              />
            </div>

            <div className="ps-form-field">
              <label htmlFor="ps-input-title" className="ps-field-label">Tiêu đề hiển thị:</label>
              <input
                id="ps-input-title"
                type="text"
                className="ps-field-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Nhân vật Chibi Áo Trắng"
              />
            </div>

            <div className="ps-form-field">
              <label className="ps-field-label">Danh mục lưu trữ trong kho (manifests/builtin.json):</label>
              <div className="ps-category-pills" role="radiogroup">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`ps-category-pill ${category === (c.folder || c.id) ? 'active' : ''}`}
                    onClick={() => setCategory(c.folder || c.id)}
                  >
                    {c.title || c.id}
                  </button>
                ))}
              </div>
            </div>

            <div className="ps-form-checkboxes">
              <label className="ps-checkbox-row">
                <input
                  type="checkbox"
                  checked={addToScene}
                  onChange={(e) => setAddToScene(e.target.checked)}
                />
                <span>Thêm ngay làm Layer ảnh vào Cảnh (Shot) hiện tại</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="ps-modal-footer">
          <button
            type="button"
            className="ps-btn ghost sm"
            onClick={() => onDownloadFile(fileName)}
            title="Lưu thẳng file PNG về thư mục Downloads máy tính"
          >
            <IconDownload width={14} height={14} />
            <span>Tải về máy (.png)</span>
          </button>

          <div style={{ flex: 1 }} />

          <button type="button" className="ps-btn ghost" onClick={onClose} disabled={isSaving}>
            Hủy
          </button>

          <button
            type="button"
            className="ps-btn primary"
            onClick={() => handleSave(addToScene)}
            disabled={isSaving}
          >
            {isSaving ? (
              <span>Đang lưu…</span>
            ) : addToScene ? (
              <>
                <IconPlus width={14} height={14} />
                <span>Lưu vào kho & Thêm vào Cảnh</span>
              </>
            ) : (
              <>
                <IconSave width={14} height={14} />
                <span>Lưu vào Thư viện tài nguyên</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
