import React, { useState } from 'react'
import type { DetectedIsland, GridSlicerSettings } from './types'
import { IconPlus } from '../../icons'

export interface CutterGridSubBarProps {
  grid: GridSlicerSettings
  totalCells: number
  onChangeGrid: (patch: Partial<GridSlicerSettings>) => void
  onSendAllToBoard: () => void
}

const GRID_PRESETS: Array<{ label: string; rows: number; cols: number }> = [
  { label: '1×2', rows: 1, cols: 2 },
  { label: '2×2', rows: 2, cols: 2 },
  { label: '2×3', rows: 2, cols: 3 },
  { label: '3×3', rows: 3, cols: 3 },
  { label: '3×4', rows: 3, cols: 4 },
  { label: '4×4', rows: 4, cols: 4 }
]

export function CutterGridSubBar({
  grid,
  totalCells,
  onChangeGrid,
  onSendAllToBoard
}: CutterGridSubBarProps) {
  return (
    <div className="cutter-grid-subbar">
      <div className="cutter-grid-badge">
        <span>Cắt Lưới Ma Trận</span>
      </div>

      {/* Chọn nhanh tỷ lệ lưới */}
      <div className="cutter-grid-presets">
        {GRID_PRESETS.map((p) => {
          const isActive = grid.rows === p.rows && grid.cols === p.cols
          return (
            <button
              key={p.label}
              type="button"
              className={`brush-preset-pill ${isActive ? 'active' : ''}`}
              onClick={() => onChangeGrid({ rows: p.rows, cols: p.cols })}
              title={`Chia lưới ${p.rows} hàng × ${p.cols} cột`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      <div className="layer-cutter-divider" />

      {/* Số Hàng */}
      <div className="layer-cutter-control-row">
        <span className="subbar-label">Hàng:</span>
        <button
          type="button"
          className="stepper-btn"
          onClick={() => onChangeGrid({ rows: Math.max(1, grid.rows - 1) })}
        >
          -
        </button>
        <span className="subbar-val" style={{ textAlign: 'center', minWidth: 18 }}>
          {grid.rows}
        </span>
        <button
          type="button"
          className="stepper-btn"
          onClick={() => onChangeGrid({ rows: Math.min(12, grid.rows + 1) })}
        >
          +
        </button>
      </div>

      {/* Số Cột */}
      <div className="layer-cutter-control-row">
        <span className="subbar-label">Cột:</span>
        <button
          type="button"
          className="stepper-btn"
          onClick={() => onChangeGrid({ cols: Math.max(1, grid.cols - 1) })}
        >
          -
        </button>
        <span className="subbar-val" style={{ textAlign: 'center', minWidth: 18 }}>
          {grid.cols}
        </span>
        <button
          type="button"
          className="stepper-btn"
          onClick={() => onChangeGrid({ cols: Math.min(12, grid.cols + 1) })}
        >
          +
        </button>
      </div>

      {/* Thu viền ô (Padding Inset) */}
      <div
        className="layer-cutter-control-row"
        title="Co lùi viền mỗi ô lưới vào trong để không dính vạch kẻ khung"
      >
        <span className="subbar-label">Thu viền ô:</span>
        <input
          type="range"
          min={0}
          max={30}
          value={grid.paddingInset}
          onChange={(e) => onChangeGrid({ paddingInset: Number(e.target.value) })}
          style={{ width: 56 }}
        />
        <span className="subbar-val">{grid.paddingInset}px</span>
      </div>

      <button
        type="button"
        className="btn sm primary"
        style={{ marginLeft: 'auto', height: 24, padding: '0 10px', fontSize: 11 }}
        onClick={onSendAllToBoard}
        title="Cắt toàn bộ các ô trong lưới và đưa sang Bố cục lắp ráp 2D"
      >
        Đưa cả {totalCells} ô sang 2D
      </button>
    </div>
  )
}

export interface CutterQuickPartsStripProps {
  mode: 'auto' | 'grid'
  islands: DetectedIsland[]
  selectedIslandId: string | null
  minIslandArea: number
  mergeGap?: number
  onChangeMinIslandArea: (area: number) => void
  onChangeMergeGap?: (gap: number) => void
  onSelectIsland: (island: DetectedIsland) => void
  onQuickAddIsland: (island: DetectedIsland) => void
  onIslandDragStart?: (e: React.DragEvent, island: DetectedIsland) => void
  onSendAllToBoard: () => void
}

export function CutterQuickPartsStrip({
  mode,
  islands,
  selectedIslandId,
  minIslandArea,
  mergeGap = 18,
  onChangeMinIslandArea,
  onChangeMergeGap,
  onSelectIsland,
  onQuickAddIsland,
  onIslandDragStart,
  onSendAllToBoard
}: CutterQuickPartsStripProps) {
  const [expanded, setExpanded] = useState<boolean>(true)

  return (
    <div className="cutter-parts-strip-wrap">
      <div className="cutter-parts-strip-header">
        <div className="cutter-parts-strip-left">
          <button
            type="button"
            className="cutter-parts-collapse-btn"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Thu gọn danh sách mảnh cắt' : 'Mở rộng danh sách mảnh cắt'}
          >
            {expanded ? '▾' : '▸'} Danh sách mảnh tách ({islands.length})
          </button>

          {mode === 'auto' && (
            <>
              <div
                className="cutter-min-area-pill"
                title="Lọc diện tích mảnh nhỏ nhất (không quét lại ảnh, phản hồi tức thì): kéo thấp để lấy chi tiết nhỏ (mắt, lông mày), kéo cao để bỏ qua vụn rác"
              >
                <span>Lọc mảnh nhỏ:</span>
                <input
                  type="range"
                  min={16}
                  max={600}
                  step={8}
                  value={minIslandArea}
                  onChange={(e) => onChangeMinIslandArea(Number(e.target.value))}
                />
                <strong>{minIslandArea}px²</strong>
              </div>

              {onChangeMergeGap && (
                <div
                  className="cutter-min-area-pill"
                  title="Khoảng cách gom các nét rời gần nhau: đặt 0px để tách riêng từng lông mày/mắt/miệng, tăng lên để gom thành 1 cụm biểu cảm"
                >
                  <span>Gom nét gần:</span>
                  <input
                    type="range"
                    min={0}
                    max={48}
                    step={2}
                    value={mergeGap}
                    onChange={(e) => onChangeMergeGap(Number(e.target.value))}
                  />
                  <strong>{mergeGap}px</strong>
                </div>
              )}
            </>
          )}
        </div>

        <div className="cutter-parts-strip-right">
          {islands.length > 0 && (
            <button
              id="btn-cutter-send-all-parts"
              type="button"
              className="cutter-send-all-btn"
              onClick={onSendAllToBoard}
              title="Tự động cắt toàn bộ các mảnh đã nhận diện và xếp vào Bố cục lắp ráp 2D"
            >
              Đưa tất cả ({islands.length}) vào Bố cục 2D
            </button>
          )}
        </div>
      </div>

      {expanded && islands.length > 0 && (
        <div className="cutter-parts-chips-scroll">
          {islands.map((isl, idx) => {
            const isSelected = selectedIslandId === isl.id
            const shortName =
              isl.label && !isl.label.startsWith('Mảnh #')
                ? isl.label
                : `Mảnh #${idx + 1}`
            return (
              <div
                key={isl.id}
                className={`cutter-part-chip ${isSelected ? 'selected' : ''}`}
                draggable={true}
                onDragStart={(e) => onIslandDragStart?.(e, isl)}
                onClick={() => onSelectIsland(isl)}
                onDoubleClick={() => onQuickAddIsland(isl)}
                title={`Click để chọn "${shortName}" (${isl.width}×${isl.height}px) · Kéo thả hoặc nhấp đúp để đưa ngay sang Bố cục 2D`}
              >
                <span className="cutter-part-chip-idx">#{idx + 1}</span>
                <span className="cutter-part-chip-dim">
                  {isl.width}×{isl.height}
                </span>
                <button
                  type="button"
                  className="cutter-part-chip-add"
                  onClick={(e) => {
                    e.stopPropagation()
                    onQuickAddIsland(isl)
                  }}
                  title={`Đưa ngay "${shortName}" sang Bố cục lắp ráp 2D`}
                >
                  <IconPlus width={10} height={10} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
