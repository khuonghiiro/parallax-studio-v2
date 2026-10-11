import React, { useRef, useEffect } from 'react'
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
}

interface BrushPreviewProps {
  brushSettings: BrushSettings
  onChangeBrushSettings: (settings: BrushSettings) => void
  disabled?: boolean
}

export function BrushPreviewVisualizer({ brushSettings, onChangeBrushSettings, disabled }: BrushPreviewProps) {
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

    // Quy đổi bán kính cọ (1..100) sang bán kính preview (3..27px) trên khung 64x64
    const minR = 3
    const maxR = 27
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
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])
    ctx.stroke()
    ctx.restore()

    // Tâm điểm ngắm cọ 4px
    ctx.fillStyle = 'rgba(56, 189, 248, 0.9)'
    ctx.fillRect(cx - 0.5, cy - 2, 1, 4)
    ctx.fillRect(cx - 2, cy - 0.5, 4, 1)
  }, [size, opacity, hardness])

  const setSizePreset = (s: number) => {
    if (disabled) return
    onChangeBrushSettings({ ...brushSettings, size: s })
  }

  const setHardnessPreset = (h: number) => {
    if (disabled) return
    onChangeBrushSettings({ ...brushSettings, hardness: h })
  }

  return (
    <div className="layer-brush-preview-card">
      <div
        className="layer-brush-preview-box"
        title={`Xem trước cọ tẩy: Cỡ ${size}px, Lực ${Math.round(opacity * 100)}%, Độ cứng ${Math.round(hardness * 100)}%`}
      >
        <canvas ref={canvasRef} width={64} height={64} className="layer-brush-preview-canvas" />
        <span className="layer-brush-preview-box-badge">{size}px</span>
      </div>
      <div className="layer-brush-preview-meta">
        <div className="brush-tags-row">
          <span className="brush-tag size">Ø {size}px</span>
          <span className="brush-tag opacity">{Math.round(opacity * 100)}% lực</span>
          <span className="brush-tag hardness">
            {hardness >= 0.8 ? 'Cứng' : hardness <= 0.3 ? 'Mềm' : 'Vừa'}
          </span>
        </div>
        <div className="brush-presets-row">
          <span className="brush-preset-label">Cỡ:</span>
          {[12, 24, 48, 80].map((s) => (
            <button
              key={s}
              type="button"
              className={`brush-preset-btn ${size === s ? 'active' : ''}`}
              disabled={disabled}
              onClick={() => setSizePreset(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="brush-presets-row">
          <span className="brush-preset-label">Cọ:</span>
          <button
            type="button"
            className={`brush-preset-btn ${hardness === 0.3 ? 'active' : ''}`}
            disabled={disabled}
            onClick={() => setHardnessPreset(0.3)}
          >
            Mềm 30%
          </button>
          <button
            type="button"
            className={`brush-preset-btn ${hardness === 1 ? 'active' : ''}`}
            disabled={disabled}
            onClick={() => setHardnessPreset(1)}
          >
            Cứng
          </button>
        </div>
      </div>
    </div>
  )
}

export function EraserIsolatedCanvas(props: PixelEditorProps) {
  const { layer, imagePreviewUrl, brushSettings, cursorPos, isErasing } = props
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

  const unavailable = layer.locked || layer.hidden
  const setBrush = (hardness: number) => {
    setHand(false)
    props.onChangeBrushSettings({ ...brushSettings, hardness })
  }

  return (
    <section
      className="layer-pixel-pane"
      aria-label="Chỉnh sửa pixel của layer"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Thanh công cụ dòng 2 */}
      <header className="layer-pixel-header">
        <div className="layer-pixel-header-left">
          <span className="layer-pixel-title">
            <IconEraser width={14} height={14} />
            <strong title={layer.name}>{layer.name}</strong>
            <span className="layer-pixel-badge">TẨY</span>
          </span>
          <div className="layer-pixel-divider" />
          <nav className="layer-pixel-tools" aria-label="Công cụ chỉnh ảnh">
            <button
              type="button"
              title="Cọ tẩy mềm (Độ cứng 40%)"
              aria-label="Cọ tẩy mềm"
              aria-pressed={!hand && brushSettings.hardness < 1}
              disabled={unavailable || isErasing}
              onClick={() => setBrush(0.4)}
            >
              <IconBrush width={14} height={14} />
              <span className="layer-tool-label">Cọ mềm</span>
            </button>
            <button
              type="button"
              title="Tẩy pixel nét cứng (Độ cứng 100%)"
              aria-label="Tẩy pixel nét cứng"
              aria-pressed={!hand && brushSettings.hardness === 1}
              disabled={unavailable || isErasing}
              onClick={() => setBrush(1)}
            >
              <IconEraser width={14} height={14} />
              <span className="layer-tool-label">Tẩy cứng</span>
            </button>
            <button
              type="button"
              title="Bàn tay · kéo để dời ảnh (hoặc giữ phím Space)"
              aria-label="Bàn tay"
              aria-pressed={hand}
              disabled={isErasing}
              onClick={() => setHand(true)}
            >
              <IconHand width={14} height={14} />
              <span className="layer-tool-label">Bàn tay</span>
            </button>
            <div className="layer-pixel-divider" />
            <button
              type="button"
              title="Vừa khung ảnh"
              aria-label="Vừa khung ảnh"
              disabled={isErasing}
              onClick={reset}
            >
              <IconFit width={14} height={14} />
            </button>
            <button
              type="button"
              title="Khôi phục ảnh gốc"
              aria-label="Khôi phục ảnh gốc"
              disabled={unavailable || !layer.imageUrl || !layer.assetPath || isErasing}
              onClick={props.onResetLayerImage}
            >
              <IconUndo width={14} height={14} />
            </button>
          </nav>
        </div>

        <div className="layer-pixel-header-right">
          <span className="layer-pixel-hint">
            {unavailable ? 'Layer đang khóa' : 'Space: dời · Cuộn: zoom · Esc: hủy nét'}
          </span>
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
      </header>

      {/* Nội dung dòng 2: Canvas bên trái + Controls & Live Preview bên phải */}
      <div className="layer-pixel-body">
        {/* Khung ảnh canvas cách ly */}
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
        </div>

        {/* Bảng điều khiển cọ & Live Brush Preview */}
        <div className="layer-pixel-controls-area">
          <BrushPreviewVisualizer
            brushSettings={brushSettings}
            onChangeBrushSettings={props.onChangeBrushSettings}
            disabled={unavailable || isErasing}
          />

          <fieldset className="layer-brush-sliders" disabled={unavailable || isErasing}>
            {/* Cỡ cọ */}
            <div className="layer-brush-slider-row">
              <span>Cỡ cọ</span>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={brushSettings.size}
                onChange={(e) =>
                  props.onChangeBrushSettings({ ...brushSettings, size: Number(e.target.value) })
                }
              />
              <div className="layer-brush-steppers">
                <button
                  type="button"
                  className="layer-brush-stepper-btn"
                  title="Giảm 5px"
                  onClick={() =>
                    props.onChangeBrushSettings({
                      ...brushSettings,
                      size: Math.max(1, brushSettings.size - 5)
                    })
                  }
                >
                  -
                </button>
                <span className="layer-brush-val">{brushSettings.size}px</span>
                <button
                  type="button"
                  className="layer-brush-stepper-btn"
                  title="Tăng 5px"
                  onClick={() =>
                    props.onChangeBrushSettings({
                      ...brushSettings,
                      size: Math.min(100, brushSettings.size + 5)
                    })
                  }
                >
                  +
                </button>
              </div>
            </div>

            {/* Lực tẩy */}
            <div className="layer-brush-slider-row">
              <span>Lực tẩy</span>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={brushSettings.opacity}
                onChange={(e) =>
                  props.onChangeBrushSettings({ ...brushSettings, opacity: Number(e.target.value) })
                }
              />
              <span className="layer-brush-val">{Math.round(brushSettings.opacity * 100)}%</span>
            </div>

            {/* Độ cứng */}
            <div className="layer-brush-slider-row">
              <span>Độ cứng</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={brushSettings.hardness}
                onChange={(e) =>
                  props.onChangeBrushSettings({ ...brushSettings, hardness: Number(e.target.value) })
                }
              />
              <span className="layer-brush-val">{Math.round(brushSettings.hardness * 100)}%</span>
            </div>
          </fieldset>
        </div>
      </div>
    </section>
  )
}
