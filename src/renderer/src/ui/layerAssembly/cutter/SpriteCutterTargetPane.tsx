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
import { useLayerAssetImage } from '../useLayerAssetImage'
import { IconLayers, IconTrash, IconPlus, IconFlipHorizontal, IconPen } from '../../icons'
import { CustomSelect } from '../../controls/CustomSelect'
import { LayerAssemblyCalloutOverlay } from '../LayerAssemblyCalloutOverlay'

interface CutterPlacedLayerItemProps {
  layer: AssembledLayerItem
  assets?: LayerComposite['assets']
  isSelected: boolean
  onPointerDown: (e: React.PointerEvent, layer: AssembledLayerItem) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
}

function CutterPlacedLayerItem({
  layer,
  assets,
  isSelected,
  onPointerDown,
  onPointerMove,
  onPointerUp
}: CutterPlacedLayerItemProps) {
  const resolvedUrl = useLayerAssetImage(
    layer.asset || layer.assetPath,
    layer.imageUrl,
    assets
  )
  const baseScale = Math.max(0.05, layer.scale || 1)
  const squashScaleX = layer.scaleX ?? 1
  const squashScaleY = layer.scaleY ?? 1
  const anchor = layer.boneId ? 'center' : layer.motion?.anchor || 'center'
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
  const zVal = layer.z ?? 0

  return (
    <div
      className={`layer-cutter-placed-layer ${isSelected ? 'selected' : ''}`}
      style={{
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) translate3d(${layer.x}px, ${layer.y}px, 0px) scale(${baseScale})`,
        transformOrigin: '50% 50%',
        transformStyle: 'preserve-3d',
        zIndex: Math.round(1000 - zVal)
      }}
      onPointerDown={(e) => onPointerDown(e, layer)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className="layer-cutter-placed-inner"
        style={{
          position: 'relative',
          display: 'inline-block',
          transform: `rotateY(${-rotY}deg) rotateX(${rotX}deg) rotateZ(${rotZ}deg) scale(${squashScaleX}, ${squashScaleY})`,
          transformOrigin: anchorOrigin,
          transformStyle: 'preserve-3d',
          opacity: layer.opacity ?? 1
        }}
      >
        {isSelected && (
          <div
            className="layer-cutter-layer-zbadge"
            title={`Chiều sâu Z: ${zVal} (Z nhỏ/âm nổi lên trước, Z lớn lùi ra sau · Phím - / +)`}
          >
            Z: {zVal}
          </div>
        )}
        {resolvedUrl ? (
          <img src={resolvedUrl} alt={layer.name} draggable={false} />
        ) : (
          <div
            style={{
              padding: 8,
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              borderRadius: 4,
              fontSize: 10
            }}
          >
            {layer.name}
          </div>
        )}
      </div>
    </div>
  )
}

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
  const [presetsList, setPresetsList] = useState<TemplateSlotPreset[]>(() => getAllPresets())
  const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false)

  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null)
  const [isDragOverCanvas, setIsDragOverCanvas] = useState<boolean>(false)
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [boardScale, setBoardScale] = useState<number>(1)

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
        setBoardScale(Number(s.toFixed(3)))
      }
    }
    updateScale()
    const ro = new ResizeObserver(updateScale)
    ro.observe(el)
    return () => ro.disconnect()
  }, [boardW, boardH])

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

  const handleLayerPointerDown = (e: React.PointerEvent, layer: AssembledLayerItem) => {
    e.stopPropagation()
    onSelectLayer(layer.id)
    setDraggingLayer({
      id: layer.id,
      startX: e.clientX,
      startY: e.clientY,
      layerX: layer.x,
      layerY: layer.y
    })
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
  }

  const handleLayerPointerMove = (e: React.PointerEvent) => {
    if (!draggingLayer) return
    const invScale = 1 / Math.max(0.25, boardScale)
    const dx = Math.round((e.clientX - draggingLayer.startX) * invScale)
    const dy = Math.round((e.clientY - draggingLayer.startY) * invScale)
    onUpdateLayer(draggingLayer.id, {
      x: draggingLayer.layerX + dx,
      y: draggingLayer.layerY + dy
    })
  }

  const handleLayerPointerUp = (e: React.PointerEvent) => {
    if (draggingLayer) {
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
      setDraggingLayer(null)
    }
  }

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

      {/* Pane Header */}
      <div className="layer-cutter-header">
        <div className="layer-cutter-title">
          <IconLayers width={14} height={14} />
          <strong>Bố cục lắp ráp 2D</strong>
          <span className="layer-cutter-badge-pill">{composite.layers.length} bộ phận</span>
        </div>
        <div className="layer-cutter-actions">
          <button
            type="button"
            className="btn sm"
            disabled={composite.layers.length === 0}
            onClick={() => setShowSaveDialog(true)}
            title="Lưu bố cục và tên bộ phận hiện tại thành Khuôn mẫu mới để sau ghép nhanh hơn"
          >
            💾 Lưu mẫu mới
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
              className="btn sm"
              style={{ color: '#ef4444', height: 26, padding: '0 8px', gap: 4 }}
              title="Xóa tất cả các lớp đang có trên bố cục 2D"
              onClick={onClearAllLayers}
            >
              <IconTrash width={12} height={12} /> Xóa hết
            </button>
          )}
        </div>
      </div>

      {/* Studio Topbar Row: Mode Switcher, Preset Options & Quick Z-Order */}
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
            ⚡ Chế độ tự do
          </button>
          <button
            id="btn-mode-template"
            type="button"
            className={`layer-cutter-tool-btn ${useTemplate ? 'active' : ''}`}
            onClick={() => setUseTemplate(true)}
            title="Dùng khuôn mẫu: Bật các ô khung định vị vị trí có sẵn"
          >
            📐 Dùng khuôn mẫu
          </button>
        </div>

        {/* When useTemplate is ON: Preset selector and slots toggle */}
        {useTemplate && (
          <>
            <div style={{ width: 190 }}>
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
                className="btn sm icon"
                style={{ color: '#ef4444', height: 24, padding: '0 6px' }}
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
            <span className="layer-cutter-z-hint">(Phím - / +)</span>
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
        <div className="layer-cutter-target-viewport" ref={targetViewportRef}>
          <div
            ref={boardRef}
            className={`layer-cutter-target-board ${isDragOverCanvas ? 'drag-over' : ''}`}
            style={{
              width: `${boardW}px`,
              height: `${boardH}px`,
              transform: `translate(-50%, -50%) scale(${boardScale})`,
              transformOrigin: 'center center'
            }}
            onPointerMove={handleBoardPointerMove}
            onDragOver={handleBoardDragOver}
            onDragLeave={handleBoardDragLeave}
            onDrop={handleBoardDrop}
          >
            {/* Center Axis Grid Marker */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 1,
                height: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                transform: 'translateY(-50%)',
                pointerEvents: 'none'
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: '100%',
                height: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                transform: 'translateX(-50%)',
                pointerEvents: 'none'
              }}
            />

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
                    className={`layer-cutter-slot-box ${isOver ? 'drag-over' : ''} ${isFilled ? 'filled' : ''}`}
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
            {sortedVisibleLayers.map((layer) => {
              return (
                <CutterPlacedLayerItem
                  key={layer.id}
                  layer={layer}
                  assets={composite.assets}
                  isSelected={selectedLayerId === layer.id}
                  onPointerDown={handleLayerPointerDown}
                  onPointerMove={handleLayerPointerMove}
                  onPointerUp={handleLayerPointerUp}
                />
              )
            })}
          </div>

          {/* Bóng tròn chọn nhanh Layer nằm ngoài khung caro trên bảng lắp ráp 2D */}
          <LayerAssemblyCalloutOverlay
            layers={composite.layers}
            selectedLayerId={selectedLayerId}
            canvasWidth={boardW}
            canvasHeight={boardH}
            zoom={boardScale}
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
      <div className="layer-cutter-footer">
        {currentSelectedLayer ? (
          <div className="layer-cutter-footer-controls">
            <div className="layer-cutter-footer-group">
              <div
                className="layer-cutter-part-input-wrap footer-name-wrap"
                title="Nhấp để đổi tên bộ phận đang chọn"
              >
                <IconPen width={11} height={11} className="layer-cutter-part-pen" />
                <input
                  type="text"
                  className="layer-cutter-part-name-input footer-name-input"
                  value={currentSelectedLayer.name}
                  onChange={(e) => onUpdateLayer(currentSelectedLayer.id, { name: e.target.value })}
                  placeholder="Tên bộ phận..."
                />
              </div>
              <span className="layer-cutter-badge" style={{ fontSize: 9, padding: '1px 5px' }}>
                ({Math.round(currentSelectedLayer.x)}, {Math.round(currentSelectedLayer.y)})
              </span>
            </div>

            {/* Scale control */}
            <div className="layer-cutter-footer-group">
              <span>Thu phóng:</span>
              <button
                type="button"
                className="btn sm icon"
                style={{ width: 18, height: 18, padding: 0 }}
                title="Giảm kích thước (-5%)"
                onClick={() =>
                  onUpdateLayer(currentSelectedLayer.id, {
                    scale: Math.max(0.05, Number((currentSelectedLayer.scale - 0.05).toFixed(2)))
                  })
                }
              >
                -
              </button>
              <input
                type="range"
                min={0.05}
                max={3.0}
                step={0.01}
                value={currentSelectedLayer.scale}
                onChange={(e) =>
                  onUpdateLayer(currentSelectedLayer.id, { scale: Number(e.target.value) })
                }
              />
              <button
                type="button"
                className="btn sm icon"
                style={{ width: 18, height: 18, padding: 0 }}
                title="Tăng kích thước (+5%)"
                onClick={() =>
                  onUpdateLayer(currentSelectedLayer.id, {
                    scale: Math.min(4.0, Number((currentSelectedLayer.scale + 0.05).toFixed(2)))
                  })
                }
              >
                +
              </button>
              <button
                type="button"
                className="layer-cutter-footer-mini-btn"
                title="Đặt lại tỉ lệ chuẩn 100%"
                onClick={() => onUpdateLayer(currentSelectedLayer.id, { scale: 1 })}
              >
                {Math.round(currentSelectedLayer.scale * 100)}%
              </button>
            </div>

            {/* Rotation control */}
            <div className="layer-cutter-footer-group">
              <span>Xoay:</span>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={currentSelectedLayer.rotation}
                onChange={(e) =>
                  onUpdateLayer(currentSelectedLayer.id, { rotation: Number(e.target.value) })
                }
              />
              <button
                type="button"
                className="layer-cutter-footer-mini-btn"
                title="Đặt lại góc xoay 0°"
                onClick={() => onUpdateLayer(currentSelectedLayer.id, { rotation: 0 })}
              >
                {currentSelectedLayer.rotation}°
              </button>
            </div>

            {/* Z-Depth (Layer Stacking) control */}
            <div
              className="layer-cutter-footer-group"
              title="Chiều sâu Z: Z càng nhỏ (âm) càng nổi lên phía trước camera, Z càng lớn (dương) càng lùi ra sau. Nhấn phím '-' / '+' để thay đổi"
            >
              <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>Z:</span>
              <button
                type="button"
                className="btn sm icon"
                style={{ width: 18, height: 18, padding: 0 }}
                title="Đưa nổi lên trước (Z - 1, phím '-')"
                onClick={() => {
                  const cur = currentSelectedLayer.z ?? 0
                  onUpdateLayer(currentSelectedLayer.id, { z: cur - 1 })
                }}
              >
                -
              </button>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: 'var(--accent-cyan)',
                  minWidth: 20,
                  textAlign: 'center'
                }}
              >
                {currentSelectedLayer.z ?? 0}
              </span>
              <button
                type="button"
                className="btn sm icon"
                style={{ width: 18, height: 18, padding: 0 }}
                title="Đưa chìm ra sau (Z + 1, phím '+')"
                onClick={() => {
                  const cur = currentSelectedLayer.z ?? 0
                  onUpdateLayer(currentSelectedLayer.id, { z: cur + 1 })
                }}
              >
                +
              </button>
            </div>

            {/* Flip Horizontal */}
            <button
              type="button"
              className={`btn sm ${(currentSelectedLayer.scaleX ?? 1) < 0 ? 'primary' : ''}`}
              style={{ height: 22, padding: '0 8px', fontSize: 10 }}
              title="Lật ảnh nằm ngang (Flip Horizontal)"
              onClick={() =>
                onUpdateLayer(currentSelectedLayer.id, {
                  scaleX: (currentSelectedLayer.scaleX ?? 1) * -1
                })
              }
            >
              <IconFlipHorizontal width={12} height={12} /> Lật ngang
            </button>

            {/* Center button */}
            <button
              type="button"
              className="btn sm"
              style={{ height: 22, padding: '0 8px', fontSize: 10 }}
              title="Đặt bộ phận về ngay chính giữa (0, 0)"
              onClick={() => onUpdateLayer(currentSelectedLayer.id, { x: 0, y: 0 })}
            >
              ⊙ Về giữa
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-faint)' }}>
            <span>💡 Click chọn lớp để chỉnh sửa hoặc di chuyển · Kéo từ trái sang hoặc</span>
            <kbd style={{ background: 'var(--bg-3)', padding: '1px 5px', borderRadius: 3, border: '1px solid var(--line)', color: 'var(--text)', fontSize: 10 }}>Ctrl+V</kbd>
            <span>để dán tại chuột</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
          {selectedLayerId && (
            <button
              type="button"
              className="btn sm icon"
              style={{ color: '#ef4444', height: 24, padding: '0 8px', gap: 4 }}
              onClick={() => onDeleteLayer(selectedLayerId)}
              title="Xóa bộ phận đang chọn"
            >
              <IconTrash width={12} height={12} /> Xóa
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
