import React, { useRef } from 'react'
import { IconEraser } from '../icons'
import type { AssembledLayerItem } from './types'
import type { BrushSettings } from './useLayerBrushEraser'

export function EraserTopBar({
  brushSettings,
  onChangeBrushSettings,
  onResetLayerImage,
  onClose,
  hasSelectedLayer,
  hasModifiedImage
}: {
  brushSettings: BrushSettings
  onChangeBrushSettings: (s: BrushSettings) => void
  onResetLayerImage: () => void
  onClose: () => void
  hasSelectedLayer: boolean
  hasModifiedImage: boolean
}) {
  return (
    <div 
      onPointerDown={e => e.stopPropagation()}
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '44px',
      background: 'color-mix(in srgb, var(--bg-1) 94%, transparent)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--line-soft)',
      zIndex: 50000,
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: '20px',
      fontSize: '11px', userSelect: 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)', fontWeight: 600 }}>
        <IconEraser width={16} height={16} style={{ color: 'var(--accent-cyan)' }} />
        <span>Cọ Tẩy Pixel</span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--text-dim)' }}>Cỡ cọ:</span>
        <input type="range" min="5" max="300" step="1"
          style={{ width: '80px', accentColor: 'var(--accent-cyan)' }}
          value={brushSettings.size}
          onChange={(e) => onChangeBrushSettings({ ...brushSettings, size: Number(e.target.value) })}
        />
        <span style={{ width: '28px', color: 'var(--text-dim)' }}>{brushSettings.size}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--text-dim)' }}>Lực tẩy:</span>
        <input type="range" min="0" max="1" step="0.05"
          style={{ width: '70px', accentColor: 'var(--accent-cyan)' }}
          value={brushSettings.opacity}
          onChange={(e) => onChangeBrushSettings({ ...brushSettings, opacity: Number(e.target.value) })}
        />
        <span style={{ width: '28px', color: 'var(--text-dim)' }}>{Math.round(brushSettings.opacity * 100)}%</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--text-dim)' }}>Độ cứng:</span>
        <input type="range" min="0" max="1" step="0.05"
          style={{ width: '70px', accentColor: 'var(--accent-cyan)' }}
          value={brushSettings.hardness}
          onChange={(e) => onChangeBrushSettings({ ...brushSettings, hardness: Number(e.target.value) })}
        />
        <span style={{ width: '28px', color: 'var(--text-dim)' }}>{Math.round(brushSettings.hardness * 100)}%</span>
      </div>

      <div style={{ flex: 1 }} />
      
      {!hasSelectedLayer && (
        <span style={{ color: '#eab308' }}>💡 Chọn 1 layer để tẩy</span>
      )}
      
      <button type="button" className="btn sm danger" disabled={!hasModifiedImage} onClick={onResetLayerImage} style={{ padding: '4px 10px' }}>
        Khôi phục ảnh gốc
      </button>

      <button type="button" className="btn sm" onClick={onClose} style={{ padding: '4px 10px' }}>
        Đóng (Esc)
      </button>
    </div>
  )
}

export function EraserIsolatedCanvas({
  layer,
  imagePreviewUrl,
  cursorSize,
  cursorPos,
  onPointerDown,
  onPointerMove,
  onPointerUp
}: {
  layer: AssembledLayerItem
  imagePreviewUrl?: string | null
  cursorSize: number
  cursorPos: { x: number, y: number } | null
  onPointerDown: (e: React.PointerEvent, rect: DOMRect) => void
  onPointerMove: (e: React.PointerEvent, rect: DOMRect) => void
  onPointerUp: (e: React.PointerEvent) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={containerRef}
      className="layer-eraser-isolated-canvas"
      style={{
        position: 'absolute',
        top: 60, left: 60,
        width: '320px', height: '320px',
        background: 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 50% / 20px 20px',
        border: '2px solid var(--accent-cyan)',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 50000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        cursor: 'crosshair',
        touchAction: 'none'
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        if (containerRef.current) onPointerDown(e, containerRef.current.getBoundingClientRect())
      }}
      onPointerMove={(e) => {
        e.stopPropagation()
        if (containerRef.current) onPointerMove(e, containerRef.current.getBoundingClientRect())
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
        onPointerUp(e)
      }}
      onPointerLeave={(e) => {
        e.stopPropagation()
        onPointerUp(e)
      }}
    >
      <div style={{ position: 'absolute', top: 4, left: 8, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', color: 'white', pointerEvents: 'none', zIndex: 10 }}>
        Tẩy độc lập: {layer.name}
      </div>
      <img
        src={imagePreviewUrl || layer.imageUrl || layer.assetPath}
        alt="Eraser Canvas"
        style={{
          width: '100%', height: '100%', objectFit: 'contain',
          pointerEvents: 'none'
        }}
        draggable={false}
      />
      {cursorPos && (
        <div
          style={{
            position: 'absolute',
            left: cursorPos.x, top: cursorPos.y,
            width: cursorSize, height: cursorSize,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '1.5px solid var(--accent-cyan)',
            background: 'rgba(56, 189, 248, 0.1)',
            pointerEvents: 'none',
            zIndex: 9999
          }}
        />
      )}
    </div>
  )
}
