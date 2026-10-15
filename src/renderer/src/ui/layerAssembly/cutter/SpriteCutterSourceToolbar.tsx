import React from 'react'
import type {
  ChromaKeySettings,
  CutterToolMode,
  EyedropperSample,
  EyedropperTarget,
  GridSlicerSettings
} from './types'
import {
  IconSparkles,
  IconCrop,
  IconEraser,
  IconBrush,
  IconGrid3D
} from '../../icons'
import { CutterChromaStudioPanel } from './CutterChromaStudioPanel'
import { PhotoshopEyedropperButton } from './PhotoshopEyedropperOverlay'

export type TagDisplayMode = 'hover' | 'always' | 'hidden'
export type CanvasBgMode = 'checker' | 'dark' | 'light'

export interface SpriteCutterSourceToolbarProps {
  tool: CutterToolMode
  islandsCount: number
  gridSettings: GridSlicerSettings
  tagDisplayMode: TagDisplayMode
  canvasBg: CanvasBgMode
  chroma: ChromaKeySettings
  showChromaStudio: boolean
  eyedropperTarget: EyedropperTarget | null
  eyedropperSample: EyedropperSample | null
  onChangeTool: (tool: CutterToolMode) => void
  onChangeTagDisplayMode: (mode: TagDisplayMode) => void
  onChangeCanvasBg: (bg: CanvasBgMode) => void
  onChangeChroma: (patch: Partial<ChromaKeySettings>) => void
  onToggleChromaStudio: () => void
  onToggleEyedropper: (target: EyedropperTarget) => void
  onResetChroma: () => void
}

export function SpriteCutterSourceToolbar({
  tool,
  islandsCount,
  gridSettings,
  tagDisplayMode,
  canvasBg,
  chroma,
  showChromaStudio,
  eyedropperTarget,
  eyedropperSample,
  onChangeTool,
  onChangeTagDisplayMode,
  onChangeCanvasBg,
  onChangeChroma,
  onToggleChromaStudio,
  onToggleEyedropper,
  onResetChroma
}: SpriteCutterSourceToolbarProps) {
  return (
    <>
      {/* Hàng 1: Nhóm Công Cụ Cắt Tách + Nút Hút Màu Nhanh + Nút Mở Bộ Lọc Studio + Nền Canvas */}
      <div className="layer-cutter-toolbar layer-cutter-ribbon">
        <div className="layer-cutter-tool-group" role="tablist" aria-label="Chế độ cắt tách sprite">
          <button
            id="btn-cutter-tool-auto"
            type="button"
            className={`layer-cutter-tool-btn ${tool === 'auto' ? 'active' : ''}`}
            onClick={() => onChangeTool('auto')}
            title="Quét tự động (Auto Islands): Tự động nhận diện các mảnh bộ phận rời trên ảnh đã tách nền"
          >
            <IconSparkles width={12} height={12} />
            <span className="lc-tool-label">Tự động</span>
            <span className="lc-count-badge">{islandsCount}</span>
          </button>

          <button
            id="btn-cutter-tool-grid"
            type="button"
            className={`layer-cutter-tool-btn ${tool === 'grid' ? 'active' : ''}`}
            onClick={() => onChangeTool('grid')}
            title="Cắt lưới ma trận (Grid Slicer): Chia đều tấm ảnh theo Số Hàng × Số Cột để cắt nhanh"
          >
            <IconGrid3D width={12} height={12} />
            <span className="lc-tool-label">Cắt lưới</span>
            <span className="lc-count-badge">
              {gridSettings.rows}×{gridSettings.cols}
            </span>
          </button>

          <button
            id="btn-cutter-tool-box"
            type="button"
            className={`layer-cutter-tool-btn ${tool === 'box' ? 'active' : ''}`}
            onClick={() => onChangeTool('box')}
            title="Kéo khung chữ nhật (Box): Khoanh vùng chữ nhật bất kỳ để cắt riêng bộ phận"
          >
            <IconCrop width={12} height={12} />
            <span className="lc-tool-label">Khung</span>
          </button>

          <button
            id="btn-cutter-tool-lasso"
            type="button"
            className={`layer-cutter-tool-btn ${tool === 'lasso' ? 'active' : ''}`}
            onClick={() => onChangeTool('lasso')}
            title="Khoanh vùng tự do (Lasso): Vẽ đường viền tự do để tách bộ phận nằm sát nhau"
          >
            <span>✂️</span>
            <span className="lc-tool-label">Lasso</span>
          </button>

          <button
            id="btn-cutter-tool-eraser"
            type="button"
            className={`layer-cutter-tool-btn ${tool === 'eraser' ? 'active' : ''}`}
            onClick={() => onChangeTool('eraser')}
            title="Cọ tẩy (Eraser): Xóa thủ công chi tiết thừa hoặc tách rời 2 bộ phận dính nhau"
          >
            <IconEraser width={12} height={12} />
            <span className="lc-tool-label">Cọ tẩy</span>
          </button>

          <button
            id="btn-cutter-tool-restore"
            type="button"
            className={`layer-cutter-tool-btn ${tool === 'restore' ? 'active' : ''}`}
            onClick={() => onChangeTool('restore')}
            title="Cọ khôi phục (Restore): Vẽ lấy lại phần chi tiết bị xóa nhầm"
          >
            <IconBrush width={12} height={12} />
            <span className="lc-tool-label">Khôi phục</span>
          </button>
        </div>

        {/* Công tắc bật/tắt Tách nền + Nút mở Bảng Studio Tách Nền Chuyên Sâu */}
        <label
          className="layer-cutter-switch-pill"
          title="Bật/tắt thuật toán tách nền tự động"
        >
          <input
            type="checkbox"
            className="lc-switch"
            checked={chroma.enabled}
            onChange={(e) => onChangeChroma({ enabled: e.target.checked })}
          />
          <span>Tách nền</span>
        </label>

        {/* Nút Hút màu kiểu Adobe Photoshop ngay trên thanh công cụ chính */}
        <PhotoshopEyedropperButton
          id="btn-toolbar-eyedropper"
          active={eyedropperTarget === 'key'}
          currentHex={chroma.keyColorHex}
          hoveredHex={eyedropperTarget === 'key' ? eyedropperSample?.hex : null}
          label="Hút màu"
          title="Hút màu nền trực tiếp trên ảnh với Kính lúp Pixel & Vòng đối chiếu màu kiểu Adobe Photoshop"
          onToggle={() => onToggleEyedropper('key')}
        />

        <button
          id="btn-toggle-chroma-studio"
          type="button"
          className={`cutter-studio-toggle-btn ${showChromaStudio ? 'active' : ''}`}
          onClick={onToggleChromaStudio}
          title="Đóng/mở bảng thiết lập Tách nền & Khử viền rác chuyên sâu"
        >
          <span>🧪 Bộ lọc Tách & Khử viền</span>
          <span className="caret">{showChromaStudio ? '▴' : '▾'}</span>
        </button>

        {/* Nhóm hiển thị bên phải: Nhãn & Nền Canvas */}
        <div className="layer-cutter-toolbar-right">
          <div className="layer-cutter-seg-mini" title="Chế độ hiển thị nhãn tên mảnh cắt">
            <span className="seg-label">Nhãn:</span>
            {(['hover', 'always', 'hidden'] as const).map((m) => (
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

          <div className="layer-cutter-seg-mini" title="Màu nền vùng xem để kiểm tra viền rác">
            <span className="seg-label">Nền:</span>
            {(['checker', 'dark', 'light'] as const).map((bg) => (
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
        </div>
      </div>

      {/* Bảng Studio Tách Nền & Khử Viền Sượng Chuyên Sâu (2 Sub-tabs giống Xưởng Lắp Ráp 2D) */}
      {showChromaStudio && chroma.enabled && (
        <CutterChromaStudioPanel
          chroma={chroma}
          eyedropperTarget={eyedropperTarget}
          eyedropperSample={eyedropperSample}
          onChangeChroma={onChangeChroma}
          onToggleEyedropper={onToggleEyedropper}
          onResetChroma={onResetChroma}
        />
      )}
    </>
  )
}
