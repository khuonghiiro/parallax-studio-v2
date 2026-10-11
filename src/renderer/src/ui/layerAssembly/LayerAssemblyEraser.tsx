import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useIsolatedCanvasView } from './useIsolatedCanvasView'
import { IconEraser, IconBrush, IconHand, IconFit, IconUndo, IconX } from '../icons'
import type { AssembledLayerItem } from './types'
import type { BrushSettings } from './useLayerBrushEraser'
import { useLayerAssetImage } from './useLayerAssetImage'
import { type IsolatedTransform } from './isolatedBrushGeometry'
import '../../styles/layerAssemblyEraser.css'

export interface PixelEditorProps {
  layer: AssembledLayerItem
  imagePreviewUrl?: string | null
  brushSettings: BrushSettings
  cursorPos: { x: number; y: number; isIsolated?: boolean } | null
  onPointerDown: (e: React.PointerEvent, rect: DOMRect, transform: IsolatedTransform) => void
  onPointerMove: (e: React.PointerEvent, rect: DOMRect, transform: IsolatedTransform) => void
  onPointerUp: (e: React.PointerEvent) => void
  onCancel: () => void
  onCursorLeave: () => void
  onChangeBrushSettings: (settings: BrushSettings) => void
  onResetLayerImage: () => void
  onClose: () => void
  isErasing: boolean
  is2DOnly?: boolean
}

export interface BrushControlsCompactProps {
  brushSettings: BrushSettings
  onChangeBrushSettings: (settings: BrushSettings) => void
  disabled?: boolean
}

export function BrushControlsCompact({
  brushSettings,
  onChangeBrushSettings,
  disabled
}: BrushControlsCompactProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { size, opacity, hardness } = brushSettings

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const cx = w / 2
    const cy = h / 2

    ctx.clearRect(0, 0, w, h)

    // Quy đổi bán kính cọ (1..100) sang bán kính preview (3..19px) trên khung 44x44
    const minR = 3
    const maxR = 19
    const t = Math.max(0, Math.min(1, (size - 1) / 99))
    const r = minR + t * (maxR - minR)

    // Bán kính lõi cứng nét cọ
    const clampedHardness = Math.max(0, Math.min(1, hardness))
    const innerR = Math.max(0, r * clampedHardness)

    // Gradient tỏa tia thể hiện độ mờ và lực tẩy
    const radGrad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, r)
    radGrad.addColorStop(0, `rgba(56, 189, 248, ${opacity})`)
    radGrad.addColorStop(1, `rgba(56, 189, 248, 0)`)

    ctx.fillStyle = radGrad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()

    // Đường viền nét đứt giới hạn kích thước cọ thật
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])
    ctx.stroke()
    ctx.restore()

    // Tâm điểm ngắm cọ 3px
    ctx.fillStyle = 'rgba(56, 189, 248, 0.95)'
    ctx.fillRect(cx - 0.5, cy - 2, 1, 4)
    ctx.fillRect(cx - 2, cy - 0.5, 4, 1)
  }, [size, opacity, hardness])

  return (
    <div className="layer-brush-compact-grid">
      {/* Cột trái: Hộp preview live + Nút đổi nhanh cỡ cọ mini */}
      <div className="layer-brush-preview-col">
        <div
          className="layer-brush-preview-box"
          title={`Xem trước cọ tẩy: Cỡ ${size}px, Lực ${Math.round(opacity * 100)}%, Độ cứng ${Math.round(hardness * 100)}%`}
        >
          <canvas ref={canvasRef} width={44} height={44} className="layer-brush-preview-canvas" />
          <span className="layer-brush-preview-box-badge">{size}px</span>
        </div>
        <div className="layer-brush-presets-mini">
          {[12, 24, 48, 80].map((s) => (
            <button
              key={s}
              type="button"
              className={`brush-preset-mini-btn ${size === s ? 'active' : ''}`}
              disabled={disabled}
              title={`Đặt cỡ cọ ${s}px`}
              onClick={() => onChangeBrushSettings({ ...brushSettings, size: s })}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Cột phải: 3 Sliders thông số cực kỳ thanh mảnh & trực quan */}
      <fieldset className="layer-brush-sliders-col" disabled={disabled}>
        {/* Cỡ cọ */}
        <div className="layer-brush-slider-compact">
          <span className="slider-label">Cỡ</span>
          <input
            type="range"
            min={1}
            max={100}
            step={1}
            value={size}
            onChange={(e) => onChangeBrushSettings({ ...brushSettings, size: Number(e.target.value) })}
          />
          <div className="slider-stepper-val">
            <button
              type="button"
              className="stepper-btn"
              title="Giảm 2px"
              onClick={() => onChangeBrushSettings({ ...brushSettings, size: Math.max(1, size - 2) })}
            >
              -
            </button>
            <span className="slider-num">{size}px</span>
            <button
              type="button"
              className="stepper-btn"
              title="Tăng 2px"
              onClick={() => onChangeBrushSettings({ ...brushSettings, size: Math.min(100, size + 2) })}
            >
              +
            </button>
          </div>
        </div>

        {/* Lực tẩy */}
        <div className="layer-brush-slider-compact">
          <span className="slider-label">Lực</span>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => onChangeBrushSettings({ ...brushSettings, opacity: Number(e.target.value) })}
          />
          <span className="slider-num">{Math.round(opacity * 100)}%</span>
        </div>

        {/* Độ cứng */}
        <div className="layer-brush-slider-compact">
          <span className="slider-label">Cứng</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={hardness}
            onChange={(e) => onChangeBrushSettings({ ...brushSettings, hardness: Number(e.target.value) })}
          />
          <span className="slider-num">{Math.round(hardness * 100)}%</span>
        </div>
      </fieldset>
    </div>
  )
}

// Giữ lại alias để tương thích ngược nếu có
export const BrushPreviewVisualizer = BrushControlsCompact

export function EraserIsolatedCanvas(props: PixelEditorProps) {
  const { layer, imagePreviewUrl, brushSettings, cursorPos, isErasing, is2DOnly = false } = props
  const resolvedImageUrl = useLayerAssetImage(layer.assetPath, layer.imageUrl)
  const {
    canvasRef,
    zoom,
    hand,
    setHand,
    space,
    hover,
    setHover,
    panning,
    setSize,
    reset,
    clearGesture,
    wheel,
    down,
    move,
    up,
    g
  } = useIsolatedCanvasView(props)

  const [settingsHeight, setSettingsHeight] = useState(175)
  const unavailable = layer.locked || layer.hidden
  const setBrush = (hardness: number) => {
    setHand(false)
    props.onChangeBrushSettings({ ...brushSettings, hardness })
  }

  const handleSettingsSplitterDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = settingsHeight
    const target = e.currentTarget
    try { target.setPointerCapture(e.pointerId) } catch {}

    const onMove = (moveEvt: PointerEvent) => {
      const deltaY = startY - moveEvt.clientY
      const nextH = Math.max(125, Math.min(260, startHeight + deltaY))
      setSettingsHeight(nextH)
    }

    const onUp = (upEvt: PointerEvent) => {
      try { if (target.hasPointerCapture(upEvt.pointerId)) target.releasePointerCapture(upEvt.pointerId) } catch {}
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [settingsHeight])

  // Khung vẽ Canvas cách ly dùng chung
  const renderCanvas = (extraOverlay?: React.ReactNode) => (
    <div
      ref={canvasRef}
      className="layer-pixel-canvas-area"
      onWheel={wheel}
      style={{
        cursor: hand || space ? (panning ? 'grabbing' : 'grab') : unavailable ? 'not-allowed' : 'none'
      }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => {
        setHover(false)
        props.onCursorLeave()
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={(e) => {
        e.stopPropagation()
        clearGesture()
      }}
      onLostPointerCapture={(e) => {
        e.stopPropagation()
        clearGesture()
      }}
    >
      <img
        key={layer.id}
        src={imagePreviewUrl || resolvedImageUrl || undefined}
        alt={layer.name}
        draggable={false}
        onLoad={(e) =>
          setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
        }
        style={{
          left: g.centerX,
          top: g.centerY,
          width: g.width,
          height: g.height,
          imageRendering: g.scale >= 2 ? 'pixelated' : 'auto'
        }}
      />
      {hover && !hand && !space && !panning && !unavailable && cursorPos?.isIsolated && (
        <div
          className="layer-pixel-cursor"
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            width: brushSettings.size * 2 * zoom,
            height: brushSettings.size * 2 * zoom
          }}
        />
      )}
      <span className="layer-pixel-zoom">{Math.round(zoom * 100)}% · Fit</span>
      {extraOverlay}
    </div>
  )

interface EraserToolbarRowProps {
  hand: boolean
  space?: boolean
  brushHardness: number
  unavailable: boolean
  isErasing: boolean
  canReset: boolean
  onSetBrush: (hardness: number) => void
  onSetHand: () => void
  onResetView: () => void
  onResetImage: () => void
}

function EraserToolbarRow({
  hand,
  space = false,
  brushHardness,
  unavailable,
  isErasing,
  canReset,
  onSetBrush,
  onSetHand,
  onResetView,
  onResetImage
}: EraserToolbarRowProps) {
  const isMoving = hand || space
  return (
    <div className="layer-pixel-tools-row" aria-label="Thanh công cụ cọ tẩy">
      <div className="layer-pixel-tools-group">
        <button
          type="button"
          className="layer-pixel-tool-btn"
          title="Cọ tẩy mờ mềm (Độ cứng 40%)"
          aria-label="Cọ mềm"
          aria-pressed={!isMoving && brushHardness < 1}
          disabled={unavailable || isErasing}
          onClick={() => onSetBrush(0.4)}
        >
          <IconBrush width={13} height={13} />
          <span>Cọ mềm</span>
        </button>
        <button
          type="button"
          className="layer-pixel-tool-btn"
          title="Tẩy nét cứng (Độ cứng 100%)"
          aria-label="Tẩy cứng"
          aria-pressed={!isMoving && brushHardness === 1}
          disabled={unavailable || isErasing}
          onClick={() => onSetBrush(1)}
        >
          <IconEraser width={13} height={13} />
          <span>Tẩy cứng</span>
        </button>
        <button
          type="button"
          className="layer-pixel-tool-btn"
          title="Bàn tay dời ảnh (Giữ phím Space)"
          aria-label="Bàn tay dời ảnh"
          aria-pressed={isMoving}
          disabled={isErasing}
          onClick={onSetHand}
        >
          <IconHand width={13} height={13} />
          <span>Dời</span>
        </button>
      </div>

      <div className="layer-pixel-divider" />

      <div className="layer-pixel-tools-group right">
        <button
          type="button"
          className="layer-pixel-tool-btn icon-only"
          title="Căn vừa vặn khung ảnh (Fit View)"
          aria-label="Vừa khung ảnh"
          disabled={isErasing}
          onClick={onResetView}
        >
          <IconFit width={13} height={13} />
        </button>
        <button
          type="button"
          className="layer-pixel-tool-btn icon-only"
          title="Khôi phục lại ảnh gốc ban đầu"
          aria-label="Khôi phục ảnh gốc"
          disabled={unavailable || !canReset || isErasing}
          onClick={onResetImage}
        >
          <IconUndo width={13} height={13} />
        </button>
      </div>
    </div>
  )
}

  // =========================================================================
  // CHẾ ĐỘ 1: CHỈ CÓ 2D (is2DOnly = true)
  // Cột 1 chia 2 hàng:
  // - Hàng 1: Canvas ảnh để cọ (thoáng đãng, sạch sẽ, không che khuất)
  // - Hàng 2: UI chỉnh sửa thông số + thanh icon cọ ngang ở bottom
  // =========================================================================
  if (is2DOnly) {
    return (
      <section
        className="layer-pixel-pane mode-column"
        aria-label="Chỉnh sửa pixel của layer"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* HÀNG 1: Canvas ảnh để cọ thuần túy, sạch sẽ */}
        {renderCanvas()}

        {/* Thanh kéo chia giữa Hàng 1 và Hàng 2 trong Cột 1 */}
        <div
          className="layer-eraser-splitter"
          onPointerDown={handleSettingsSplitterDown}
          title="Kéo chuột để chỉnh độ cao khung thông số"
        />

        {/* HÀNG 2: UI chỉnh sửa thông số & thanh ngang chứa icon cọ ở bottom */}
        <div className="layer-pixel-settings-bottom" style={{ height: `${settingsHeight}px` }}>
          <div className="layer-pixel-panel-header">
            <div className="layer-pixel-title">
              <IconEraser width={14} height={14} />
              <strong title={layer.name}>{layer.name}</strong>
              <span className="layer-pixel-badge">TẨY</span>
            </div>
            <button
              type="button"
              className="layer-pixel-close-btn"
              title="Thoát chế độ tẩy (V)"
              aria-label="Thoát chế độ tẩy"
              onClick={props.onClose}
            >
              <IconX width={12} height={12} />
              <span>Thoát</span>
            </button>
          </div>

          {/* Thanh ngang chứa icon công cụ cọ tẩy nằm ở Hàng 2 */}
          <EraserToolbarRow
            hand={hand}
            space={space}
            brushHardness={brushSettings.hardness}
            unavailable={unavailable}
            isErasing={isErasing}
            canReset={Boolean(layer.imageUrl && layer.assetPath)}
            onSetBrush={setBrush}
            onSetHand={() => setHand((v) => !v)}
            onResetView={reset}
            onResetImage={props.onResetLayerImage}
          />

          <BrushControlsCompact
            brushSettings={brushSettings}
            onChangeBrushSettings={props.onChangeBrushSettings}
            disabled={unavailable || isErasing}
          />

          <div className="layer-pixel-hint">
            {unavailable ? 'Layer đang khóa' : 'Space: dời · Cuộn: zoom · Esc: hủy nét'}
          </div>
        </div>
      </section>
    )
  }

  // =========================================================================
  // CHẾ ĐỘ 2: 2D & 3D (is2DOnly = false)
  // Tool được đưa vào khoảng trống thừa bên phải (ảnh 2), không còn thanh header ngang thừa
  // =========================================================================
  return (
    <section
      className="layer-pixel-pane mode-row"
      aria-label="Chỉnh sửa pixel của layer"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Vùng canvas bên trái (toàn bộ chiều cao) */}
      {renderCanvas()}

      {/* Cột phải: chứa Tool trong khoảng trống thừa + Xem trước + Sliders */}
      <div className="layer-pixel-controls-area">
        {/* Tiêu đề & Thoát */}
        <div className="layer-pixel-panel-header">
          <div className="layer-pixel-title">
            <IconEraser width={14} height={14} />
            <strong title={layer.name}>{layer.name}</strong>
            <span className="layer-pixel-badge">TẨY</span>
          </div>
          <button
            type="button"
            className="layer-pixel-close-btn"
            title="Thoát chế độ tẩy (V)"
            aria-label="Thoát chế độ tẩy"
            onClick={props.onClose}
          >
            <IconX width={12} height={12} />
            <span>Thoát</span>
          </button>
        </div>

        {/* Thanh ngang chứa icon công cụ cọ tẩy nằm ở khoảng trống thừa */}
        <EraserToolbarRow
          hand={hand}
          space={space}
          brushHardness={brushSettings.hardness}
          unavailable={unavailable}
          isErasing={isErasing}
          canReset={Boolean(layer.imageUrl && layer.assetPath)}
          onSetBrush={setBrush}
          onSetHand={() => setHand((v) => !v)}
          onResetView={reset}
          onResetImage={props.onResetLayerImage}
        />

        {/* Card xem trước cọ & sliders tích hợp siêu gọn */}
        <BrushControlsCompact
          brushSettings={brushSettings}
          onChangeBrushSettings={props.onChangeBrushSettings}
          disabled={unavailable || isErasing}
        />

        <div className="layer-pixel-hint">
          {unavailable ? 'Layer đang khóa' : 'Space: dời · Cuộn: zoom · Esc: hủy nét'}
        </div>
      </div>
    </section>
  )
}
