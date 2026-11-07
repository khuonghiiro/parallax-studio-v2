import React, { useState } from 'react'
import type { ChromaKeySettings, ChromaKeyColorType, ChromaShadowMode } from '../layerAssembly/cutter/types'
import type { PhotoAdjustments, PhotoFilterPreset } from './types'
import { DEFAULT_PHOTO_ADJUSTMENTS } from './types'
import { isDefaultAdjustments, getPresetAdjustments } from './photoAdjustments'
import { ColorInput } from '../controls/ColorPicker'
import {
  IconChromaBackdrop,
  IconChromaTolerance,
  IconFeatherSmooth,
  IconEdgeChoke,
  IconContourStroke,
  IconCleanArtifacts,
  IconColorPresets,
  IconBrightness,
  IconContrast,
  IconSaturation,
  IconWarmth,
  IconHue,
  IconExposure,
  IconResetAll,
  IconToolEyedropper
} from './PhotoStudioIcons'
import { PhotoStudioFlyout } from './PhotoStudioFlyout'

export interface PhotoStudioRightRailProps {
  chroma: ChromaKeySettings
  onChangeChroma: (patch: Partial<ChromaKeySettings>) => void
  onPickEyedropper: () => void
  adjustments: PhotoAdjustments
  onChangeAdjustments: (patch: Partial<PhotoAdjustments>) => void
  onResetAdjustments: () => void
}

type RightFlyoutId =
  | 'color'
  | 'tolerance'
  | 'feather'
  | 'choke'
  | 'stroke'
  | 'clean'
  | 'preset'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'warmth'
  | 'hue'
  | 'exposure'
  | null

export function PhotoStudioRightRail({
  chroma,
  onChangeChroma,
  onPickEyedropper,
  adjustments,
  onChangeAdjustments,
  onResetAdjustments
}: PhotoStudioRightRailProps) {
  const [activeFlyout, setActiveFlyout] = useState<RightFlyoutId>(null)

  const toggleFlyout = (id: RightFlyoutId) => {
    setActiveFlyout((curr) => (curr === id ? null : id))
  }

  const keyType: ChromaKeyColorType = chroma.keyColorType || 'custom'
  const isolationMode = chroma.isolationMode || 'outer_only'
  const shadowMode: ChromaShadowMode =
    chroma.shadowMode && chroma.shadowMode !== 'off'
      ? chroma.shadowMode
      : chroma.keepShadows
        ? 'include'
        : 'off'

  const handleSelectColorPreset = (type: ChromaKeyColorType, hex: string) => {
    onChangeChroma({
      enabled: true,
      keyColorType: type,
      keyColorHex: hex,
      keyColor: hex,
      fringeColorType: type,
      fringeColorHex: hex
    })
  }

  const handleSelectFilterPreset = (preset: PhotoFilterPreset) => {
    if (preset === 'invert') {
      onChangeAdjustments({ ...adjustments, invert: !adjustments.invert })
    } else {
      onChangeAdjustments(getPresetAdjustments(preset))
    }
  }

  const hasColorMods = !isDefaultAdjustments(adjustments)

  return (
    <aside className="ps-right-rail" role="toolbar" aria-label="Bảng tinh chỉnh & Màu sắc" data-mcp-region="photo_editor_right_rail">
      {/* ─── GROUP 1: TÁCH NỀN & KHỬ VIỀN ─── */}
      <div className="ps-rail-group-label" title="Tách nền phông màu">
        TÁCH NỀN
      </div>

      {/* 1. Bảng màu & Tách nền (Chroma Key) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'color' ? 'active' : ''}`}
          onClick={() => toggleFlyout('color')}
          title="Tách nền Chroma Key: Chọn màu, phạm vi, độ nhạy & làm mềm biên"
        >
          <IconChromaBackdrop width={18} height={18} />
          <span className="ps-rail-label">Tách nền</span>
          <span className="ps-rail-badge">{chroma.tolerance}%</span>
          <span
            className="ps-rail-color-dot"
            style={{ background: chroma.keyColorHex || '#00DB4E' }}
            title={`Màu nền đang chọn: ${chroma.keyColorHex || '#00DB4E'}`}
          />
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'color'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Tách Nền Tự Động (Chroma Key)"
          icon={<IconChromaBackdrop width={15} height={15} />}
          badge={`${chroma.tolerance}%`}
          onReset={() =>
            onChangeChroma({
              enabled: true,
              tolerance: 18,
              smoothness: 1,
              edgeChoke: 0,
              isolationMode: 'outer_only'
            })
          }
          resetTitle="Khôi phục mặc định"
          width={320}
        >
          {/* Bật/tắt tách nền */}
          <div className="ps-flyout-row" style={{ justifyContent: 'space-between' }}>
            <span className="ps-flyout-row-title">Bật thuật toán tách nền:</span>
            <input
              type="checkbox"
              checked={chroma.enabled}
              onChange={(e) => onChangeChroma({ enabled: e.target.checked })}
            />
          </div>

          <div className="ps-flyout-divider" />

          {/* Màu phông cài sẵn */}
          <div className="ps-flyout-presets-grid">
            <button
              type="button"
              className={`ps-color-chip green ${keyType === 'chroma_green' ? 'active' : ''}`}
              onClick={() => handleSelectColorPreset('chroma_green', '#00DB4E')}
            >
              <span className="chip-dot" style={{ background: '#00DB4E' }} />
              <span>Xanh lá</span>
            </button>
            <button
              type="button"
              className={`ps-color-chip blue ${keyType === 'chroma_blue' ? 'active' : ''}`}
              onClick={() => handleSelectColorPreset('chroma_blue', '#0055FF')}
            >
              <span className="chip-dot" style={{ background: '#0055FF' }} />
              <span>Xanh lam</span>
            </button>
            <button
              type="button"
              className={`ps-color-chip white ${keyType === 'pure_white' ? 'active' : ''}`}
              onClick={() => handleSelectColorPreset('pure_white', '#FFFFFF')}
            >
              <span className="chip-dot" style={{ background: '#FFFFFF' }} />
              <span>Trắng</span>
            </button>
            <button
              type="button"
              className={`ps-color-chip black ${keyType === 'pure_black' ? 'active' : ''}`}
              onClick={() => handleSelectColorPreset('pure_black', '#000000')}
            >
              <span className="chip-dot" style={{ background: '#000000' }} />
              <span>Đen</span>
            </button>
          </div>

          <div className="ps-flyout-divider" />

          {/* ColorPicker & Hút màu */}
          <div className="ps-color-custom-section">
            <div className="ps-color-custom-row">
              <span className="ps-flyout-row-title">Màu tuỳ chọn:</span>
              <div className="ps-picker-box">
                <ColorInput
                  compact={false}
                  showText={true}
                  value={chroma.keyColorHex || '#00DB4E'}
                  onChange={(hex: string) => handleSelectColorPreset('custom', hex)}
                  title="Bấm để chọn màu tuỳ ý hoặc gõ mã HEX"
                />
              </div>
            </div>

            <button
              type="button"
              className="ps-eyedropper-action-btn"
              onClick={() => {
                onPickEyedropper()
                setActiveFlyout(null)
              }}
              title="Kích hoạt kính lúp hút màu trực tiếp từ ảnh trên canvas (Phím tắt ESC để thoát)"
            >
              <IconToolEyedropper width={14} height={14} />
              <span className="ps-action-text">Hút màu từ ảnh</span>
              <span className="ps-action-badge">Kính lúp</span>
            </button>
          </div>

          <div className="ps-flyout-divider" />

          {/* Phạm vi tách: BFS vs All */}
          <div className="ps-flyout-row">
            <span className="ps-flyout-row-title">Phạm vi:</span>
            <div className="ps-segmented-pill sm">
              <button
                type="button"
                className={`ps-seg-item ${isolationMode === 'outer_only' ? 'active' : ''}`}
                onClick={() => onChangeChroma({ isolationMode: 'outer_only' })}
                title="Chỉ tách nền ngoài biên (BFS), bảo vệ áo trắng/mắt/da bên trong nhân vật"
              >
                Giữ ruột (BFS)
              </button>
              <button
                type="button"
                className={`ps-seg-item ${isolationMode === 'all' ? 'active' : ''}`}
                onClick={() => onChangeChroma({ isolationMode: 'all' })}
                title="Tách toàn bộ pixel trùng màu trên khắp ảnh (thích hợp cho cây cối/hoa lá có nhiều khe hở)"
              >
                Toàn bộ
              </button>
            </div>
          </div>

          <div className="ps-flyout-divider" />

          {/* Slider 1: Độ nhạy (Tolerance) */}
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Độ nhạy:</span>
            <input
              type="range"
              min={1}
              max={100}
              value={chroma.tolerance}
              onChange={(e) => onChangeChroma({ tolerance: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">{chroma.tolerance}%</span>
          </div>
          <div className="ps-flyout-presets">
            {[10, 18, 25, 36, 50, 75].map((tol) => (
              <button
                key={tol}
                type="button"
                className={`ps-chip-btn ${chroma.tolerance === tol ? 'active' : ''}`}
                onClick={() => onChangeChroma({ tolerance: tol })}
              >
                {tol}%
              </button>
            ))}
          </div>

          {/* Slider 2: Mềm biên (Feather) */}
          <div className="ps-flyout-slider-row" style={{ marginTop: 4 }}>
            <span className="ps-flyout-label">Mềm biên:</span>
            <input
              type="range"
              min={0}
              max={20}
              value={chroma.smoothness}
              onChange={(e) => onChangeChroma({ smoothness: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">{chroma.smoothness}px</span>
          </div>
          <div className="ps-flyout-presets">
            {[0, 1, 2, 4, 8, 16].map((v) => (
              <button
                key={v}
                type="button"
                className={`ps-chip-btn ${chroma.smoothness === v ? 'active' : ''}`}
                onClick={() => onChangeChroma({ smoothness: v })}
              >
                {v}px
              </button>
            ))}
          </div>

          {/* Slider 3: Gọt viền (Edge Choke) */}
          <div className="ps-flyout-slider-row" style={{ marginTop: 4 }}>
            <span className="ps-flyout-label">Gọt viền:</span>
            <input
              type="range"
              min={0}
              max={8}
              value={chroma.edgeChoke ?? 0}
              onChange={(e) => onChangeChroma({ edgeChoke: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">{chroma.edgeChoke ?? 0}px</span>
          </div>
          <div className="ps-flyout-presets">
            {[0, 1, 2, 4, 6].map((v) => (
              <button
                key={v}
                type="button"
                className={`ps-chip-btn ${(chroma.edgeChoke ?? 0) === v ? 'active' : ''}`}
                onClick={() => onChangeChroma({ edgeChoke: v })}
              >
                {v}px
              </button>
            ))}
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* 2. Khử Viền, Lọc Sạn & Bóng Mờ (Cleanup) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'clean' ? 'active' : ''} ${
            (chroma.defringeStrength ?? 0) > 0 || (chroma.despeckleSize ?? 0) > 0 ? 'modified' : ''
          }`}
          onClick={() => toggleFlyout('clean')}
          title="Khử viền ám màu, làm mịn răng cưa, lọc đốm rác & xử lý bóng mờ"
        >
          <IconCleanArtifacts width={18} height={18} />
          <span className="ps-rail-label">Khử viền</span>
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'clean'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          placement="bottom"
          title="Khử Viền & Lọc Sạn"
          icon={<IconCleanArtifacts width={15} height={15} />}
          onReset={() =>
            onChangeChroma({
              defringeStrength: 0,
              edgeSmooth: 0,
              despeckleSize: 0,
              removeSoftHalo: false,
              shadowMode: 'off',
              keepShadows: false
            })
          }
          resetTitle="Đặt lại"
          width={310}
        >
          <div className="ps-flyout-row">
            <span className="ps-flyout-row-title">Khử lem màu (Defringe):</span>
            <input
              type="checkbox"
              checked={(chroma.defringeStrength ?? 0) > 0}
              onChange={(e) => onChangeChroma({ defringeStrength: e.target.checked ? 60 : 0 })}
            />
          </div>
          {(chroma.defringeStrength ?? 0) > 0 && (
            <div className="ps-flyout-slider-row">
              <span className="ps-flyout-label">Mức độ:</span>
              <input
                type="range"
                min={10}
                max={100}
                value={chroma.defringeStrength ?? 60}
                onChange={(e) => onChangeChroma({ defringeStrength: Number(e.target.value) })}
              />
              <span className="ps-flyout-val">{chroma.defringeStrength ?? 60}%</span>
            </div>
          )}

          <div className="ps-flyout-divider" />

          <div className="ps-flyout-row">
            <span className="ps-flyout-row-title">Làm mịn mép (Edge Smooth):</span>
            <input
              type="checkbox"
              checked={(chroma.edgeSmooth ?? 0) > 0}
              onChange={(e) => onChangeChroma({ edgeSmooth: e.target.checked ? 3 : 0 })}
            />
          </div>
          {(chroma.edgeSmooth ?? 0) > 0 && (
            <div className="ps-flyout-slider-row">
              <span className="ps-flyout-label">Độ mịn:</span>
              <input
                type="range"
                min={1}
                max={10}
                value={chroma.edgeSmooth ?? 3}
                onChange={(e) => onChangeChroma({ edgeSmooth: Number(e.target.value) })}
              />
              <span className="ps-flyout-val">{chroma.edgeSmooth ?? 3}px</span>
            </div>
          )}

          <div className="ps-flyout-divider" />

          <div className="ps-flyout-row">
            <span className="ps-flyout-row-title">Xóa hạt rác (Despeckle):</span>
            <input
              type="checkbox"
              checked={(chroma.despeckleSize ?? 0) > 0}
              onChange={(e) => onChangeChroma({ despeckleSize: e.target.checked ? 16 : 0 })}
            />
          </div>

          <div className="ps-flyout-divider" />

          <div className="ps-flyout-row">
            <span className="ps-flyout-row-title">Khử viền mờ (Remove Halo):</span>
            <input
              type="checkbox"
              checked={chroma.removeSoftHalo ?? false}
              onChange={(e) => onChangeChroma({ removeSoftHalo: e.target.checked })}
            />
          </div>

          <div className="ps-flyout-divider" />

          {/* Bóng mờ */}
          <div className="ps-flyout-row">
            <span className="ps-flyout-row-title">Bóng mờ:</span>
            <div className="ps-segmented-pill sm">
              <button
                type="button"
                className={`ps-seg-item ${shadowMode === 'off' ? 'active' : ''}`}
                onClick={() => onChangeChroma({ shadowMode: 'off', keepShadows: false })}
                title="Xóa triệt để mọi bóng mờ"
              >
                Xóa bóng
              </button>
              <button
                type="button"
                className={`ps-seg-item ${shadowMode === 'include' ? 'active' : ''}`}
                onClick={() => onChangeChroma({ shadowMode: 'include', keepShadows: true, shadowRetention: 65, shadowSolidThreshold: 62 })}
                title="Giữ lại bóng mờ mềm mại tự nhiên"
              >
                Lấy cả bóng
              </button>
            </div>
          </div>

          {shadowMode === 'include' && (
            <label className="ps-checkbox-label sm" title="Khử màu nền ám vào vùng bóng mờ" style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={chroma.shadowUnmixColor ?? true}
                onChange={(e) => onChangeChroma({ shadowUnmixColor: e.target.checked })}
              />
              <span>Khử ám màu nền vào bóng</span>
            </label>
          )}
        </PhotoStudioFlyout>
      </div>

      {/* 3. Viền nét mịn (Contour Stroke) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'stroke' ? 'active' : ''} ${
            (chroma.strokeWidth ?? 0) > 0 ? 'modified' : ''
          }`}
          onClick={() => toggleFlyout('stroke')}
          title="Vẽ viền nét mịn ngoài nhân vật"
        >
          <IconContourStroke width={18} height={18} />
          <span className="ps-rail-label">Viền nét</span>
          <span className="ps-rail-badge">{chroma.strokeWidth ?? 0}px</span>
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'stroke'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Viền nét nhân vật"
          icon={<IconContourStroke width={15} height={15} />}
          badge={`${chroma.strokeWidth ?? 0}px`}
          onReset={() => onChangeChroma({ strokeWidth: 0, strokeColorHex: '#ffffff' })}
          resetTitle="Tắt viền"
          width={280}
        >
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Độ dày:</span>
            <input
              type="range"
              min={0}
              max={10}
              value={chroma.strokeWidth ?? 0}
              onChange={(e) => onChangeChroma({ strokeWidth: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">{chroma.strokeWidth ?? 0}px</span>
          </div>
          <div className="ps-flyout-row" style={{ marginTop: 8 }}>
            <span className="ps-flyout-label">Màu viền:</span>
            <div className="ps-picker-box">
              <ColorInput
                compact={false}
                showText={true}
                value={chroma.strokeColorHex || '#ffffff'}
                onChange={(hex: string) => onChangeChroma({ strokeColorHex: hex })}
              />
            </div>
          </div>
        </PhotoStudioFlyout>
      </div>

      <div className="ps-rail-divider" />

      {/* ─── GROUP 2: CHỈNH MÀU SẮC & ÁNH SÁNG ─── */}
      <div className="ps-rail-group-label" title="Chỉnh màu ảnh">
        MÀU SẮC
      </div>

      {/* 7. Bộ lọc màu Presets */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'preset' ? 'active' : ''}`}
          onClick={() => toggleFlyout('preset')}
          title="Bộ lọc màu cài sẵn (Presets)"
        >
          <IconColorPresets width={18} height={18} />
          <span className="ps-rail-label">Bộ lọc</span>
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'preset'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          placement="bottom"
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

      {/* 8. Độ sáng (Brightness) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'brightness' ? 'active' : ''} ${adjustments.brightness !== 0 ? 'modified' : ''}`}
          onClick={() => toggleFlyout('brightness')}
          title="Độ sáng ảnh (-100% đến +100%)"
        >
          <IconBrightness width={18} height={18} />
          <span className="ps-rail-label">Độ sáng</span>
          {adjustments.brightness !== 0 && (
            <span className="ps-rail-badge">{adjustments.brightness > 0 ? `+${adjustments.brightness}` : adjustments.brightness}%</span>
          )}
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'brightness'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          placement="bottom"
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
            <span className="ps-flyout-val">{adjustments.brightness > 0 ? `+${adjustments.brightness}` : adjustments.brightness}%</span>
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

      {/* 9. Tương phản (Contrast) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'contrast' ? 'active' : ''} ${adjustments.contrast !== 0 ? 'modified' : ''}`}
          onClick={() => toggleFlyout('contrast')}
          title="Độ tương phản (-100% đến +100%)"
        >
          <IconContrast width={18} height={18} />
          <span className="ps-rail-label">Tương phản</span>
          {adjustments.contrast !== 0 && (
            <span className="ps-rail-badge">{adjustments.contrast > 0 ? `+${adjustments.contrast}` : adjustments.contrast}%</span>
          )}
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'contrast'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          placement="bottom"
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
            <span className="ps-flyout-val">{adjustments.contrast > 0 ? `+${adjustments.contrast}` : adjustments.contrast}%</span>
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

      {/* 10. Bão hòa (Saturation) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'saturation' ? 'active' : ''} ${adjustments.saturation !== 0 ? 'modified' : ''}`}
          onClick={() => toggleFlyout('saturation')}
          title="Độ bão hòa màu (-100% đến +100%)"
        >
          <IconSaturation width={18} height={18} />
          <span className="ps-rail-label">Bão hòa</span>
          {adjustments.saturation !== 0 && (
            <span className="ps-rail-badge">{adjustments.saturation > 0 ? `+${adjustments.saturation}` : adjustments.saturation}%</span>
          )}
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'saturation'}
          onClose={() => setActiveFlyout(null)}
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
            <span className="ps-flyout-val">{adjustments.saturation > 0 ? `+${adjustments.saturation}` : adjustments.saturation}%</span>
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

      {/* 11. Nhiệt độ màu (Warmth) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'warmth' ? 'active' : ''} ${adjustments.warmth !== 0 ? 'modified' : ''}`}
          onClick={() => toggleFlyout('warmth')}
          title="Nhiệt độ màu: Lạnh (-100%) đến Ấm (+100%)"
        >
          <IconWarmth width={18} height={18} />
          <span className="ps-rail-label">Nhiệt độ</span>
          {adjustments.warmth !== 0 && (
            <span className="ps-rail-badge">{adjustments.warmth > 0 ? `+${adjustments.warmth}` : adjustments.warmth}%</span>
          )}
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'warmth'}
          onClose={() => setActiveFlyout(null)}
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
            <span className="ps-flyout-val">{adjustments.warmth > 0 ? `+${adjustments.warmth}` : adjustments.warmth}%</span>
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

      {/* 12. Tông màu (Hue Shift) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'hue' ? 'active' : ''} ${adjustments.hue !== 0 ? 'modified' : ''}`}
          onClick={() => toggleFlyout('hue')}
          title="Đổi tông màu vòng tròn Hue (-180° đến +180°)"
        >
          <IconHue width={18} height={18} />
          <span className="ps-rail-label">Tông màu</span>
          {adjustments.hue !== 0 && (
            <span className="ps-rail-badge">{adjustments.hue}°</span>
          )}
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'hue'}
          onClose={() => setActiveFlyout(null)}
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

      {/* 13. Phơi sáng (Exposure) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'exposure' ? 'active' : ''} ${adjustments.exposure !== 1.0 ? 'modified' : ''}`}
          onClick={() => toggleFlyout('exposure')}
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
          onClose={() => setActiveFlyout(null)}
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

      {/* 14. Đặt lại toàn bộ thông số màu */}
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
    </aside>
  )
}
