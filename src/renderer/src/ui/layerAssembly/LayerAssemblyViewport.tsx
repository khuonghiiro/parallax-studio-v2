import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { LayerComposite, AssembledLayerItem } from './types'
import { WorkshopBoneOverlay, type BoneOverlayProps } from './WorkshopBoneOverlay'
import { PlantSpineOverlay, type PlantSpineOverlayProps } from './PlantSpineOverlay'
import { MotionSketchOverlay, type MotionSketchOverlayProps } from './MotionSketchOverlay'
import { MotionSketchToggleChip } from './WorkshopMotionSketchCard'
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
import { useLayerBrushEraser, type BrushPreview, type Assembly2DTool } from './useLayerBrushEraser'
import { EraserIsolatedCanvas } from './LayerAssemblyEraser'
import type { WorkshopTab } from './WorkshopRightPanel'
import type { AssemblyWorkspaceView } from './LayerAssemblyDialog'

export interface LayerAssemblyViewportProps {
  view?: AssemblyWorkspaceView
  brushSourceLayer?: AssembledLayerItem | null
  onBrushPreview?: (preview: BrushPreview | null) => void
  onBrushModeChange?: (active: boolean) => void
  boneOverlay?: BoneOverlayProps
  plantOverlay?: PlantSpineOverlayProps
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
  onSelectTab?: (tab: WorkshopTab) => void
  hideTransport?: boolean
  showBones?: boolean
  onToggleShowBones?: () => void
  showMesh?: boolean
  onToggleShowMesh?: () => void
  /** Lớp Vẽ động tác (tab Animation): nhấn gần xương rồi vẽ đường đi của ngọn xương. */
  sketchOverlay?: MotionSketchOverlayProps
}

export function LayerAssemblyViewport({
  view,
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
  onSelectTab,
  hideTransport = false,
  boneOverlay,
  plantOverlay,
  showBones = true,
  onToggleShowBones,
  showMesh = false,
  onToggleShowMesh,
  sketchOverlay
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

  const isBonesVisible = showBones

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
    onUpdateLayer,
    onPreview: handleBrushPreview
  })

  // Hàm chuyển đổi công cụ 2D an toàn: tự chuyển sang tab layers nếu đang ở tab khác, tự dừng playback, tự chọn layer
  const handleToolChange = useCallback((tool: Assembly2DTool) => {
    if (tool === 'eraser') {
      if (isPlaying) {
        onTogglePlay?.()
      }
      if (tab && tab !== 'layers') {
        onSelectTab?.('layers')
      }
      if (!selectedLayerId && composite.layers.length > 0) {
        const firstAvailable = composite.layers.find((l) => !l.locked && !l.hidden) ?? composite.layers[0]
        if (firstAvailable) {
          onSelectLayer(firstAvailable.id)
        }
      }
    }
    brush.setActiveTool(tool)
  }, [isPlaying, onTogglePlay, tab, onSelectTab, selectedLayerId, composite.layers, onSelectLayer, brush])

  // Tự động đóng cọ tẩy khi người dùng chủ động chuyển từ tab 'layers' sang tab khác
  const prevTabRef = useRef(tab)
  useEffect(() => {
    if (prevTabRef.current === 'layers' && tab && tab !== 'layers') {
      if (brush.activeTool === 'eraser') {
        brush.setActiveTool('select')
      }
    }
    prevTabRef.current = tab
  }, [tab, brush])

  // Tự động đóng cọ tẩy khi phát hoạt ảnh
  useEffect(() => {
    if (isPlaying && brush.activeTool === 'eraser') {
      brush.setActiveTool('select')
    }
  }, [isPlaying, brush])

  // Phím tắt bàn phím: V (Chọn), E / B (Cọ tẩy)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'v') {
        handleToolChange('select')
      } else if (k === 'e' || k === 'b') {
        if (!e.shiftKey) {
          handleToolChange(brush.activeTool === 'eraser' ? 'select' : 'eraser')
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleToolChange, brush.activeTool])

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

  // Tự động căn giữa và co dãn vừa vặn (Fit to screen) khung vẽ 2D đồng bộ 100% tỉ lệ padding = 1.16 với 3D
  const handleFitView = useCallback((sync3D = false) => {
    if (!containerRef.current) {
      setZoom(1.0)
      setPan({ x: 0, y: 0 })
      return
    }
    const cw = containerRef.current.clientWidth || 500
    const ch = containerRef.current.clientHeight || 500
    const padding = 1.16
    const scaleX = cw / ((composite.width || 600) * padding)
    const scaleY = ch / ((composite.height || 600) * padding)
    const fitScale = Math.min(2.5, Math.max(0.15, Math.min(scaleX, scaleY)))
    setZoom(Number(fitScale.toFixed(3)))
    setPan({ x: 0, y: 0 })
    if (sync3D && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('layerWorkshop:fitFrontSync', { detail: { source: '2d' } }))
    }
  }, [composite.width, composite.height])

  // Khởi tạo Fit view ban đầu, khi kích thước khung thay đổi hoặc khi đồng bộ từ 3D
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      handleFitView(false)
    })
    const container = containerRef.current
    const ro = container
      ? new ResizeObserver(() => {
          handleFitView(false)
        })
      : null
    if (container && ro) ro.observe(container)

    const onSyncFit = (e: Event) => {
      const detail = (e as CustomEvent)?.detail
      if (detail?.source !== '2d') {
        handleFitView(false)
      }
    }
    window.addEventListener('layerWorkshop:fitFrontSync', onSyncFit)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('layerWorkshop:fitFrontSync', onSyncFit)
    }
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

    // Nếu bấm chuột giữa hoặc giữ phím Alt (khi không ở tab animation) -> Bắt đầu Pan
    if (e.button === 1 || (e.altKey && tab !== 'animation')) {
      setIsPanning(true)
      dragStartRef.current.mouseX = e.clientX
      dragStartRef.current.mouseY = e.clientY
      dragStartRef.current.initPanX = pan.x
      dragStartRef.current.initPanY = pan.y
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }

    if (brush.activeTool === 'eraser') return

    onSelectLayer(null)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
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

  const is2DOnly = view === '2d'
  const isEraserActive = brush.activeTool === 'eraser' && (!tab || tab === 'layers') && !isPlaying
  const [eraserHeight, setEraserHeight] = useState(250)
  const [eraserColWidth, setEraserColWidth] = useState(380)

  const handleRowSplitterPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = eraserHeight
    const target = e.currentTarget
    try {
      target.setPointerCapture(e.pointerId)
    } catch {}

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaY = startY - moveEvent.clientY
      const newHeight = Math.max(160, Math.min(480, startHeight + deltaY))
      setEraserHeight(newHeight)
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      try {
        if (target.hasPointerCapture(upEvent.pointerId)) {
          target.releasePointerCapture(upEvent.pointerId)
        }
      } catch {}
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [eraserHeight])

  const handleColSplitterPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = eraserColWidth
    const target = e.currentTarget
    try {
      target.setPointerCapture(e.pointerId)
    } catch {}

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = Math.max(280, Math.min(580, startWidth + deltaX))
      setEraserColWidth(newWidth)
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      try {
        if (target.hasPointerCapture(upEvent.pointerId)) {
          target.releasePointerCapture(upEvent.pointerId)
        }
      } catch {}
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [eraserColWidth])

  return (
    <div
      className="layer-assembly-viewport-container"
      style={{
        display: 'flex',
        flexDirection: isEraserActive && is2DOnly ? 'row' : 'column',
        flex: '1 1 0%',
        minWidth: 0,
        minHeight: 0,
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Chế độ 2D độc lập: Cột 1 (Eraser studio) nằm bên trái */}
      {isEraserActive && is2DOnly && (
        <>
          <div
            className="layer-eraser-col-pane"
            style={{
              width: `${eraserColWidth}px`,
              flexShrink: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {selectedLayer ? (
              <EraserIsolatedCanvas
                layer={selectedLayer}
                is2DOnly={true}
                imagePreviewUrl={isolatedPreviewUrl}
                brushSettings={brush.brushSettings}
                cursorPos={brush.cursorPos}
                onPointerDown={brush.handleIsolatedPointerDown}
                onPointerMove={brush.handleIsolatedPointerMove}
                onPointerUp={brush.handleEraserPointerUp}
                onCancel={brush.cancelStroke}
                onCursorLeave={() => brush.setCursorPos(null)}
                onChangeBrushSettings={brush.setBrushSettings}
                onResetLayerImage={brush.resetLayerImage}
                onClose={() => brush.setActiveTool('select')}
                isErasing={brush.isErasing}
              />
            ) : (
              <div className="layer-eraser-empty">
                <span>Bấm chọn một layer ở ảnh tổng thể bên phải để tẩy pixel</span>
                <button type="button" onClick={() => brush.setActiveTool('select')}>
                  Thoát chế độ tẩy
                </button>
              </div>
            )}
          </div>
          <div
            className="layer-eraser-col-splitter"
            onPointerDown={handleColSplitterPointerDown}
            title="Kéo chuột để chỉnh độ rộng cột tẩy"
          />
        </>
      )}

      {/* Khung Stage 2D chính (Bố cục 2D tổng thể) */}
      <div
        ref={containerRef}
        className="layer-workshop-viewport"
        style={{
          position: 'relative',
          flex: '1 1 0%',
          minWidth: 0,
          minHeight: 0,
          width: isEraserActive && is2DOnly ? undefined : '100%',
          height: isEraserActive && !is2DOnly ? undefined : '100%',
          background: 'var(--bg-0)',
          overflow: 'hidden',
        cursor: isPanning
          ? 'grab'
          : isDraggingHandle
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
              assetTable={composite.assets}
              show3DPerspective={show3DPerspective && brush.activeTool !== 'eraser'}
              showMesh={showMesh}
              onPointerDown={(e) => handleStartDragLayer(e, layer)}
              onStartDragHandle={handleStartDragHandle}
            />
          )
        })}

        {/* Khung xương Blender/Moho SVG Overlay - Hiển thị NỔI TRÊN CÙNG các lớp để thao tác kéo xoay trực tiếp 60fps */}
        {boneOverlay && isBonesVisible && <WorkshopBoneOverlay {...boneOverlay} />}

        {/* Xương thực vật: hiển thị đường uốn & vẽ tay xương mới khi ở tab Thực vật */}
        {plantOverlay && <PlantSpineOverlay {...plantOverlay} />}

        {/* Lớp Vẽ động tác (tab Animation): bật bút (D) rồi nhấn gần xương và vẽ đường đi của ngọn xương */}
        {tab === 'animation' && sketchOverlay && <MotionSketchOverlay {...sketchOverlay} />}

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

      {/* Tab dọc công cụ 2D & Cọ tẩy xử lý */}
      <LayerAssembly2DToolbar
        activeTool={brush.activeTool}
        onChangeTool={handleToolChange}
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
        onFitView={() => handleFitView(true)}
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
        showBones={isBonesVisible}
        onToggleShowBones={onToggleShowBones}
        showMesh={showMesh}
        onToggleShowMesh={onToggleShowMesh}
        lighting={composite.lighting}
        onChangeLighting={onChangeComposite ? handleUpdateLighting : undefined}
        atmosphereLabel={atmosphere.label}
        atmosphereIcon={atmosphere.icon}
      />

      {/* Nút nổi bật/tắt bút Vẽ động tác */}
      {tab === 'animation' && sketchOverlay && brush.activeTool !== 'eraser' && <MotionSketchToggleChip />}

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
          {tab === 'animation'
            ? '🎭 Hoạt ảnh: Kéo xương để tạo dáng · D: bật bút vẽ động tác (vẽ đường đi ngọn xương) · Space: phát thử · Alt / chuột giữa: dời khung · Cuộn: zoom'
            : tab === 'bones'
              ? '🦴 Khung xương: Kéo khớp đầu/đuôi để chỉnh độ dài & góc · Kéo thân để dời vị trí · Delete: xóa xương'
              : tab === 'plant'
                ? '🌿 Thực vật: Kéo từ GỐC lên NGỌN để vẽ xương · Nắm tay nắm ở ngọn lắc qua lại để dạy cây đung đưa · Kéo chấm để sửa dáng'
                : 'Kéo layer / Mũi tên: dời 2D · +/-: độ sâu Z · Alt / chuột giữa: dời khung · Cuộn: zoom'}
        </div>
      )}

      {/* Floating Bottom Transport Bar */}
      {!hideTransport && (
        <LayerAssemblyTransportBar
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          time={time}
          onSeekTime={onSeekTime}
          onResetView={() => handleFitView(true)}
          zoomPercent={Math.round(zoom * 100)}
        />
      )}
    </div>

    {/* Hàng 2: Splitter & Giao diện Tẩy Layer (Chỉ áp dụng khi chế độ 2D & 3D / không phải is2DOnly) */}
    {isEraserActive && !is2DOnly && (
      <>
        <div
          className="layer-eraser-splitter"
          onPointerDown={handleRowSplitterPointerDown}
          title="Kéo chuột để chỉnh độ cao vùng tẩy"
        />
        <div
          className="layer-eraser-bottom-pane"
          style={{ height: `${eraserHeight}px`, flexShrink: 0, minHeight: 0 }}
        >
          {selectedLayer ? (
            <EraserIsolatedCanvas
              layer={selectedLayer}
              is2DOnly={false}
              imagePreviewUrl={isolatedPreviewUrl}
              brushSettings={brush.brushSettings}
              cursorPos={brush.cursorPos}
              onPointerDown={brush.handleIsolatedPointerDown}
              onPointerMove={brush.handleIsolatedPointerMove}
              onPointerUp={brush.handleEraserPointerUp}
              onCancel={brush.cancelStroke}
              onCursorLeave={() => brush.setCursorPos(null)}
              onChangeBrushSettings={brush.setBrushSettings}
              onResetLayerImage={brush.resetLayerImage}
              onClose={() => brush.setActiveTool('select')}
              isErasing={brush.isErasing}
            />
          ) : (
            <div className="layer-eraser-empty">
              <span>Bấm chọn một layer ở ảnh tổng thể phía trên để tẩy pixel</span>
              <button type="button" onClick={() => brush.setActiveTool('select')}>
                Thoát chế độ tẩy
              </button>
            </div>
          )}
        </div>
      </>
    )}
  </div>
  )
}

