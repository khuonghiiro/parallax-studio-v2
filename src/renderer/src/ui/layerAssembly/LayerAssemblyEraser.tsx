import React from 'react'
import { useIsolatedCanvasView } from './useIsolatedCanvasView'
import { IconEraser, IconBrush, IconHand, IconFit, IconUndo } from '../icons'
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

export function EraserIsolatedCanvas(props: PixelEditorProps) {
  const { layer, imagePreviewUrl, brushSettings, cursorPos, isErasing } = props
  const resolvedImageUrl = useLayerAssetImage(layer.assetPath, layer.imageUrl)
  const { canvasRef, zoom, hand, setHand, space, hover, setHover, panning, setSize,
    reset, clearGesture, wheel, down, move, up, g } = useIsolatedCanvasView(props)
  const unavailable = layer.locked || layer.hidden
  const setBrush = (hardness: number) => { setHand(false); props.onChangeBrushSettings({ ...brushSettings, hardness }) }
  return <section className="layer-pixel-editor" aria-label="Chỉnh sửa pixel của layer"
    onPointerDown={e => e.stopPropagation()} onPointerMove={e => e.stopPropagation()}
    onPointerUp={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
    <header className="layer-pixel-header">
      <IconBrush width={14} height={14} /><strong title={layer.name}>{layer.name}</strong>
      <span>PIXEL</span><button type="button" title="Đóng chỉnh sửa pixel" aria-label="Đóng chỉnh sửa pixel" onClick={props.onClose}>×</button>
    </header>
    <div className="layer-pixel-body">
      <nav className="layer-pixel-tools" aria-label="Công cụ chỉnh ảnh">
        <button type="button" title="Cọ tẩy mềm" aria-label="Cọ tẩy mềm" aria-pressed={!hand && brushSettings.hardness < 1}
          disabled={unavailable || isErasing} onClick={() => setBrush(0.4)}><IconBrush width={16} height={16} /></button>
        <button type="button" title="Tẩy pixel nét cứng" aria-label="Tẩy pixel nét cứng" aria-pressed={!hand && brushSettings.hardness === 1}
          disabled={unavailable || isErasing} onClick={() => setBrush(1)}><IconEraser width={16} height={16} /></button>
        <button type="button" title="Bàn tay · kéo để dời ảnh" aria-label="Bàn tay" aria-pressed={hand}
          disabled={isErasing} onClick={() => setHand(true)}><IconHand width={16} height={16} /></button>
        <div className="layer-pixel-divider" />
        <button type="button" title="Vừa khung" aria-label="Vừa khung ảnh" disabled={isErasing} onClick={reset}><IconFit width={16} height={16} /></button>
        <button type="button" title="Khôi phục ảnh gốc" aria-label="Khôi phục ảnh gốc"
          disabled={unavailable || !layer.imageUrl || !layer.assetPath || isErasing} onClick={props.onResetLayerImage}><IconUndo width={16} height={16} /></button>
      </nav>
      <div ref={canvasRef} className="layer-pixel-canvas" onWheel={wheel}
        style={{ cursor: hand || space ? (panning ? 'grabbing' : 'grab') : unavailable ? 'not-allowed' : 'none' }}
        onPointerEnter={() => setHover(true)} onPointerLeave={() => { setHover(false); props.onCursorLeave() }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up}
        onPointerCancel={e => { e.stopPropagation(); clearGesture() }}
        onLostPointerCapture={e => { e.stopPropagation(); clearGesture() }}>
        <img key={layer.id} src={imagePreviewUrl || resolvedImageUrl || undefined} alt={layer.name} draggable={false}
          onLoad={e => setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
          style={{ left: g.centerX, top: g.centerY, width: g.width, height: g.height,
            imageRendering: g.scale >= 2 ? 'pixelated' : 'auto' }} />
        {hover && !hand && !space && !panning && !unavailable && cursorPos?.isIsolated &&
          <div className="layer-pixel-cursor" style={{ left: cursorPos.x, top: cursorPos.y,
            width: brushSettings.size * 2 * zoom, height: brushSettings.size * 2 * zoom }} />}
        <span className="layer-pixel-zoom">{Math.round(zoom * 100)}% · Fit</span>
      </div>
    </div>
    <fieldset className="layer-pixel-settings" disabled={unavailable || isErasing}>
      {([{ key: 'size', label: 'Cỡ cọ', min: 1, max: 100, step: 1 },
        { key: 'opacity', label: 'Lực tẩy', min: 0.05, max: 1, step: 0.05 },
        { key: 'hardness', label: 'Độ cứng', min: 0, max: 1, step: 0.05 }] as const).map(item =>
        <label key={item.key}><span>{item.label}</span><input type="range" min={item.min} max={item.max} step={item.step}
          value={brushSettings[item.key]} onChange={e => props.onChangeBrushSettings({ ...brushSettings, [item.key]: Number(e.target.value) })} />
          <output>{item.key === 'size' ? brushSettings.size : `${Math.round(brushSettings[item.key] * 100)}%`}</output></label>)}
    </fieldset>
    <footer>{unavailable ? 'Layer đang ẩn hoặc khóa' : 'Cuộn: zoom · Space + kéo: dời ảnh'}</footer>
  </section>
}
