import React, { useRef } from 'react'
import type { CutterToolMode } from './types'
import type { CanvasBgMode, TagDisplayMode } from './SpriteCutterSourceToolbar'
import { IconScissors, IconUpload, IconRefresh } from '../../icons'

export interface SpriteCutterHeaderProps {
  activeIslandsCount: number
  imgNaturalSize: { w: number; h: number }
  tool: CutterToolMode
  tagDisplayMode: TagDisplayMode
  canvasBg: CanvasBgMode
  zoomMode: 'fit' | number
  effectiveScale: number
  onChangeTagDisplayMode: (mode: TagDisplayMode) => void
  onChangeCanvasBg: (bg: CanvasBgMode) => void
  onStepZoom: (delta: number) => void
  onSetZoomMode: (mode: 'fit' | number) => void
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onResetSample: () => void
}

export function SpriteCutterHeader({
  activeIslandsCount,
  imgNaturalSize,
  tool,
  tagDisplayMode,
  canvasBg,
  zoomMode,
  effectiveScale,
  onChangeTagDisplayMode,
  onChangeCanvasBg,
  onStepZoom,
  onSetZoomMode,
  onFileUpload,
  onResetSample
}: SpriteCutterHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="layer-cutter-header">
      {/* Cụm Tiêu Đề & Thông Tin Ảnh */}
      <div className="layer-cutter-title">
        <span className="lc-title-icon">
          <IconScissors width={14} height={14} />
        </span>
        <strong className="lc-title-text">Cắt tách Sprite</strong>
        <span className="layer-cutter-badge-pill" title="Số lượng mảnh phát hiện được">
          {activeIslandsCount} mảnh
        </span>
        <span className="layer-cutter-badge" title="Kích thước gốc của ảnh">
          {imgNaturalSize.w}×{imgNaturalSize.h}
        </span>
      </div>

      {/* Cụm Thao Tác: Nhãn + Nền + Zoom + Tải ảnh */}
      <div className="layer-cutter-actions">
        {/* Chế độ hiển thị nhãn */}
        {(tool === 'auto' || tool === 'grid') && (
          <div className="layer-cutter-seg-mini" title="Chế độ hiển thị nhãn tên trên từng mảnh cắt">
            <span className="seg-label">Nhãn:</span>
            <button
              type="button"
              className={`seg-btn ${tagDisplayMode === 'hover' ? 'active' : ''}`}
              onClick={() => onChangeTagDisplayMode('hover')}
              title="Chỉ hiện nhãn khi rê chuột vào mảnh"
            >
              Trỏ
            </button>
            <button
              type="button"
              className={`seg-btn ${tagDisplayMode === 'always' ? 'active' : ''}`}
              onClick={() => onChangeTagDisplayMode('always')}
              title="Luôn luôn hiển thị nhãn tên"
            >
              Luôn
            </button>
            <button
              type="button"
              className={`seg-btn ${tagDisplayMode === 'hidden' ? 'active' : ''}`}
              onClick={() => onChangeTagDisplayMode('hidden')}
              title="Ẩn tất cả nhãn để nhìn rõ hình"
            >
              Ẩn
            </button>
          </div>
        )}

        {/* Chế độ phông nền Canvas */}
        <div className="layer-cutter-seg-mini" title="Phông nền vùng làm việc để kiểm tra viền ảnh">
          <span className="seg-label">Nền:</span>
          <button
            type="button"
            className={`seg-btn ${canvasBg === 'checker' ? 'active' : ''}`}
            onClick={() => onChangeCanvasBg('checker')}
            title="Nền bàn cờ caro trong suốt"
          >
            Caro
          </button>
          <button
            type="button"
            className={`seg-btn ${canvasBg === 'dark' ? 'active' : ''}`}
            onClick={() => onChangeCanvasBg('dark')}
            title="Nền tối để soi viền trắng"
          >
            Tối
          </button>
          <button
            type="button"
            className={`seg-btn ${canvasBg === 'light' ? 'active' : ''}`}
            onClick={() => onChangeCanvasBg('light')}
            title="Nền sáng để soi viền đen"
          >
            Sáng
          </button>
        </div>

        {/* Cụm Zoom Stepper */}
        <div className="layer-cutter-zoom-pill" title="Thu phóng khung nhìn ảnh nguồn">
          <button
            type="button"
            className="stepper-btn"
            onClick={() => onStepZoom(-0.15)}
            title="Thu nhỏ"
          >
            −
          </button>
          <button
            type="button"
            className={`layer-cutter-zoom-mode-btn ${zoomMode === 'fit' ? 'active' : ''}`}
            onClick={() => onSetZoomMode('fit')}
            title={`Tự động thu phóng vừa khung nhìn (${Math.round(effectiveScale * 100)}%)`}
          >
            Vừa
          </button>
          <button
            type="button"
            className={`layer-cutter-zoom-mode-btn ${zoomMode === 1 ? 'active' : ''}`}
            onClick={() => onSetZoomMode(1)}
            title="Kích thước thực 100%"
          >
            100%
          </button>
          <button
            type="button"
            className="stepper-btn"
            onClick={() => onStepZoom(0.15)}
            title="Phóng to"
          >
            +
          </button>
        </div>

        {/* Nạp ảnh & Nạp mẫu */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={onFileUpload}
        />
        <button
          type="button"
          className="btn sm lc-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Tải ảnh sprite sheet từ máy tính (Mượt trên ảnh 4K/8K)"
        >
          <IconUpload width={12} height={12} />
          <span>Tải ảnh</span>
        </button>
        <button
          type="button"
          className="btn sm lc-sample-btn"
          onClick={onResetSample}
          title="Nạp lại ảnh mẫu Anime Green Screen"
        >
          <IconRefresh width={12} height={12} />
          <span>Mẫu</span>
        </button>
      </div>
    </div>
  )
}
