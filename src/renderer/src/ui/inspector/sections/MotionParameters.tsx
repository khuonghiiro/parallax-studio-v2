import type { DriftLoopMode, LayerMotion, Vec3 } from '@shared/types'
import { resolveLayerMotion, parseDirectionAngle } from '../../../animation/proceduralMotion'
import { NumberInput, Row, Select } from '../../controls'
import type { MotionChange } from './MotionSection'

export function MotionParameters({ motion: m, change }: { motion: LayerMotion; change: MotionChange }) {
  const defaults = resolveLayerMotion(m)
  const amp = m.amplitude ?? defaults.amplitude!
  const pulse = m.type === 'pulse'
  const drift = m.type === 'drift'
  const setAmplitude = (axis: number, value: number, key: string): void => {
    const amplitude: Vec3 = [...amp]
    amplitude[axis] = pulse ? value / 100 : value
    change({ amplitude }, key)
  }
  return <div className="motion-parameters">
    <Row label={drift ? 'Vận tốc' : 'Tần số'} title={drift ? 'Đơn vị không gian mỗi giây' : 'Số chu kỳ mỗi giây'}>
      <NumberInput id="motion-speed" value={m.speed ?? defaults.speed!} min={0} step={drift ? 1 : 0.05}
        precision={2} suffix={drift ? ' u/s' : ' Hz'} onChange={(v, k) => change({ speed: v }, k)} />
    </Row>
    {drift ? <>
      <Row label="Hướng" title="0° sang phải, 90° lên trên, 180° sang trái, 270° xuống dưới">
        <NumberInput id="motion-direction" value={parseDirectionAngle(m.direction)} min={0} max={360} suffix="°"
          onChange={(v, k) => change({ direction: v }, k)} />
      </Row>
      <Row label="Kiểu lặp">
        <Select id="motion-loop-mode" value={m.loopMode === 'wrap' ? 'uv' : m.loopMode ?? 'uv'} options={[
          { value: 'uv', label: 'Offset · Cuộn texture' }, { value: 'ping-pong', label: 'Ping-pong · Qua lại' },
          { value: 'continuous', label: 'Continuous · Một chiều' }
        ]} onChange={(v) => change({ loopMode: v as DriftLoopMode })} />
      </Row>
      {m.loopMode === 'ping-pong' && <Row label="Quãng đường">
        <NumberInput id="motion-loop-width" value={m.loopWidth ?? 3000} min={0.01} suffix=" u" step={10}
          onChange={(v, k) => change({ loopWidth: v }, k)} />
      </Row>}
      <Row label="Dao động phụ" title="Biên độ vuông góc với hướng trôi">
        <NumberInput id="motion-amplitude-1" value={amp[1]} suffix=" u" onChange={(v, k) => setAmplitude(1, v, k)} />
      </Row>
    </> : <>
      <Row label={pulse ? 'Co giãn X / Y' : 'Biên độ X / Y'}>
        {[0, 1].map((i) => <NumberInput key={i} id={`motion-amplitude-${i}`} axis={'xy'[i]}
          value={amp[i] * (pulse ? 100 : 1)} suffix={pulse ? '%' : ' u'} step={pulse ? 0.5 : 1}
          onChange={(v, k) => setAmplitude(i, v, k)} />)}
      </Row>
      {!pulse && m.type !== 'float' && <Row label="Xoay Z">
        <NumberInput id="motion-amplitude-2" value={amp[2]} suffix="°" step={0.1}
          onChange={(v, k) => setAmplitude(2, v, k)} />
      </Row>}
    </>}
    <Row label="Lệch pha" title={drift ? 'Offset theo đơn vị không gian; với Ping-pong là radian' : 'Độ lệch pha, radian'}>
      <NumberInput id="motion-phase" value={m.phase ?? 0} step={0.1} precision={2}
        onChange={(v, k) => change({ phase: v }, k)} />
    </Row>
    {m.type === 'wiggle' && <Row label="Random seed" title="Cùng seed cho kết quả giống nhau khi xem và xuất video">
      <NumberInput id="motion-seed" value={m.seed ?? 0} min={0} max={999999} precision={0}
        onChange={(v, k) => change({ seed: Math.round(v) }, k)} />
    </Row>}
  </div>
}
