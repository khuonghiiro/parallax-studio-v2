import React, { useState } from 'react'
import type { ChromaKeySettings, ChromaKeyColorType, ChromaShadowMode } from '../layerAssembly/cutter/types'
import type { PhotoAdjustments, PhotoFilterPreset } from './types'
import { DEFAULT_PHOTO_ADJUSTMENTS } from './types'
import { isDefaultAdjustments } from './photoAdjustments'
import { ColorInput } from '../controls/ColorPicker'
import {
  IconTolerance,
  IconFeather,
  IconEdgeChoke,
  IconContourStroke,
  IconShieldClean,
  IconPalette,
  IconContrast,
  IconSaturation,
  IconWarmth,
  IconHue,
  IconExposure
} from './PhotoStudioIcons'
import { IconSun, IconSparkles, IconEyedropper } from '../icons'
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
    switch (preset) {
      case 'original':
        onChangeAdjustments(DEFAULT_PHOTO_ADJUSTMENTS)
        break
      case 'vivid':
        onChangeAdjustments({
          brightness: 6,
          contrast: 14,
          saturation: 28,
          warmth: 4,
          hue: 0,
          exposure: 1.05,
          grayscale: false,
          invert: false
        })
        break
      case 'warm_anime':
        onChangeAdjustments({
          brightness: 8,
          contrast: 10,
          saturation: 18,
          warmth: 24,
          hue: 0,
          exposure: 1.08,
          grayscale: false,
          invert: false
        })
        break
      case 'cinematic_cool':
        onChangeAdjustments({
          brightness: -4,
          contrast: 22,
          saturation: -8,
          warmth: -20,
          hue: 0,
          exposure: 0.96,
          grayscale: false,
          invert: false
        })
        break
      case 'bw':
        onChangeAdjustments({
          brightness: 0,
          contrast: 16,
          saturation: -100,
          warmth: 0,
          hue: 0,
          exposure: 1.0,
          grayscale: true,
          invert: false
        })
        break
      case 'invert':
        onChangeAdjustments({
          ...adjustments,
          invert: !adjustments.invert
        })
        break
    }
  }

  const hasColorMods = !isDefaultAdjustments(adjustments)

  return (
    <aside className="ps-right-rail" role="toolbar" aria-label="Bảng tinh chỉnh & Màu sắc" data-mcp-region="photo_editor_right_rail">
      {/* ─── GROUP 1: TÁCH NỀN & KHỬ VIỀN ─── */}
      <div className="ps-rail-group-label" title="Tách nền phông màu">
        TÁCH NỀN
      </div>

      {/* 1. Bảng màu tách phông */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'color' ? 'active' : ''}`}
          onClick={() => toggleFlyout('color')}
          title="Bảng màu nền & Chế độ tách"
        >
          <span
            className="ps-rail-color-dot"
            style={{ background: chroma.keyColorHex || '#00DB4E' }}
          />
          <span className="ps-rail-label">Màu nền</span>
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'color'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Màu nền & Chế độ tách"
          icon={<IconSparkles width={14} height={14} />}
          width={280}
        >
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
          <div className="ps-flyout-row-wrap">
            <button
              type="button"
              className="ps-btn ghost xs"
              onClick={() => {
                onPickEyedropper()
                setActiveFlyout(null)
              }}
              title="Kích hoạt kính lúp hút màu trực tiếp từ ảnh"
            >
              <IconEyedropper width={13} height={13} />
              <span>Hút màu từ ảnh</span>
            </button>
            <div className="ps-picker-box">
              <ColorInput
                compact
                showText
                value={chroma.keyColorHex || '#00DB4E'}
                onChange={(hex: string) => handleSelectColorPreset('custom', hex)}
              />
            </div>
          </div>

          <div className="ps-flyout-divider" />

          {/* BFS vs All */}
          <div className="ps-flyout-row">
            <span className="ps-flyout-row-title">Phạm vi:</span>
            <div className="ps-segmented-pill sm">
              <button
                type="button"
                className={`ps-seg-item ${isolationMode === 'outer_only' ? 'active' : ''}`}
                onClick={() => onChangeChroma({ isolationMode: 'outer_only' })}
                title="Chỉ tách nền ngoài biên, bảo vệ mắt/áo bên trong"
              >
                Giữ ruột (BFS)
              </button>
              <button
                type="button"
                className={`ps-seg-item ${isolationMode === 'all' ? 'active' : ''}`}
                onClick={() => onChangeChroma({ isolationMode: 'all' })}
                title="Tách toàn bộ pixel trùng màu trên khắp ảnh"
              >
                Toàn bộ
              </button>
            </div>
          </div>

          {/* Bóng mờ */}
          <div className="ps-flyout-row">
            <span className="ps-flyout-row-title">Bóng mờ:</span>
            <div className="ps-segmented-pill sm">
              <button
                type="button"
                className={`ps-seg-item ${shadowMode === 'off' ? 'active' : ''}`}
                onClick={() => onChangeChroma({ shadowMode: 'off', keepShadows: false })}
              >
                Xóa bóng
              </button>
              <button
                type="button"
                className={`ps-seg-item ${shadowMode === 'include' ? 'active' : ''}`}
                onClick={() => onChangeChroma({ shadowMode: 'include', keepShadows: true })}
                title="Giữ bóng mờ bán trong suốt"
              >
                Lấy cả bóng
              </button>
            </div>
          </div>

          <label className="ps-checkbox-label sm" style={{ marginTop: 6 }}>
            <input
              type="checkbox"
              checked={chroma.shadowUnmixColor !== false}
              onChange={(e) => onChangeChroma({ shadowUnmixColor: e.target.checked })}
            />
            <span>Khử ám màu nền vào bóng</span>
          </label>
        </PhotoStudioFlyout>
      </div>

      {/* 2. Độ nhạy (Tolerance) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'tolerance' ? 'active' : ''}`}
          onClick={() => toggleFlyout('tolerance')}
          title="Độ nhạy nhận diện màu nền"
        >
          <IconTolerance width={18} height={18} />
          <span className="ps-rail-label">Độ nhạy</span>
          <span className="ps-rail-badge">{chroma.tolerance}%</span>
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'tolerance'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Độ nhạy tách nền"
          icon={<IconTolerance width={15} height={15} />}
          badge={`${chroma.tolerance}%`}
          onReset={() => onChangeChroma({ tolerance: 36 })}
          resetTitle="Đặt lại 36%"
          width={250}
        >
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Độ nhạy:</span>
            <input
              type="range"
              min={0}
              max={100}
              value={chroma.tolerance}
              onChange={(e) => onChangeChroma({ tolerance: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">{chroma.tolerance}%</span>
          </div>
          <div className="ps-flyout-presets">
            {[15, 25, 36, 50, 75, 100].map((v) => (
              <button
                key={v}
                type="button"
                className={`ps-chip-btn ${chroma.tolerance === v ? 'active' : ''}`}
                onClick={() => onChangeChroma({ tolerance: v })}
              >
                {v}%
              </button>
            ))}
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* 3. Mềm biên (Feather) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'feather' ? 'active' : ''}`}
          onClick={() => toggleFlyout('feather')}
          title="Làm mềm mờ biên ngoài (Feather không răng cưa)"
        >
          <IconFeather width={18} height={18} />
          <span className="ps-rail-label">Mềm biên</span>
          <span className="ps-rail-badge">{chroma.smoothness}px</span>
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'feather'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Mềm biên không răng cưa"
          icon={<IconFeather width={15} height={15} />}
          badge={`${chroma.smoothness}px`}
          onReset={() => onChangeChroma({ smoothness: 2 })}
          resetTitle="Đặt lại 2px"
          width={250}
        >
          <div className="ps-flyout-slider-row">
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
        </PhotoStudioFlyout>
      </div>

      {/* 4. Gọt viền (Edge Choke) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'choke' ? 'active' : ''}`}
          onClick={() => toggleFlyout('choke')}
          title="Gọt bớt lớp viền lem ám màu nền"
        >
          <IconEdgeChoke width={18} height={18} />
          <span className="ps-rail-label">Gọt viền</span>
          <span className="ps-rail-badge">{chroma.edgeChoke ?? 0}px</span>
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'choke'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Gọt viền lem ám nền"
          icon={<IconEdgeChoke width={15} height={15} />}
          badge={`${chroma.edgeChoke ?? 0}px`}
          onReset={() => onChangeChroma({ edgeChoke: 0 })}
          resetTitle="Đặt lại 0px"
          width={250}
        >
          <div className="ps-flyout-slider-row">
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

      {/* 5. Viền nét mịn (Contour Stroke) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'stroke' ? 'active' : ''}`}
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
          title="Viền nét mịn nhân vật"
          icon={<IconContourStroke width={15} height={15} />}
          badge={`${chroma.strokeWidth ?? 0}px`}
          onReset={() => onChangeChroma({ strokeWidth: 0, strokeColorHex: '#ffffff' })}
          resetTitle="Tắt viền"
          width={260}
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
            <ColorInput
              compact
              showText
              value={chroma.strokeColorHex || '#ffffff'}
              onChange={(hex: string) => onChangeChroma({ strokeColorHex: hex })}
            />
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* 6. Khử lem & Lọc đốm rác (Advanced) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'clean' ? 'active' : ''}`}
          onClick={() => toggleFlyout('clean')}
          title="Khử tràn màu (Defringe), khử răng cưa và dọn rác"
        >
          <IconShieldClean width={18} height={18} />
          <span className="ps-rail-label">Lọc rác</span>
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'clean'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          placement="bottom"
          title="Khử viền lem & Đốm rác"
          icon={<IconShieldClean width={15} height={15} />}
          onReset={() =>
            onChangeChroma({
              defringeStrength: 45,
              edgeSmooth: 2,
              despeckleSize: 16,
              removeSoftHalo: true
            })
          }
          width={270}
        >
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Khử màu viền:</span>
            <input
              type="range"
              min={0}
              max={100}
              value={chroma.defringeStrength ?? 45}
              onChange={(e) => onChangeChroma({ defringeStrength: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">{chroma.defringeStrength ?? 45}%</span>
          </div>
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Lọc răng cưa:</span>
            <input
              type="range"
              min={0}
              max={10}
              value={chroma.edgeSmooth ?? 2}
              onChange={(e) => onChangeChroma({ edgeSmooth: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">{chroma.edgeSmooth ?? 2}px</span>
          </div>
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Xóa đốm rác:</span>
            <input
              type="range"
              min={0}
              max={300}
              value={chroma.despeckleSize ?? 16}
              onChange={(e) => onChangeChroma({ despeckleSize: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">{chroma.despeckleSize ?? 16}px</span>
          </div>
          <label className="ps-checkbox-label sm" style={{ marginTop: 6 }}>
            <input
              type="checkbox"
              checked={chroma.removeSoftHalo !== false}
              onChange={(e) => onChangeChroma({ removeSoftHalo: e.target.checked })}
            />
            <span>Xóa quầng mờ sáng quanh mép</span>
          </label>
        </PhotoStudioFlyout>
      </div>

      <div className="ps-rail-divider" />

      {/* ─── GROUP 2: CHỈNH MÀU & BỘ LỌC ─── */}
      <div className="ps-rail-group-label" title="Chỉnh màu sắc ảnh">
        MÀU SẮC
      </div>

      {/* 7. Bộ lọc ảnh (Presets) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${activeFlyout === 'preset' ? 'active' : ''}`}
          onClick={() => toggleFlyout('preset')}
          title="Bộ lọc màu 1-Click"
        >
          <IconPalette width={18} height={18} />
          <span className="ps-rail-label">Bộ lọc</span>
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'preset'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Bộ lọc ảnh nghệ thuật"
          icon={<IconPalette width={15} height={15} />}
          width={260}
        >
          <div className="ps-flyout-presets-grid cols-2">
            <button
              type="button"
              className="ps-filter-btn"
              onClick={() => handleSelectFilterPreset('original')}
            >
              Tự nhiên (Gốc)
            </button>
            <button
              type="button"
              className="ps-filter-btn"
              onClick={() => handleSelectFilterPreset('vivid')}
            >
              🍧 Tươi sáng
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
              🌗 Đen trắng
            </button>
            <button
              type="button"
              className="ps-filter-btn"
              onClick={() => handleSelectFilterPreset('invert')}
            >
              🔁 Đảo màu
            </button>
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* 8. Độ sáng (Brightness) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${adjustments.brightness !== 0 ? 'modified' : ''} ${activeFlyout === 'brightness' ? 'active' : ''}`}
          onClick={() => toggleFlyout('brightness')}
          title="Độ sáng (-100% đến +100%)"
        >
          <IconSun width={18} height={18} />
          <span className="ps-rail-label">Độ sáng</span>
          {adjustments.brightness !== 0 && (
            <span className="ps-rail-badge">
              {adjustments.brightness > 0 ? `+${adjustments.brightness}` : adjustments.brightness}%
            </span>
          )}
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'brightness'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Độ sáng"
          icon={<IconSun width={15} height={15} />}
          badge={`${adjustments.brightness}%`}
          onReset={() => onChangeAdjustments({ brightness: 0 })}
          resetTitle="Đặt lại 0%"
          width={240}
        >
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Sáng/Tối:</span>
            <input
              type="range"
              min={-100}
              max={100}
              value={adjustments.brightness}
              onChange={(e) => onChangeAdjustments({ brightness: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">{adjustments.brightness}%</span>
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* 9. Độ tương phản (Contrast) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${adjustments.contrast !== 0 ? 'modified' : ''} ${activeFlyout === 'contrast' ? 'active' : ''}`}
          onClick={() => toggleFlyout('contrast')}
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
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Độ tương phản"
          icon={<IconContrast width={15} height={15} />}
          badge={`${adjustments.contrast}%`}
          onReset={() => onChangeAdjustments({ contrast: 0 })}
          resetTitle="Đặt lại 0%"
          width={240}
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
            <span className="ps-flyout-val">{adjustments.contrast}%</span>
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* 10. Độ bão hòa (Saturation) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${adjustments.saturation !== 0 ? 'modified' : ''} ${activeFlyout === 'saturation' ? 'active' : ''}`}
          onClick={() => toggleFlyout('saturation')}
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
          onClose={() => setActiveFlyout(null)}
          side="left"
          placement="bottom"
          title="Độ bão hòa màu"
          icon={<IconSaturation width={15} height={15} />}
          badge={`${adjustments.saturation}%`}
          onReset={() => onChangeAdjustments({ saturation: 0 })}
          resetTitle="Đặt lại 0%"
          width={240}
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
            <span className="ps-flyout-val">{adjustments.saturation}%</span>
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* 11. Nhiệt độ màu (Warmth) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${adjustments.warmth !== 0 ? 'modified' : ''} ${activeFlyout === 'warmth' ? 'active' : ''}`}
          onClick={() => toggleFlyout('warmth')}
          title="Nhiệt độ màu: Ấm vàng / Lạnh lam (-100% đến +100%)"
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
          onClose={() => setActiveFlyout(null)}
          side="left"
          placement="bottom"
          title="Nhiệt độ màu (Ấm/Lạnh)"
          icon={<IconWarmth width={15} height={15} />}
          badge={`${adjustments.warmth}%`}
          onReset={() => onChangeAdjustments({ warmth: 0 })}
          resetTitle="Đặt lại 0%"
          width={240}
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
            <span className="ps-flyout-val">{adjustments.warmth}%</span>
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* 12. Tông màu (Hue Shift) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${adjustments.hue !== 0 ? 'modified' : ''} ${activeFlyout === 'hue' ? 'active' : ''}`}
          onClick={() => toggleFlyout('hue')}
          title="Xoay tông màu (Hue: -180° đến +180°)"
        >
          <IconHue width={18} height={18} />
          <span className="ps-rail-label">Tông màu</span>
          {adjustments.hue !== 0 && (
            <span className="ps-rail-badge">
              {adjustments.hue > 0 ? `+${adjustments.hue}` : adjustments.hue}°
            </span>
          )}
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'hue'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          placement="bottom"
          title="Xoay tông màu (Hue)"
          icon={<IconHue width={15} height={15} />}
          badge={`${adjustments.hue}°`}
          onReset={() => onChangeAdjustments({ hue: 0 })}
          resetTitle="Đặt lại 0°"
          width={240}
        >
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Tông màu:</span>
            <input
              type="range"
              min={-180}
              max={180}
              value={adjustments.hue}
              onChange={(e) => onChangeAdjustments({ hue: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">{adjustments.hue}°</span>
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* 13. Phơi sáng (Exposure) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${adjustments.exposure !== 1.0 ? 'modified' : ''} ${activeFlyout === 'exposure' ? 'active' : ''}`}
          onClick={() => toggleFlyout('exposure')}
          title="Độ phơi sáng (0.5x đến 2.0x)"
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
          badge={`${adjustments.exposure.toFixed(2)}x`}
          onReset={() => onChangeAdjustments({ exposure: 1.0 })}
          resetTitle="Đặt lại 1.00x"
          width={240}
        >
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Phơi sáng:</span>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.05}
              value={adjustments.exposure}
              onChange={(e) => onChangeAdjustments({ exposure: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">{adjustments.exposure.toFixed(2)}x</span>
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* 14. Nút Đặt lại màu (Reset all adjustments) */}
      {hasColorMods && (
        <div className="ps-rail-item" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="ps-rail-btn reset-btn"
            onClick={onResetAdjustments}
            title="Đưa toàn bộ màu sắc về mặc định ban đầu"
          >
            <span style={{ fontSize: 13 }}>↺</span>
            <span className="ps-rail-label">Đặt lại</span>
          </button>
        </div>
      )}
    </aside>
  )
}
