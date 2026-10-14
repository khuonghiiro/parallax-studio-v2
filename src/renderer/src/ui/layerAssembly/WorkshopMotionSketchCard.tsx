import { useMotionSketch, setMotionSketchState, resetMotionSketchState } from './motionSketchStore'
import { RigNumber } from './WorkshopRigPanel'

export interface MotionSketchCardProps {
  isPlaying: boolean
  onTogglePlay: () => void
  onApplyCurrentSketch?: () => void
}

export function WorkshopMotionSketchCard({
  isPlaying,
  onTogglePlay,
  onApplyCurrentSketch
}: MotionSketchCardProps) {
  const sketch = useMotionSketch()
  const red = sketch.redBone
  const gray = sketch.grayBone

  return (
    <div className="lw-card-section lw-motion-sketch-card">
      <div className="lw-card-header">
        <span className="lw-card-title">🖊️ Vẽ động tác (Motion Sketch)</span>
        <span className="lw-card-badge" style={{ color: 'var(--accent-cyan)' }}>
          {gray ? '✓ Đã vẽ nét' : red ? 'Đang vẽ...' : 'Sẵn sàng'}
        </span>
      </div>

      <div className="lw-sketch-instructions" style={{ fontSize: '11px', lineHeight: '1.5', color: 'var(--text-dim)', marginBottom: '8px' }}>
        <div>🔴 <strong style={{ color: 'var(--axis-x, #ff3344)' }}>Giữ phím Alt:</strong> Kéo chuột trên hình để vẽ xương màu đỏ.</div>
        <div>🔵 <strong style={{ color: 'var(--accent-cyan, #00e5ff)' }}>Giữ phím Shift:</strong> Kéo từ ngọn xương để vẽ nét cong chuyển động Blue.</div>
        <div>⚪ <strong style={{ color: 'var(--text-dim, #94a3b8)' }}>Chỗ kẻ xám:</strong> Tư thế đích đến khi hoàn thành nét vẽ.</div>
      </div>

      {red && (
        <div style={{ background: 'var(--bg-3)', padding: '6px 8px', borderRadius: '4px', fontSize: '11px', marginBottom: '8px' }}>
          <div>
            <span style={{ color: 'var(--axis-x, #ff3344)', fontWeight: 600 }}>Xương nguồn:</span>{' '}
            {red.matchedBoneName || 'Xương đỏ vẽ tay'} ({red.length.toFixed(0)}px · {red.angle.toFixed(1)}°)
          </div>
          {gray && (
            <div style={{ marginTop: '2px', color: 'var(--accent-cyan)' }}>
              <strong>Độ xoay quỹ đạo:</strong> {sketch.deltaAngle > 0 ? '+' : ''}{sketch.deltaAngle.toFixed(1)}°
            </div>
          )}
        </div>
      )}

      <div className="lw-rig-grid" style={{ marginBottom: '8px' }}>
        <RigNumber
          label="Thời lượng (s)"
          value={sketch.duration}
          min={0.1}
          max={10}
          step={0.1}
          onChange={(duration) => {
            const next = { ...sketch, duration }
            setMotionSketchState(next)
            if (gray && onApplyCurrentSketch) onApplyCurrentSketch()
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
        <label className="lw-rig-check" title="Tự động uốn cong layer bằng lưới Mesh 2D mềm mại dọc theo nét vẽ">
          <input
            type="checkbox"
            checked={sketch.enableMeshBend}
            onChange={(e) => {
              const next = { ...sketch, enableMeshBend: e.target.checked }
              setMotionSketchState(next)
              if (gray && onApplyCurrentSketch) onApplyCurrentSketch()
            }}
          />
          <span>🌿 Uốn cong layer bằng Mesh 2D</span>
        </label>

        <label className="lw-rig-check" title="Động tác khứ hồi: vung tới kẻ xám rồi thu về dáng ban đầu">
          <input
            type="checkbox"
            checked={sketch.loopBack}
            onChange={(e) => {
              const next = { ...sketch, loopBack: e.target.checked }
              setMotionSketchState(next)
              if (gray && onApplyCurrentSketch) onApplyCurrentSketch()
            }}
          />
          <span>Khứ hồi (về lại tư thế cũ)</span>
        </label>
      </div>

      <div className="lw-rig-actions">
        <button
          type="button"
          className="btn sm primary"
          onClick={onTogglePlay}
          title="Phát thử động tác (Phím Space)"
        >
          {isPlaying ? 'Tạm dừng (Space)' : 'Phát thử (Space)'}
        </button>
        {(red || gray) && (
          <button
            type="button"
            className="btn sm"
            onClick={resetMotionSketchState}
            title="Xoá toàn bộ nét vẽ hiện tại"
          >
            Xoá nét vẽ
          </button>
        )}
      </div>
    </div>
  )
}
