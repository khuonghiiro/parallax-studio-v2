import React from 'react'
import type { PhotoAdjustments, PhotoFilterPreset } from './types'
import { isDefaultAdjustments, getPresetAdjustments } from './photoAdjustments'
import {
  IconColorPresets,
  IconBrightness,
  IconContrast,
  IconSaturation,
  IconWarmth,
  IconHue,
  IconExposure,
  IconResetAll
} from './PhotoStudioIcons'
import { PhotoStudioFlyout } from './PhotoStudioFlyout'

export type ColorGradingFlyoutId =
  | 'preset'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'warmth'
  | 'hue'
  | 'exposure'

export interface PhotoStudioColorGradingRailGroupProps {
  activeFlyout: string | null
  onToggleFlyout: (id: ColorGradingFlyoutId) => void
  onCloseFlyout: () => void
  adjustments: PhotoAdjustments
  onChangeAdjustments: (patch: Partial<PhotoAdjustments>) => void
  onResetAdjustments: () => void
}

export function PhotoStudioColorGradingRailGroup({
  activeFlyout,
  onToggleFlyout,
  onCloseFlyout,
  adjustments,
  onChangeAdjustments,
  onResetAdjustments
}: PhotoStudioColorGradingRailGroupProps) {
  const handleSelectFilterPreset = (preset: PhotoFilterPreset) => {
    if (preset === 'invert') {
      onChangeAdjustments({ ...adjustments, invert: !adjustments.invert })
    } else {
      onChangeAdjustments(getPresetAdjustments(preset))
    }
  }

  const hasColorMods = !isDefaultAdjustments(adjustments)

  return (
    <>
      <div className="ps-rail-group-label" title="Chỉnh màu ảnh">
        MÀU SẮC
      </div>

      {/* Bộ lọc màu Presets */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'preset' ? 'active' : ''}`}
          onClick={() => onToggleFlyout('preset')}
          title="Bộ lọc màu cài sẵn (Presets)"
        >
          <IconColorPresets width={18} height={18} />
          <span className="ps-rail-label">Bộ lọc</span>
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'preset'}
          onClose={onCloseFlyout}
          side="left"
          title="Bộ lọc màu sắc"
          icon={<IconColorPresets width={15} height={15} />}
          width={290}
        >
          <div className="ps-flyout-presets-grid cols-2">
            <button
              type="button"
              className="ps-filter-btn"
              onClick={() => handleSelectFilterPreset('original')}
            >
              🌿 Tự nhiên
            </button>
            <button
              type="button"
              className="ps-filter-btn"
              onClick={() => handleSelectFilterPreset('vivid')}
            >
              🎨 Tươi sáng
            </button>
            <button
              type="button"
              className="ps-filter-btn"
              onClick={() => handleSelectFilterPreset('warm_anime')}
            >
              🌅 Ấm áp Anime
            </button>
            <button
              type="button"
              className="ps-filter-btn"
              onClick={() => handleSelectFilterPreset('cinematic_cool')}
            >
              🎬 Điện ảnh
            </button>
            <button
              type="button"
              className="ps-filter-btn"
              onClick={() => handleSelectFilterPreset('bw')}
            >
              🌑 Đen trắng
            </button>
            <button
              type="button"
              className={`ps-filter-btn ${adjustments.invert ? 'active' : ''}`}
              onClick={() => handleSelectFilterPreset('invert')}
            >
              🎭 Đảo màu
            </button>
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* Độ sáng (Brightness) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'brightness' ? 'active' : ''} ${adjustments.brightness !== 0 ? 'modified' : ''}`}
          onClick={() => onToggleFlyout('brightness')}
          title="Độ sáng ảnh (-100% đến +100%)"
        >
          <IconBrightness width={18} height={18} />
          <span className="ps-rail-label">Độ sáng</span>
          {adjustments.brightness !== 0 && (
            <span className="ps-rail-badge">
              {adjustments.brightness > 0 ? `+${adjustments.brightness}` : adjustments.brightness}%
            </span>
          )}
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'brightness'}
          onClose={onCloseFlyout}
          side="left"
          title="Độ sáng ảnh"
          icon={<IconBrightness width={15} height={15} />}
          badge={adjustments.brightness !== 0 ? `${adjustments.brightness}%` : undefined}
          onReset={() => onChangeAdjustments({ brightness: 0 })}
          resetTitle="Đặt lại 0%"
          width={280}
        >
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Độ sáng:</span>
            <input
              type="range"
              min={-100}
              max={100}
              value={adjustments.brightness}
              onChange={(e) => onChangeAdjustments({ brightness: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">
              {adjustments.brightness > 0 ? `+${adjustments.brightness}` : adjustments.brightness}%
            </span>
          </div>
          <div className="ps-flyout-presets">
            {[-25, -10, 0, 10, 25].map((v) => (
              <button
                key={v}
                type="button"
                className={`ps-chip-btn ${adjustments.brightness === v ? 'active' : ''}`}
                onClick={() => onChangeAdjustments({ brightness: v })}
              >
                {v > 0 ? `+${v}` : v}%
              </button>
            ))}
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* Tương phản (Contrast) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'contrast' ? 'active' : ''} ${adjustments.contrast !== 0 ? 'modified' : ''}`}
          onClick={() => onToggleFlyout('contrast')}
          title="Độ tương phản (-100% đến +100%)"
        >
          <IconContrast width={18} height={18} />
          <span className="ps-rail-label">Tương phản</span>
          {adjustments.contrast !== 0 && (
            <span className="ps-rail-badge">
              {adjustments.contrast > 0 ? `+${adjustments.contrast}` : adjustments.contrast}%
            </span>
          )}
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'contrast'}
          onClose={onCloseFlyout}
          side="left"
          title="Độ tương phản"
          icon={<IconContrast width={15} height={15} />}
          badge={adjustments.contrast !== 0 ? `${adjustments.contrast}%` : undefined}
          onReset={() => onChangeAdjustments({ contrast: 0 })}
          resetTitle="Đặt lại 0%"
          width={280}
        >
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Tương phản:</span>
            <input
              type="range"
              min={-100}
              max={100}
              value={adjustments.contrast}
              onChange={(e) => onChangeAdjustments({ contrast: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">
              {adjustments.contrast > 0 ? `+${adjustments.contrast}` : adjustments.contrast}%
            </span>
          </div>
          <div className="ps-flyout-presets">
            {[-20, 0, 15, 30, 50].map((v) => (
              <button
                key={v}
                type="button"
                className={`ps-chip-btn ${adjustments.contrast === v ? 'active' : ''}`}
                onClick={() => onChangeAdjustments({ contrast: v })}
              >
                {v > 0 ? `+${v}` : v}%
              </button>
            ))}
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* Bão hòa (Saturation) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'saturation' ? 'active' : ''} ${adjustments.saturation !== 0 ? 'modified' : ''}`}
          onClick={() => onToggleFlyout('saturation')}
          title="Độ bão hòa màu (-100% đến +100%)"
        >
          <IconSaturation width={18} height={18} />
          <span className="ps-rail-label">Bão hòa</span>
          {adjustments.saturation !== 0 && (
            <span className="ps-rail-badge">
              {adjustments.saturation > 0 ? `+${adjustments.saturation}` : adjustments.saturation}%
            </span>
          )}
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'saturation'}
          onClose={onCloseFlyout}
          side="left"
          placement="bottom"
          title="Độ bão hòa màu"
          icon={<IconSaturation width={15} height={15} />}
          badge={adjustments.saturation !== 0 ? `${adjustments.saturation}%` : undefined}
          onReset={() => onChangeAdjustments({ saturation: 0 })}
          resetTitle="Đặt lại 0%"
          width={280}
        >
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Bão hòa:</span>
            <input
              type="range"
              min={-100}
              max={100}
              value={adjustments.saturation}
              onChange={(e) => onChangeAdjustments({ saturation: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">
              {adjustments.saturation > 0 ? `+${adjustments.saturation}` : adjustments.saturation}%
            </span>
          </div>
          <div className="ps-flyout-presets">
            {[-100, -30, 0, 20, 50].map((v) => (
              <button
                key={v}
                type="button"
                className={`ps-chip-btn ${adjustments.saturation === v ? 'active' : ''}`}
                onClick={() => onChangeAdjustments({ saturation: v })}
              >
                {v > 0 ? `+${v}` : v}%
              </button>
            ))}
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* Nhiệt độ màu (Warmth) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'warmth' ? 'active' : ''} ${adjustments.warmth !== 0 ? 'modified' : ''}`}
          onClick={() => onToggleFlyout('warmth')}
          title="Nhiệt độ màu: Lạnh (-100%) đến Ấm (+100%)"
        >
          <IconWarmth width={18} height={18} />
          <span className="ps-rail-label">Nhiệt độ</span>
          {adjustments.warmth !== 0 && (
            <span className="ps-rail-badge">
              {adjustments.warmth > 0 ? `+${adjustments.warmth}` : adjustments.warmth}%
            </span>
          )}
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'warmth'}
          onClose={onCloseFlyout}
          side="left"
          placement="bottom"
          title="Nhiệt độ (Ấm / Lạnh)"
          icon={<IconWarmth width={15} height={15} />}
          badge={adjustments.warmth !== 0 ? `${adjustments.warmth}%` : undefined}
          onReset={() => onChangeAdjustments({ warmth: 0 })}
          resetTitle="Đặt lại 0%"
          width={280}
        >
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Nhiệt độ:</span>
            <input
              type="range"
              min={-100}
              max={100}
              value={adjustments.warmth}
              onChange={(e) => onChangeAdjustments({ warmth: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">
              {adjustments.warmth > 0 ? `+${adjustments.warmth}` : adjustments.warmth}%
            </span>
          </div>
          <div className="ps-flyout-presets">
            {[-40, -15, 0, 15, 40].map((v) => (
              <button
                key={v}
                type="button"
                className={`ps-chip-btn ${adjustments.warmth === v ? 'active' : ''}`}
                onClick={() => onChangeAdjustments({ warmth: v })}
              >
                {v > 0 ? `+${v}` : v}%
              </button>
            ))}
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* Tông màu (Hue Shift) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'hue' ? 'active' : ''} ${adjustments.hue !== 0 ? 'modified' : ''}`}
          onClick={() => onToggleFlyout('hue')}
          title="Đổi tông màu vòng tròn Hue (-180° đến +180°)"
        >
          <IconHue width={18} height={18} />
          <span className="ps-rail-label">Tông màu</span>
          {adjustments.hue !== 0 && <span className="ps-rail-badge">{adjustments.hue}°</span>}
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'hue'}
          onClose={onCloseFlyout}
          side="left"
          placement="bottom"
          title="Tông màu (Hue)"
          icon={<IconHue width={15} height={15} />}
          badge={adjustments.hue !== 0 ? `${adjustments.hue}°` : undefined}
          onReset={() => onChangeAdjustments({ hue: 0 })}
          resetTitle="Đặt lại 0°"
          width={280}
        >
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Góc xoay:</span>
            <input
              type="range"
              min={-180}
              max={180}
              value={adjustments.hue}
              onChange={(e) => onChangeAdjustments({ hue: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">{adjustments.hue}°</span>
          </div>
          <div className="ps-flyout-presets">
            {[-90, -45, 0, 45, 90].map((v) => (
              <button
                key={v}
                type="button"
                className={`ps-chip-btn ${adjustments.hue === v ? 'active' : ''}`}
                onClick={() => onChangeAdjustments({ hue: v })}
              >
                {v}°
              </button>
            ))}
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* Phơi sáng (Exposure) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'exposure' ? 'active' : ''} ${adjustments.exposure !== 1.0 ? 'modified' : ''}`}
          onClick={() => onToggleFlyout('exposure')}
          title="Độ phơi sáng máy ảnh (0.2x đến 2.5x)"
        >
          <IconExposure width={18} height={18} />
          <span className="ps-rail-label">Phơi sáng</span>
          {adjustments.exposure !== 1.0 && (
            <span className="ps-rail-badge">{adjustments.exposure.toFixed(2)}x</span>
          )}
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'exposure'}
          onClose={onCloseFlyout}
          side="left"
          placement="bottom"
          title="Độ phơi sáng"
          icon={<IconExposure width={15} height={15} />}
          badge={adjustments.exposure !== 1.0 ? `${adjustments.exposure.toFixed(2)}x` : undefined}
          onReset={() => onChangeAdjustments({ exposure: 1.0 })}
          resetTitle="Đặt lại 1.0x"
          width={280}
        >
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Phơi sáng:</span>
            <input
              type="range"
              min={0.2}
              max={2.5}
              step={0.05}
              value={adjustments.exposure}
              onChange={(e) => onChangeAdjustments({ exposure: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">{adjustments.exposure.toFixed(2)}x</span>
          </div>
          <div className="ps-flyout-presets">
            {[0.5, 0.8, 1.0, 1.25, 1.6].map((v) => (
              <button
                key={v}
                type="button"
                className={`ps-chip-btn ${adjustments.exposure === v ? 'active' : ''}`}
                onClick={() => onChangeAdjustments({ exposure: v })}
              >
                {v.toFixed(2)}x
              </button>
            ))}
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* Đặt lại toàn bộ thông số màu */}
      {hasColorMods && (
        <div className="ps-rail-item">
          <button
            type="button"
            className="ps-rail-btn reset-btn"
            onClick={onResetAdjustments}
            title="Đặt lại toàn bộ thông số màu về mặc định"
          >
            <IconResetAll width={16} height={16} />
            <span className="ps-rail-label">Đặt lại</span>
          </button>
        </div>
      )}
    </>
  )
}
