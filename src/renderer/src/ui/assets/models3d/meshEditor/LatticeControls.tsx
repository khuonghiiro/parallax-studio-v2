import type { LatticeSettings } from './meshEditorTypes'

interface LatticeControlsProps {
  settings: LatticeSettings
  onChangeSettings: (patch: Partial<LatticeSettings>) => void
  onResetLattice: () => void
  onSelectPoint?: (index: number | null) => void
}

export function LatticeControls({
  settings,
  onChangeSettings,
  onResetLattice,
  onSelectPoint
}: LatticeControlsProps) {
  return (
    <div className="mesh-editor-tool-controls lattice-controls">
      <div className="tool-controls-header">
        <span className="tool-title">🕸️ Khung Nắn Tự Do (FFD Lattice 4×4)</span>
        <button type="button" className="btn xs secondary" onClick={onResetLattice} title="Khôi phục khung lưới phẳng">
          Đặt lại khung
        </button>
      </div>

      <div className="trim-hint-text" style={{ marginTop: 8 }}>
        Khung lưới 16 điểm tự do nắn hình dáng tổng thể mà không làm méo mó texture UV.
      </div>

      {/* Sơ đồ 4x4 điểm kiểm soát */}
      <div className="lattice-grid-diagram" style={{ marginTop: 8 }}>
        <span className="field-sub-label">Chọn điểm nắn (4 hàng × 4 cột):</span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '4px',
            marginTop: '6px'
          }}
        >
          {Array.from({ length: 16 }, (_, idx) => {
            const row = Math.floor(idx / 4)
            const isBottomRow = row === 0
            const isPinned = isBottomRow && settings.pinnedBottomRow
            const isSelected = settings.activePointIndex === idx

            return (
              <button
                key={idx}
                type="button"
                className={`snap-btn${isSelected ? ' active' : ''}${isPinned ? ' pinned' : ''}`}
                style={{
                  padding: '6px 2px',
                  fontSize: '10px',
                  opacity: isPinned ? 0.6 : 1
                }}
                onClick={() => {
                  if (onSelectPoint) onSelectPoint(isSelected ? null : idx)
                }}
                title={
                  isPinned
                    ? `Điểm ${idx + 1} (Hàng đáy đang ghim)`
                    : `Chọn điểm kiểm soát ${idx + 1}`
                }
              >
                {isPinned ? '📌' : `P${idx + 1}`}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tùy chọn ghim hàng đáy */}
      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          className={`snap-btn${settings.pinnedBottomRow ? ' active' : ''}`}
          style={{ width: '100%' }}
          onClick={() => onChangeSettings({ pinnedBottomRow: !settings.pinnedBottomRow })}
          title="Khóa cứng 4 điểm hàng dưới cùng để bảo vệ cuống lá/cánh gắn liền thân"
        >
          {settings.pinnedBottomRow ? '📌 Đang ghim 4 điểm hàng gốc' : '📍 Ghim hàng gốc'}
        </button>
      </div>
    </div>
  )
}
