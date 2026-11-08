import React, { useState } from 'react'
import type { ChromaKeySettings, ChromaKeyColorType, ChromaShadowMode } from '../layerAssembly/cutter/types'
import type { PhotoAdjustments } from './types'
import { ColorInput } from '../controls/ColorPicker'
import {
  IconChromaBackdrop,
  IconContourStroke,
  IconCleanArtifacts,
  IconToolEyedropper
} from './PhotoStudioIcons'
import { PhotoStudioFlyout } from './PhotoStudioFlyout'
import {
  PhotoStudioColorGradingRailGroup,
  type ColorGradingFlyoutId
} from './PhotoStudioColorGradingRailGroup'

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
              detailProtection: 75,
              contourBarrier: 70,
              smoothness: 1,
              edgeChoke: 0,
              isolationMode: 'outer_only'
            })
          }
          resetTitle="Khôi phục mặc định"
          width={344}
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

          {/* Slider 1b: Bảo vệ chi tiết gần nền (Sắc độ / Chroma) */}
          <div
            className="ps-flyout-slider-row"
            style={{ marginTop: 4 }}
            title="Bảo vệ các chi tiết nhân vật (da mặt, mũ/áo nâu xám, áo xanh xám, lá cây) có độ sáng gần trùng với màu nền xám/trắng/kem"
          >
            <span className="ps-flyout-label">Giữ chi tiết:</span>
            <input
              type="range"
              min={0}
              max={100}
              value={chroma.detailProtection ?? 75}
              onChange={(e) => onChangeChroma({ detailProtection: Number(e.target.value) })}
            />
            <span className="ps-flyout-val">{chroma.detailProtection ?? 75}%</span>
          </div>
          <div className="ps-flyout-presets">
            {[0, 50, 75, 90, 100].map((dp) => (
              <button
                key={dp}
                type="button"
                className={`ps-chip-btn ${(chroma.detailProtection ?? 75) === dp ? 'active' : ''}`}
                onClick={() => onChangeChroma({ detailProtection: dp })}
              >
                {dp}%
              </button>
            ))}
          </div>

          {/* Slider 1c: Độ kín tường viền BFS (khi bật Giữ ruột BFS) */}
          {isolationMode === 'outer_only' && (
            <>
              <div
                className="ps-flyout-slider-row"
                style={{ marginTop: 4 }}
                title="Độ kín của tường viền ngăn loang BFS: kéo cao để chặn loang qua khe hở / đỉnh trán không viền đen"
              >
                <span className="ps-flyout-label">Tường BFS:</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={chroma.contourBarrier ?? 70}
                  onChange={(e) => onChangeChroma({ contourBarrier: Number(e.target.value) })}
                />
                <span className="ps-flyout-val">{chroma.contourBarrier ?? 70}%</span>
              </div>
              <div className="ps-flyout-presets">
                {[30, 50, 70, 85, 100].map((cb) => (
                  <button
                    key={cb}
                    type="button"
                    className={`ps-chip-btn ${(chroma.contourBarrier ?? 70) === cb ? 'active' : ''}`}
                    onClick={() => onChangeChroma({ contourBarrier: cb })}
                  >
                    {cb}%
                  </button>
                ))}
              </div>
            </>
          )}

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
          placement="top"
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
          width={316}
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
          {(chroma.despeckleSize ?? 0) > 0 && (
            <div className="ps-flyout-slider-row">
              <span className="ps-flyout-label">Cỡ hạt rác:</span>
              <input
                type="range"
                min={2}
                max={120}
                step={2}
                value={chroma.despeckleSize ?? 16}
                onChange={(e) => onChangeChroma({ despeckleSize: Number(e.target.value) })}
              />
              <span className="ps-flyout-val">{chroma.despeckleSize ?? 16}px²</span>
            </div>
          )}

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
            <>
              <div className="ps-flyout-slider-row" style={{ marginTop: 4 }}>
                <span className="ps-flyout-label">Độ đậm bóng:</span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={chroma.shadowRetention ?? 65}
                  onChange={(e) => onChangeChroma({ shadowRetention: Number(e.target.value) })}
                />
                <span className="ps-flyout-val">{chroma.shadowRetention ?? 65}%</span>
              </div>
              <div
                className="ps-flyout-slider-row"
                title="Ngưỡng phân tách giữa vật thể đặc (100% rõ nét) và bóng mờ bán trong suốt"
              >
                <span className="ps-flyout-label">Độ đặc khối:</span>
                <input
                  type="range"
                  min={30}
                  max={92}
                  step={1}
                  value={chroma.shadowSolidThreshold ?? 62}
                  onChange={(e) => onChangeChroma({ shadowSolidThreshold: Number(e.target.value) })}
                />
                <span className="ps-flyout-val">{chroma.shadowSolidThreshold ?? 62}%</span>
              </div>
              <label className="ps-checkbox-label sm" title="Khử màu nền ám vào vùng bóng mờ" style={{ marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={chroma.shadowUnmixColor ?? true}
                  onChange={(e) => onChangeChroma({ shadowUnmixColor: e.target.checked })}
                />
                <span>Khử ám màu nền vào bóng</span>
              </label>
            </>
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
      <PhotoStudioColorGradingRailGroup
        activeFlyout={activeFlyout}
        onToggleFlyout={(id: ColorGradingFlyoutId) => toggleFlyout(id)}
        onCloseFlyout={() => setActiveFlyout(null)}
        adjustments={adjustments}
        onChangeAdjustments={onChangeAdjustments}
        onResetAdjustments={onResetAdjustments}
      />
    </aside>
  )
}
