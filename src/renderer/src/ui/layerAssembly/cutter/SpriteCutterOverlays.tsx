import React from 'react'
import type {
  CutterToolMode,
  DetectedIsland,
  CutPiece,
  EyedropperTarget,
  CutPoint
} from './types'
import type { TagDisplayMode } from './SpriteCutterSourceToolbar'

export interface SpriteCutterOverlaysProps {
  tool: CutterToolMode
  eyedropperTarget: EyedropperTarget | null
  activeIslands: DetectedIsland[]
  selectedIslandId: string | null
  selectedPiece: CutPiece | null
  scaleX: number
  scaleY: number
  marquee: { startX: number; startY: number; currentX: number; currentY: number } | null
  lassoPoints: CutPoint[]
  isDrawing: boolean
  copiedBadge: boolean
  onSelectIsland: (isl: DetectedIsland) => void
  onQuickAddIsland: (isl: DetectedIsland) => void
  onDragStart: (e: React.DragEvent, piece: CutPiece) => void
  onTransferToTarget: (piece: CutPiece) => void
  onCopyPiece: () => void
}

export function SpriteCutterOverlays({
  tool,
  eyedropperTarget,
  activeIslands,
  selectedIslandId,
  selectedPiece,
  scaleX,
  scaleY,
  marquee,
  lassoPoints,
  isDrawing,
  copiedBadge,
  onSelectIsland,
  onQuickAddIsland,
  onDragStart,
  onTransferToTarget,
  onCopyPiece
}: SpriteCutterOverlaysProps) {
  if (eyedropperTarget) return null

  return (
    <>
      {/* Hiển thị các khung mảnh cắt (Tự động hoặc Lưới) */}
      {(tool === 'auto' || tool === 'grid') &&
        activeIslands.map((isl) => {
          const isSelected = selectedIslandId === isl.id
          const boxW = isl.width * scaleX
          const boxH = isl.height * scaleY
          const isInside = boxH >= 34 && boxW >= 46
          const isNearTop = isl.y * scaleY < 22
          const tagPlacementClass = isInside
            ? 'inside-top-left'
            : isNearTop
              ? 'outside-bottom'
              : 'outside-top'

          return (
            <div
              key={isl.id}
              className={`layer-cutter-island-box ${isSelected ? 'selected' : ''}`}
              draggable={isSelected}
              onDragStart={(e) => selectedPiece && onDragStart(e, selectedPiece)}
              onClick={(e) => {
                e.stopPropagation()
                onSelectIsland(isl)
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                onQuickAddIsland(isl)
              }}
              style={{
                left: `${isl.x * scaleX}px`,
                top: `${isl.y * scaleY}px`,
                width: `${boxW}px`,
                height: `${boxH}px`
              }}
              title={`${isl.label} — Click chọn · Nhấp đúp hoặc kéo sang phải để đưa vào Bố cục 2D`}
            >
              <span className={`layer-cutter-island-tag ${tagPlacementClass}`}>
                {isl.label?.replace(/\s*\(\d+×\d+\)$/, '')}
              </span>
            </div>
          )
        })}

      {/* Khung marquee hình chữ nhật */}
      {tool === 'box' && marquee && (
        <div
          className={`layer-cutter-marquee ${!isDrawing && selectedPiece ? 'ready' : ''}`}
          draggable={!isDrawing && Boolean(selectedPiece)}
          onDragStart={(e) => selectedPiece && onDragStart(e, selectedPiece)}
          onClick={(e) => e.stopPropagation()}
          style={{
            left: `${Math.min(marquee.startX, marquee.currentX) * scaleX}px`,
            top: `${Math.min(marquee.startY, marquee.currentY) * scaleY}px`,
            width: `${Math.abs(marquee.currentX - marquee.startX) * scaleX}px`,
            height: `${Math.abs(marquee.currentY - marquee.startY) * scaleY}px`
          }}
        >
          {!isDrawing && selectedPiece && (
            <div className="layer-cutter-marquee-badge" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="btn sm primary"
                style={{ height: 20, padding: '0 6px', fontSize: 10 }}
                onClick={() => onTransferToTarget(selectedPiece)}
              >
                Đưa vào 2D ➡️
              </button>
              <button
                type="button"
                className="btn sm"
                style={{ height: 20, padding: '0 6px', fontSize: 10 }}
                onClick={onCopyPiece}
              >
                {copiedBadge ? 'Đã chép!' : 'Sao chép'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Khung lasso tự do */}
      {tool === 'lasso' && lassoPoints.length >= 2 && (
        <>
          <svg className="layer-cutter-lasso-svg">
            <polyline
              points={lassoPoints.map((p) => `${p.x * scaleX},${p.y * scaleY}`).join(' ')}
              fill="rgba(251, 191, 36, 0.2)"
              stroke="var(--key)"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
          </svg>

          {!isDrawing && selectedPiece && selectedPiece.sourceBox && (
            <div
              className="layer-cutter-marquee ready"
              draggable={true}
              onDragStart={(e) => onDragStart(e, selectedPiece)}
              onClick={(e) => e.stopPropagation()}
              style={{
                left: `${selectedPiece.sourceBox.x * scaleX}px`,
                top: `${selectedPiece.sourceBox.y * scaleY}px`,
                width: `${selectedPiece.sourceBox.width * scaleX}px`,
                height: `${selectedPiece.sourceBox.height * scaleY}px`
              }}
            >
              <div className="layer-cutter-marquee-badge" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn sm primary"
                  style={{ height: 20, padding: '0 6px', fontSize: 10 }}
                  onClick={() => onTransferToTarget(selectedPiece)}
                >
                  Đưa vào 2D ➡️
                </button>
                <button
                  type="button"
                  className="btn sm"
                  style={{ height: 20, padding: '0 6px', fontSize: 10 }}
                  onClick={onCopyPiece}
                >
                  {copiedBadge ? 'Đã chép!' : 'Sao chép'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
