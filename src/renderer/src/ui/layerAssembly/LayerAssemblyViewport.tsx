import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { LayerComposite, AssembledLayerItem } from './types'
import { WorkshopBoneOverlay, type BoneOverlayProps } from './WorkshopBoneOverlay'
import { PlantSpineOverlay, type PlantSpineOverlayProps } from './PlantSpineOverlay'
import { MotionSketchOverlay, type MotionSketchOverlayProps } from './MotionSketchOverlay'
import { AnimAssistChips } from './AnimAssistChips'
import { confirmPoseAndStep } from './workshopStepRecord'
import { PlantMotionChips } from './PlantMotionSection'
import { RigGhostOverlay } from './RigGhostOverlay'
import { LayerAssemblyTransportBar } from './LayerAssemblyTransportBar'
import { IconLayers, IconImage } from '../icons'
import { useView } from '../../store/view'
import { computeCanvasAtmosphere } from './layerAssembly2DLighting'
import type { AssemblyLighting } from '../assets/models3d/types'
import {
  loadLayerWorkshopViewPrefs,
  saveLayerWorkshopViewPrefs
} from './layerAssemblyViewPrefs'
import type { Bbox2DHandle } from './layerAssembly2DBbox'
import { useLayerAssemblySplitters } from './useLayerAssemblySplitters'
import { useLayerAssembly2DDrag } from './useLayerAssembly2DDrag'
import { AssembledLayerItemView } from './AssembledLayerItemView'
import { LayerAssembly2DToolbar } from './LayerAssembly2DToolbar'
import { fitCharacterToCanvas, fitCanvasToCharacter } from './layerAssemblyFit'
import { useLayerBrushEraser, type BrushPreview, type Assembly2DTool } from './useLayerBrushEraser'
import { EraserIsolatedCanvas } from './LayerAssemblyEraser'
import { LayerAssemblyCalloutOverlay } from './LayerAssemblyCalloutOverlay'
import { WorkshopCutoutPartRigOverlay } from './WorkshopCutoutPartRigOverlay'
import { applyRigAction } from './workshopRig'
import { useRigToolStore, setRigToolState, closeCutoutPartRig, toggleBoneLabels } from './rigToolStore'
import type { WorkshopTab } from './WorkshopRightPanel'
import type { AssemblyWorkspaceView } from './LayerAssemblyDialog'
import { usePinchPanGesture } from '../../hooks/usePinchPanGesture'

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
  const [show3DPerspective, setShow3DPerspective] = useState(() => loadLayerWorkshopViewPrefs().show3DPerspective2D)
  const [clipToCamera, setClipToCamera] = useState(() => loadLayerWorkshopViewPrefs().clipToCamera2D)
  const [showBbox, setShowBbox] = useState(() => loadLayerWorkshopViewPrefs().showBbox2D)
  const theme = useView((s) => s.theme)
  const isLight = theme === 'light'
  usePinchPanGesture(containerRef, ({ scaleFactor, dx, dy }) => {
    setZoom((z) => Math.max(0.12, Math.min(3.5, Number((z * scaleFactor).toFixed(3)))))
    setPan((p) => ({ x: Math.round(p.x + dx), y: Math.round(p.y + dy) }))
  })

  const isBonesVisible = showBones
  const rigTool = useRigToolStore()
  const isCutoutRigActive = Boolean(rigTool.cutoutStageMode)
  const activeCutoutLayerId = rigTool.focusedCutoutLayerId || selectedLayerId
  const shouldDimOthers = isCutoutRigActive && (rigTool.dimOtherLayers ?? true) && Boolean(activeCutoutLayerId)

  const selectedLayer = useMemo(() => {
    return composite.layers.find((l) => l.id === selectedLayerId) || null
  }, [composite.layers, selectedLayerId])

  const [isolatedPreviewUrl, setIsolatedPreviewUrl] = useState<string | null>(null)
  const [showStageHint, setShowStageHint] = useState<boolean>(false)
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

  const {
    isDraggingLayer,
    isDraggingHandle,
    handleStartDragHandle,
    handleStartDragLayer,
    handleDragPointerMove,
    handleDragPointerUp
  } = useLayerAssembly2DDrag({
    zoom,
    pan,
    setPan,
    isPanning,
    setIsPanning,
    composite,
    selectedIds,
    selectedLayerId,
    onSelectLayer,
    onUpdateLayer,
    onChangeComposite,
    brushActiveTool: brush.activeTool
  })

  const panStartRef = useRef({ mouseX: 0, mouseY: 0, initPanX: 0, initPanY: 0 })

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

  // Tự động căn giữa và co dãn vừa vặn (Fit to screen) khung vẽ 2D kèm hành lang hai bên cho bóng chọn layer ngoài khung caro
  const handleFitView = useCallback((sync3D = false) => {
    if (!containerRef.current) {
      setZoom(1.0)
      setPan({ x: 0, y: 0 })
      return
    }
    const cw = containerRef.current.clientWidth || 500
    const ch = containerRef.current.clientHeight || 500
    const padding = 1.26
    const availW = Math.max(160, cw - 152)
    const availH = Math.max(160, ch - 96)
    const scaleX = Math.min(cw / ((composite.width || 600) * padding), availW / (composite.width || 600))
    const scaleY = Math.min(ch / ((composite.height || 600) * padding), availH / (composite.height || 600))
    const fitScale = Math.min(2.5, Math.max(0.15, Math.min(scaleX, scaleY)))
    setZoom(Number(fitScale.toFixed(3)))
    // Dịch nhẹ tâm sang phải 16px để nhường chỗ cho thanh dock dọc bên trái + cột bóng tròn bên trái
    setPan({ x: 16, y: 0 })
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
    if (
      target?.closest?.(
        '.layer-workshop-3d-vertical-dock, .layer-brush-popover, .layer-workshop-popover-menu, .layer-workshop-transport-bar, .lw-callout-hud, .lw-layer-callout-bubble, button, input'
      )
    ) {
      return
    }

    // Nếu bấm chuột giữa hoặc giữ phím Alt (khi không ở tab animation) -> Bắt đầu Pan
    if (e.button === 1 || (e.altKey && tab !== 'animation')) {
      setIsPanning(true)
      panStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        initPanX: pan.x,
        initPanY: pan.y
      }
      try {
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      } catch {}
      return
    }

    if (brush.activeTool === 'eraser') return

    onSelectLayer(null)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (brush.isErasing) return

    if (isPanning) {
      const dx = e.clientX - panStartRef.current.mouseX
      const dy = e.clientY - panStartRef.current.mouseY
      setPan({
        x: panStartRef.current.initPanX + dx,
        y: panStartRef.current.initPanY + dy
      })
      return
    }

    if (handleDragPointerMove(e)) return
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    brush.handleEraserPointerUp(e)
    handleDragPointerUp(e)
  }

  const is2DOnly = view === '2d'
  const isEraserActive = brush.activeTool === 'eraser' && (!tab || tab === 'layers') && !isPlaying
  const {
    eraserHeight,
    eraserColWidth,
    handleRowSplitterPointerDown,
    handleColSplitterPointerDown
  } = useLayerAssemblySplitters()

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
            perspective: 'none',
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
            const isCutoutFocus = isCutoutRigActive && layer.id === activeCutoutLayerId
            const isCutoutDimmed = shouldDimOthers && layer.id !== activeCutoutLayerId

            return (
              <AssembledLayerItemView
                key={layer.id}
                layer={layer}
                isSelected={isSelected}
                isDimmed={isCutoutDimmed}
                isFocused={isCutoutFocus}
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

          {/* Onion skin + quỹ đạo ngọn xương (tab Animation), nằm ngay dưới lớp xương */}
          {tab === 'animation' && boneOverlay && isBonesVisible && (
            <RigGhostOverlay rig={boneOverlay.composite.rig} width={composite.width} height={composite.height} time={boneOverlay.time} boneId={boneOverlay.boneId} />
          )}

          {/* Khung xương Blender/Moho SVG Overlay - Hiển thị NỔI TRÊN CÙNG các lớp để thao tác kéo xoay trực tiếp 60fps */}
          {boneOverlay && isBonesVisible && <WorkshopBoneOverlay {...boneOverlay} />}

          {/* Xương motion: hiển thị đường uốn & vẽ tay xương mới khi ở tab Motion */}
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

        {/* Bóng tròn chọn nhanh Layer nằm ngoài khung caro (kèm dây nối Cung tròn / Vuông bo giống Cam 2D) */}
        {brush.activeTool !== 'eraser' && (
          <LayerAssemblyCalloutOverlay
            layers={composite.layers}
            selectedLayerId={selectedLayerId}
            selectedIds={selectedIds}
            canvasWidth={composite.width || 600}
            canvasHeight={composite.height || 600}
            zoom={zoom}
            panX={pan.x}
            panY={pan.y}
            containerRef={containerRef}
            onSelectLayer={onSelectLayer}
            showHud={tab !== 'animation' && tab !== 'plant'}
            safeLeft={54}
            safeRight={14}
            safeTop={42}
            safeBottom={54}
          />
        )}

        {/* Chế độ vẽ xương theo bộ phận (Cutout Part Rig Stage) 2D */}
        {isCutoutRigActive && (
          <WorkshopCutoutPartRigOverlay
            tab={tab}
            composite={composite}
            canvasWidth={composite.width || 600}
            canvasHeight={composite.height || 600}
            zoom={zoom}
            panX={pan.x}
            panY={pan.y}
            containerRef={containerRef}
            selectedLayerId={activeCutoutLayerId}
            onSelectLayer={(id) => {
              if (id) {
                onSelectLayer(id)
                setRigToolState({ focusedCutoutLayerId: id, targetBindingLayerId: id })
              }
            }}
            run={(action) => {
              if (onChangeComposite) {
                onChangeComposite((prev) => applyRigAction(prev, action))
              }
            }}
            onClose={() => closeCutoutPartRig()}
          />
        )}

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
          onFitCharacter={(mode) => {
            if (!onChangeComposite) return
            if (mode === 'frame') onChangeComposite(fitCanvasToCharacter(composite))
            else onChangeComposite(fitCharacterToCanvas(composite))
          }}
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
          showBoneLabels={rigTool.showBoneLabels ?? true}
          onToggleShowBoneLabels={toggleBoneLabels}
          showMesh={showMesh}
          onToggleShowMesh={onToggleShowMesh}
          lighting={composite.lighting}
          onChangeLighting={onChangeComposite ? handleUpdateLighting : undefined}
          atmosphereLabel={atmosphere.label}
          atmosphereIcon={atmosphere.icon}
          tab={tab}
          selectedBoneName={composite.rig?.bones?.find((b) => b.id === boneOverlay?.boneId)?.name ?? null}
        />

        {/* Thanh công cụ hoạt họa nổi: Xác nhận vị trí (Enter), Bút vẽ động tác, IK, Onion skin, Quỹ đạo */}
        {tab === 'animation' && sketchOverlay && brush.activeTool !== 'eraser' && (
          <AnimAssistChips
            onConfirmStep={() => {
              sketchOverlay.stopPlayback?.()
              let nextTime = sketchOverlay.time
              sketchOverlay.setComposite((c) => {
                const res = confirmPoseAndStep(c, sketchOverlay.time)
                nextTime = res.nextTime
                return res.composite
              })
              sketchOverlay.seek?.(nextTime)
            }}
          />
        )}
        {tab === 'plant' && plantOverlay && brush.activeTool !== 'eraser' && <PlantMotionChips />}

        {/* Floating 2D Hint (Ẩn mặc định, có toggle icon nhỏ gọn) */}
        {brush.activeTool !== 'eraser' && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '14px',
              zIndex: 32,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              pointerEvents: 'auto'
            }}
          >
            <button
              type="button"
              className={`lw-stage-hint-btn${showStageHint ? ' active' : ''}`}
              onClick={() => setShowStageHint((v) => !v)}
              title={showStageHint ? 'Ẩn phím tắt & hướng dẫn sân khấu' : 'Hiện phím tắt & hướng dẫn sân khấu 2D (nhấn để bật)'}
              style={{
                width: '20px',
                height: '20px',
                padding: 0,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                background: showStageHint ? 'var(--accent)' : 'color-mix(in srgb, var(--bg-1) 85%, transparent)',
                color: showStageHint ? 'var(--on-accent)' : 'var(--text-dim)',
                border: '1px solid var(--line-soft)',
                backdropFilter: 'blur(6px)',
                cursor: 'pointer',
                lineHeight: 1
              }}
            >
              ℹ️
            </button>
            {showStageHint && (
              <div
                style={{
                  maxWidth: 'calc(100vw - 360px)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '10.5px',
                  color: 'var(--text)',
                  background: 'var(--bg-1)',
                  border: '1px solid var(--line-focus)',
                  backdropFilter: 'blur(10px)',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm, 4px)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)'
                }}
              >
                {tab === 'animation'
                  ? '🎭 Hoạt ảnh: Chuột trái chỉnh xương → nhấn Enter ⏎ xác nhận vị trí · Giữ Shift + Chuột trái: ghi động tác Realtime · D: bút vẽ · Space: phát thử'
                  : tab === 'bones'
                    ? '🦴 Khung xương: Kéo chuột để vẽ xương · Kéo ngọn để chỉnh độ dài & góc · Click xương để focus · Space: phát thử'
                    : tab === 'plant'
                      ? '🌿 Motion: Kéo từ GỐC lên NGỌN để vẽ xương · Nắm vòng tròn ở ngọn kéo theo nhịp để GHI chuyển động · R: vẽ quỹ đạo ngọn'
                      : 'Kéo layer / Mũi tên: dời 2D · +/-: độ sâu Z · Alt / chuột giữa: dời khung · Cuộn: zoom'}
              </div>
            )}
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

