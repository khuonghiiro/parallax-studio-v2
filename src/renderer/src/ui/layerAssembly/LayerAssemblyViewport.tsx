import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { LayerComposite, AssembledLayerItem } from './types'
import { useLayerAssetImage } from './useLayerAssetImage'
import { LayerAssemblyTransportBar } from './LayerAssemblyTransportBar'
import { IconLayers, IconImage } from '../icons'

export interface LayerAssemblyViewportProps {
  composite: LayerComposite
  selectedLayerId: string | null
  onSelectLayer: (id: string | null) => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  isPlaying: boolean
  onTogglePlay: () => void
  time: number
  onSeekTime: (t: number) => void
  hideTransport?: boolean
}

export function LayerAssemblyViewport({
  composite,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  isPlaying,
  onTogglePlay,
  time,
  onSeekTime,
  hideTransport = false
}: LayerAssemblyViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [isDraggingLayer, setIsDraggingLayer] = useState(false)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, initLayerX: 0, initLayerY: 0, initPanX: 0, initPanY: 0 })

  // Tự động căn giữa và co dãn vừa vặn (Fit to screen) khung vẽ 2D
  const handleFitView = useCallback(() => {
    if (!containerRef.current) {
      setZoom(1.0)
      setPan({ x: 0, y: 0 })
      return
    }
    const cw = containerRef.current.clientWidth || 500
    const ch = containerRef.current.clientHeight || 500
    const pad = 56
    const scaleX = (cw - pad) / (composite.width || 600)
    const scaleY = (ch - pad) / (composite.height || 600)
    const fitScale = Math.min(1.0, Math.max(0.15, Math.min(scaleX, scaleY)))
    setZoom(Number(fitScale.toFixed(2)))
    setPan({ x: 0, y: 0 })
  }, [composite.width, composite.height])

  // Khởi tạo Fit view ban đầu hoặc khi kích thước khung thay đổi
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      handleFitView()
    })
    return () => cancelAnimationFrame(raf)
  }, [handleFitView])

  // Phím tắt Space để Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        onTogglePlay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onTogglePlay])

  // Sắp xếp các layer: Z càng lớn ở sau (render trước), Z càng nhỏ ở trước (render sau)
  const sortedLayers = useMemo(() => {
    return [...composite.layers].sort((a, b) => b.z - a.z)
  }, [composite.layers])

  const handlePointerDownViewport = (e: React.PointerEvent) => {
    // Nếu bấm chuột giữa hoặc giữ phím Alt -> Bắt đầu Pan
    if (e.button === 1 || e.altKey) {
      setIsPanning(true)
      dragStartRef.current.mouseX = e.clientX
      dragStartRef.current.mouseY = e.clientY
      dragStartRef.current.initPanX = pan.x
      dragStartRef.current.initPanY = pan.y
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    onSelectLayer(null)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      const dx = e.clientX - dragStartRef.current.mouseX
      const dy = e.clientY - dragStartRef.current.mouseY
      setPan({
        x: Math.round(dragStartRef.current.initPanX + dx),
        y: Math.round(dragStartRef.current.initPanY + dy)
      })
      return
    }

    if (!isDraggingLayer || !selectedLayerId) return
    const dx = (e.clientX - dragStartRef.current.mouseX) / zoom
    const dy = (e.clientY - dragStartRef.current.mouseY) / zoom
    onUpdateLayer(selectedLayerId, {
      x: Math.round(dragStartRef.current.initLayerX + dx),
      y: Math.round(dragStartRef.current.initLayerY + dy)
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false)
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
    }
    if (isDraggingLayer) {
      setIsDraggingLayer(false)
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
    }
  }

  const handleStartDragLayer = (e: React.PointerEvent, layer: AssembledLayerItem) => {
    e.stopPropagation()
    onSelectLayer(layer.id)
    if (layer.locked) return

    setIsDraggingLayer(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initLayerX: layer.x,
      initLayerY: layer.y,
      initPanX: pan.x,
      initPanY: pan.y
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  return (
    <div
      ref={containerRef}
      className="layer-workshop-viewport"
      style={{
        position: 'relative',
        flex: '1 1 0%',
        minWidth: 0,
        height: '100%',
        background: 'var(--bg-0)',
        overflow: 'hidden',
        cursor: isPanning ? 'grab' : 'default',
        userSelect: 'none'
      }}
      onPointerDown={handlePointerDownViewport}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={(e) => {
        e.preventDefault()
        const factor = e.deltaY < 0 ? 1.12 : 0.88
        setZoom((z) => Math.max(0.15, Math.min(4.0, z * factor)))
      }}
    >
      {/* 2.5D Checkerboard Canvas Box */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: `${composite.width}px`,
          height: `${composite.height}px`,
          transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          background: 'var(--bg-1)',
          backgroundImage:
            'linear-gradient(45deg, var(--bg-2) 25%, transparent 25%), linear-gradient(-45deg, var(--bg-2) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--bg-2) 75%), linear-gradient(-45deg, transparent 75%, var(--bg-2) 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          border: '1.5px solid var(--line-focus)',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.45)',
          overflow: 'visible'
        }}
      >
        {/* Canvas Center Reference Crosshairs */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: '1px',
            background: 'color-mix(in srgb, var(--line-soft) 50%, transparent)',
            pointerEvents: 'none'
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: '1px',
            background: 'color-mix(in srgb, var(--line-soft) 50%, transparent)',
            pointerEvents: 'none'
          }}
        />

        {/* Stacked Layers */}
        {sortedLayers.map((layer) => {
          if (layer.hidden) return null
          const isSelected = layer.id === selectedLayerId

          return (
            <AssembledLayerItemView
              key={layer.id}
              layer={layer}
              isSelected={isSelected}
              time={time}
              onPointerDown={(e) => handleStartDragLayer(e, layer)}
            />
          )
        })}

        {composite.layers.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-dim)',
              fontSize: '12px',
              gap: '8px'
            }}
          >
            <IconLayers width={36} height={36} style={{ opacity: 0.4 }} />
            <span>Kéo thả hoặc chọn ảnh từ thư viện bên trái để bắt đầu xếp chồng</span>
          </div>
        )}
      </div>

      {/* 2D Mini Control Bar (Góc trên trái) */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          zIndex: 40,
          background: 'color-mix(in srgb, var(--bg-1) 85%, transparent)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--line-soft)',
          borderRadius: '6px',
          padding: '3px 8px',
          fontSize: '11px',
          userSelect: 'none'
        }}
      >
        <button
          type="button"
          className="btn xs"
          onClick={() => {
            setZoom(1.0)
            setPan({ x: 0, y: 0 })
          }}
          title="Đặt lại tỉ lệ 100% (gốc 0, 0)"
          style={{ fontFamily: 'monospace', fontWeight: 600 }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="btn xs"
          onClick={handleFitView}
          title="Căn giữa và thu phóng vừa vặn khung vẽ 2D"
        >
          Căn giữa
        </button>
      </div>

      {/* Floating 2D Hint */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '14px',
          fontSize: '10px',
          color: 'var(--text-faint)',
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(6px)',
          padding: '2px 8px',
          borderRadius: '4px',
          pointerEvents: 'none',
          zIndex: 30
        }}
      >
        Kéo layer: dời vị trí · Alt / chuột giữa: dời khung · Cuộn: zoom
      </div>

      {/* Floating Bottom Transport Bar */}
      {!hideTransport && (
        <LayerAssemblyTransportBar
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          time={time}
          onSeekTime={onSeekTime}
          onResetView={handleFitView}
          zoomPercent={Math.round(zoom * 100)}
        />
      )}
    </div>
  )
}

interface AssembledLayerItemViewProps {
  layer: AssembledLayerItem
  isSelected: boolean
  time: number
  onPointerDown: (e: React.PointerEvent) => void
}

function AssembledLayerItemView({
  layer,
  isSelected,
  time,
  onPointerDown
}: AssembledLayerItemViewProps) {
  const imageUrl = useLayerAssetImage(layer.assetPath, layer.imageUrl)

  // Tính chuyển động hoạt ảnh theo thời gian
  let animRotate = 0
  let animScaleX = 1
  let animScaleY = 1
  let animTranslateX = 0
  let animTranslateY = 0

  const { type, speed, amplitude, phaseOffset = 0, anchor } = layer.motion
  const t = time * speed + phaseOffset

  if (type === 'sway') {
    // Đung đưa xoay góc mượt mà quanh điểm neo
    animRotate = Math.sin(t * Math.PI * 2) * amplitude
  } else if (type === 'breathe') {
    // Phập phồng nhịp nhàng
    const factor = 1 + Math.sin(t * Math.PI * 2) * (amplitude / 100)
    animScaleX = factor
    animScaleY = factor
  } else if (type === 'float') {
    // Lơ lửng bồng bềnh
    animTranslateY = Math.sin(t * Math.PI * 2) * amplitude
  } else if (type === 'rocking') {
    // Bập bênh con lắc
    animRotate = Math.cos(t * Math.PI * 2) * amplitude
    animTranslateX = Math.sin(t * Math.PI * 2) * (amplitude * 0.4)
  }

  const anchorOrigin =
    anchor === 'bottom'
      ? '50% 100%'
      : anchor === 'top'
        ? '50% 0%'
        : anchor === 'left'
          ? '0% 50%'
          : anchor === 'right'
            ? '100% 50%'
            : '50% 50%'

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) translate3d(${layer.x + animTranslateX}px, ${layer.y + animTranslateY}px, 0)`,
        pointerEvents: 'none',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        zIndex: Math.round(1000 - layer.z)
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'inline-block',
          transform: `rotate(${layer.rotation + animRotate}deg) scale(${layer.scale * animScaleX}, ${layer.scale * animScaleY})`,
          transformOrigin: anchorOrigin,
          opacity: layer.opacity,
          cursor: layer.locked ? 'default' : 'move',
          outline: isSelected ? '2px solid var(--accent)' : 'none',
          outlineOffset: '2px',
          borderRadius: '3px',
          boxShadow: isSelected ? '0 0 12px rgba(38, 128, 235, 0.5)' : 'none',
          pointerEvents: 'auto'
        }}
        onPointerDown={onPointerDown}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={layer.name}
            style={{
              display: 'block',
              maxWidth: '380px',
              maxHeight: '380px',
              objectFit: 'contain',
              pointerEvents: 'none',
              imageRendering: '-webkit-optimize-contrast',
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              filter: `drop-shadow(0 4px 10px rgba(0, 0, 0, ${Math.min(0.6, Math.max(0.1, (layer.z + 50) / 150))}))`
            }}
            draggable={false}
          />
        ) : (
          <div
            style={{
              width: '130px',
              height: '130px',
              background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
              border: '1.5px dashed var(--accent)',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              color: 'var(--text)'
            }}
          >
            <span>{layer.name}</span>
            <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>Z: {layer.z}px</span>
          </div>
        )}

        {/* Điểm neo (Anchor Dot Indicator) khi layer được chọn */}
        {isSelected && (
          <div
            style={{
              position: 'absolute',
              left: anchor === 'left' ? '0%' : anchor === 'right' ? '100%' : '50%',
              top: anchor === 'top' ? '0%' : anchor === 'bottom' ? '100%' : '50%',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--key)',
              border: '2px solid #ffffff',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 6px rgba(0,0,0,0.6)',
              pointerEvents: 'none',
              zIndex: 10
            }}
            title={`Điểm neo uốn: ${anchor}`}
          />
        )}
      </div>
    </div>
  )
}
