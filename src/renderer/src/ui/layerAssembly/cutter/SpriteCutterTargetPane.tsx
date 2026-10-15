import React, { useState, useRef, useEffect, useCallback } from 'react'
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
import { computeNextLayerZ } from '../useLayerWorkshop'
import { IconLayers, IconTrash, IconPlus, IconCheck, IconFlipHorizontal, IconPen } from '../../icons'
import { CustomSelect } from '../../controls/CustomSelect'
import { LayerAssemblyCalloutOverlay } from '../LayerAssemblyCalloutOverlay'

export interface SpriteCutterTargetPaneProps {
  composite: LayerComposite
  assetUrls?: Record<string, string>
  selectedLayerId: string | null
  selectedPiece: CutPiece | null
  onSelectLayer: (id: string | null, additive?: boolean) => void
  onAddLayer: (name: string, assetPath: string, imageUrl?: string, pos?: { x: number; y: number }, customZ?: number) => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onDeleteLayer: (id: string) => void
  onClearAllLayers?: () => void
}

export function SpriteCutterTargetPane({
  composite,
  assetUrls,
  selectedLayerId,
  selectedPiece,
  onSelectLayer,
  onAddLayer,
  onUpdateLayer,
  onDeleteLayer,
  onClearAllLayers
}: SpriteCutterTargetPaneProps) {
  // Freeform mode by default per user request
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

  useEffect(() => {
    const el = targetViewportRef.current
    if (!el) return
    const updateScale = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        const s = Math.min(1, Math.max(0.4, Math.min((rect.width - 96) / 600, (rect.height - 68) / 600)))
        setBoardScale(Number(s.toFixed(3)))
      }
    }
    updateScale()
    const ro = new ResizeObserver(updateScale)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Active slot preset
  const activePreset: TemplateSlotPreset =
    presetsList.find((p) => p.id === activePresetId) || presetsList[0]

  // Currently selected layer
  const currentSelectedLayer = composite.layers.find((l) => l.id === selectedLayerId) || null

  // Convert client pointer event to board coordinates (center is 0,0)
  const getBoardCoords = useCallback((clientX: number, clientY: number) => {
    const board = boardRef.current
    if (!board) return { x: 0, y: 0 }
    const rect = board.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const sx = 600 / Math.max(1, rect.width)
    const sy = 600 / Math.max(1, rect.height)
    return {
      x: Math.round((clientX - cx) * sx),
      y: Math.round((clientY - cy) * sy)
    }
  }, [])

  // Global Keyboard Shortcuts for Target Pane:
  // - Ctrl + V: Dán mảnh cắt tại vị trí chuột
  // - Phím '+' / '=' / NumpadAdd: Tăng Z-index của layer đang chọn (+1)
  // - Phím '-' / '_' / NumpadSubtract: Giảm Z-index của layer đang chọn (-1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        const cutPart = (window as unknown as { __parallax_cut_part?: CutPiece }).__parallax_cut_part
        if (cutPart) {
          e.preventDefault()
          const nextZ = computeNextLayerZ(composite.layers)
          onAddLayer(cutPart.label || 'Mảnh cắt', '', cutPart.dataUrl, mouseCanvasPos, nextZ)
        }
        return
      }

      // Phím + / - điều khiển Z-index layer đang chọn (layer Z cao hơn sẽ che layer Z thấp hơn)
      if (currentSelectedLayer) {
        if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
          e.preventDefault()
          const curZ = currentSelectedLayer.z ?? 10
          onUpdateLayer(currentSelectedLayer.id, { z: curZ + 1 })
        } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
          e.preventDefault()
          const curZ = currentSelectedLayer.z ?? 10
          onUpdateLayer(currentSelectedLayer.id, { z: Math.max(1, curZ - 1) })
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [composite.layers, currentSelectedLayer, mouseCanvasPos, onAddLayer, onUpdateLayer])

  // Track mouse coordinates for pasting
  const handleBoardPointerMove = (e: React.PointerEvent) => {
    setMouseCanvasPos(getBoardCoords(e.clientX, e.clientY))
  }

  // Handle Drag Over & Drop onto the Canvas Board
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
      const nextZ = computeNextLayerZ(composite.layers)
      onAddLayer(piece.label || 'Mảnh cắt', '', piece.dataUrl, pos, nextZ)
    }
  }

  // Handle Drop onto a specific Template Slot Box
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

    if (existing) {
      onUpdateLayer(existing.id, {
        imageUrl: piece.dataUrl,
        x: slot.x,
        y: slot.y,
        z: slot.z ?? existing.z
      })
      onSelectLayer(existing.id)
    } else {
      onAddLayer(slot.name, '', piece.dataUrl, { x: slot.x, y: slot.y })
    }
  }

  // Assign currently selected piece directly to slot
  const handleAssignToSlot = (slot: TemplateSlotDef) => {
    if (!selectedPiece) return
    const existing = composite.layers.find(
      (l) => l.name.toLowerCase().includes(slot.name.toLowerCase()) || l.id === slot.id
    )

    if (existing) {
      onUpdateLayer(existing.id, {
        imageUrl: selectedPiece.dataUrl,
        x: slot.x,
        y: slot.y,
        z: slot.z ?? existing.z
      })
      onSelectLayer(existing.id)
    } else {
      onAddLayer(slot.name, '', selectedPiece.dataUrl, { x: slot.x, y: slot.y })
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
            title="Thứ tự lớp (Z-index): Layer có Z lớn hơn sẽ che layer có Z nhỏ hơn. Nhấn phím '+' hoặc '-' để thay đổi nhanh"
          >
            <span className="subbar-label">Thứ tự Z:</span>
            <button
              id="btn-cutter-z-minus"
              type="button"
              className="stepper-btn"
              title="Giảm Z (-1, phím '-')"
              onClick={() =>
                onUpdateLayer(currentSelectedLayer.id, {
                  z: Math.max(1, (currentSelectedLayer.z ?? 10) - 1)
                })
              }
            >
              -
            </button>
            <span className="layer-cutter-z-val">{currentSelectedLayer.z ?? 10}</span>
            <button
              id="btn-cutter-z-plus"
              type="button"
              className="stepper-btn"
              title="Tăng Z (+1, phím '+')"
              onClick={() =>
                onUpdateLayer(currentSelectedLayer.id, {
                  z: (currentSelectedLayer.z ?? 10) + 1
                })
              }
            >
              +
            </button>
            <span className="layer-cutter-z-hint">(Phím + / -)</span>
          </div>
        )}

        <div className="layer-cutter-toolbar-right">
          <span className="layer-cutter-coord-pill" title="Tọa độ con trỏ chuột trên bảng lắp ráp 2D">
            XY: ({mouseCanvasPos.x}, {mouseCanvasPos.y})
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
              transform: boardScale < 1 ? `scale(${boardScale})` : undefined,
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

            {/* Render Placed Layers in 2D Assembly */}
            {composite.layers.map((layer) => {
              const isSelected = selectedLayerId === layer.id
              const imgUrl =
                layer.imageUrl ||
                (layer.assetPath ? assetUrls?.[layer.assetPath] || composite.assets?.[layer.assetPath] : '') ||
                ''
              const currentScaleX = layer.scale * (layer.scaleX ?? 1)
              const currentScaleY = layer.scale * (layer.scaleY ?? 1)

              return (
                <div
                  key={layer.id}
                  className={`layer-cutter-placed-layer ${isSelected ? 'selected' : ''}`}
                  style={{
                    left: `calc(50% + ${layer.x}px)`,
                    top: `calc(50% + ${layer.y}px)`,
                    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${currentScaleX}, ${currentScaleY})`,
                    zIndex: Math.round(layer.z ?? 10)
                  }}
                  onPointerDown={(e) => handleLayerPointerDown(e, layer)}
                  onPointerMove={handleLayerPointerMove}
                  onPointerUp={handleLayerPointerUp}
                >
                  {/* Badge hiển thị Z-index khi được chọn */}
                  {isSelected && (
                    <div
                      className="layer-cutter-layer-zbadge"
                      title={`Thứ tự lớp Z: ${layer.z ?? 10} (Phím + để tăng, - để giảm)`}
                    >
                      Z: {layer.z ?? 10}
                    </div>
                  )}
                  {imgUrl ? (
                    <img src={imgUrl} alt={layer.name} draggable={false} />
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
              )
            })}
          </div>

          {/* Bóng tròn chọn nhanh Layer nằm ngoài khung caro trên bảng lắp ráp 2D */}
          <LayerAssemblyCalloutOverlay
            layers={composite.layers}
            selectedLayerId={selectedLayerId}
            canvasWidth={600}
            canvasHeight={600}
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
                title="Giảm kích thước (-10%)"
                onClick={() =>
                  onUpdateLayer(currentSelectedLayer.id, {
                    scale: Math.max(0.1, Number((currentSelectedLayer.scale - 0.1).toFixed(2)))
                  })
                }
              >
                -
              </button>
              <input
                type="range"
                min={0.1}
                max={3.0}
                step={0.05}
                value={currentSelectedLayer.scale}
                onChange={(e) =>
                  onUpdateLayer(currentSelectedLayer.id, { scale: Number(e.target.value) })
                }
              />
              <button
                type="button"
                className="btn sm icon"
                style={{ width: 18, height: 18, padding: 0 }}
                title="Tăng kích thước (+10%)"
                onClick={() =>
                  onUpdateLayer(currentSelectedLayer.id, {
                    scale: Math.min(4.0, Number((currentSelectedLayer.scale + 0.1).toFixed(2)))
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
              title="Thứ tự lớp (Z-index): Layer có Z lớn hơn sẽ che layer có Z nhỏ hơn. Nhấn phím '+' để tăng, '-' để giảm"
            >
              <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>Z:</span>
              <button
                type="button"
                className="btn sm icon"
                style={{ width: 18, height: 18, padding: 0 }}
                title="Giảm Z (-1, phím '-')"
                onClick={() => {
                  const cur = currentSelectedLayer.z ?? 10
                  onUpdateLayer(currentSelectedLayer.id, { z: Math.max(1, cur - 1) })
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
                {currentSelectedLayer.z ?? 10}
              </span>
              <button
                type="button"
                className="btn sm icon"
                style={{ width: 18, height: 18, padding: 0 }}
                title="Tăng Z (+1, phím '+')"
                onClick={() => {
                  const cur = currentSelectedLayer.z ?? 10
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
