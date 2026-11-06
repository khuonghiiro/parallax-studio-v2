import React, { useEffect, useRef, useState } from 'react'
import type { ChromaKeySettings, EyedropperTarget } from './types'
import type { CanvasBgMode, TagDisplayMode } from './SpriteCutterSourceToolbar'
import {
  IconSparkles,
  IconSliders,
  IconSun,
  IconEye,
  IconSquare,
  IconZoomIn,
  IconZoomOut,
  IconEyedropper
} from '../../icons'
import { SpriteCutterFlyout } from './SpriteCutterFlyout'

export interface SpriteCutterRightRailProps {
  chroma: ChromaKeySettings
  canvasBg: CanvasBgMode
  tagDisplayMode: TagDisplayMode
  zoomMode: 'fit' | number
  effectiveScale: number
  onChangeChroma: (patch: Partial<ChromaKeySettings>) => void
  onChangeCanvasBg: (bg: CanvasBgMode) => void
  onChangeTagDisplayMode: (mode: TagDisplayMode) => void
  onStepZoom: (delta: number) => void
  onSetZoomMode: (mode: 'fit' | number) => void
  onResetChroma: () => void
  eyedropperTarget?: EyedropperTarget | null
  onToggleEyedropper?: (target: EyedropperTarget) => void
  isProcessing?: boolean
}

type RightFlyoutId = 'chroma' | 'stroke' | 'shadow' | 'canvasBg' | 'view' | null

const STROKE_COLOR_PRESETS = [
  { label: 'Đỏ', hex: '#ef4444' },
  { label: 'Vàng cam', hex: '#f59e0b' },
  { label: 'Cyan', hex: '#06b6d4' },
  { label: 'Trắng', hex: '#ffffff' },
  { label: 'Đen', hex: '#0f172a' },
  { label: 'Tím', hex: '#8b5cf6' }
]

interface RailRangeSliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (val: number) => void
}

function RailRangeSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}: RailRangeSliderProps) {
  const [localVal, setLocalVal] = useState(value)
  const isDraggingRef = useRef(false)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalVal(value)
    }
  }, [value])

  const commit = (val: number) => {
    isDraggingRef.current = false
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val !== value) {
      onChange(val)
    }
  }

  const handlePointerDown = () => {
    isDraggingRef.current = true
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLInputElement>) => {
    commit(Number(e.currentTarget.value))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    setLocalVal(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      commit(v)
    }, 280)
  }

  return (
    <div className="sc-flyout-field">
      <div className="sc-flyout-label-row">
        <span>{label}</span>
        <strong>
          {localVal}
          {unit}
        </strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localVal}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onKeyUp={(e) => commit(Number(e.currentTarget.value))}
        onChange={handleChange}
        className="sc-slider"
      />
    </div>
  )
}

export function SpriteCutterRightRail({
  chroma,
  canvasBg,
  tagDisplayMode,
  zoomMode,
  effectiveScale,
  onChangeChroma,
  onChangeCanvasBg,
  onChangeTagDisplayMode,
  onStepZoom,
  onSetZoomMode,
  onResetChroma,
  eyedropperTarget,
  onToggleEyedropper,
  isProcessing
}: SpriteCutterRightRailProps) {
  const [activeFlyout, setActiveFlyout] = useState<RightFlyoutId>(null)

  const toggleFlyout = (id: RightFlyoutId) => {
    setActiveFlyout((prev) => (prev === id ? null : id))
  }

  const isOriginalPreview = chroma.previewMode === 'original'
  const zoomDisplayPercent = Math.round(effectiveScale * 100)
  const isStrokeActive = (chroma.strokeWidth ?? 0) > 0
  const isOuterOnly = chroma.isolationMode !== 'all'

  return (
    <aside className="sc-right-rail" aria-label="Thanh cấu hình tách nền và hiển thị">
      {/* 1. Tách Nền Chroma Key */}
      <div className="sc-rail-item-wrap">
        <button
          type="button"
          className={`sc-rail-btn ${chroma.enabled ? 'active' : ''} ${activeFlyout === 'chroma' ? 'has-flyout-open' : ''}`}
          onClick={() => toggleFlyout('chroma')}
          title="Tách nền Chroma Key: Click để mở cài đặt màu nền và độ nhạy"
        >
          <IconSparkles width={18} height={18} />
          <span className="sc-rail-label">Tách nền</span>
          <span className="sc-rail-badge">{isProcessing ? '⏳' : chroma.enabled ? `${chroma.tolerance}%` : 'Tắt'}</span>
        </button>

        <SpriteCutterFlyout
          isOpen={activeFlyout === 'chroma'}
          onClose={() => setActiveFlyout(null)}
          side="right"
          title="Tách Nền Tự Động (Chroma Key)"
          icon={<IconSparkles width={14} height={14} />}
          badge={`${chroma.tolerance}%`}
          width={310}
          onReset={onResetChroma}
          resetTitle="Khôi phục toàn bộ thông số tách nền về mặc định"
          isProcessing={isProcessing}
        >
          <div className="sc-flyout-field">
            <div className="sc-flyout-switch-row">
              <span>Bật thuật toán tách nền</span>
              <input
                type="checkbox"
                className="sc-switch-input"
                checked={chroma.enabled}
                onChange={(e) => onChangeChroma({ enabled: e.target.checked })}
              />
            </div>
          </div>

          <div className="sc-flyout-field">
            <div className="sc-flyout-label-row">
              <span>Màu nền cần tách</span>
              <span className="sc-color-pill" style={{ background: chroma.keyColorHex }}>
                {chroma.keyColorHex}
              </span>
            </div>
            <div className="sc-color-swatches-grid">
              <button
                type="button"
                className={`sc-swatch-chip ${chroma.keyColorType === 'chroma_green' ? 'active' : ''}`}
                onClick={() =>
                  onChangeChroma({
                    keyColorType: 'chroma_green',
                    keyColorHex: '#00DB4E',
                    keyColor: '#00DB4E'
                  })
                }
              >
                <span className="sc-swatch-dot" style={{ background: '#00DB4E' }} />
                <span>Xanh lá</span>
              </button>
              <button
                type="button"
                className={`sc-swatch-chip ${chroma.keyColorType === 'chroma_blue' ? 'active' : ''}`}
                onClick={() =>
                  onChangeChroma({
                    keyColorType: 'chroma_blue',
                    keyColorHex: '#0084FF',
                    keyColor: '#0084FF'
                  })
                }
              >
                <span className="sc-swatch-dot" style={{ background: '#0084FF' }} />
                <span>Xanh lam</span>
              </button>
              <button
                type="button"
                className={`sc-swatch-chip ${chroma.keyColorType === 'pure_white' ? 'active' : ''}`}
                onClick={() =>
                  onChangeChroma({
                    keyColorType: 'pure_white',
                    keyColorHex: '#FFFFFF',
                    keyColor: '#FFFFFF'
                  })
                }
              >
                <span className="sc-swatch-dot" style={{ background: '#FFFFFF', border: '1px solid #94a3b8' }} />
                <span>Trắng</span>
              </button>
              <button
                type="button"
                className={`sc-swatch-chip ${chroma.keyColorType === 'pure_black' ? 'active' : ''}`}
                onClick={() =>
                  onChangeChroma({
                    keyColorType: 'pure_black',
                    keyColorHex: '#000000',
                    keyColor: '#000000'
                  })
                }
              >
                <span className="sc-swatch-dot" style={{ background: '#000000' }} />
                <span>Đen</span>
              </button>
            </div>
            {onToggleEyedropper && (
              <button
                type="button"
                className={`sc-flyout-eyedropper-btn ${eyedropperTarget === 'key' ? 'active' : ''}`}
                onClick={() => onToggleEyedropper('key')}
                title="Hút màu trực tiếp trên ảnh bằng Kính lúp Pixel Photoshop (Bấm để bật, click trên ảnh để lấy màu)"
              >
                <IconEyedropper width={13} height={13} />
                <span>{eyedropperTarget === 'key' ? 'Đang bật Kính lúp hút màu…' : 'Hút màu trực tiếp từ ảnh'}</span>
                <span className="sc-swatch-dot" style={{ background: chroma.keyColorHex, marginLeft: 'auto' }} />
              </button>
            )}
          </div>

          <div className="sc-flyout-field">
            <div className="sc-flyout-label-row">
              <span>Phạm vi tách</span>
            </div>
            <div className="sc-segmented-row">
              <button
                type="button"
                className={`sc-segment-btn ${isOuterOnly ? 'active' : ''}`}
                onClick={() => onChangeChroma({ isolationMode: 'outer_only' })}
                title="Giữ lại các chi tiết bên trong nhân vật có màu trùng nền (BFS loang từ 4 cạnh biên vào)"
              >
                Giữ ruột (BFS)
              </button>
              <button
                type="button"
                className={`sc-segment-btn ${!isOuterOnly ? 'active' : ''}`}
                onClick={() => onChangeChroma({ isolationMode: 'all' })}
                title="Tách toàn bộ pixel có màu giống màu nền trên toàn ảnh"
              >
                Toàn bộ ảnh
              </button>
            </div>
          </div>

          <RailRangeSlider
            label="Độ nhạy tách màu (Tolerance)"
            value={chroma.tolerance}
            min={1}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => onChangeChroma({ tolerance: v })}
          />

          <RailRangeSlider
            label="Làm mềm biên (Feather)"
            value={chroma.smoothness}
            min={0}
            max={20}
            step={1}
            unit="px"
            onChange={(v) => onChangeChroma({ smoothness: v })}
          />

          <RailRangeSlider
            label="Gọt viền bám màu (Choke)"
            value={chroma.edgeChoke ?? 0}
            min={0}
            max={10}
            step={1}
            unit="px"
            onChange={(v) => onChangeChroma({ edgeChoke: v })}
          />
        </SpriteCutterFlyout>
      </div>

      {/* 2. Khử Viền, Lọc Sạn & Viền Nét */}
      <div className="sc-rail-item-wrap">
        <button
          type="button"
          className={`sc-rail-btn ${isStrokeActive || (chroma.defringeStrength ?? 0) > 0 || (chroma.despeckleSize ?? 0) > 0 ? 'active' : ''} ${activeFlyout === 'stroke' ? 'has-flyout-open' : ''}`}
          onClick={() => toggleFlyout('stroke')}
          title="Khử viền ám màu, Lọc đốm sạn pixel & Vẽ viền nét mịn xung quanh đối tượng"
        >
          <IconSliders width={18} height={18} />
          <span className="sc-rail-label">Viền nét</span>
          <span className="sc-rail-badge">{isStrokeActive ? `${chroma.strokeWidth}px` : 'Khử'}</span>
        </button>

        <SpriteCutterFlyout
          isOpen={activeFlyout === 'stroke'}
          onClose={() => setActiveFlyout(null)}
          side="right"
          title="Khử Ám Viền, Lọc Sạn & Viền Nét"
          icon={<IconSliders width={14} height={14} />}
          badge={isStrokeActive ? `${chroma.strokeWidth}px` : undefined}
          width={310}
          isProcessing={isProcessing}
        >
          <RailRangeSlider
            label="Khử viền ám màu (Despill)"
            value={chroma.defringeStrength ?? 0}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => onChangeChroma({ defringeStrength: v })}
          />

          <RailRangeSlider
            label="Làm mịn răng cưa mép (Smooth)"
            value={chroma.edgeSmooth ?? 0}
            min={0}
            max={10}
            step={1}
            unit="px"
            onChange={(v) => onChangeChroma({ edgeSmooth: v })}
          />

          <RailRangeSlider
            label="Lọc đốm rác / Sạn nền (Despeckle)"
            value={chroma.despeckleSize ?? 0}
            min={0}
            max={120}
            step={2}
            unit="px²"
            onChange={(v) => onChangeChroma({ despeckleSize: v })}
          />

          <RailRangeSlider
            label="Khử hạt sạn trắng viền"
            value={chroma.whiteSpeckleSensitivity ?? 0}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => onChangeChroma({ whiteSpeckleSensitivity: v })}
          />

          <div className="sc-flyout-field">
            <div className="sc-flyout-switch-row">
              <span>Vẽ viền nét mịn (Stroke Outline)</span>
              <input
                type="checkbox"
                className="sc-switch-input"
                checked={isStrokeActive}
                onChange={(e) => onChangeChroma({ strokeWidth: e.target.checked ? 3 : 0 })}
              />
            </div>
          </div>

          {isStrokeActive && (
            <>
              <RailRangeSlider
                label="Độ dày nét viền"
                value={chroma.strokeWidth ?? 3}
                min={1}
                max={10}
                step={1}
                unit="px"
                onChange={(v) => onChangeChroma({ strokeWidth: v })}
              />

              <div className="sc-flyout-field">
                <div className="sc-flyout-label-row">
                  <span>Màu sắc nét viền</span>
                  <span className="sc-color-pill" style={{ background: chroma.strokeColorHex || '#ef4444' }}>
                    {chroma.strokeColorHex || '#ef4444'}
                  </span>
                </div>
                <div className="sc-stroke-colors-grid">
                  {STROKE_COLOR_PRESETS.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      className={`sc-stroke-color-chip ${chroma.strokeColorHex === p.hex ? 'active' : ''}`}
                      onClick={() => onChangeChroma({ strokeColorHex: p.hex })}
                      title={p.label}
                    >
                      <span className="sc-stroke-color-dot" style={{ background: p.hex }} />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </SpriteCutterFlyout>
      </div>

      {/* 3. Bóng Mờ (Shadow Extraction) */}
      <div className="sc-rail-item-wrap">
        <button
          type="button"
          className={`sc-rail-btn ${chroma.shadowMode && chroma.shadowMode !== 'off' ? 'active' : ''} ${activeFlyout === 'shadow' ? 'has-flyout-open' : ''}`}
          onClick={() => toggleFlyout('shadow')}
          title="Trích xuất bóng mờ trong suốt (Shadow extraction)"
        >
          <IconSun width={18} height={18} />
          <span className="sc-rail-label">Bóng mờ</span>
          <span className="sc-rail-badge">
            {!chroma.shadowMode || chroma.shadowMode === 'off' ? 'Xoá' : chroma.shadowMode === 'include' ? 'Cả bóng' : 'Bóng'}
          </span>
        </button>

        <SpriteCutterFlyout
          isOpen={activeFlyout === 'shadow'}
          onClose={() => setActiveFlyout(null)}
          side="right"
          title="Tùy Chọn Bóng Mờ Trong Suốt"
          icon={<IconSun width={14} height={14} />}
          badge={chroma.shadowMode || 'off'}
          width={300}
        >
          <div className="sc-flyout-field">
            <div className="sc-flyout-label-row">
              <span>Chế độ giữ bóng</span>
            </div>
            <div className="sc-segmented-row">
              <button
                type="button"
                className={`sc-segment-btn ${!chroma.shadowMode || chroma.shadowMode === 'off' ? 'active' : ''}`}
                onClick={() => onChangeChroma({ shadowMode: 'off' })}
              >
                Xoá bóng
              </button>
              <button
                type="button"
                className={`sc-segment-btn ${chroma.shadowMode === 'include' ? 'active' : ''}`}
                onClick={() => onChangeChroma({ shadowMode: 'include' })}
              >
                Lấy cả bóng
              </button>
              <button
                type="button"
                className={`sc-segment-btn ${chroma.shadowMode === 'only' ? 'active' : ''}`}
                onClick={() => onChangeChroma({ shadowMode: 'only' })}
              >
                Chỉ bóng
              </button>
            </div>
          </div>

          {chroma.shadowMode && chroma.shadowMode !== 'off' && (
            <>
              <div className="sc-flyout-field">
                <div className="sc-flyout-label-row">
                  <span>Kiểu bóng</span>
                </div>
                <div className="sc-segmented-row">
                  <button
                    type="button"
                    className={`sc-segment-btn ${!chroma.shadowType || chroma.shadowType === 'auto' ? 'active' : ''}`}
                    onClick={() => onChangeChroma({ shadowType: 'auto' })}
                  >
                    Tự động
                  </button>
                  <button
                    type="button"
                    className={`sc-segment-btn ${chroma.shadowType === 'light' ? 'active' : ''}`}
                    onClick={() => onChangeChroma({ shadowType: 'light' })}
                  >
                    Mây/Sáng
                  </button>
                  <button
                    type="button"
                    className={`sc-segment-btn ${chroma.shadowType === 'dark' ? 'active' : ''}`}
                    onClick={() => onChangeChroma({ shadowType: 'dark' })}
                  >
                    Bóng tối
                  </button>
                </div>
              </div>

              <RailRangeSlider
                label="Độ đậm bóng (Retention)"
                value={chroma.shadowRetention ?? 0}
                min={0}
                max={100}
                step={5}
                unit="%"
                onChange={(v) => onChangeChroma({ shadowRetention: v })}
              />

              <RailRangeSlider
                label="Độ đặc khối bóng (Solid Threshold)"
                value={chroma.shadowSolidThreshold ?? 100}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(v) => onChangeChroma({ shadowSolidThreshold: v })}
              />

              <div className="sc-flyout-field">
                <div className="sc-flyout-switch-row">
                  <span>Khử ám màu nền vào bóng (Unmix)</span>
                  <input
                    type="checkbox"
                    className="sc-switch-input"
                    checked={chroma.shadowUnmixColor ?? true}
                    onChange={(e) => onChangeChroma({ shadowUnmixColor: e.target.checked })}
                  />
                </div>
              </div>
            </>
          )}
        </SpriteCutterFlyout>
      </div>

      <div className="sc-rail-sep" />

      {/* 4. Đối Chiếu Kết Quả: Đã Tách vs Ảnh Gốc (Toggle 1 Chạm) */}
      <div className="sc-rail-item-wrap">
        <button
          type="button"
          className={`sc-rail-btn ${isOriginalPreview ? 'sc-original-active' : 'sc-transparent-active'}`}
          onClick={() =>
            onChangeChroma({
              enabled: true,
              previewMode: isOriginalPreview ? 'transparent' : 'original'
            })
          }
          title={isOriginalPreview ? 'Đang xem Ảnh Gốc ban đầu (Click để xem kết quả Đã Tách)' : 'Đang xem kết quả Đã Tách Nền (Click để xem lại Ảnh Gốc)'}
        >
          <IconEye width={18} height={18} />
          <span className="sc-rail-label">{isOriginalPreview ? 'Gốc' : 'Đã tách'}</span>
          <span className="sc-rail-badge">{isOriginalPreview ? 'Ảnh gốc' : 'Trong suốt'}</span>
        </button>
      </div>

      {/* 5. Phông Nền Canvas */}
      <div className="sc-rail-item-wrap">
        <button
          type="button"
          className={`sc-rail-btn ${activeFlyout === 'canvasBg' ? 'has-flyout-open' : ''}`}
          onClick={() => toggleFlyout('canvasBg')}
          title="Chế độ nền Canvas: Caro tối/sáng hoặc màu phẳng"
        >
          <IconSquare width={18} height={18} />
          <span className="sc-rail-label">Nền</span>
          <span className="sc-rail-badge">
            {canvasBg === 'checker-dark' ? 'Caro Tối' : canvasBg === 'checker-light' ? 'Caro Sáng' : canvasBg === 'dark' ? 'Tối' : 'Sáng'}
          </span>
        </button>

        <SpriteCutterFlyout
          isOpen={activeFlyout === 'canvasBg'}
          onClose={() => setActiveFlyout(null)}
          side="right"
          title="Phông Nền Canvas"
          icon={<IconSquare width={14} height={14} />}
          width={260}
        >
          <div className="sc-canvas-bg-grid">
            <button
              type="button"
              className={`sc-bg-choice-card ${canvasBg === 'checker-dark' ? 'active' : ''}`}
              onClick={() => onChangeCanvasBg('checker-dark')}
            >
              <div className="sc-bg-preview sc-bg-checker-dark" />
              <span>Caro Tối</span>
            </button>
            <button
              type="button"
              className={`sc-bg-choice-card ${canvasBg === 'checker-light' ? 'active' : ''}`}
              onClick={() => onChangeCanvasBg('checker-light')}
            >
              <div className="sc-bg-preview sc-bg-checker-light" />
              <span>Caro Sáng</span>
            </button>
            <button
              type="button"
              className={`sc-bg-choice-card ${canvasBg === 'dark' ? 'active' : ''}`}
              onClick={() => onChangeCanvasBg('dark')}
            >
              <div className="sc-bg-preview sc-bg-solid-dark" />
              <span>Đen Phẳng</span>
            </button>
            <button
              type="button"
              className={`sc-bg-choice-card ${canvasBg === 'light' ? 'active' : ''}`}
              onClick={() => onChangeCanvasBg('light')}
            >
              <div className="sc-bg-preview sc-bg-solid-light" />
              <span>Trắng Phẳng</span>
            </button>
          </div>
        </SpriteCutterFlyout>
      </div>

      {/* 6. Thu Phóng & Nhãn Hiển Thị */}
      <div className="sc-rail-item-wrap">
        <button
          type="button"
          className={`sc-rail-btn ${activeFlyout === 'view' ? 'has-flyout-open' : ''}`}
          onClick={() => toggleFlyout('view')}
          title="Thu phóng khung nhìn và Tuỳ chọn hiển thị nhãn mảnh cắt"
        >
          <IconZoomIn width={18} height={18} />
          <span className="sc-rail-label">Khung nhìn</span>
          <span className="sc-rail-badge">{zoomMode === 'fit' ? 'Vừa' : `${zoomDisplayPercent}%`}</span>
        </button>

        <SpriteCutterFlyout
          isOpen={activeFlyout === 'view'}
          onClose={() => setActiveFlyout(null)}
          side="right"
          title="Thu Phóng & Tuỳ Chọn Hiển Thị"
          icon={<IconZoomIn width={14} height={14} />}
          badge={`${zoomDisplayPercent}%`}
          width={280}
        >
          <div className="sc-flyout-field">
            <div className="sc-flyout-label-row">
              <span>Độ phóng to</span>
              <strong>{zoomMode === 'fit' ? 'Tự vừa khung' : `${zoomDisplayPercent}%`}</strong>
            </div>
            <div className="sc-zoom-buttons-row">
              <button
                type="button"
                className={`sc-chip-btn ${zoomMode === 'fit' ? 'active' : ''}`}
                onClick={() => onSetZoomMode('fit')}
              >
                Vừa khung
              </button>
              <button
                type="button"
                className={`sc-chip-btn ${zoomMode === 1 ? 'active' : ''}`}
                onClick={() => onSetZoomMode(1)}
              >
                100%
              </button>
              <button
                type="button"
                className="sc-chip-btn"
                onClick={() => onStepZoom(-0.25)}
                title="Thu nhỏ"
              >
                <IconZoomOut width={13} height={13} />
              </button>
              <button
                type="button"
                className="sc-chip-btn"
                onClick={() => onStepZoom(0.25)}
                title="Phóng to"
              >
                <IconZoomIn width={13} height={13} />
              </button>
            </div>
          </div>

          <div className="sc-flyout-field">
            <div className="sc-flyout-label-row">
              <span>Nhãn tên trên từng mảnh cắt</span>
            </div>
            <div className="sc-segmented-row">
              <button
                type="button"
                className={`sc-segment-btn ${tagDisplayMode === 'hover' ? 'active' : ''}`}
                onClick={() => onChangeTagDisplayMode('hover')}
                title="Chỉ hiện nhãn khi rê chuột vào mảnh"
              >
                Trỏ chuột
              </button>
              <button
                type="button"
                className={`sc-segment-btn ${tagDisplayMode === 'always' ? 'active' : ''}`}
                onClick={() => onChangeTagDisplayMode('always')}
                title="Luôn luôn hiển thị nhãn tên"
              >
                Luôn hiện
              </button>
              <button
                type="button"
                className={`sc-segment-btn ${tagDisplayMode === 'hidden' ? 'active' : ''}`}
                onClick={() => onChangeTagDisplayMode('hidden')}
                title="Ẩn tất cả nhãn để nhìn trọn vẹn hình"
              >
                Ẩn tất cả
              </button>
            </div>
          </div>
        </SpriteCutterFlyout>
      </div>
    </aside>
  )
}
