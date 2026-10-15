import { useState } from 'react'
import { RigNumber } from './WorkshopRigPanel'
import { setMotionSketchSettings, toggleMotionSketchArmed, useMotionSketch } from './motionSketchStore'
import type { MotionSketchMode, MotionSketchTiming } from './workshopMotionSketch'

const MODES: Array<[MotionSketchMode, string, string]> = [
  ['rotate', '⟳ Xoay theo nét', 'Ngọn xương bám theo đường vẽ (tay, chân, đầu, đuôi…); bật chuỗi IK để cả cánh tay/chân cùng chuyển động'],
  ['move', '✥ Dời theo nét', 'Khớp gốc dời theo đường vẽ (nhún hông, nhảy, lắc người…)']
]
const TIMINGS: Array<[MotionSketchTiming, string, string]> = [
  ['live', '● Thời gian thực', 'Ghi đúng tốc độ tay như quay phim: đầu phát chạy theo nên các xương khác chuyển động cùng lúc (ghi chồng từng phần)'],
  ['hand', 'Theo nhịp tay', 'Giữ nhịp nhanh/chậm của tay nhưng co giãn vừa đúng thời lượng bên dưới'],
  ['even', 'Đều nhau', 'Chia đều tốc độ theo độ dài nét vẽ']
]
const CHAINS: Array<[number, string, string]> = [
  [1, '1 xương (FK)', 'Chỉ xoay xương được nhấn (FK)'],
  [2, 'IK 2 xương', 'Xương được nhấn + xương cha (cẳng tay kéo theo bắp tay)'],
  [3, 'IK 3 xương', 'Thêm một cấp nữa (bàn tay kéo cả cẳng tay và bắp tay)']
]

/** Thẻ "Vẽ động tác" trong tab Animation: bật bút, chọn kiểu chuyển động, chuỗi IK, nhịp và thời lượng. */
export function WorkshopMotionSketchCard({ isPlaying, onTogglePlay }: { isPlaying: boolean; onTogglePlay: () => void }) {
  const { armed, settings, last, status } = useMotionSketch()
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div className="lw-card-section lw-motion-sketch-card">
      <div className="lw-card-header">
        <span className="lw-card-title">✏️ Bút vẽ động tác trực tiếp</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span className={`lw-card-badge${armed ? ' lw-sketch-badge-on' : ''}`}>
            {armed ? '● Đang bật' : 'Tắt'}
          </span>
          <button
            type="button"
            className={`btn xs${showHelp ? ' primary' : ''}`}
            style={{ height: 20, padding: '0 6px', fontSize: 10 }}
            onClick={() => setShowHelp((v) => !v)}
            title="Xem hướng dẫn 3 bước vẽ động tác bằng chuột"
          >
            ? Cách vẽ
          </button>
        </div>
      </div>

      <button
        type="button"
        className={`btn sm ${armed ? 'primary' : ''} lw-sketch-arm-btn`}
        style={{ width: '100%', justifyContent: 'center', height: 28, fontWeight: 700, marginBottom: 8 }}
        onClick={() => toggleMotionSketchArmed()}
        title="Phím tắt: D"
      >
        {armed ? '■ Đang bật bút vẽ — Bấm để tắt (Phím D)' : '✏️ Bật bút vẽ động tác trên khung 2D (Phím D)'}
      </button>

      {showHelp && (
        <ol className="lw-sketch-steps" style={{ marginBottom: 8 }}>
          <li>Nhấn <strong>gần ngọn một xương</strong> trên Bố cục 2D (xương sáng lên khi rê chuột tới).</li>
          <li>Giữ chuột và <strong>diễn động tác</strong> — xương chạy theo tay, đầu phát chạy theo thời gian thật.</li>
          <li>Thả chuột: tự ghi keyframe và phát thử. Vẽ tiếp xương khác để ghi chồng. <kbd>Ctrl+Z</kbd> để hoàn tác.</li>
        </ol>
      )}

      <div className="lw-sketch-label-row">Kiểu chuyển động <span>(Shift khi vẽ để đổi tạm)</span></div>
      <div className="lw-sketch-chips">
        {MODES.map(([id, title, hint]) => (
          <button key={id} type="button" title={hint} className={`lw-sketch-option${settings.mode === id ? ' active' : ''}`} onClick={() => setMotionSketchSettings({ mode: id })}>
            {title}
          </button>
        ))}
      </div>

      {settings.mode === 'rotate' && (
        <>
          <div className="lw-sketch-label-row">Chuỗi xương liên kết <span>(Ctrl = 1 xương)</span></div>
          <div className="lw-sketch-chips">
            {CHAINS.map(([n, title, hint]) => (
              <button key={n} type="button" title={hint} className={`lw-sketch-option${settings.chain === n ? ' active' : ''}`} onClick={() => setMotionSketchSettings({ chain: n })}>
                {title}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="lw-sketch-label-row">Nhịp ghi động tác</div>
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
          <span>Khứ hồi (đi & về)</span>
        </label>
        <label className="lw-rig-check" title="Tự tua về điểm bắt đầu và phát thử ngay khi thả chuột">
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
        <button type="button" className="btn sm" onClick={onTogglePlay} title="Phát thử (Space)">
          {isPlaying ? '⏸ Tạm dừng phát' : '▶ Phát thử động tác'}
        </button>
      </div>
    </div>
  )
}
