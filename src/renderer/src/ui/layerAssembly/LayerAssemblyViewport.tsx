import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { LayerComposite, AssembledLayerItem } from './types'
import { WorkshopBoneOverlay, type BoneOverlayProps } from './WorkshopBoneOverlay'
import { LayerAssemblyTransportBar } from './LayerAssemblyTransportBar'
import { IconLayers, IconImage } from '../icons'
import { useView } from '../../store/view'
import { computeCanvasAtmosphere } from './layerAssembly2DLighting'
import type { AssemblyLighting } from '../assets/models3d/types'
import {
  loadLayerWorkshopViewPrefs,
  saveLayerWorkshopViewPrefs
} from './layerAssemblyViewPrefs'
import {
  type Bbox2DHandle,
  calculateAnchorPinnedResize
} from './layerAssembly2DBbox'
import { AssembledLayerItemView } from './AssembledLayerItemView'
import { LayerAssembly2DToolbar } from './LayerAssembly2DToolbar'
import { useLayerBrushEraser, type BrushPreview } from './useLayerBrushEraser'
import { EraserTopBar, EraserIsolatedCanvas } from './LayerAssemblyEraser'
import type { WorkshopTab } from './WorkshopRightPanel'

export interface LayerAssemblyViewportProps {
  brushSourceLayer?: AssembledLayerItem | null
  onBrushPreview?: (preview: BrushPreview | null) => void
  onBrushModeChange?: (active: boolean) => void
  boneOverlay?: BoneOverlayProps
  composite: LayerComposite
  selectedLayerId: string | null
  selectedIds?: string[]
  onSelectLayer: (id: string | null, additive?: boolean) => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onChangeComposite?: (update: LayerComposite | ((prev: LayerComposite) => LayerComposite)) => void
  onAddLayerFromAsset?: (name: string, path: string, url?: string, pos?: { x: number; y: number }) => void
  onAppendPresetLayers?: (layers: AssembledLayerItem[], offset?: { x: number; y: number }) => void
  isPlaying: boolean
  onTogglePlay: () => void
  time: number
  onSeekTime: (t: number) => void
  tab?: WorkshopTab
  hideTransport?: boolean
  showBones?: boolean
  onToggleShowBones?: () => void
  showMesh?: boolean
  onToggleShowMesh?: () => void
}

export function LayerAssemblyViewport({
  brushSourceLayer,
  onBrushPreview,
  onBrushModeChange,
  composite,
  selectedLayerId,
  selectedIds,
  onSelectLayer,
  onUpdateLayer,
  onChangeComposite,
  onAddLayerFromAsset,
  onAppendPresetLayers,
  isPlaying,
  onTogglePlay,
  time,
  onSeekTime,
  tab,
  hideTransport = false,
  boneOverlay,
  showBones = true,
  onToggleShowBones,
  showMesh = false,
  onToggleShowMesh
}: LayerAssemblyViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [isDraggingLayer, setIsDraggingLayer] = useState(false)
  const [show3DPerspective, setShow3DPerspective] = useState(() => loadLayerWorkshopViewPrefs().show3DPerspective2D)
  const [clipToCamera, setClipToCamera] = useState(() => loadLayerWorkshopViewPrefs().clipToCamera2D)
  const [showBbox, setShowBbox] = useState(() => loadLayerWorkshopViewPrefs().showBbox2D)
  const [isDraggingHandle, setIsDraggingHandle] = useState(false)
  const theme = useView((s) => s.theme)
  const isLight = theme === 'light'

  const selectedLayer = useMemo(() => {
    return composite.layers.find((l) => l.id === selectedLayerId) || null
  }, [composite.layers, selectedLayerId])

  const [isolatedPreviewUrl, setIsolatedPreviewUrl] = useState<string | null>(null)
  const handleBrushPreview = useCallback((preview: BrushPreview | null) => {
    setIsolatedPreviewUrl(preview?.imageUrl || null)
    if (onBrushPreview) onBrushPreview(preview)
  }, [onBrushPreview])

  // Hook công cụ Cọ Tẩy (Brush Eraser) để xoá pixel thừa và làm mờ xuyên thấu nhẹ
  const brush = useLayerBrushEraser({
    selectedLayer: brushSourceLayer === undefined ? selectedLayer : brushSourceLayer,
    zoom,
    pan,
    onUpdateLayer,
    onPreview: handleBrushPreview,
    containerRef
  })

  // Tự động đóng cọ tẩy khi chuyển tab hoặc khi đang phát hoạt ảnh
  useEffect(() => {
    if ((tab && tab !== 'layers') || isPlaying) {
      if (brush.activeTool === 'eraser') {
        brush.setActiveTool('select')
      }
    }
  }, [tab, isPlaying, brush])

  useEffect(() => {
    const isErasing = brush.activeTool === 'eraser' && (!tab || tab === 'layers') && !isPlaying
    onBrushModeChange?.(isErasing)
    return () => onBrushModeChange?.(false)
  }, [brush.activeTool, tab, isPlaying, onBrushModeChange])

  const handleDragRef = useRef<{
    handle: Bbox2DHandle
    layerId: string
    startX: number
    startY: number
    startScale: number
    startMouseX: number
    startMouseY: number
    baseWidth: number
    baseHeight: number
  } | null>(null)

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
      if (e.key !== 'Escape' || (!isDraggingLayer && !isPanning && !isDraggingHandle)) return
      if (handleDragRef.current) {
        const d = handleDragRef.current
        onUpdateLayer(d.layerId, { x: d.startX, y: d.startY, scale: d.startScale })
        handleDragRef.current = null
        setIsDraggingHandle(false)
      }
      if (isDraggingLayer) dragStartRef.current.initPositions.forEach((position, id) => onUpdateLayer(id, position))
      if (isPanning) setPan({ x: dragStartRef.current.initPanX, y: dragStartRef.current.initPanY })
      setIsDraggingLayer(false); setIsPanning(false)
      e.preventDefault(); e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [isDraggingLayer, isPanning, isDraggingHandle, onUpdateLayer])

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
    const target = e.target as HTMLElement | null
    if (target?.closest?.('.layer-workshop-3d-vertical-dock, .layer-brush-popover, .layer-workshop-popover-menu, .layer-workshop-transport-bar, button, input')) {
      return
    }

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

    // Nếu đang ở công cụ Cọ Tẩy (Eraser) và click lên layer đã chọn
    if (brush.activeTool === 'eraser') {
      if (selectedLayer && e.button === 0) {
        brush.handleEraserPointerDown(e)
        return
      }
    }

    onSelectLayer(null)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement | null
    const isOverUI = !!target?.closest?.(
      '.layer-workshop-3d-vertical-dock, .layer-brush-popover, .layer-workshop-popover-menu, .layer-workshop-transport-bar, button, input, .dock-divider'
    )

    // Khi hover vào UI dock/toolbar: Ẩn ngay vòng tròn cọ
    if (isOverUI) {
      brush.setCursorPos(null)
    } else {
      brush.handleEraserPointerMove(e)
    }

    if (brush.isErasing) return

    if (isPanning) {
      const dx = e.clientX - dragStartRef.current.mouseX
      const dy = e.clientY - dragStartRef.current.mouseY
      setPan({
        x: Math.round(dragStartRef.current.initPanX + dx),
        y: Math.round(dragStartRef.current.initPanY + dy)
      })
      return
    }

    if (handleDragRef.current) {
      const d = handleDragRef.current
      const dx = (e.clientX - d.startMouseX) / zoom
      const dy = (e.clientY - d.startMouseY) / zoom
      const res = calculateAnchorPinnedResize({
        handle: d.handle,
        dx,
        dy,
        startX: d.startX,
        startY: d.startY,
        startScale: d.startScale,
        baseWidth: d.baseWidth,
        baseHeight: d.baseHeight
      })
      onUpdateLayer(d.layerId, {
        x: res.x,
        y: res.y,
        scale: res.scale
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
    brush.handleEraserPointerUp(e)

    if (isPanning) {
      setIsPanning(false)
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
    }
    if (handleDragRef.current) {
      handleDragRef.current = null
      setIsDraggingHandle(false)
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

  const handleStartDragHandle = (
    e: React.PointerEvent,
    handle: Bbox2DHandle,
    layer: AssembledLayerItem,
    baseW: number,
    baseH: number
  ) => {
    e.stopPropagation()
    if (layer.locked) return
    setIsDraggingHandle(true)
    handleDragRef.current = {
      handle,
      layerId: layer.id,
      startX: layer.x,
      startY: layer.y,
      startScale: layer.scale,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      baseWidth: baseW,
      baseHeight: baseH
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleStartDragLayer = (e: React.PointerEvent, layer: AssembledLayerItem) => {
    e.stopPropagation()

    // Nếu đang ở công cụ Cọ Tẩy (Eraser):
    if (brush.activeTool === 'eraser') {
      if (layer.id !== selectedLayerId) {
        // Chuyển chọn layer sang layer mới an toàn để nạp ảnh mới vào canvas
        onSelectLayer(layer.id, false)
        return
      }
      if (!layer.locked && e.button === 0) {
        brush.handleEraserPointerDown(e)
      }
      return
    }

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
        cursor: isPanning
          ? 'grab'
          : isDraggingHandle
          ? 'crosshair'
          : brush.activeTool === 'eraser'
          ? 'crosshair'
          : 'default',
        userSelect: 'none'
      }}
      onPointerDown={handlePointerDownViewport}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={brush.cancelStroke}
      onLostPointerCapture={brush.cancelStroke}
      onPointerLeave={() => brush.setCursorPos(null)}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e) => {
        e.preventDefault()
        const container = containerRef.current
        if (!container) return
        const rect = container.getBoundingClientRect()
        const mouseX = e.clientX - rect.left - rect.width / 2 - pan.x
        const mouseY = e.clientY - rect.top - rect.height / 2 - pan.y
        const dropX = Math.round(mouseX / zoom)
        const dropY = Math.round(mouseY / zoom)

        try {
          const raw = e.dataTransfer.getData('application/json')
          if (!raw) return
          const data = JSON.parse(raw)
          if (data.type === 'asset' && onAddLayerFromAsset) {
            onAddLayerFromAsset(data.name, data.path, data.url, { x: dropX, y: dropY })
          } else if (data.type === 'composite' && onAppendPresetLayers && data.composite?.layers) {
            onAppendPresetLayers(data.composite.layers, { x: dropX, y: dropY })
          } else if (data.type === 'layer' && data.layer) {
            onUpdateLayer(data.layer.id, { x: dropX, y: dropY })
          }
        } catch (err) {
          console.warn('[LayerAssemblyViewport] Failed to parse drop data:', err)
        }
      }}
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
          perspective: show3DPerspective && brush.activeTool !== 'eraser' ? '1400px' : 'none',
          perspectiveOrigin: '50% 50%',
          transformStyle: 'preserve-3d'
        }}
      >
        {boneOverlay && showBones && <WorkshopBoneOverlay {...boneOverlay} />}
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
              showBbox={showBbox}
              zoom={zoom}
              time={time}
              maxZ={maxZ}
              lighting={composite.lighting}
              show3DPerspective={show3DPerspective && brush.activeTool !== 'eraser'}
              showMesh={showMesh}
              onPointerDown={(e) => handleStartDragLayer(e, layer)}
              onStartDragHandle={handleStartDragHandle}
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

      {/* Vòng tròn con trỏ Cọ Tẩy (Brush Cursor Indicator) theo thời gian thực */}
      {brush.activeTool === 'eraser' && brush.cursorPos && !brush.cursorPos.isIsolated && (
        <div
          style={{
            position: 'absolute',
            left: `${brush.cursorPos.x}px`,
            top: `${brush.cursorPos.y}px`,
            width: `${brush.brushSettings.size * 2 * zoom}px`,
            height: `${brush.brushSettings.size * 2 * zoom}px`,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '1.5px solid var(--accent-cyan)',
            background: `rgba(56, 189, 248, ${Math.max(0.08, brush.brushSettings.opacity * 0.22)})`,
            boxShadow: '0 0 10px rgba(56, 189, 248, 0.45)',
            pointerEvents: 'none',
            zIndex: 9999
          }}
        />
      )}

      {/* Tab dọc công cụ 2D & Cọ tẩy xử lý */}
      <LayerAssembly2DToolbar
        activeTool={brush.activeTool}
        onChangeTool={brush.setActiveTool}
        brushSettings={brush.brushSettings}
        onChangeBrushSettings={brush.setBrushSettings}
        onResetLayerImage={brush.resetLayerImage}
        hasSelectedLayer={!!selectedLayer}
        hasModifiedImage={!!selectedLayer?.imageUrl}
        zoom={zoom}
        onResetZoom={() => {
          setZoom(1.0)
          setPan({ x: 0, y: 0 })
        }}
        onFitView={handleFitView}
        show3DPerspective={show3DPerspective}
        onToggle3DPerspective={() =>
          setShow3DPerspective((v) => {
            const next = !v
            saveLayerWorkshopViewPrefs({ show3DPerspective2D: next })
            return next
          })
        }
        clipToCamera={clipToCamera}
        onToggleClipToCamera={() =>
          setClipToCamera((v) => {
            const next = !v
            saveLayerWorkshopViewPrefs({ clipToCamera2D: next })
            return next
          })
        }
        showBbox={showBbox}
        onToggleShowBbox={() =>
          setShowBbox((v) => {
            const next = !v
            saveLayerWorkshopViewPrefs({ showBbox2D: next })
            return next
          })
        }
        hasBones={!!composite.rig?.bones?.length}
        showBones={showBones}
        onToggleShowBones={onToggleShowBones}
        showMesh={showMesh}
        onToggleShowMesh={onToggleShowMesh}
        lighting={composite.lighting}
        onChangeLighting={onChangeComposite ? handleUpdateLighting : undefined}
        atmosphereLabel={atmosphere.label}
        atmosphereIcon={atmosphere.icon}
      />

      {/* Giao diện thanh ngang Tẩy và Khung ảnh Tẩy độc lập */}
      {brush.activeTool === 'eraser' && (!tab || tab === 'layers') && !isPlaying && (
        <>
          <EraserTopBar
            brushSettings={brush.brushSettings}
            onChangeBrushSettings={brush.setBrushSettings}
            hasSelectedLayer={!!selectedLayer}
            hasModifiedImage={!!selectedLayer?.imageUrl}
            onResetLayerImage={brush.resetLayerImage}
            onClose={() => brush.setActiveTool('select')}
          />
          {selectedLayer && (
            <EraserIsolatedCanvas
              layer={selectedLayer}
              imagePreviewUrl={isolatedPreviewUrl}
              brushSettings={brush.brushSettings}
              cursorPos={brush.cursorPos}
              onPointerDown={brush.handleIsolatedPointerDown}
              onPointerMove={brush.handleIsolatedPointerMove}
              onPointerUp={brush.handleEraserPointerUp}
            />
          )}
        </>
      )}

      {/* Floating 2D Hint */}
      {brush.activeTool !== 'eraser' && (
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
          Kéo layer / Mũi tên: dời 2D · +/-: độ sâu Z · Alt / chuột giữa: dời khung · Cuộn: zoom
        </div>
      )}

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

