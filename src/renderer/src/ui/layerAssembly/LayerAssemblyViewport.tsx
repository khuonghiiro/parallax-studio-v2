import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { LayerComposite, AssembledLayerItem } from './types'
import { useLayerAssetImage } from './useLayerAssetImage'
import { computeLayerMotion } from './layerAssemblyMotion'
import { LayerAssemblyTransportBar } from './LayerAssemblyTransportBar'
import { IconLayers, IconImage } from '../icons'
import { useView } from '../../store/view'
import { computeLayer2DLighting, computeCanvasAtmosphere } from './layerAssembly2DLighting'
import { LightingControlPopover } from './LightingControlPopover'
import type { AssemblyLighting } from '../assets/models3d/types'
import { DEFAULT_LIGHTING } from '../assets/models3d/assemblyLighting'
import {
  loadLayerWorkshopViewPrefs,
  saveLayerWorkshopViewPrefs
} from './layerAssemblyViewPrefs'

export interface LayerAssemblyViewportProps {
  composite: LayerComposite
  selectedLayerId: string | null
  selectedIds?: string[]
  onSelectLayer: (id: string | null, additive?: boolean) => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onChangeComposite?: (update: LayerComposite | ((prev: LayerComposite) => LayerComposite)) => void
  isPlaying: boolean
  onTogglePlay: () => void
  time: number
  onSeekTime: (t: number) => void
  hideTransport?: boolean
}

export function LayerAssemblyViewport({
  composite,
  selectedLayerId,
  selectedIds,
  onSelectLayer,
  onUpdateLayer,
  onChangeComposite,
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
  const [show3DPerspective, setShow3DPerspective] = useState(() => loadLayerWorkshopViewPrefs().show3DPerspective2D)
  const [clipToCamera, setClipToCamera] = useState(() => loadLayerWorkshopViewPrefs().clipToCamera2D)
  const theme = useView((s) => s.theme)
  const isLight = theme === 'light'
  const [isLightingOpen, setIsLightingOpen] = useState(false)
  const lightingBtnRef = useRef<HTMLButtonElement | null>(null)

  const maxZ = useMemo(() => {
    if (composite.layers.length === 0) return 0
    return Math.max(0, ...composite.layers.map((l) => l.z || 0))
  }, [composite.layers])

  const atmosphere = useMemo(() => {
    return computeCanvasAtmosphere(composite.lighting, isLight)
  }, [composite.lighting, isLight])

  const handleUpdateLighting = useCallback(
    (newLighting: AssemblyLighting) => {
      if (onChangeComposite) {
        onChangeComposite((prev) => ({
          ...prev,
          lighting: newLighting
        }))
      }
    },
    [onChangeComposite]
  )

  const dragStartRef = useRef<{
    mouseX: number
    mouseY: number
    initPositions: Map<string, { x: number; y: number }>
    initPanX: number
    initPanY: number
  }>({ mouseX: 0, mouseY: 0, initPositions: new Map(), initPanX: 0, initPanY: 0 })

  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (!isDraggingLayer && !isPanning)) return
      if (isDraggingLayer) dragStartRef.current.initPositions.forEach((position, id) => onUpdateLayer(id, position))
      if (isPanning) setPan({ x: dragStartRef.current.initPanX, y: dragStartRef.current.initPanY })
      setIsDraggingLayer(false); setIsPanning(false)
      e.preventDefault(); e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [isDraggingLayer, isPanning, onUpdateLayer])

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

    if (!isDraggingLayer) return
    const dx = (e.clientX - dragStartRef.current.mouseX) / zoom
    const dy = (e.clientY - dragStartRef.current.mouseY) / zoom
    dragStartRef.current.initPositions.forEach((pos, id) => {
      onUpdateLayer(id, {
        x: Math.round(pos.x + dx),
        y: Math.round(pos.y + dy)
      })
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
    const isAdditive = e.ctrlKey || e.metaKey || e.shiftKey
    if (isAdditive) {
      onSelectLayer(layer.id, true)
      return
    } else if (!selectedIds?.includes(layer.id)) {
      onSelectLayer(layer.id, false)
    }
    if (layer.locked) return

    setIsDraggingLayer(true)
    const activeSelection = selectedIds && selectedIds.includes(layer.id) ? selectedIds : [layer.id]
    const initPositions = new Map<string, { x: number; y: number }>()
    composite.layers.forEach((l) => {
      if (activeSelection.includes(l.id) && !l.locked) {
        initPositions.set(l.id, { x: l.x, y: l.y })
      }
    })
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initPositions,
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
          background: atmosphere.background,
          transition: 'background 0.35s ease',
          backgroundImage: atmosphere.isDarkScene
            ? 'linear-gradient(45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%), linear-gradient(-45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.04) 75%), linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.04) 75%)'
            : 'linear-gradient(45deg, rgba(0, 0, 0, 0.04) 25%, transparent 25%), linear-gradient(-45deg, rgba(0, 0, 0, 0.04) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(0, 0, 0, 0.04) 75%), linear-gradient(-45deg, transparent 75%, rgba(0, 0, 0, 0.04) 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          border: '2px solid var(--accent)',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--line-focus)',
          overflow: clipToCamera ? 'hidden' : 'visible',
          perspective: show3DPerspective ? '1400px' : 'none',
          perspectiveOrigin: '50% 50%',
          transformStyle: 'preserve-3d'
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
          const isSelected = selectedIds ? selectedIds.includes(layer.id) : layer.id === selectedLayerId

          return (
            <AssembledLayerItemView
              key={layer.id}
              layer={layer}
              isSelected={isSelected}
              time={time}
              maxZ={maxZ}
              lighting={composite.lighting}
              show3DPerspective={show3DPerspective}
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
        <button
          type="button"
          className={`btn xs${show3DPerspective ? ' active' : ''}`}
          onClick={() =>
            setShow3DPerspective((v) => {
              const next = !v
              saveLayerWorkshopViewPrefs({ show3DPerspective2D: next })
              return next
            })
          }
          title={
            show3DPerspective
              ? 'Đang bật phối cảnh 3D (hiển thị nghiêng sâu và xoay chéo). Bấm để chuyển về phẳng 2D'
              : 'Đang xem phẳng 2D. Bấm để bật phối cảnh & hướng xoay 3D'
          }
        >
          {show3DPerspective ? '📐 3D' : '🖼 2D'}
        </button>
        <button
          type="button"
          className={`btn xs${clipToCamera ? ' active' : ''}`}
          onClick={() =>
            setClipToCamera((v) => {
              const next = !v
              saveLayerWorkshopViewPrefs({ clipToCamera2D: next })
              return next
            })
          }
          title={
            clipToCamera
              ? 'Đang cắt gọn các phần layer vượt ra ngoài tầm nhìn khung camera (Bấm để xem tràn viền)'
              : 'Đang hiển thị tràn viền toàn bộ layer (Bấm để cắt gọn theo khung camera)'
          }
        >
          {clipToCamera ? '✂ Cắt khung' : '👁 Tràn viền'}
        </button>

        {/* Nút bật popup Hướng sáng & Đổ bóng ngày đêm ngay tại thanh công cụ 2D */}
        {onChangeComposite && (
          <button
            ref={lightingBtnRef}
            type="button"
            className={`btn xs${isLightingOpen ? ' active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setIsLightingOpen((v) => !v)
            }}
            title={`Hệ thống chiếu sáng: ${atmosphere.label} (Bấm để chỉnh góc nắng & đổ bóng 2D / 3D)`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 500
            }}
          >
            <span>{atmosphere.icon}</span>
            <span>{atmosphere.label}</span>
          </button>
        )}
      </div>

      {/* Popover Hướng sáng & Đổ bóng cho 2D viewport */}
      {isLightingOpen &&
        onChangeComposite &&
        createPortal(
          <LightingControlPopover
            style={{
              position: 'fixed',
              left: lightingBtnRef.current
                ? Math.max(10, Math.min(window.innerWidth - 300, lightingBtnRef.current.getBoundingClientRect().left))
                : 20,
              top: lightingBtnRef.current
                ? Math.min(window.innerHeight - 480, lightingBtnRef.current.getBoundingClientRect().bottom + 6)
                : 40,
              zIndex: 30000
            }}
            lighting={composite.lighting || DEFAULT_LIGHTING}
            onChangeLighting={handleUpdateLighting}
            onClose={() => setIsLightingOpen(false)}
          />,
          document.body
        )}

      {/* Floating 2D Hint */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '14px',
          fontSize: '10px',
          color: 'var(--text-dim)',
          background: 'var(--bg-1)',
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
  maxZ: number
  lighting?: AssemblyLighting
  show3DPerspective?: boolean
  onPointerDown: (e: React.PointerEvent) => void
}

function AssembledLayerItemView({
  layer,
  isSelected,
  time,
  maxZ,
  lighting,
  show3DPerspective = true,
  onPointerDown
}: AssembledLayerItemViewProps) {
  const imageUrl = useLayerAssetImage(layer.assetPath, layer.imageUrl)

  // Tính hiệu ứng hướng nắng, bóng đổ theo chiều sâu Z và màu sắc hấp thụ ánh sáng ngày/đêm
  const lightingResult = useMemo(() => {
    return computeLayer2DLighting(layer, maxZ, lighting)
  }, [layer, maxZ, lighting])

  // Tính chuyển động hoạt ảnh theo thời gian mượt mà
  const {
    animRotateDeg: animRotate,
    animScaleX,
    animScaleY,
    animTranslateX,
    animTranslateY
  } = computeLayerMotion(layer.motion, time)
  const { anchor } = layer.motion

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

  const rotX = layer.rotationX || 0
  const rotY = layer.rotationY || 0
  const rotZ = layer.rotation || 0

  const layerTransform = show3DPerspective
    ? `rotateY(${-rotY}deg) rotateX(${rotX}deg) rotateZ(${rotZ + animRotate}deg) scale(${layer.scale * animScaleX}, ${layer.scale * animScaleY})`
    : `rotate(${rotZ + animRotate}deg) scale(${layer.scale * animScaleX}, ${layer.scale * animScaleY})`

  const depthTranslateZ = show3DPerspective ? -layer.z * 0.75 : 0

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) translate3d(${layer.x + animTranslateX}px, ${layer.y + animTranslateY}px, ${depthTranslateZ}px)`,
        transformStyle: 'preserve-3d',
        pointerEvents: 'none',
        willChange: 'transform',
        zIndex: Math.round(1000 - layer.z)
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'inline-block',
          transform: layerTransform,
          transformOrigin: anchorOrigin,
          transformStyle: 'preserve-3d',
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
              filter: lightingResult.combinedFilter
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
              color: 'var(--text)',
              filter: lightingResult.dropShadowFilter || undefined
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
