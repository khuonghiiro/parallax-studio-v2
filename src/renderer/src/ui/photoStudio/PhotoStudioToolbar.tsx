import React from 'react'
import {
  IconUndo,
  IconRedo,
  IconUpload,
  IconImage,
  IconSave,
  IconX,
  IconSun,
  IconMoon
} from '../icons'
import { IconCheckerboard } from './PhotoStudioIcons'

export interface PhotoStudioToolbarProps {
  // Chroma Toggle & Mode
  chromaEnabled: boolean
  onChangeChromaEnabled: (enabled: boolean) => void
  previewMode: 'transparent' | 'original'
  onChangePreviewMode: (mode: 'transparent' | 'original') => void

  // Canvas BG: Caro (Grid) + Sáng/Tối (Tone)
  isChecker: boolean
  onChangeIsChecker: (checker: boolean) => void
  tone: 'dark' | 'light'
  onChangeTone: (tone: 'dark' | 'light') => void

  // Zoom
  zoomScale: number
  onStepZoom: (delta: number) => void
  onFitZoom: () => void
  onResetZoom: () => void

  // History
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void

  // File & Actions
  imageSize: { w: number; h: number }
  fileName: string
  onUploadImage: () => void
  onLoadSample: () => void
  onOpenSaveModal: () => void
  onClose: () => void
}

export function PhotoStudioToolbar({
  chromaEnabled,
  onChangeChromaEnabled,
  previewMode,
  onChangePreviewMode,
  isChecker,
  onChangeIsChecker,
  tone,
  onChangeTone,
  zoomScale,
  onStepZoom,
  onFitZoom,
  onResetZoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  imageSize,
  fileName,
  onUploadImage,
  onLoadSample,
  onOpenSaveModal,
  onClose
}: PhotoStudioToolbarProps) {
  return (
    <header className="ps-toolbar" data-mcp-region="photo_editor_toolbar">
      {/* 1. Header Left: Title + Size badge + File name */}
      <div className="ps-toolbar-left">
        <div className="ps-title-group">
          <span className="ps-app-icon" aria-hidden="true">
            <IconImage width={16} height={16} />
          </span>
          <span className="ps-app-title">Tách nền & Chỉnh sửa ảnh</span>
          <span className="ps-size-badge" title={`Kích thước ảnh gốc: ${imageSize.w}×${imageSize.h}px`}>
            {imageSize.w}×{imageSize.h}
          </span>
          {fileName && (
            <span className="ps-file-name" title={fileName}>
              {fileName}
            </span>
          )}
        </div>
      </div>

      {/* 2. Header Center: Chroma Toggle + Preview Mode + Canvas BG (Caro / Tone) */}
      <div className="ps-toolbar-center">
        {/* Toggle Tách nền */}
        <label className="ps-toggle-label" title="Bật/Tắt thuật toán tách phông Chroma">
          <input
            type="checkbox"
            checked={chromaEnabled}
            onChange={(e) => onChangeChromaEnabled(e.target.checked)}
          />
          <span className="ps-toggle-text">Tách nền</span>
        </label>

        {/* Chế độ xem: Đã tách vs Ảnh gốc */}
        <div className="ps-segmented-pill" role="radiogroup" aria-label="Chế độ xem trước">
          <button
            type="button"
            className={`ps-seg-item ${previewMode !== 'original' ? 'active' : ''}`}
            onClick={() => onChangePreviewMode('transparent')}
            title="Xem kết quả sau khi tách nền & chỉnh màu"
          >
            Đã tách
          </button>
          <button
            type="button"
            className={`ps-seg-item ${previewMode === 'original' ? 'active' : ''}`}
            onClick={() => onChangePreviewMode('original')}
            title="Xem ảnh gốc ban đầu"
          >
            Ảnh gốc
          </button>
        </div>

        <div className="ps-toolbar-separator" />

        {/* Bật/Tắt Ô lưới Caro */}
        <button
          type="button"
          className={`ps-caro-toggle-btn ${isChecker ? 'active' : ''}`}
          onClick={() => onChangeIsChecker(!isChecker)}
          title={isChecker ? 'Đang bật ô lưới Caro (Click để tắt về nền đơn sắc)' : 'Đang tắt ô lưới Caro (Click để bật dạng lưới)'}
        >
          <IconCheckerboard width={14} height={14} />
          <span>Caro</span>
        </button>

        {/* Nền Sáng / Tối */}
        <div className="ps-segmented-pill" role="radiogroup" aria-label="Nền sáng tối">
          <button
            type="button"
            className={`ps-seg-item ${tone === 'dark' ? 'active' : ''}`}
            onClick={() => onChangeTone('dark')}
            title="Nền tối (Ô caro đen hoặc đen tuyền)"
          >
            <IconMoon width={12} height={12} style={{ marginRight: 3 }} />
            <span>Tối</span>
          </button>
          <button
            type="button"
            className={`ps-seg-item ${tone === 'light' ? 'active' : ''}`}
            onClick={() => onChangeTone('light')}
            title="Nền sáng (Ô caro sáng hoặc trắng tuyền)"
          >
            <IconSun width={12} height={12} style={{ marginRight: 3 }} />
            <span>Sáng</span>
          </button>
        </div>
      </div>

      {/* 3. Header Right: Zoom + History + File Actions + Close */}
      <div className="ps-toolbar-right">
        {/* Thu phóng (Zoom) */}
        <div className="ps-zoom-group">
          <button type="button" className="ps-btn ghost sm" onClick={onFitZoom} title="Thu phóng vừa khung nhìn">
            Vừa ({Math.round(zoomScale * 100)}%)
          </button>
          <button type="button" className="ps-btn ghost sm" onClick={onResetZoom} title="Kích thước thực 100%">
            100%
          </button>
          <button
            type="button"
            className="ps-icon-btn sm"
            onClick={() => onStepZoom(-0.15)}
            title="Thu nhỏ (-)"
          >
            -
          </button>
          <button
            type="button"
            className="ps-icon-btn sm"
            onClick={() => onStepZoom(0.15)}
            title="Phóng to (+)"
          >
            +
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="ps-btn-group">
          <button
            type="button"
            className="ps-icon-btn sm"
            disabled={!canUndo}
            onClick={onUndo}
            title="Hoàn tác nét cọ/tẩy (Ctrl+Z)"
          >
            <IconUndo width={13} height={13} />
          </button>
          <button
            type="button"
            className="ps-icon-btn sm"
            disabled={!canRedo}
            onClick={onRedo}
            title="Làm lại nét cọ/tẩy (Ctrl+Y)"
          >
            <IconRedo width={13} height={13} />
          </button>
        </div>

        {/* Tải ảnh / Mẫu */}
        <button
          type="button"
          className="ps-btn ghost sm"
          onClick={onUploadImage}
          title="Chọn ảnh từ máy tính"
        >
          <IconUpload width={13} height={13} />
          <span className="ps-btn-text">Tải ảnh</span>
        </button>

        <button
          type="button"
          className="ps-btn ghost sm"
          onClick={onLoadSample}
          title="Nạp ảnh nhân vật mẫu"
        >
          <IconImage width={13} height={13} />
          <span className="ps-btn-text">Mẫu</span>
        </button>

        {/* Lưu ảnh (CTA) */}
        <button
          type="button"
          className="ps-btn success sm"
          onClick={onOpenSaveModal}
          title="Lưu ảnh vào Thư viện tài nguyên & Cảnh"
        >
          <IconSave width={14} height={14} />
          <span>Lưu ảnh…</span>
        </button>

        {/* Đóng */}
        <button
          type="button"
          className="ps-icon-btn close-btn sm"
          onClick={onClose}
          title="Đóng xưởng ảnh (Esc)"
        >
          <IconX width={14} height={14} />
        </button>
      </div>
    </header>
  )
}
