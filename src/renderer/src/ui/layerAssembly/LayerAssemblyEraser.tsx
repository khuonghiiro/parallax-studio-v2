import React, { useRef, useState, useEffect } from 'react'
import { IconEraser, IconFit } from '../icons'
import type { AssembledLayerItem } from './types'
import type { BrushSettings } from './useLayerBrushEraser'
import { useLayerAssetImage } from './useLayerAssetImage'

export interface IsolatedTransform {
  zoom: number
  pan: { x: number; y: number }
}

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
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: '12px',
        left: '56px',
        right: '10px',
        height: '36px',
        background: 'color-mix(in srgb, var(--bg-1) 90%, transparent)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--line-soft)',
        borderRadius: '7px',
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.25)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: '8px',
        fontSize: '11px',
        userSelect: 'none'
      }}
    >
      {/* 1. Identity Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          color: 'var(--text)',
          fontWeight: 600,
          padding: '2px 7px',
          borderRadius: '4px',
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          flexShrink: 0
        }}
      >
        <IconEraser width={14} height={14} style={{ color: 'var(--accent-cyan)' }} />
        <span>Cọ Tẩy</span>
      </div>

      <div style={{ width: '1px', height: '16px', background: 'var(--line-soft)', flexShrink: 0 }} />

      {/* 2. Cỡ cọ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Cỡ:</span>
        <input
          type="range"
          min="5"
          max="300"
          step="1"
          style={{ width: '48px', height: '4px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
          value={brushSettings.size}
          onChange={(e) => onChangeBrushSettings({ ...brushSettings, size: Number(e.target.value) })}
        />
        <span
          style={{
            minWidth: '28px',
            textAlign: 'center',
            padding: '1px 3px',
            fontSize: '10px',
            fontFamily: 'monospace',
            fontWeight: 600,
            color: 'var(--text)',
            background: 'var(--bg-0)',
            border: '1px solid var(--line-soft)',
            borderRadius: '3px'
          }}
        >
          {brushSettings.size}
        </span>
      </div>

      {/* 3. Lực tẩy (Opacity) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Lực:</span>
        <input
          type="range"
          min="0.05"
          max="1"
          step="0.05"
          style={{ width: '40px', height: '4px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
          value={brushSettings.opacity}
          onChange={(e) => onChangeBrushSettings({ ...brushSettings, opacity: Number(e.target.value) })}
        />
        <span
          style={{
            minWidth: '28px',
            textAlign: 'center',
            padding: '1px 3px',
            fontSize: '10px',
            fontFamily: 'monospace',
            fontWeight: 600,
            color: 'var(--text)',
            background: 'var(--bg-0)',
            border: '1px solid var(--line-soft)',
            borderRadius: '3px'
          }}
        >
          {Math.round(brushSettings.opacity * 100)}%
        </span>
      </div>

      {/* 4. Độ cứng (Hardness) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Cứng:</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          style={{ width: '40px', height: '4px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
          value={brushSettings.hardness}
          onChange={(e) => onChangeBrushSettings({ ...brushSettings, hardness: Number(e.target.value) })}
        />
        <span
          style={{
            minWidth: '28px',
            textAlign: 'center',
            padding: '1px 3px',
            fontSize: '10px',
            fontFamily: 'monospace',
            fontWeight: 600,
            color: 'var(--text)',
            background: 'var(--bg-0)',
            border: '1px solid var(--line-soft)',
            borderRadius: '3px'
          }}
        >
          {Math.round(brushSettings.hardness * 100)}%
        </span>
      </div>

      <div style={{ width: '1px', height: '16px', background: 'var(--line-soft)', flexShrink: 0 }} />

      {/* 5. Tooltip & Hint (flextShrink: 1 to yield room on small screens) */}
      {!hasSelectedLayer ? (
        <span style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', flexShrink: 0 }}>
          ⚠️ Chọn 1 layer
        </span>
      ) : (
        <span
          style={{
            color: 'var(--text-dim)',
            fontSize: '10px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flexShrink: 1,
            minWidth: 0
          }}
          title="Cuộn chuột zoom · Giữ Space + Kéo chuột để di chuyển ảnh"
        >
          💡 Cuộn: Zoom · Space: Pan
        </span>
      )}

      <div style={{ flex: 1, minWidth: '4px' }} />

      {/* 6. Actions */}
      <button
        type="button"
        className="btn sm danger"
        disabled={!hasModifiedImage}
        onClick={onResetLayerImage}
        title="Khôi phục lại hình ảnh gốc chưa tẩy xóa"
        style={{
          padding: '2px 8px',
          height: '24px',
          fontSize: '11px',
          flexShrink: 0,
          opacity: hasModifiedImage ? 1 : 0.45
        }}
      >
        Khôi phục
      </button>

      <button
        type="button"
        className="btn sm"
        onClick={onClose}
        title="Đóng chế độ cọ tẩy pixel (phím Esc)"
        style={{
          padding: '2px 8px',
          height: '24px',
          fontSize: '11px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        <span>Đóng</span>
        <kbd
          style={{
            fontSize: '9px',
            padding: '0 3px',
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            borderRadius: '2px',
            color: 'var(--text-dim)',
            fontFamily: 'sans-serif'
          }}
        >
          Esc
        </kbd>
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
  cursorPos: { x: number; y: number; isIsolated?: boolean } | null
  onPointerDown: (e: React.PointerEvent, rect: DOMRect, transform: IsolatedTransform) => void
  onPointerMove: (e: React.PointerEvent, rect: DOMRect, transform: IsolatedTransform) => void
  onPointerUp: (e: React.PointerEvent) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resolvedImageUrl = useLayerAssetImage(layer.assetPath, layer.imageUrl)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isSpaceHeld, setIsSpaceHeld] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)

  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const isHoveredRef = useRef(false)

  // Reset transform when layer changes
  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [layer.id])

  // Spacebar pan listener (like Photoshop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isHoveredRef.current) {
        e.preventDefault()
        e.stopPropagation()
        setIsSpaceHeld(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false)
      }
    }
    const handleBlur = () => {
      setIsSpaceHeld(false)
      setIsPanning(false)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // Wheel zoom centered on cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const delta = -e.deltaY
    const factor = delta > 0 ? 1.15 : 1 / 1.15
    const nextZoom = Math.min(Math.max(zoom * factor, 0.25), 15)
    if (nextZoom === zoom) return
    const ratio = nextZoom / zoom
    const nextPanX = pan.x * ratio + (mx - rect.width / 2) * (1 - ratio)
    const nextPanY = pan.y * ratio + (my - rect.height / 2) * (1 - ratio)
    setZoom(nextZoom)
    setPan({ x: nextPanX, y: nextPanY })
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    if (!containerRef.current) return
    if (isSpaceHeld || e.button === 1) {
      setIsPanning(true)
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    if (e.button === 0) {
      onPointerDown(e, containerRef.current.getBoundingClientRect(), { zoom, pan })
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    e.stopPropagation()
    if (!containerRef.current) return
    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy
      })
      return
    }
    if (!isSpaceHeld) {
      onPointerMove(e, containerRef.current.getBoundingClientRect(), { zoom, pan })
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation()
    if (isPanning) {
      setIsPanning(false)
      panStartRef.current = null
      return
    }
    onPointerUp(e)
  }

  const handleResetTransform = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const W = 210
  const H = 210
  const natW = naturalSize?.width || 210
  const natH = naturalSize?.height || 210
  const baseFactor = Math.min(W / natW, H / natH)
  const baseW = natW * baseFactor
  const baseH = natH * baseFactor

  return (
    <div
      ref={containerRef}
      className="layer-eraser-isolated-canvas"
      style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        width: `${W}px`,
        height: `${H}px`,
        background: 'repeating-conic-gradient(var(--bg-2) 0% 25%, var(--bg-1) 0% 50%) 50% / 14px 14px',
        border: '1.5px solid var(--accent-cyan)',
        borderRadius: '8px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        cursor: isSpaceHeld ? (isPanning ? 'grabbing' : 'grab') : 'crosshair',
        touchAction: 'none',
        userSelect: 'none'
      }}
      onPointerEnter={() => {
        isHoveredRef.current = true
      }}
      onPointerLeave={(e) => {
        isHoveredRef.current = false
        setIsSpaceHeld(false)
        if (!isPanning) {
          onPointerUp(e)
        }
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Top Header Strip */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '24px',
          background: 'color-mix(in srgb, var(--bg-0) 88%, transparent)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          zIndex: 10,
          pointerEvents: 'auto'
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--text)',
            maxWidth: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={layer.name}
        >
          {layer.name}
        </span>
        <button
          type="button"
          onClick={handleResetTransform}
          title="Bấm để đặt lại 100% Fit (hoặc click icon)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '9px',
            fontWeight: 600,
            color: 'var(--accent-cyan)',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '3px',
            padding: '1px 5px',
            cursor: 'pointer'
          }}
        >
          <IconFit width={10} height={10} />
          <span>{Math.round(zoom * 100)}%</span>
        </button>
      </div>

      {/* Layer Image with Pan & Zoom Transform */}
      <img
        src={imagePreviewUrl || resolvedImageUrl || undefined}
        alt="Eraser Canvas"
        onLoad={(e) => {
          setNaturalSize({
            width: e.currentTarget.naturalWidth,
            height: e.currentTarget.naturalHeight
          })
        }}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: `${baseW}px`,
          height: `${baseH}px`,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) translate(-50%, -50%)`,
          transformOrigin: 'center center',
          pointerEvents: 'none',
          userSelect: 'none',
          imageRendering: zoom >= 2 ? 'pixelated' : 'auto'
        }}
        draggable={false}
      />

      {/* Bottom Hint Strip */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '18px',
          background: 'color-mix(in srgb, var(--bg-0) 80%, transparent)',
          borderTop: '1px solid var(--line-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '9px',
          color: 'var(--text-faint)',
          pointerEvents: 'none',
          zIndex: 10
        }}
      >
        Cuộn: Zoom · Space + Kéo: Pan
      </div>

      {/* Cursor Brush Circle (only when not panning) */}
      {!isSpaceHeld && !isPanning && cursorPos && cursorPos.isIsolated && (
        <div
          style={{
            position: 'absolute',
            left: cursorPos.x,
            top: cursorPos.y,
            width: cursorSize,
            height: cursorSize,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '1.5px solid var(--accent-cyan)',
            background: 'rgba(56, 189, 248, 0.12)',
            pointerEvents: 'none',
            zIndex: 9999
          }}
        />
      )}
    </div>
  )
}
