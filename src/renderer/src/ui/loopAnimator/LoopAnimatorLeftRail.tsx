import React, { useState } from 'react'
import { toast } from '../../actions'
import { ColorInput } from '../controls/ColorPicker'
import {
  IconAnchor,
  IconBoundingBox,
  IconEyedropper,
  IconGrid,
  IconLightning,
  IconScissors,
  IconSearch,
  IconWand
} from '../icons'
import { LoopAnimatorFlyout } from './LoopAnimatorFlyout'
import { LoopRangeField } from './LoopChromaControls'
import { LoopNumField } from './LoopSlicerControls'
import { useLoopAnimator } from './loopAnimatorState'
import { resolveLoopIsolationMode } from './loopChromaProcessor'
import type { LoopShadowMode, LoopShadowType, SlicerMode } from './types'

interface Props {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>
  zoom: number
  onChangeZoom: (z: number | ((prev: number) => number)) => void
  eyedropperActive: boolean
  onToggleEyedropper: () => void
  onAutoDetect: () => void
  onRunContour: () => void
}

type FlyoutType = 'grid' | 'contour' | 'manual' | 'chroma' | 'zoom' | null

const KEY_SWATCHES = ['#00ff00', '#ff00ff', '#0000ff', '#ffffff', '#000000']

const SHADOW_MODES: { id: LoopShadowMode; label: string; title: string }[] = [
  { id: 'off', label: 'Xoá bóng', title: 'Xoá toàn bộ bóng và quầng bán trong suốt cùng nền' },
  { id: 'include', label: '☁️ Cả bóng', title: 'Giữ lại cả vật thể chính lẫn bóng mờ / hào quang' },
  { id: 'only', label: '👻 Chỉ bóng', title: 'Chỉ trích xuất riêng lớp bóng mờ' }
]

/**
 * Thanh công cụ bên trái Xưởng Tách Hoạt Ảnh Loop (Photoshop Tools Rail).
 * Chứa các icon công cụ: Lưới đều, Tự dò vùng, Kéo tay, Tách nền Chroma, Hút màu, Thu phóng.
 */
export function LoopAnimatorLeftRail({
  sourceCanvasRef,
  zoom,
  onChangeZoom,
  eyedropperActive,
  onToggleEyedropper,
  onAutoDetect,
  onRunContour
}: Props): React.ReactElement {
  const [activeFlyout, setActiveFlyout] = useState<FlyoutType>(null)

  const slicerMode = useLoopAnimator((s) => s.slicerMode)
  const setSlicerMode = useLoopAnimator((s) => s.setSlicerMode)
  const gridConfig = useLoopAnimator((s) => s.gridConfig)
  const setGridConfig = useLoopAnimator((s) => s.setGridConfig)
  const contourConfig = useLoopAnimator((s) => s.contourConfig)
  const setContourConfig = useLoopAnimator((s) => s.setContourConfig)
  const chromaKey = useLoopAnimator((s) => s.chromaKey)
  const setChromaKey = useLoopAnimator((s) => s.setChromaKey)
  const groups = useLoopAnimator((s) => s.groups)
  const activeGroupIndex = useLoopAnimator((s) => s.activeGroupIndex)
  const syncChromaAll = useLoopAnimator((s) => s.syncChromaAll)
  const setSyncChromaAll = useLoopAnimator((s) => s.setSyncChromaAll)
  const toggleGroupSyncChroma = useLoopAnimator((s) => s.toggleGroupSyncChroma)
  const applyActiveChromaToSyncedGroups = useLoopAnimator((s) => s.applyActiveChromaToSyncedGroups)
  const equalizeFrameSizes = useLoopAnimator((s) => s.equalizeFrameSizes)
  const autoCenterFrames = useLoopAnimator((s) => s.autoCenterFrames)

  const fullKey = resolveLoopIsolationMode(chromaKey) === 'all'
  const shadowMode: LoopShadowMode = chromaKey.shadowMode ?? 'off'
  const activeGroup = groups[activeGroupIndex]
  const isCurrentGroupSynced = activeGroup ? activeGroup.syncChromaKey !== false : true
  const syncedGroupCount = groups.filter((g) => g.syncChromaKey !== false).length

  const handleCenter = (): void => {
    autoCenterFrames(sourceCanvasRef.current)
    toast('🎯 Đã căn tâm và đáy sàn chống nảy cho tất cả frame')
  }

  const toggleFlyout = (f: FlyoutType): void => {
    setActiveFlyout((prev) => (prev === f ? null : f))
  }

  return (
    <aside className="la-left-rail" aria-label="Thanh công cụ cắt khung & tách nền">
      {/* 1. Lưới đều (Grid Slice) */}
      <div className="la-rail-item">
        <button
          type="button"
          className={`la-rail-btn${slicerMode === 'grid' ? ' active' : ''}`}
          onClick={() => {
            setSlicerMode('grid')
            toggleFlyout('grid')
          }}
          title="Cắt khung dạng Lưới đều (Hàng × Cột)"
          aria-label="Cắt khung Lưới đều"
        >
          <IconGrid width={18} height={18} />
          <span className="la-rail-label">Lưới</span>
          <span className="la-rail-badge">{gridConfig.cols}×{gridConfig.rows}</span>
        </button>

        <LoopAnimatorFlyout
          isOpen={activeFlyout === 'grid'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Thông số Lưới đều"
          icon={<IconGrid width={14} height={14} />}
          badge={`${gridConfig.cols}×${gridConfig.rows}`}
          width={290}
        >
          <div className="la-field-group">
            <div className="la-field-row">
              <span className="la-field-label">Số ô lưới:</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <LoopNumField label="Cột" value={gridConfig.cols} min={1} max={32} onChange={(v) => setGridConfig({ cols: v })} />
                <LoopNumField label="Hàng" value={gridConfig.rows} min={1} max={32} onChange={(v) => setGridConfig({ rows: v })} />
              </div>
            </div>
            <div className="la-field-row">
              <span className="la-field-label">Khử viền khung:</span>
              <LoopNumField
                label="Padding"
                unit="px"
                value={gridConfig.borderPadding ?? 0}
                min={0}
                max={80}
                onChange={(v) => setGridConfig({ borderPadding: v })}
                title="Mở rộng độ dày viền lưới để loại bỏ vạch kẻ khung đen"
              />
            </div>
            <div className="la-field-row">
              <span className="la-field-label">Lề ngoài (X / Y):</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <LoopNumField label="X" unit="px" value={gridConfig.marginX} min={0} max={400} onChange={(v) => setGridConfig({ marginX: v })} />
                <LoopNumField label="Y" unit="px" value={gridConfig.marginY} min={0} max={400} onChange={(v) => setGridConfig({ marginY: v })} />
              </div>
            </div>
            <div className="la-field-row">
              <span className="la-field-label">Khe giữa (X / Y):</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <LoopNumField label="X" unit="px" value={gridConfig.paddingX} min={0} max={200} onChange={(v) => setGridConfig({ paddingX: v })} />
                <LoopNumField label="Y" unit="px" value={gridConfig.paddingY} min={0} max={200} onChange={(v) => setGridConfig({ paddingY: v })} />
              </div>
            </div>
          </div>
        </LoopAnimatorFlyout>
      </div>

      {/* 2. Tự dò vùng (Contour Auto) */}
      <div className="la-rail-item">
        <button
          type="button"
          className={`la-rail-btn${slicerMode === 'contour' ? ' active' : ''}`}
          onClick={() => {
            setSlicerMode('contour')
            toggleFlyout('contour')
            onRunContour()
          }}
          title="Tự động dò tìm các khối ảnh tách biệt trong Sprite Sheet"
          aria-label="Tự dò vùng"
        >
          <IconLightning width={18} height={18} />
          <span className="la-rail-label">Tự dò</span>
          <span className="la-rail-badge">Auto</span>
        </button>

        <LoopAnimatorFlyout
          isOpen={activeFlyout === 'contour'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Cấu hình Tự dò vùng"
          icon={<IconLightning width={14} height={14} />}
          width={300}
        >
          <div className="la-field-group">
            <div className="la-field-row">
              <LoopNumField label="Alpha" value={contourConfig.alphaThreshold} min={1} max={250} onChange={(v) => setContourConfig({ alphaThreshold: v })} title="Ngưỡng alpha coi là có nội dung" />
              <LoopNumField label="Gộp" unit="px" value={contourConfig.mergeGap} min={0} max={64} onChange={(v) => setContourConfig({ mergeGap: v })} title="Gộp mảnh gần" />
              <LoopNumField label="Tối thiểu" unit="px²" value={contourConfig.minArea} min={16} max={5000} step={50} onChange={(v) => setContourConfig({ minArea: v })} title="Diện tích tối thiểu" />
            </div>

            <div className="la-field-row" style={{ marginTop: 4 }}>
              <span className="la-field-label">Neo:</span>
              <div className="la-seg">
                <button
                  type="button"
                  className={`la-seg-btn${contourConfig.alignAnchor !== 'center' ? ' active' : ''}`}
                  onClick={() => setContourConfig({ alignAnchor: 'bottom' })}
                >
                  Đáy
                </button>
                <button
                  type="button"
                  className={`la-seg-btn${contourConfig.alignAnchor === 'center' ? ' active' : ''}`}
                  onClick={() => setContourConfig({ alignAnchor: 'center' })}
                >
                  Tâm
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button type="button" className="la-btn la-btn--primary la-btn--sm" onClick={onRunContour} style={{ flex: 1 }}>
                <IconLightning width={12} height={12} /> Quét tách
              </button>
              <button
                type="button"
                className="la-btn la-btn--outline la-btn--sm"
                onClick={() => {
                  equalizeFrameSizes()
                  toast('📏 Đã đồng bộ kích thước khung hình')
                }}
              >
                <IconBoundingBox width={12} height={12} /> Đồng cỡ
              </button>
              <button type="button" className="la-btn la-btn--outline la-btn--sm" onClick={handleCenter}>
                <IconAnchor width={12} height={12} /> Căn chân
              </button>
            </div>
          </div>
        </LoopAnimatorFlyout>
      </div>

      {/* 3. Kéo tay (Manual Slicer) */}
      <div className="la-rail-item">
        <button
          type="button"
          className={`la-rail-btn${slicerMode === 'manual' ? ' active' : ''}`}
          onClick={() => {
            setSlicerMode('manual')
            toggleFlyout('manual')
          }}
          title="Kéo tay tự do từng khung cắt"
          aria-label="Kéo tay"
        >
          <IconScissors width={18} height={18} />
          <span className="la-rail-label">Kéo tay</span>
        </button>

        <LoopAnimatorFlyout
          isOpen={activeFlyout === 'manual'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Chế độ Kéo tay"
          icon={<IconScissors width={14} height={14} />}
          width={280}
        >
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '4px 0 8px', lineHeight: 1.4 }}>
            Kéo trực tiếp từng khung trên ảnh để dời vùng cắt, hoặc nhập X / Y / W / H ở dải frame bên dưới.
          </p>
          <button type="button" className="la-btn la-btn--outline la-btn--sm" onClick={handleCenter} style={{ width: '100%' }}>
            <IconAnchor width={12} height={12} /> Căn tâm tự động
          </button>
        </LoopAnimatorFlyout>
      </div>

      <div className="la-rail-separator" />

      {/* 4. Tách nền Chroma */}
      <div className="la-rail-item">
        <button
          type="button"
          className={`la-rail-btn${chromaKey.enabled ? ' modified' : ''}`}
          onClick={() => toggleFlyout('chroma')}
          title="Cấu hình Tách nền theo màu (Chroma Key)"
          aria-label="Tách nền Chroma"
        >
          <IconWand width={18} height={18} />
          <span className="la-rail-label">Tách nền</span>
          <span
            className="la-rail-badge swatch"
            style={{ background: chromaKey.keyColor || '#00ff00' }}
          />
        </button>

        <LoopAnimatorFlyout
          isOpen={activeFlyout === 'chroma'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Tách nền Chroma Key"
          icon={<IconWand width={14} height={14} />}
          badge={chromaKey.enabled ? 'Đang bật' : 'Tắt'}
          width={310}
        >
          <div className="la-field-group">
            <div className="la-field-row">
              <label className="la-switch" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={chromaKey.enabled}
                  onChange={(e) => setChromaKey({ enabled: e.target.checked })}
                />
                <span className="la-switch-track" aria-hidden />
                <span className="la-switch-text" style={{ fontSize: 11, fontWeight: 600 }}>Bật tách nền</span>
              </label>

              {chromaKey.enabled && (
                <label className="la-switch" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={fullKey}
                    onChange={(e) => setChromaKey({ isolationMode: e.target.checked ? 'all' : 'outer_only' })}
                  />
                  <span className="la-switch-track" aria-hidden />
                  <span className="la-switch-text" style={{ fontSize: 10 }}>{fullKey ? 'Tách cả trong' : 'Chỉ ngoài'}</span>
                </label>
              )}
            </div>

            {chromaKey.enabled && (
              <>
                <div className="la-field-row" style={{ marginTop: 4 }}>
                  <span className="la-field-label">Màu nền:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ColorInput
                      value={chromaKey.keyColor}
                      onChange={(v) => setChromaKey({ keyColor: v })}
                      compact
                      showText={false}
                      title="Màu nền cần xoá"
                    />
                    <div className="la-swatch-row">
                      {KEY_SWATCHES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`la-swatch-item${chromaKey.keyColor.toLowerCase() === c ? ' active' : ''}`}
                          style={{ background: c }}
                          onClick={() => setChromaKey({ keyColor: c })}
                          title={`Xoá nền ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button
                    type="button"
                    className={`la-btn la-btn--xs ${eyedropperActive ? 'la-btn--primary' : 'la-btn--outline'}`}
                    onClick={onToggleEyedropper}
                    style={{ flex: 1 }}
                  >
                    <IconEyedropper width={12} height={12} /> {eyedropperActive ? 'Đang chấm…' : 'Chấm màu'}
                  </button>
                  <button
                    type="button"
                    className="la-btn la-btn--outline la-btn--xs"
                    onClick={onAutoDetect}
                    style={{ flex: 1 }}
                  >
                    <IconWand width={12} height={12} /> Tự nhận 4 góc
                  </button>
                </div>

                {/* Sliders */}
                <div style={{ marginTop: 6 }}>
                  <LoopRangeField
                    label="Độ nhạy"
                    value={chromaKey.similarity}
                    display={`${Math.round(chromaKey.similarity * 100)}%`}
                    min={0.05}
                    max={0.95}
                    step={0.01}
                    onChange={(v) => setChromaKey({ similarity: v })}
                  />
                  <LoopRangeField
                    label="Mềm biên"
                    value={chromaKey.smoothness}
                    display={`${Math.round(chromaKey.smoothness * 100)}%`}
                    min={0}
                    max={0.5}
                    step={0.01}
                    onChange={(v) => setChromaKey({ smoothness: v })}
                  />
                </div>

                {/* Chế độ bóng mờ */}
                <div className="la-field-row" style={{ marginTop: 4 }}>
                  <span className="la-field-label">Bóng mờ:</span>
                  <div className="la-seg">
                    {SHADOW_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`la-seg-btn${shadowMode === m.id ? ' active' : ''}`}
                        onClick={() => setChromaKey({ shadowMode: m.id })}
                        title={m.title}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Đồng bộ nhóm */}
                {groups.length > 1 && (
                  <div style={{ marginTop: 6, padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={syncChromaAll}
                          onChange={(e) => setSyncChromaAll(e.target.checked)}
                        />
                        <span>Đồng bộ {syncedGroupCount}/{groups.length} nhóm</span>
                      </label>
                      {syncChromaAll && (
                        <button
                          type="button"
                          className="la-btn la-btn--outline la-btn--xs"
                          onClick={() => {
                            const count = applyActiveChromaToSyncedGroups()
                            toast(`✨ Đã áp Tách nền cho ${count} nhóm`)
                          }}
                        >
                          Áp nhóm
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </LoopAnimatorFlyout>
      </div>

      {/* 5. Hút màu (Eyedropper Quick Action) */}
      <div className="la-rail-item">
        <button
          type="button"
          className={`la-rail-btn${eyedropperActive ? ' active' : ''}`}
          onClick={onToggleEyedropper}
          title="Chấm màu trực tiếp trên ảnh gốc (Eyedropper)"
          aria-label="Hút màu"
        >
          <IconEyedropper width={18} height={18} />
          <span className="la-rail-label">{eyedropperActive ? 'Đang hút' : 'Hút màu'}</span>
        </button>
      </div>

      <div className="la-rail-separator" />

      {/* 6. Thu phóng (Zoom) */}
      <div className="la-rail-item">
        <button
          type="button"
          className="la-rail-btn"
          onClick={() => toggleFlyout('zoom')}
          title="Thu phóng khung nhìn ảnh nguồn"
          aria-label="Thu phóng"
        >
          <IconSearch width={18} height={18} />
          <span className="la-rail-label">Zoom</span>
          <span className="la-rail-badge">{Math.round(zoom * 100)}%</span>
        </button>

        <LoopAnimatorFlyout
          isOpen={activeFlyout === 'zoom'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Thu phóng ảnh nguồn"
          icon={<IconSearch width={14} height={14} />}
          badge={`${Math.round(zoom * 100)}%`}
          width={240}
        >
          <div className="la-field-group">
            <div className="la-slider-row">
              <input
                type="range"
                min={0.5}
                max={2.5}
                step={0.1}
                value={zoom}
                onChange={(e) => onChangeZoom(Number(e.target.value))}
              />
              <span className="la-field-val">{Math.round(zoom * 100)}%</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                type="button"
                className="la-btn la-btn--outline la-btn--sm"
                onClick={() => onChangeZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                style={{ flex: 1 }}
              >
                − Nhỏ
              </button>
              <button
                type="button"
                className="la-btn la-btn--outline la-btn--sm"
                onClick={() => onChangeZoom(1)}
                style={{ flex: 1 }}
              >
                100%
              </button>
              <button
                type="button"
                className="la-btn la-btn--outline la-btn--sm"
                onClick={() => onChangeZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
                style={{ flex: 1 }}
              >
                + To
              </button>
            </div>
          </div>
        </LoopAnimatorFlyout>
      </div>
    </aside>
  )
}
