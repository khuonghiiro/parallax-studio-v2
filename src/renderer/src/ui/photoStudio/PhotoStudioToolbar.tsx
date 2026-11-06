import React from 'react'
import {
  IconUndo,
  IconRedo,
  IconImage,
  IconSave,
  IconX,
  IconSun,
  IconMoon
} from '../icons'
import { IconCheckerboard, IconImageUpload } from './PhotoStudioIcons'

export interface PhotoStudioToolbarProps {
  // Preview Mode: Đã tách vs Ảnh gốc
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
          <span className="ps-size-badge" title={`Kích thước ảnh: ${imageSize.w}×${imageSize.h}px`}>
            {imageSize.w}×{imageSize.h}
          </span>
          {fileName && (
            <span className="ps-file-name" title={fileName}>
              {fileName}
            </span>
          )}
        </div>
      </div>

      {/* 2. Header Center: Preview Mode + Canvas BG (Caro / Tone) */}
      <div className="ps-toolbar-center">
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
          title={isChecker ? 'Tắt ô lưới caro (chuyển sang nền đơn sắc)' : 'Bật ô lưới caro'}
          aria-pressed={isChecker}
        >
          <IconCheckerboard width={13} height={13} />
          <span>Caro</span>
        </button>

        {/* Nền Tối vs Sáng */}
        <div className="ps-segmented-pill" role="radiogroup" aria-label="Tông nền canvas">
          <button
            type="button"
            className={`ps-seg-item ${tone === 'dark' ? 'active' : ''}`}
            onClick={() => onChangeTone('dark')}
            title="Nền tối (dễ phát hiện viền trắng/xanh)"
          >
            <IconMoon width={11} height={11} />
            <span>Tối</span>
          </button>
          <button
            type="button"
            className={`ps-seg-item ${tone === 'light' ? 'active' : ''}`}
            onClick={() => onChangeTone('light')}
            title="Nền sáng (dễ phát hiện viền đen/xám)"
          >
            <IconSun width={11} height={11} />
            <span>Sáng</span>
          </button>
        </div>
      </div>

      {/* 3. Header Right: Zoom + History + Actions */}
      <div className="ps-toolbar-right">
        {/* Zoom */}
        <div className="ps-zoom-group">
          <button
            type="button"
            className="ps-btn ghost xs"
            onClick={onFitZoom}
            title="Vừa vặn khung nhìn (Fit to screen)"
          >
            Vừa ({Math.round(zoomScale * 100)}%)
          </button>
          <button
            type="button"
            className="ps-btn ghost xs"
            onClick={onResetZoom}
            title="Kích thước thực 100%"
          >
            100%
          </button>
          <button
            type="button"
            className="ps-icon-btn sm"
            onClick={() => onStepZoom(-0.15)}
            title="Thu nhỏ"
          >
            −
          </button>
          <button
            type="button"
            className="ps-icon-btn sm"
            onClick={() => onStepZoom(+0.15)}
            title="Phóng to"
          >
            +
          </button>
        </div>

        <div className="ps-toolbar-separator" />

        {/* Undo / Redo */}
        <div className="ps-history-group">
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

        {/* Tải ảnh (Nút nổi bật dễ nhận biết) */}
        <button
          type="button"
          className="ps-btn ps-btn-upload sm"
          onClick={onUploadImage}
          title="Tải ảnh mới từ máy tính để tách nền / chỉnh sửa"
        >
          <IconImageUpload width={14} height={14} />
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

        {/* Lưu ảnh (CTA chính) */}
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
