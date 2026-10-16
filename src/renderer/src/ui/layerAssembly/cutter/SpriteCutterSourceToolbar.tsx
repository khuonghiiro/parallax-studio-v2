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
  IconGrid3D,
  IconLasso,
  IconWand,
  IconSliders,
  IconRefresh
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
  chroma,
  showChromaStudio,
  eyedropperTarget,
  eyedropperSample,
  onChangeTool,
  onChangeChroma,
  onToggleChromaStudio,
  onToggleEyedropper,
  onResetChroma
}: SpriteCutterSourceToolbarProps) {
  const isOriginalPreview = chroma.previewMode === 'original'

  return (
    <>
      {/* Hàng Ribbon chính: Luôn nằm trên 1 hàng phẳng lì 34px, không bao giờ rớt dòng so le */}
      <div className="layer-cutter-toolbar layer-cutter-ribbon">
        {/* Nhóm công cụ Cắt & Khoanh Vùng */}
        <div className="layer-cutter-tool-group" role="tablist" aria-label="Chế độ cắt tách sprite">
          <button
            id="btn-cutter-tool-auto"
            type="button"
            className={`layer-cutter-tool-btn ${tool === 'auto' ? 'active' : ''}`}
            onClick={() => onChangeTool('auto')}
            title="Quét tự động (Auto Islands): Tự động nhận diện các mảnh bộ phận rời trên ảnh"
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
            title="Cắt lưới ma trận (Grid Slicer): Chia đều tấm ảnh theo Số Hàng × Số Cột"
          >
            <IconGrid3D width={12} height={12} />
            <span className="lc-tool-label">Lưới</span>
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
            title="Khoanh vùng tự do (Lasso): Vẽ đường bao tự do để tách chi tiết sát nhau"
          >
            <IconLasso width={12} height={12} />
            <span className="lc-tool-label">Lasso</span>
          </button>

          <div className="lc-tool-separator" />

          <button
            id="btn-cutter-tool-wand"
            type="button"
            className={`layer-cutter-tool-btn ${tool === 'wand' ? 'active' : ''}`}
            onClick={() => onChangeTool('wand')}
            title="Đũa thần (Magic Wand): Click 1 điểm để đục thủng vùng nền kẹt kín (Alt + Click để khôi phục)"
          >
            <IconWand width={12} height={12} />
            <span className="lc-tool-label">Đũa</span>
          </button>

          <button
            id="btn-cutter-tool-eraser"
            type="button"
            className={`layer-cutter-tool-btn ${tool === 'eraser' ? 'active' : ''}`}
            onClick={() => onChangeTool('eraser')}
            title="Cọ tẩy (Eraser): Xóa thủ công chi tiết thừa hoặc tách rời 2 bộ phận dính nhau"
          >
            <IconEraser width={12} height={12} />
            <span className="lc-tool-label">Tẩy</span>
          </button>

          <button
            id="btn-cutter-tool-restore"
            type="button"
            className={`layer-cutter-tool-btn ${tool === 'restore' ? 'active' : ''}`}
            onClick={() => onChangeTool('restore')}
            title="Cọ khôi phục (Restore): Vẽ lấy lại pixel gốc bị xóa nhầm"
          >
            <IconBrush width={12} height={12} />
            <span className="lc-tool-label">Khôi phục</span>
          </button>
        </div>

        {/* Nhóm điều khiển Tách nền bên phải (Căn thẳng hàng, phẳng phiu) */}
        <div className="layer-cutter-toolbar-right">
          {/* Nút bật/tắt Tách nền */}
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

          {/* Kính lúp hút màu nhanh khi chưa mở Studio */}
          {(!showChromaStudio || !chroma.enabled) && (
            <PhotoshopEyedropperButton
              id="btn-toolbar-eyedropper"
              active={eyedropperTarget === 'key'}
              currentHex={chroma.keyColorHex}
              hoveredHex={eyedropperTarget === 'key' ? eyedropperSample?.hex : null}
              label="Hút màu"
              title="Hút màu nền trực tiếp trên ảnh với Kính lúp Pixel kiểu Adobe Photoshop"
              onToggle={() => onToggleEyedropper('key')}
            />
          )}

          {/* Chế độ đối chiếu: Đã tách vs Ảnh gốc */}
          <div
            className="cutter-preview-mode-group"
            title="Đối chiếu kết quả đã tách nền với ảnh gốc ban đầu"
          >
            <button
              type="button"
              className={`cutter-preview-mode-btn ${!isOriginalPreview && chroma.enabled ? 'active' : ''}`}
              onClick={() => onChangeChroma({ enabled: true, previewMode: 'transparent' })}
            >
              Đã tách
            </button>
            <button
              type="button"
              className={`cutter-preview-mode-btn ${isOriginalPreview || !chroma.enabled ? 'active' : ''}`}
              onClick={() =>
                onChangeChroma({ previewMode: isOriginalPreview ? 'transparent' : 'original' })
              }
            >
              Ảnh gốc
            </button>
          </div>

          {/* Nút gạt mở/đóng Bảng tinh chỉnh Bộ lọc */}
          <button
            id="btn-toggle-chroma-studio"
            type="button"
            className={`cutter-studio-toggle-btn ${showChromaStudio && chroma.enabled ? 'active' : ''}`}
            onClick={onToggleChromaStudio}
            disabled={!chroma.enabled}
            title={chroma.enabled ? 'Đóng/mở bảng tinh chỉnh thông số Tách nền & Khử viền' : 'Hãy bật Tách nền để mở Bộ lọc'}
          >
            <IconSliders width={12} height={12} />
            <span>Bộ lọc</span>
            <span className="caret">{showChromaStudio && chroma.enabled ? '▴' : '▾'}</span>
          </button>

          {/* Nút reset thông số về chuẩn */}
          <button
            type="button"
            className="cutter-studio-reset-btn"
            onClick={onResetChroma}
            title="Khôi phục toàn bộ thông số tách nền về mặc định"
          >
            <IconRefresh width={11} height={11} />
          </button>
        </div>
      </div>

      {/* Bảng Studio Tách Nền & Khử Viền Gọn Gàng (Siêu mỏng 56px, tiết kiệm tối đa không gian Canvas) */}
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
