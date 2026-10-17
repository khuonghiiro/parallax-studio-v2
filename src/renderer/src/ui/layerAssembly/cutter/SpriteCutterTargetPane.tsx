import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { AssembledLayerItem, LayerComposite } from '../types'
import type { CutPiece, TemplateSlotDef, TemplateSlotPreset } from './types'
import {
  getAllPresets,
  deleteCustomPreset,
  exportPresetJson,
  importPresetJson
} from './slotPresets'
import { SaveTemplateDialog } from './SaveTemplateDialog'
import { AssembledPartsDrawer } from './AssembledPartsDrawer'
import { computeFrontLayerZ } from '../useLayerWorkshop'
import { computeAutoFitPieceScale, computeSlotFitPieceScale } from './cutterHelpers'
import { IconLayers, IconTrash, IconPlus, IconCrop } from '../../icons'
import { CustomSelect } from '../../controls/CustomSelect'
import { LayerAssemblyCalloutOverlay } from '../LayerAssemblyCalloutOverlay'
import { calculateAnchorPinnedResize, type Bbox2DHandle } from '../layerAssembly2DBbox'
import {
  CutterCanvasBgControl,
  CutterZoomControl,
  resolveCanvasBgState,
  type CanvasBgMode
} from './CutterCanvasBgToggle'
import { CutterPlacedLayerItem } from './CutterPlacedLayerItem'
import { CutterTargetFooter } from './CutterTargetFooter'

export interface SpriteCutterTargetPaneProps {
  composite: LayerComposite
  selectedLayerId: string | null
  selectedPiece: CutPiece | null
  onSelectLayer: (id: string | null, additive?: boolean) => void
  onAddLayer: (
    name: string,
    assetPath: string,
    imageUrl?: string,
    pos?: { x: number; y: number },
    customZ?: number,
    initialScale?: number
  ) => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onDeleteLayer: (id: string) => void
  onClearAllLayers?: () => void
}

export function SpriteCutterTargetPane({
  composite,
  selectedLayerId,
  selectedPiece,
  onSelectLayer,
  onAddLayer,
  onUpdateLayer,
  onDeleteLayer,
  onClearAllLayers
}: SpriteCutterTargetPaneProps) {
  const [useTemplate, setUseTemplate] = useState<boolean>(false)
  const [activePresetId, setActivePresetId] = useState<string>('humanoid_anime')
  const [showSlots, setShowSlots] = useState<boolean>(true)
  const [showBbox, setShowBbox] = useState<boolean>(true)
  const [targetCanvasBg, setTargetCanvasBg] = useState<CanvasBgMode>('checker-dark')
  const [targetZoomMode, setTargetZoomMode] = useState<'fit' | number>('fit')
  const [presetsList, setPresetsList] = useState<TemplateSlotPreset[]>(() => getAllPresets())
  const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false)

  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null)
  const [isDragOverCanvas, setIsDragOverCanvas] = useState<boolean>(false)
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [fitBoardScale, setFitBoardScale] = useState<number>(1)

  const boardRef = useRef<HTMLDivElement | null>(null)
  const targetViewportRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const boardW = Math.max(200, composite.width || 600)
  const boardH = Math.max(200, composite.height || 600)

  const sortedVisibleLayers = useMemo(
    () =>
      composite.layers
        .filter((l) => !l.hidden)
        .sort((a, b) => (b.z ?? 0) - (a.z ?? 0)),
    [composite.layers]
  )

  useEffect(() => {
    const el = targetViewportRef.current
    if (!el) return
    const updateScale = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        const s = Math.min(
          1.25,
          Math.max(0.15, Math.min((rect.width - 104) / boardW, (rect.height - 64) / boardH))
        )
        setFitBoardScale(Number(s.toFixed(3)))
      }
    }
    updateScale()
    const ro = new ResizeObserver(updateScale)
    ro.observe(el)
    return () => ro.disconnect()
  }, [boardW, boardH])

  const effectiveBoardScale = targetZoomMode === 'fit' ? fitBoardScale : targetZoomMode
  const targetBgCssClass = resolveCanvasBgState(targetCanvasBg).cssClass

  const stepTargetZoom = (delta: number) => {
    const next = Math.min(3.0, Math.max(0.15, Number((effectiveBoardScale + delta).toFixed(2))))
    setTargetZoomMode(next)
  }

  const handleViewportWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    stepTargetZoom(e.deltaY < 0 ? 0.12 : -0.12)
  }

  const activePreset: TemplateSlotPreset =
    presetsList.find((p) => p.id === activePresetId) || presetsList[0]

  const currentSelectedLayer = composite.layers.find((l) => l.id === selectedLayerId) || null

  const getBoardCoords = useCallback(
    (clientX: number, clientY: number) => {
      const board = boardRef.current
      if (!board) return { x: 0, y: 0 }
      const rect = board.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const sx = boardW / Math.max(1, rect.width)
      const sy = boardH / Math.max(1, rect.height)
      return {
        x: Math.round((clientX - cx) * sx),
        y: Math.round((clientY - cy) * sy)
      }
    },
    [boardW, boardH]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        const cutPart = (window as unknown as { __parallax_cut_part?: CutPiece }).__parallax_cut_part
        if (cutPart) {
          e.preventDefault()
          const nextZ = computeFrontLayerZ(composite.layers)
          const fitScale = computeAutoFitPieceScale(cutPart, boardW, boardH)
          onAddLayer(cutPart.label || 'Mảnh cắt', '', cutPart.dataUrl, mouseCanvasPos, nextZ, fitScale)
        }
        return
      }

      if (currentSelectedLayer) {
        if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
          e.preventDefault()
          const curZ = currentSelectedLayer.z ?? 0
          onUpdateLayer(currentSelectedLayer.id, { z: curZ + 1 })
        } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
          e.preventDefault()
          const curZ = currentSelectedLayer.z ?? 0
          onUpdateLayer(currentSelectedLayer.id, { z: curZ - 1 })
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [boardW, boardH, composite.layers, currentSelectedLayer, mouseCanvasPos, onAddLayer, onUpdateLayer])

  const handleBoardPointerMove = (e: React.PointerEvent) => {
    setMouseCanvasPos(getBoardCoords(e.clientX, e.clientY))
  }

  const handleBoardDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOverCanvas(true)
    setMouseCanvasPos(getBoardCoords(e.clientX, e.clientY))
  }

  const handleBoardDragLeave = () => {
    setIsDragOverCanvas(false)
  }

  const handleBoardDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverCanvas(false)
    setDragOverSlotId(null)

    let piece: CutPiece | null = null
    try {
      const json = e.dataTransfer.getData('application/json')
      if (json) piece = JSON.parse(json)
    } catch {}

    if (!piece) {
      piece = (window as unknown as { __parallax_cut_part?: CutPiece }).__parallax_cut_part || null
    }

    if (piece) {
      const pos = getBoardCoords(e.clientX, e.clientY)
      const nextZ = computeFrontLayerZ(composite.layers)
      const fitScale = computeAutoFitPieceScale(piece, boardW, boardH)
      onAddLayer(piece.label || 'Mảnh cắt', '', piece.dataUrl, pos, nextZ, fitScale)
    }
  }

  const handleSlotDrop = (e: React.DragEvent, slot: TemplateSlotDef) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverSlotId(null)

    let piece: CutPiece | null = null
    try {
      const json = e.dataTransfer.getData('application/json')
      if (json) piece = JSON.parse(json)
    } catch {}

    if (!piece) {
      piece = (window as unknown as { __parallax_cut_part?: CutPiece }).__parallax_cut_part || null
    }

    if (!piece) return

    const existing = composite.layers.find(
      (l) => l.name.toLowerCase().includes(slot.name.toLowerCase()) || l.id === slot.id
    )
    const slotScale = computeSlotFitPieceScale(piece, slot, boardW, boardH)

    if (existing) {
      onUpdateLayer(existing.id, {
        imageUrl: piece.dataUrl,
        x: slot.x,
        y: slot.y,
        z: slot.z ?? existing.z,
        scale: slotScale
      })
      onSelectLayer(existing.id)
    } else {
      onAddLayer(slot.name, '', piece.dataUrl, { x: slot.x, y: slot.y }, slot.z, slotScale)
    }
  }

  const handleAssignToSlot = (slot: TemplateSlotDef) => {
    if (!selectedPiece) return
    const existing = composite.layers.find(
      (l) => l.name.toLowerCase().includes(slot.name.toLowerCase()) || l.id === slot.id
    )
    const slotScale = computeSlotFitPieceScale(selectedPiece, slot, boardW, boardH)

    if (existing) {
      onUpdateLayer(existing.id, {
        imageUrl: selectedPiece.dataUrl,
        x: slot.x,
        y: slot.y,
        z: slot.z ?? existing.z,
        scale: slotScale
      })
      onSelectLayer(existing.id)
    } else {
      onAddLayer(slot.name, '', selectedPiece.dataUrl, { x: slot.x, y: slot.y }, slot.z, slotScale)
    }
  }

  // Dragging existing placed layers around on board
  const [draggingLayer, setDraggingLayer] = useState<{
    id: string
    startX: number
    startY: number
    layerX: number
    layerY: number
  } | null>(null)

  // Resizing layer via 8-point Bbox handles (Non-destructive scale)
  const [resizingLayer, setResizingLayer] = useState<{
    id: string
    handle: Bbox2DHandle
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    startScale: number
    baseWidth: number
    baseHeight: number
  } | null>(null)

  const handleLayerPointerDown = (e: React.PointerEvent, layer: AssembledLayerItem) => {
    if (resizingLayer) return
    e.stopPropagation()
    onSelectLayer(layer.id)
    if (layer.locked) return
    setDraggingLayer({
      id: layer.id,
      startX: e.clientX,
      startY: e.clientY,
      layerX: layer.x,
      layerY: layer.y
    })
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
  }

  const handleLayerPointerMove = (e: React.PointerEvent) => {
    if (!draggingLayer || resizingLayer) return
    const invScale = 1 / Math.max(0.15, effectiveBoardScale)
    const dx = Math.round((e.clientX - draggingLayer.startX) * invScale)
    const dy = Math.round((e.clientY - draggingLayer.startY) * invScale)
    onUpdateLayer(draggingLayer.id, {
      x: draggingLayer.layerX + dx,
      y: draggingLayer.layerY + dy
    })
  }

  const handleLayerPointerUp = (e: React.PointerEvent) => {
    if (draggingLayer) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {}
      setDraggingLayer(null)
    }
  }

  const handleStartResizeHandle = useCallback(
    (
      e: React.PointerEvent,
      handle: Bbox2DHandle,
      layer: AssembledLayerItem,
      baseWidth: number,
      baseHeight: number
    ) => {
      e.stopPropagation()
      onSelectLayer(layer.id)
      setDraggingLayer(null)
      setResizingLayer({
        id: layer.id,
        handle,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: layer.x,
        startY: layer.y,
        startScale: Math.max(0.05, layer.scale || 1),
        baseWidth: Math.max(20, baseWidth),
        baseHeight: Math.max(20, baseHeight)
      })
    },
    [onSelectLayer]
  )

  useEffect(() => {
    if (!resizingLayer) return
    const handleWindowMove = (e: PointerEvent) => {
      const invBoardScale = 1 / Math.max(0.15, effectiveBoardScale)
      const dx = (e.clientX - resizingLayer.startClientX) * invBoardScale
      const dy = (e.clientY - resizingLayer.startClientY) * invBoardScale
      const result = calculateAnchorPinnedResize({
        handle: resizingLayer.handle,
        dx,
        dy,
        startX: resizingLayer.startX,
        startY: resizingLayer.startY,
        startScale: resizingLayer.startScale,
        baseWidth: resizingLayer.baseWidth,
        baseHeight: resizingLayer.baseHeight,
        minDimension: 16
      })
      onUpdateLayer(resizingLayer.id, {
        x: result.x,
        y: result.y,
        scale: result.scale
      })
    }
    const handleWindowUp = () => {
      setResizingLayer(null)
    }
    window.addEventListener('pointermove', handleWindowMove)
    window.addEventListener('pointerup', handleWindowUp)
    window.addEventListener('pointercancel', handleWindowUp)
    return () => {
      window.removeEventListener('pointermove', handleWindowMove)
      window.removeEventListener('pointerup', handleWindowUp)
      window.removeEventListener('pointercancel', handleWindowUp)
    }
  }, [resizingLayer, effectiveBoardScale, onUpdateLayer])

  // Custom template operations
  const handleTemplateSaved = (newPreset: TemplateSlotPreset) => {
    const updated = getAllPresets()
    setPresetsList(updated)
    setActivePresetId(newPreset.id)
    setUseTemplate(true)
  }

  const handleDeleteActivePreset = () => {
    if (!activePreset.isCustom) return
    deleteCustomPreset(activePreset.id)
    const updated = getAllPresets()
    setPresetsList(updated)
    setActivePresetId(updated[0]?.id || 'humanoid_anime')
  }

  const handleExportPreset = () => {
    const json = exportPresetJson(activePreset)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activePreset.name.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9-]/g, '_')}_template.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportPresetFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        if (text) {
          const imported = importPresetJson(text)
          const updated = getAllPresets()
          setPresetsList(updated)
          setActivePresetId(imported.id)
          setUseTemplate(true)
        }
      } catch (err) {
        alert(`Không thể nạp file mẫu: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="layer-cutter-pane">
      {/* Save Template Modal */}
      {showSaveDialog && (
        <SaveTemplateDialog
          layers={composite.layers}
          onClose={() => setShowSaveDialog(false)}
          onSaved={handleTemplateSaved}
        />
      )}

      {/* Pane Header: Tiêu đề + Nền (Caro + Tối/Sáng) + Zoom + Khuôn mẫu + Xóa hết */}
      <div className="layer-cutter-header">
        <div className="layer-cutter-title">
          <IconLayers width={14} height={14} />
          <strong>Bố cục lắp ráp 2D</strong>
          <span className="layer-cutter-badge-pill">{composite.layers.length} bộ phận</span>
        </div>
        <div className="layer-cutter-actions">
          {/* Chế độ Nền Bố cục 2D: Caro bật/tắt kết hợp Tối/Sáng */}
          <CutterCanvasBgControl value={targetCanvasBg} onChange={setTargetCanvasBg} />

          {/* Cụm Zoom cho Bố cục 2D */}
          <CutterZoomControl
            zoomMode={targetZoomMode}
            effectiveScale={effectiveBoardScale}
            onStepZoom={stepTargetZoom}
            onSetZoomMode={setTargetZoomMode}
            title="Thu phóng khung Bố cục lắp ráp 2D (Lăn chuột trên bảng để zoom nhanh)"
          />

          <button
            type="button"
            className="btn sm"
            disabled={composite.layers.length === 0}
            onClick={() => setShowSaveDialog(true)}
            title="Lưu bố cục và tên bộ phận hiện tại thành Khuôn mẫu mới để sau ghép nhanh hơn"
          >
            💾 Lưu mẫu
          </button>

          {useTemplate && (
            <button
              type="button"
              className="btn sm"
              onClick={handleExportPreset}
              title="Xuất file JSON khuôn mẫu này"
            >
              Xuất JSON
            </button>
          )}

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".json,application/json"
            onChange={handleImportPresetFile}
          />
          <button
            type="button"
            className="btn sm"
            onClick={() => fileInputRef.current?.click()}
            title="Nhập file JSON khuôn mẫu từ máy tính"
          >
            Nhập JSON
          </button>

          {onClearAllLayers && composite.layers.length > 0 && (
            <button
              type="button"
              className="btn sm lc-danger-btn"
              title="Xóa tất cả các lớp đang có trên bố cục 2D"
              onClick={onClearAllLayers}
            >
              <IconTrash width={12} height={12} />
              <span>Xóa hết</span>
            </button>
          )}
        </div>
      </div>

      {/* Studio Topbar Row: Mode Switcher, Bbox Resize Toggle, Preset Options & Quick Z-Order */}
      <div className="layer-cutter-toolbar layer-cutter-toolbar-row">
        {/* Mode Toggle: Tự do vs Dùng khuôn mẫu */}
        <div className="layer-cutter-tool-group">
          <button
            id="btn-mode-freeform"
            type="button"
            className={`layer-cutter-tool-btn ${!useTemplate ? 'active' : ''}`}
            onClick={() => setUseTemplate(false)}
            title="Chế độ Tự do: Thoải mái đặt vị trí và tự đặt tên cho bộ phận"
          >
            ⚡ Tự do
          </button>
          <button
            id="btn-mode-template"
            type="button"
            className={`layer-cutter-tool-btn ${useTemplate ? 'active' : ''}`}
            onClick={() => setUseTemplate(true)}
            title="Dùng khuôn mẫu: Bật các ô khung định vị vị trí có sẵn"
          >
            📐 Khuôn mẫu
          </button>
        </div>

        {/* Toggle Bật/Tắt Khung BBox Resize 8 điểm (Giữ nguyên 100% chất lượng ảnh gốc) */}
        <button
          id="btn-cutter-toggle-bbox"
          type="button"
          className={`layer-cutter-bbox-toggle-btn ${showBbox ? 'active' : ''}`}
          onClick={() => setShowBbox((v) => !v)}
          title="Bật/tắt khung Bbox 8 điểm kéo chỉnh kích thước bộ phận (Giữ nguyên 100% độ phân giải ảnh gốc để zoom cận cảnh không vỡ nét)"
        >
          <IconCrop width={12} height={12} />
          <span>Khung Bbox</span>
        </button>

        {/* When useTemplate is ON: Preset selector and slots toggle */}
        {useTemplate && (
          <>
            <div style={{ width: 175 }}>
              <CustomSelect<string>
                size="sm"
                value={activePresetId}
                onChange={(val: string) => setActivePresetId(val)}
                options={presetsList.map((p) => ({
                  value: p.id,
                  label: `${p.isCustom ? '⭐ ' : ''}${p.name}`
                }))}
              />
            </div>

            <label className="layer-cutter-check-pill" title="Hiện/ẩn các ô khung định vị trên bảng 2D">
              <input
                type="checkbox"
                checked={showSlots}
                onChange={(e) => setShowSlots(e.target.checked)}
              />
              <span>Hiện khung</span>
            </label>

            {activePreset.isCustom && (
              <button
                type="button"
                className="btn sm lc-danger-btn"
                title="Xóa mẫu tùy chỉnh này"
                onClick={handleDeleteActivePreset}
              >
                <IconTrash width={12} height={12} />
              </button>
            )}
          </>
        )}

        {/* Quick Z-Index controls on toolbar when a layer is selected */}
        {currentSelectedLayer && (
          <div
            className="layer-cutter-z-controls"
            title="Chiều sâu Z: Z càng nhỏ (âm) càng nổi lên phía trước camera, Z càng lớn (dương) càng lùi ra sau. Nhấn phím '-' hoặc '+' để thay đổi nhanh"
          >
            <span className="subbar-label">Thứ tự Z:</span>
            <button
              id="btn-cutter-z-minus"
              type="button"
              className="stepper-btn"
              title="Đưa nổi lên trước (Z - 1, phím '-')"
              onClick={() =>
                onUpdateLayer(currentSelectedLayer.id, {
                  z: (currentSelectedLayer.z ?? 0) - 1
                })
              }
            >
              -
            </button>
            <span className="layer-cutter-z-val">{currentSelectedLayer.z ?? 0}</span>
            <button
              id="btn-cutter-z-plus"
              type="button"
              className="stepper-btn"
              title="Đưa chìm ra sau (Z + 1, phím '+')"
              onClick={() =>
                onUpdateLayer(currentSelectedLayer.id, {
                  z: (currentSelectedLayer.z ?? 0) + 1
                })
              }
            >
              +
            </button>
          </div>
        )}

        <div className="layer-cutter-toolbar-right">
          <span className="layer-cutter-coord-pill" title="Kích thước khung bố cục & tọa độ con trỏ chuột">
            {boardW}×{boardH} · XY: ({mouseCanvasPos.x}, {mouseCanvasPos.y})
          </span>
        </div>
      </div>

      {/* Target Container: Canvas + Side Drawer */}
      <div className="layer-cutter-target-container">
        {/* 2D Canvas Viewport */}
        <div
          className={`layer-cutter-target-viewport ${targetBgCssClass}`}
          ref={targetViewportRef}
          onWheel={handleViewportWheel}
        >
          <div
            ref={boardRef}
            className={`layer-cutter-target-board ${targetBgCssClass} ${
              isDragOverCanvas ? 'drag-over' : ''
            }`}
            style={{
              width: `${boardW}px`,
              height: `${boardH}px`,
              transform: `translate(-50%, -50%) scale(${effectiveBoardScale})`,
              transformOrigin: 'center center'
            }}
            onPointerMove={handleBoardPointerMove}
            onDragOver={handleBoardDragOver}
            onDragLeave={handleBoardDragLeave}
            onDrop={handleBoardDrop}
          >
            {/* Center Axis Grid Marker */}
            <div className="layer-cutter-board-axis-v" />
            <div className="layer-cutter-board-axis-h" />

            {/* Template Slot Wireframe Overlays (ONLY WHEN useTemplate IS ACTIVE) */}
            {useTemplate &&
              showSlots &&
              activePreset.slots.map((slot) => {
                const isOver = dragOverSlotId === slot.id
                const isFilled = composite.layers.some(
                  (l) => l.name.toLowerCase().includes(slot.name.toLowerCase()) || l.id === slot.id
                )

                return (
                  <div
                    key={slot.id}
                    className={`layer-cutter-slot-box ${isOver ? 'drag-over' : ''} ${
                      isFilled ? 'filled' : ''
                    }`}
                    style={{
                      left: `calc(50% + ${slot.x - slot.width / 2}px)`,
                      top: `calc(50% + ${slot.y - slot.height / 2}px)`,
                      width: `${slot.width}px`,
                      height: `${slot.height}px`
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragOverSlotId(slot.id)
                    }}
                    onDragLeave={() => setDragOverSlotId(null)}
                    onDrop={(e) => handleSlotDrop(e, slot)}
                    onClick={() => handleAssignToSlot(slot)}
                    title={
                      selectedPiece
                        ? `Click để gán "${selectedPiece.label}" vào [${slot.name}]`
                        : `Kéo thả mảnh cắt vào đây để gán vào [${slot.name}]`
                    }
                  >
                    <span>{slot.name}</span>
                  </div>
                )
              })}

            {/* Render Placed Layers in 2D Assembly (sorted & filtered identically to Tab 1) */}
            {sortedVisibleLayers.map((layer) => (
              <CutterPlacedLayerItem
                key={layer.id}
                layer={layer}
                assets={composite.assets}
                isSelected={selectedLayerId === layer.id}
                showBbox={showBbox}
                boardScale={effectiveBoardScale}
                onPointerDown={handleLayerPointerDown}
                onPointerMove={handleLayerPointerMove}
                onPointerUp={handleLayerPointerUp}
                onStartResizeHandle={handleStartResizeHandle}
              />
            ))}
          </div>

          {/* Bóng tròn chọn nhanh Layer nằm ngoài khung caro trên bảng lắp ráp 2D */}
          <LayerAssemblyCalloutOverlay
            layers={composite.layers}
            selectedLayerId={selectedLayerId}
            canvasWidth={boardW}
            canvasHeight={boardH}
            zoom={effectiveBoardScale}
            containerRef={targetViewportRef}
            onSelectLayer={(id) => onSelectLayer(id)}
            safeLeft={12}
            safeRight={12}
            safeTop={40}
            safeBottom={16}
            storageKey="parallax.cutterTarget.callouts.v1"
          />
        </div>

        {/* Right Side Drawer: AssembledPartsDrawer in Freeform mode, or Slots Drawer in Template mode */}
        {!useTemplate ? (
          <AssembledPartsDrawer
            layers={composite.layers}
            assets={composite.assets}
            selectedLayerId={selectedLayerId}
            onSelectLayer={onSelectLayer}
            onUpdateLayer={onUpdateLayer}
            onDeleteLayer={onDeleteLayer}
          />
        ) : (
          <div className="layer-cutter-slot-drawer">
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>
              Khung mẫu ({activePreset.slots.length})
            </div>
            {activePreset.slots.map((slot) => {
              const matchedLayer = composite.layers.find(
                (l) => l.name.toLowerCase().includes(slot.name.toLowerCase()) || l.id === slot.id
              )
              const isOver = dragOverSlotId === slot.id

              return (
                <div
                  key={slot.id}
                  className={`layer-cutter-slot-card ${isOver ? 'drag-over' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOverSlotId(slot.id)
                  }}
                  onDragLeave={() => setDragOverSlotId(null)}
                  onDrop={(e) => handleSlotDrop(e, slot)}
                  onClick={() => {
                    if (selectedPiece) {
                      handleAssignToSlot(slot)
                    } else if (matchedLayer) {
                      onSelectLayer(matchedLayer.id)
                    }
                  }}
                  title={
                    selectedPiece
                      ? `Click để gán "${selectedPiece.label}" vào ${slot.name}`
                      : matchedLayer
                        ? `Chọn lớp ${matchedLayer.name}`
                        : `Kéo thả ảnh vào đây`
                  }
                >
                  <div className="layer-cutter-slot-thumb">
                    {matchedLayer?.imageUrl ? (
                      <img src={matchedLayer.imageUrl} alt={slot.name} />
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>+</span>
                    )}
                  </div>
                  <div className="layer-cutter-slot-info">
                    <span className="layer-cutter-slot-name">{slot.name}</span>
                    <span className="layer-cutter-slot-state">
                      {matchedLayer ? (
                        <span style={{ color: 'var(--accent-cyan)' }}>✓ Đã lắp</span>
                      ) : (
                        'Trống (Kéo thả ảnh)'
                      )}
                    </span>
                  </div>
                  {selectedPiece && (
                    <button
                      type="button"
                      className="btn sm icon"
                      style={{ marginLeft: 'auto', minWidth: 22, height: 22 }}
                      title={`Gán mảnh đang chọn vào ${slot.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAssignToSlot(slot)
                      }}
                    >
                      <IconPlus width={11} height={11} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer Info & Transform Controls for Selected Layer */}
      <CutterTargetFooter
        selectedLayer={currentSelectedLayer}
        onUpdateLayer={onUpdateLayer}
        onDeleteLayer={onDeleteLayer}
      />
    </div>
  )
}
