import React from 'react'
import type { PhotoAdjustments, PhotoFilterPreset } from './types'
import { DEFAULT_PHOTO_ADJUSTMENTS } from './types'
import { getPresetAdjustments, isDefaultAdjustments } from './photoAdjustments'
import { IconUndo, IconSparkles } from '../icons'

export interface PhotoStudioAdjustmentsBarProps {
  adjustments: PhotoAdjustments
  onChangeAdjustments: (patch: Partial<PhotoAdjustments>) => void
  onResetAdjustments: () => void
}

export function PhotoStudioAdjustmentsBar({
  adjustments,
  onChangeAdjustments,
  onResetAdjustments
}: PhotoStudioAdjustmentsBarProps) {
  const isDefault = isDefaultAdjustments(adjustments)

  const handleApplyPreset = (preset: PhotoFilterPreset) => {
    onChangeAdjustments(getPresetAdjustments(preset))
  }

  return (
    <div className="ps-adjustments-strip" data-mcp-region="photo_editor_adjustments">
      {/* 1. Bộ lọc 1-Click mẫu nhanh */}
      <div className="ps-presets-row">
        <span className="ps-row-label">
          <IconSparkles width={13} height={13} />
          <span>Bộ lọc ảnh:</span>
        </span>

        <div className="ps-filter-pills" role="radiogroup">
          <button
            type="button"
            className={`ps-filter-pill ${isDefault ? 'active' : ''}`}
            onClick={() => handleApplyPreset('original')}
          >
            Tự nhiên (Gốc)
          </button>
          <button
            type="button"
            className="ps-filter-pill"
            onClick={() => handleApplyPreset('vivid')}
            title="Tăng cường tương phản và độ rực rỡ"
          >
            🎨 Tươi sáng
          </button>
          <button
            type="button"
            className="ps-filter-pill"
            onClick={() => handleApplyPreset('warm_anime')}
            title="Tông màu ấm áp phong cách hoạt hình Anime"
          >
            🌅 Ấm áp Anime
          </button>
          <button
            type="button"
            className="ps-filter-pill"
            onClick={() => handleApplyPreset('cinematic_cool')}
            title="Tông màu xanh lạnh điện ảnh"
          >
            🎬 Điện ảnh
          </button>
          <button
            type="button"
            className={`ps-filter-pill ${adjustments.grayscale ? 'active' : ''}`}
            onClick={() => handleApplyPreset('bw')}
            title="Chuyển sang ảnh đen trắng đơn sắc"
          >
            ⚫ Đen trắng
          </button>
          <button
            type="button"
            className={`ps-filter-pill ${adjustments.invert ? 'active' : ''}`}
            onClick={() => handleApplyPreset('invert')}
            title="Đảo ngược các kênh màu sắc"
          >
            🔄 Đảo màu
          </button>
        </div>

        {!isDefault && (
          <button
            type="button"
            className="ps-reset-color-btn"
            onClick={onResetAdjustments}
            title="Đặt lại toàn bộ thông số màu về mặc định ban đầu"
          >
            <IconUndo width={12} height={12} />
            <span>Đặt lại màu</span>
          </button>
        )}
      </div>

      {/* 2. Dải thanh trượt chỉnh màu chuyên nghiệp */}
      <div className="ps-color-sliders">
        <div className="ps-slider-cell" title="Chỉnh độ sáng tối của ảnh">
          <span className="cell-label">Độ sáng</span>
          <input
            type="range"
            min={-100}
            max={100}
            value={adjustments.brightness}
            onChange={(e) => onChangeAdjustments({ brightness: Number(e.target.value) })}
          />
          <span className="cell-val">{adjustments.brightness > 0 ? `+${adjustments.brightness}` : adjustments.brightness}%</span>
        </div>

        <div className="ps-slider-cell" title="Tăng giảm độ tương phản giữa vùng sáng và vùng tối">
          <span className="cell-label">Tương phản</span>
          <input
            type="range"
            min={-100}
            max={100}
            value={adjustments.contrast}
            onChange={(e) => onChangeAdjustments({ contrast: Number(e.target.value) })}
          />
          <span className="cell-val">{adjustments.contrast > 0 ? `+${adjustments.contrast}` : adjustments.contrast}%</span>
        </div>

        <div className="ps-slider-cell" title="Chỉnh độ tươi màu sắc (Độ bão hòa)">
          <span className="cell-label">Bão hòa</span>
          <input
            type="range"
            min={-100}
            max={100}
            value={adjustments.saturation}
            disabled={adjustments.grayscale}
            onChange={(e) => onChangeAdjustments({ saturation: Number(e.target.value) })}
          />
          <span className="cell-val">{adjustments.saturation > 0 ? `+${adjustments.saturation}` : adjustments.saturation}%</span>
        </div>

        <div className="ps-slider-cell" title="Chỉnh nhiệt độ màu: Kéo sang trái là Lạnh/Lam, sang phải là Ấm/Vàng">
          <span className="cell-label">Nhiệt độ (Ấm/Lạnh)</span>
          <input
            type="range"
            min={-100}
            max={100}
            value={adjustments.warmth}
            onChange={(e) => onChangeAdjustments({ warmth: Number(e.target.value) })}
          />
          <span className="cell-val">{adjustments.warmth > 0 ? `+${adjustments.warmth}` : adjustments.warmth}%</span>
        </div>

        <div className="ps-slider-cell" title="Xoay góc Hue quanh phổ màu 360°">
          <span className="cell-label">Tông màu (Hue)</span>
          <input
            type="range"
            min={-180}
            max={180}
            value={adjustments.hue}
            onChange={(e) => onChangeAdjustments({ hue: Number(e.target.value) })}
          />
          <span className="cell-val">{adjustments.hue > 0 ? `+${adjustments.hue}` : adjustments.hue}°</span>
        </div>

        <div className="ps-slider-cell" title="Độ phơi sáng Gamma">
          <span className="cell-label">Phơi sáng</span>
          <input
            type="range"
            min={50}
            max={180}
            value={Math.round(adjustments.exposure * 100)}
            onChange={(e) => onChangeAdjustments({ exposure: Number(e.target.value) / 100 })}
          />
          <span className="cell-val">{adjustments.exposure.toFixed(2)}x</span>
        </div>
      </div>
    </div>
  )
}
