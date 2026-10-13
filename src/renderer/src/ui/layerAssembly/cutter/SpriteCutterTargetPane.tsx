import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { AssembledLayerItem, LayerComposite } from '../types'
import type { CutPiece, TemplateSlotDef, TemplateSlotPreset } from './types'
import { SLOT_PRESETS } from './slotPresets'
import { IconLayers, IconTrash, IconPlus, IconCheck } from '../../icons'
import { CustomSelect } from '../../controls/CustomSelect'

export interface SpriteCutterTargetPaneProps {
  composite: LayerComposite
  selectedLayerId: string | null
  selectedPiece: CutPiece | null
  onSelectLayer: (id: string | null) => void
  onAddLayer: (name: string, assetPath: string, imageUrl?: string, pos?: { x: number; y: number }) => void
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
  const [activePresetId, setActivePresetId] = useState<string>('humanoid_anime')
  const [showSlots, setShowSlots] = useState<boolean>(true)
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null)
  const [isDragOverCanvas, setIsDragOverCanvas] = useState<boolean>(false)
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Active slot preset
  const activePreset: TemplateSlotPreset =
    SLOT_PRESETS.find((p) => p.id === activePresetId) || SLOT_PRESETS[0]

  const boardRef = useRef<HTMLDivElement | null>(null)

  // Convert client pointer event to board coordinates (center is 0,0)
  const getBoardCoords = useCallback((clientX: number, clientY: number) => {
    const board = boardRef.current
    if (!board) return { x: 0, y: 0 }
    const rect = board.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    return {
      x: Math.round(clientX - cx),
      y: Math.round(clientY - cy)
    }
  }, [])

  // Paste handler (Ctrl + V) at mouse position
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        const cutPart = (window as unknown as { __parallax_cut_part?: CutPiece }).__parallax_cut_part
        if (cutPart) {
          e.preventDefault()
          onAddLayer(cutPart.label || 'Mảnh cắt', '', cutPart.dataUrl, mouseCanvasPos)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mouseCanvasPos, onAddLayer])

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
      onAddLayer(piece.label || 'Mảnh cắt', '', piece.dataUrl, pos)
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

    // Find if a layer already corresponds to this slot
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
    const dx = e.clientX - draggingLayer.startX
    const dy = e.clientY - draggingLayer.startY
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

  return (
    <div className="layer-cutter-pane">
      {/* Pane Header */}
      <div className="layer-cutter-header">
        <div className="layer-cutter-title">
          <IconLayers width={14} height={14} />
          <strong>Khung mẫu & Bố cục 2D</strong>
          <span className="layer-cutter-badge">{composite.layers.length} lớp</span>
        </div>
        <div className="layer-cutter-actions">
          {onClearAllLayers && composite.layers.length > 0 && (
            <button
              type="button"
              className="btn sm icon"
              title="Xóa tất cả các lớp đang có trên bố cục 2D"
              onClick={onClearAllLayers}
            >
              <IconTrash width={12} height={12} />
            </button>
          )}
        </div>
      </div>

      {/* Preset Toolbar */}
      <div className="layer-cutter-toolbar">
        <div style={{ width: 220 }}>
          <CustomSelect<string>
            size="sm"
            value={activePresetId}
            onChange={(val: string) => setActivePresetId(val)}
            options={SLOT_PRESETS.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>

        <label className="layer-cutter-control-row" style={{ cursor: 'pointer', marginLeft: 6 }}>
          <input
            type="checkbox"
            checked={showSlots}
            onChange={(e) => setShowSlots(e.target.checked)}
          />
          <span>Hiện khung mẫu gợi ý</span>
        </label>

        <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontSize: 11 }}>
          Tọa độ chuột: ({mouseCanvasPos.x}, {mouseCanvasPos.y})
        </span>
      </div>

      {/* Target Container: Canvas + Side Slot Drawer */}
      <div className="layer-cutter-target-container">
        {/* 2D Canvas Area */}
        <div className="layer-cutter-target-viewport">
          <div
            ref={boardRef}
            className={`layer-cutter-target-board ${isDragOverCanvas ? 'drag-over' : ''}`}
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
                background: 'rgba(255, 255, 255, 0.04)',
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
                background: 'rgba(255, 255, 255, 0.04)',
                transform: 'translateX(-50%)',
                pointerEvents: 'none'
              }}
            />

            {/* Template Slot Wireframe Overlays */}
            {showSlots &&
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
              const imgUrl = layer.imageUrl || ''

              return (
                <div
                  key={layer.id}
                  className={`layer-cutter-placed-layer ${isSelected ? 'selected' : ''}`}
                  style={{
                    left: `calc(50% + ${layer.x}px)`,
                    top: `calc(50% + ${layer.y}px)`,
                    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
                    zIndex: isSelected ? 30 : Math.round(100 - (layer.z ?? 0))
                  }}
                  onPointerDown={(e) => handleLayerPointerDown(e, layer)}
                  onPointerMove={handleLayerPointerMove}
                  onPointerUp={handleLayerPointerUp}
                >
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
        </div>

        {/* Side Slot Deck / Drawer */}
        {activePreset.slots.length > 0 && (
          <div className="layer-cutter-slot-drawer">
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>
              Danh mục bộ phận ({activePreset.slots.length})
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

      {/* Footer Info */}
      <div className="layer-cutter-footer">
        <div>
          {selectedLayerId ? (
            <span>
              <strong>Lớp đang chọn:</strong>{' '}
              {composite.layers.find((l) => l.id === selectedLayerId)?.name}
            </span>
          ) : (
            <span style={{ color: 'var(--text-faint)' }}>
              Click lớp để di chuyển · Kéo từ trái sang để thả ảnh
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="layer-cutter-footer-hint">
            Dán tại chuột: <kbd>Ctrl+V</kbd>
          </span>
          {selectedLayerId && (
            <button
              type="button"
              className="btn sm"
              onClick={() => onDeleteLayer(selectedLayerId)}
              title="Xóa lớp đang chọn"
            >
              <IconTrash width={12} height={12} /> Xóa lớp
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
