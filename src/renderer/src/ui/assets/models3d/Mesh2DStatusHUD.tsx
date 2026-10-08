import type { Face3D } from './types'

interface Mesh2DStatusHUDProps {
  face: Face3D
  imgW: number
  imgH: number
  cols: number
  rows: number
  rotation: number
  zoom: number
  setZoom: React.Dispatch<React.SetStateAction<number>>
  onResetView: () => void
  selectedCellsCount: number
  hiddenCellsCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  onRestoreHidden: () => void
}

export function Mesh2DStatusHUD({
  face,
  imgW,
  imgH,
  cols,
  rows,
  rotation,
  zoom,
  setZoom,
  onResetView,
  selectedCellsCount,
  hiddenCellsCount,
  onSelectAll,
  onClearSelection,
  onRestoreHidden
}: Mesh2DStatusHUDProps) {
  const isFoldActive = face.foldLine?.enabled && face.foldLine.angle !== 0
  const isWarpActive = face.warp3x3Mode && face.warp3x3Mode !== 'none'

  return (
    <div className="mesh2d-status-hud-dock">
      {/* Left: Metadata badges in a sleek single line */}
      <div className="hud-badge-group">
        <span className="hud-face-chip" title={face.name}>
          <span className="hud-icon">🖼️</span>
          <span className="hud-text-ellipsis">{face.name}</span>
        </span>

        <span className="hud-meta-pill" title="Kích thước ảnh texture gốc">
          {imgW}×{imgH}
        </span>

        <span className="hud-meta-pill" title={`Lưới phân giải ${cols}×${rows}`}>
          ⬡ {cols}×{rows}
        </span>

        {rotation !== 0 && (
          <span className="hud-meta-pill" title={`Khung xoay ${rotation}°`}>
            ⟳ {rotation > 0 ? `+${rotation}°` : `${rotation}°`}
          </span>
        )}

        {isFoldActive && (
          <span className="hud-meta-pill amber" title={`Nếp gấp Origami 3D: ${face.foldLine!.angle}°`}>
            📦 Gấp {face.foldLine!.angle > 0 ? `+${face.foldLine!.angle}°` : `${face.foldLine!.angle}°`}
          </span>
        )}

        {isWarpActive && (
          <span className="hud-meta-pill cyan" title={`Lưới uốn 3×3: ${face.warp3x3Mode}`}>
            🪜 {face.warp3x3Mode === 'stairs' ? 'Cầu thang' : face.warp3x3Mode}
          </span>
        )}
      </div>

      {/* Right: Actions & Zoom Controls */}
      <div className="hud-action-group">
        {selectedCellsCount > 0 ? (
          <button
            type="button"
            className="hud-action-btn gold"
            onClick={onClearSelection}
            title="Bỏ chọn các ô đang chọn"
          >
            Bỏ chọn ({selectedCellsCount})
          </button>
        ) : (
          <button
            type="button"
            className="hud-action-btn"
            onClick={onSelectAll}
            title="Chọn toàn bộ các ô lưới khả dụng"
          >
            Chọn tất cả
          </button>
        )}

        {hiddenCellsCount > 0 && (
          <button
            type="button"
            className="hud-action-btn danger"
            onClick={onRestoreHidden}
            title="Khôi phục lại các ô lưới đã gọt"
          >
            Khôi phục ({hiddenCellsCount})
          </button>
        )}

        <div className="hud-divider" />

        {/* Zoom controls */}
        <div className="hud-zoom-controls">
          <button
            type="button"
            className="hud-zoom-btn"
            onClick={() => setZoom((prev) => Math.max(0.15, prev * 0.85))}
            title="Thu nhỏ (-)"
          >
            -
          </button>
          <span className="hud-zoom-text" title="Tỉ lệ phóng hiện tại">
            {(zoom * 100).toFixed(0)}%
          </span>
          <button
            type="button"
            className="hud-zoom-btn"
            onClick={() => setZoom((prev) => Math.min(5.0, prev * 1.15))}
            title="Phóng to (+)"
          >
            +
          </button>
          <button
            type="button"
            className="hud-action-btn fit"
            onClick={onResetView}
            title="Góc nhìn 100% vừa vặn"
          >
            100%
          </button>
        </div>
      </div>
    </div>
  )
}
