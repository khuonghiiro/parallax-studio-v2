import type { Layer, LayerMotion, LayerMotionType } from '@shared/types'
import { defaultLayerMotion, patchLayerMotion } from '../../../animation/proceduralMotion'
import { NumberInput, Row, Select } from '../../controls'
import type { Setter } from '../types'
import { MotionParameters } from './MotionParameters'
import { MotionPreview } from './MotionPreview'
import '../../../styles/motion.css'

const options = [
  { value: 'none', label: 'Không có chuyển động' }, { value: 'drift', label: 'Offset · Trôi & cuộn' },
  { value: 'wind', label: 'Wind · Gió lay' }, { value: 'sway', label: 'Sway · Lắc nhẹ' },
  { value: 'float', label: 'Float · Bồng bềnh' }, { value: 'wiggle', label: 'Wiggle · Rung hữu cơ' },
  { value: 'pulse', label: 'Pulse · Nhịp thở' }
]

export type MotionChange = (patch: Partial<LayerMotion>, key?: string) => void

export function MotionSection({ layer, set }: { layer: Layer; set: Setter }) {
  const motion = layer.motion ?? { type: 'none' }
  const change: MotionChange = (patch, key) => set((l) => {
    l.motion = patchLayerMotion(l.motion, patch)
  }, key)
  const active = motion.type !== 'none'
  return <section className="section motion-controls" aria-label="Motion controls">
    <div className="motion-heading">
      <div><span className="motion-eyebrow">EFFECT CONTROLS</span><h3>Motion</h3></div>
      <div className="motion-actions">
        <button className="btn sm ghost" disabled={!active} onClick={() => set((l) => {
          l.motion = defaultLayerMotion(motion.type)
        })} title="Khôi phục thông số mặc định của loại chuyển động">Reset</button>
        <button id="motion-enabled" className={`switch${active && motion.enabled !== false ? ' on' : ''}`}
          aria-label="Bật hoặc tắt Motion" aria-pressed={active && motion.enabled !== false} disabled={!active}
          onClick={() => change({ enabled: motion.enabled === false })} />
      </div>
    </div>
    <Select id="motion-type" value={motion.type} options={options}
      onChange={(type) => change({ type: type as LayerMotionType })} />
    {active ? <>
      <MotionPreview motion={motion} />
      <Row label="Cường độ" title="Trộn chuyển động vào Transform gốc; 0% giữ nguyên Transform">
        <NumberInput id="motion-amount" value={(motion.amount ?? 1) * 100} suffix="%" min={0} max={100}
          onChange={(v, k) => change({ amount: v / 100 }, k)} />
      </Row>
      <MotionParameters motion={motion} change={change} />
      <details className="motion-timing" open>
        <summary>Thời gian & chuyển tiếp</summary>
        <Row label="Bắt đầu" title="Thời điểm bắt đầu trên timeline, tính bằng giây">
          <NumberInput id="motion-start" value={motion.startTime ?? 0} min={0} step={0.1} suffix="s"
            onChange={(v, k) => change({ startTime: v }, k)} />
        </Row>
        <Row label="Thời lượng" title="0 = chạy đến hết layer; sau thời lượng này trở về Transform gốc">
          <NumberInput id="motion-duration" value={motion.duration ?? 0} min={0} step={0.1} suffix="s"
            onChange={(v, k) => change({ duration: v }, k)} />
        </Row>
        <Row label="Ease In / Out" title="Tăng/giảm cường độ mềm. Ease Out cần thời lượng lớn hơn 0.">
          <NumberInput id="motion-fade-in" axis="in" value={motion.fadeIn ?? 0} min={0} step={0.1} suffix="s"
            onChange={(v, k) => change({ fadeIn: v }, k)} />
          <NumberInput id="motion-fade-out" axis="out" value={motion.fadeOut ?? 0} min={0} step={0.1} suffix="s"
            onChange={(v, k) => change({ fadeOut: v }, k)} />
        </Row>
      </details>
      <p className="motion-note">Cộng vào Transform và keyframe hiện có. Kéo giá trị để chỉnh nhanh; Shift ×10, Alt ×0.1.</p>
    </> : <p className="motion-note">Chọn chuyển động để tinh chỉnh nhịp, biên độ và chuyển tiếp.</p>}
  </section>
}
