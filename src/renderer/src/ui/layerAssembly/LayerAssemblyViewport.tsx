import { useState, useRef, useEffect, useMemo } from 'react'
import type { LayerComposite, AssembledLayerItem } from './types'
import { IconPlay, IconPause, IconLoop } from '../icons'

export interface LayerAssemblyViewportProps {
  composite: LayerComposite
  selectedLayerId: string | null
  onSelectLayer: (id: string | null) => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  isPlaying: boolean
  onTogglePlay: () => void
  time: number
  onSeekTime: (t: number) => void
}

export function LayerAssemblyViewport({
  composite,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  isPlaying,
  onTogglePlay,
  time,
  onSeekTime
}: LayerAssemblyViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDraggingLayer, setIsDraggingLayer] = useState(false)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, initLayerX: 0, initLayerY: 0 })

  // Sắp xếp các layer hiển thị theo thứ tự Z: Z càng lớn ở sau (render trước), Z càng nhỏ ở trước (render sau)
  const sortedLayers = useMemo(() => {
    return [...composite.layers].sort((a, b) => b.z - a.z)
  }, [composite.layers])

  // Tính toán transform hoạt ảnh cho từng layer theo mốc thời gian `time`
  const computeLayerTransform = (layer: AssembledLayerItem) => {
    let animRotate = 0
    let animScaleX = 1
    let animScaleY = 1
    let animTranslateX = 0
    let animTranslateY = 0

    const { type, speed, amplitude, phaseOffset = 0 } = layer.motion
    const t = (time * speed) + phaseOffset

    if (type === 'sway') {
      // Đung đưa xoay góc quanh điểm neo
      animRotate = Math.sin(t * Math.PI * 2) * amplitude
    } else if (type === 'breathe') {
      // Co dãn thở nhịp nhàng
      const factor = 1 + (Math.sin(t * Math.PI * 2) * (amplitude / 100))
      animScaleX = factor
      animScaleY = factor
    } else if (type === 'float') {
      // Nổi bồng bềnh lên xuống
      animTranslateY = Math.sin(t * Math.PI * 2) * amplitude
    } else if (type === 'rocking') {
      // Lắc lư con lắc
      animRotate = Math.cos(t * Math.PI * 2) * amplitude
      animTranslateX = Math.sin(t * Math.PI * 2) * (amplitude * 0.4)
    }

    const anchorOrigin =
      layer.motion.anchor === 'bottom'
        ? '50% 100%'
        : layer.motion.anchor === 'top'
          ? '50% 0%'
          : '50% 50%'

    return {
      transform: `translate(${layer.x + animTranslateX}px, ${layer.y + animTranslateY}px) rotate(${layer.rotation + animRotate}deg) scale(${layer.scale * animScaleX}, ${layer.scale * animScaleY})`,
      transformOrigin: anchorOrigin
    }
  }

  const handlePointerDownLayer = (e: React.PointerEvent, layer: AssembledLayerItem) => {
    e.stopPropagation()
    onSelectLayer(layer.id)
    if (layer.locked) return

    setIsDraggingLayer(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initLayerX: layer.x,
      initLayerY: layer.y
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingLayer || !selectedLayerId) return
    const dx = (e.clientX - dragStartRef.current.mouseX) / zoom
    const dy = (e.clientY - dragStartRef.current.mouseY) / zoom
    onUpdateLayer(selectedLayerId, {
      x: Math.round(dragStartRef.current.initLayerX + dx),
      y: Math.round(dragStartRef.current.initLayerY + dy)
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingLayer) {
      setIsDraggingLayer(false)
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
    }
  }

  return (
    <div
      ref={containerRef}
      className="layer-workshop-viewport"
      onPointerDown={() => onSelectLayer(null)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={(e) => {
        e.preventDefault()
        const factor = e.deltaY < 0 ? 1.1 : 0.9
        setZoom((z) => Math.max(0.2, Math.min(4.0, z * factor)))
      }}
    >
      {/* Canvas Box chứa các layer */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: composite.width,
          height: composite.height,
          transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          border: '1px dashed var(--line-focus)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
          overflow: 'visible'
        }}
      >
        {/* Render từng layer theo thứ tự chiều sâu Z */}
        {sortedLayers.map((layer) => {
          if (layer.hidden) return null
          const isSelected = layer.id === selectedLayerId
          const motionStyle = computeLayerTransform(layer)

          return (
            <div
              key={layer.id}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: motionStyle.transform,
                transformOrigin: motionStyle.transformOrigin,
                opacity: layer.opacity,
                cursor: layer.locked ? 'default' : 'move',
                zIndex: Math.round(1000 - layer.z)
              }}
              onPointerDown={(e) => handlePointerDownLayer(e, layer)}
            >
              <div
                style={{
                  position: 'relative',
                  outline: isSelected ? '2px solid var(--accent)' : 'none',
                  outlineOffset: '2px',
                  borderRadius: '2px'
                }}
              >
                {layer.imageUrl ? (
                  <img
                    src={layer.imageUrl}
                    alt={layer.name}
                    style={{ display: 'block', maxWidth: '300px', maxHeight: '300px', pointerEvents: 'none' }}
                    draggable={false}
                  />
                ) : (
                  <div
                    style={{
                      width: '120px',
                      height: '120px',
                      background: 'color-mix(in srgb, var(--accent) 20%, transparent)',
                      border: '1px dashed var(--accent)',
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
              </div>
            </div>
          )
        })}
      </div>

      {/* Floating Transport Bar: Play / Pause, Time Scrubber */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'color-mix(in srgb, var(--bg-1) 90%, transparent)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--line-soft)',
          borderRadius: '8px',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 50,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
        }}
      >
        <button
          type="button"
          className="btn sm icon"
          onClick={onTogglePlay}
          style={{ width: '28px', height: '28px' }}
          title={isPlaying ? 'Tạm dừng xem trước hoạt ảnh' : 'Phát xem trước hoạt ảnh'}
        >
          {isPlaying ? <IconPause width={14} height={14} /> : <IconPlay width={14} height={14} />}
        </button>

        <span style={{ fontSize: '11px', color: 'var(--text)', minWidth: '40px', fontFamily: 'monospace' }}>
          {time.toFixed(2)}s
        </span>

        <input
          type="range"
          min="0"
          max="4"
          step="0.05"
          value={time % 4}
          onChange={(e) => onSeekTime(Number(e.target.value))}
          style={{ width: '120px', accentColor: 'var(--accent)' }}
        />

        <button
          type="button"
          className="btn sm"
          onClick={() => {
            setZoom(1.0)
            setPan({ x: 0, y: 0 })
          }}
          title="Đặt lại khung nhìn về 100%"
          style={{ fontSize: '10.5px' }}
        >
          100%
        </button>
      </div>
    </div>
  )
}
