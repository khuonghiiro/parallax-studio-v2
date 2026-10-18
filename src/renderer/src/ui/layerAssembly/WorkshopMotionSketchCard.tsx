import { useState } from 'react'
import { RigNumber } from './WorkshopRigPanel'
import { setMotionSketchSettings, toggleMotionSketchArmed, useMotionSketch } from './motionSketchStore'
import type { MotionSketchMode, MotionSketchTiming } from './workshopMotionSketch'

const MODES: Array<[MotionSketchMode, string, string]> = [
  ['rotate', '⟳ Xoay theo nét', 'Ngọn xương bám theo đường vẽ (tay, chân, đầu, đuôi…); bật chuỗi IK để cả cánh tay/chân cùng chuyển động'],
  ['move', '✥ Dời theo nét', 'Khớp gốc dời theo đường vẽ (nhún hông, nhảy, lắc người…)']
]
const TIMINGS: Array<[MotionSketchTiming, string, string]> = [
  ['live', '● Thời gian thực', 'Ghi đúng tốc độ tay như quay phim: đầu phát chạy theo nên các xương khác chuyển động cùng lúc (ghi nối tiếp từng bước)'],
  ['hand', 'Theo nhịp tay', 'Giữ nhịp nhanh/chậm của tay nhưng co giãn vừa đúng thời lượng bên dưới'],
  ['even', 'Đều nhau', 'Chia đều tốc độ theo độ dài nét vẽ']
]
const CHAINS: Array<[number, string, string]> = [
  [1, '1 xương (FK)', 'Chỉ xoay xương được nhấn (FK)'],
  [2, 'IK 2 xương', 'Xương được nhấn + xương cha (cẳng tay kéo theo bắp tay)'],
  [3, 'IK 3 xương', 'Thêm một cấp nữa (bàn tay kéo cả cẳng tay và bắp tay)']
]

/** Thẻ "Vẽ động tác" trong tab Animation: hỗ trợ Shift+Chuột trái ghi Realtime, Chuột trái + Enter chốt từng bước, hoặc Bút vẽ tự do (D). */
export function WorkshopMotionSketchCard({
  isPlaying,
  onTogglePlay,
  onConfirmStep
}: {
  isPlaying: boolean
  onTogglePlay: () => void
  onConfirmStep?: () => void
}) {
  const { armed, settings, last, status } = useMotionSketch()
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div className="lw-card-section lw-motion-sketch-card">
      <div className="lw-card-header">
        <span className="lw-card-title">✏️ Vẽ &amp; Ghi động tác</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <span className={`lw-card-badge${armed ? ' lw-sketch-badge-on' : ''}`} style={{ whiteSpace: 'nowrap' }}>
            {armed ? '● Bút vẽ: Bật' : 'Sẵn sàng'}
          </span>
          <button
            type="button"
            className={`btn xs${showHelp ? ' primary' : ''}`}
            style={{ height: 20, padding: '0 6px', fontSize: 10, whiteSpace: 'nowrap' }}
            onClick={() => setShowHelp((v) => !v)}
            title="Xem hướng dẫn chi tiết 3 cách ghi động tác"
          >
            ? Cách dùng
          </button>
        </div>
      </div>

      {/* Thẻ tóm tắt 2 cách thao tác chính gọn gàng */}
      <div className="lw-sketch-workflow-grid">
        <div className="lw-sketch-workflow-item realtime">
          <div className="lw-sketch-wf-badge">🔴 Ghi Realtime</div>
          <div className="lw-sketch-wf-desc">
            Giữ <kbd>Shift</kbd> + <strong>Chuột trái</strong> kéo xương để ghi trực tiếp theo thứ tự.
          </div>
        </div>
        <div className="lw-sketch-workflow-item step">
          <div className="lw-sketch-wf-badge">✓ Ghi từng bước</div>
          <div className="lw-sketch-wf-desc">
            <strong>Chuột trái</strong> chỉnh xương vừa ý → nhấn <kbd>Enter ⏎</kbd> chốt vị trí.
          </div>
        </div>
      </div>

      <button
        type="button"
        className={`btn xs ${armed ? 'primary' : ''} lw-sketch-arm-btn`}
        style={{ height: 26, fontWeight: 700, width: '100%' }}
        onClick={() => toggleMotionSketchArmed()}
        title="Bật chế độ bút vẽ tự do không cần giữ phím Shift (Phím tắt: D)"
      >
        {armed ? '■ Đang bật Bút vẽ tự do — Tắt (Phím D)' : '✏️ Bật Bút vẽ tự do trên khung 2D (Phím D)'}
      </button>

      {showHelp && (
        <ol className="lw-sketch-steps">
          <li><strong>Realtime (<kbd>Shift</kbd> + Chuột trái):</strong> Kéo xương theo nhịp tay, thả chuột tự đậu ở cuối để kéo tiếp xương sau.</li>
          <li><strong>Từng bước (Chuột trái + <kbd>Enter</kbd>):</strong> Chỉnh các xương đến khi chuẩn dáng rồi nhấn <kbd>Enter</kbd> để chốt mốc.</li>
          <li><strong>Bút vẽ tự do (<kbd>D</kbd>):</strong> Mọi nét kéo chuột trên khung 2D đều tự vẽ chuyển động mà không cần giữ Shift.</li>
        </ol>
      )}

      <div className="lw-sketch-label-row">Kiểu chuyển động &amp; Chuỗi IK <span>(Ctrl = 1 xương)</span></div>
      <div className="lw-sketch-chips">
        {MODES.map(([id, title, hint]) => (
          <button key={id} type="button" title={hint} className={`lw-sketch-option${settings.mode === id ? ' active' : ''}`} onClick={() => setMotionSketchSettings({ mode: id })}>
            {title}
          </button>
        ))}
        {settings.mode === 'rotate' &&
          CHAINS.map(([n, title, hint]) => (
            <button key={n} type="button" title={hint} className={`lw-sketch-option${settings.chain === n ? ' active' : ''}`} onClick={() => setMotionSketchSettings({ chain: n })}>
              {title}
            </button>
          ))}
      </div>

      <div className="lw-sketch-label-row">Nhịp ghi của Bút vẽ tự do (D)</div>
      <div className="lw-sketch-chips">
        {TIMINGS.map(([id, title, hint]) => (
          <button key={id} type="button" title={hint} className={`lw-sketch-option${settings.timing === id ? ' active' : ''}`} onClick={() => setMotionSketchSettings({ timing: id })}>
            {title}
          </button>
        ))}
      </div>

      {settings.timing !== 'live' && (
        <div className="lw-rig-grid">
          <RigNumber label="Thời lượng nét (s)" value={settings.duration} min={0.1} max={20} step={0.1} onChange={(duration) => setMotionSketchSettings({ duration })} />
        </div>
      )}

      <div className="lw-sketch-checks-row">
        <label className="lw-rig-check" title="Đi hết nét vẽ rồi quay ngược về tư thế ban đầu (gấp đôi thời lượng)">
          <input type="checkbox" checked={settings.loopBack} onChange={(e) => setMotionSketchSettings({ loopBack: e.target.checked })} />
          <span>Khứ hồi (đi &amp; về)</span>
        </label>
        <label className="lw-rig-check" title="Tự tua về điểm bắt đầu và phát thử ngay khi thả chuột (khi dùng Bút vẽ D)">
          <input type="checkbox" checked={settings.autoPlay} onChange={(e) => setMotionSketchSettings({ autoPlay: e.target.checked })} />
          <span>Tự phát sau khi vẽ</span>
        </label>
      </div>

      {(status || last) && (
        <div className="lw-sketch-result" role="status">
          {status || `✓ ${last?.boneName}: ${last?.keyCount} keyframe`}
        </div>
      )}

      <div className="lw-rig-actions" style={{ marginBottom: 0 }}>
        <button type="button" className="btn xs" style={{ width: '100%', justifyContent: 'center', height: 24 }} onClick={onTogglePlay} title="Phát thử (Space)">
          {isPlaying ? '⏸ Tạm dừng phát' : '▶ Phát thử động tác'}
        </button>
      </div>
    </div>
  )
}
