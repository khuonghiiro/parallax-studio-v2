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
      <div className="layer-cutter-title">
        <IconScissors width={14} height={14} />
        <strong>Nguồn ảnh & Tách nền Studio</strong>
        <span className="layer-cutter-badge-pill">{activeIslandsCount} mảnh</span>
        <span className="layer-cutter-badge" title="Kích thước ảnh gốc">
          {imgNaturalSize.w}×{imgNaturalSize.h}px
        </span>
      </div>

      <div className="layer-cutter-actions">
        {(tool === 'auto' || tool === 'grid') && (
          <div className="layer-cutter-seg-mini" title="Chế độ hiển thị nhãn tên trên mảnh cắt">
            <span className="seg-label">Nhãn</span>
            {(['hover', 'always', 'hidden'] as TagDisplayMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`seg-btn ${tagDisplayMode === m ? 'active' : ''}`}
                onClick={() => onChangeTagDisplayMode(m)}
              >
                {m === 'hover' ? 'Trỏ' : m === 'always' ? 'Luôn' : 'Ẩn'}
              </button>
            ))}
          </div>
        )}

        <div className="layer-cutter-seg-mini" title="Phông nền vùng làm việc để soi viền ảnh">
          <span className="seg-label">Nền</span>
          {(['checker', 'dark', 'light'] as CanvasBgMode[]).map((bg) => (
            <button
              key={bg}
              type="button"
              className={`seg-btn ${canvasBg === bg ? 'active' : ''}`}
              onClick={() => onChangeCanvasBg(bg)}
            >
              {bg === 'checker' ? 'Caro' : bg === 'dark' ? 'Tối' : 'Sáng'}
            </button>
          ))}
        </div>

        <div className="layer-cutter-zoom-pill" title="Thu phóng khung nhìn ảnh nguồn">
          <button type="button" className="stepper-btn" onClick={() => onStepZoom(-0.15)}>
            -
          </button>
          <button
            type="button"
            className={`layer-cutter-zoom-mode-btn ${zoomMode === 'fit' ? 'active' : ''}`}
            onClick={() => onSetZoomMode('fit')}
          >
            Vừa ({Math.round(effectiveScale * 100)}%)
          </button>
          <button
            type="button"
            className={`layer-cutter-zoom-mode-btn ${zoomMode === 1 ? 'active' : ''}`}
            onClick={() => onSetZoomMode(1)}
          >
            100%
          </button>
          <button type="button" className="stepper-btn" onClick={() => onStepZoom(0.15)}>
            +
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={onFileUpload}
        />
        <button
          type="button"
          className="btn sm"
          onClick={() => fileInputRef.current?.click()}
          title="Tải ảnh sprite sheet từ máy tính (Hỗ trợ mượt ảnh 4K/8K)"
        >
          <IconUpload width={12} height={12} /> Tải ảnh
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={onResetSample}
          title="Nạp lại ảnh mẫu Anime Green Screen"
        >
          <IconRefresh width={12} height={12} /> Mẫu
        </button>
      </div>
    </div>
  )
}
