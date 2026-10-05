import type { DriftDirection, DriftLoopMode, Layer, LayerMotion, LayerMotionType, Vec3 } from '@shared/types'
import { parseDirectionAngle } from '../../../engine/evaluateScene'
import { NumberInput, Row } from '../../controls'
import type { Setter } from '../types'

export function MotionSection({ layer, set }: { layer: Layer; set: Setter }) {
  const motion = layer.motion ?? { type: 'none' }
  const setMotion = (patch: Partial<LayerMotion>): void => {
    set((l) => {
      l.motion = { ...(l.motion ?? { type: 'none' }), ...patch }
    }, 'motion')
  }

  const setAmp = (axisIdx: number, val: number, mergeKey: string): void => {
    set((l) => {
      const cur = [...(l.motion?.amplitude ?? [20, 0, 0])] as Vec3
      cur[axisIdx] = val
      l.motion = { ...(l.motion ?? { type: 'drift' }), amplitude: cur }
    }, mergeKey)
  }

  return (
    <div className="section">
      <div className="section-title">Chuyển động (Motion &amp; Loop)</div>
      <Row label="Loại" title="Tự động di chuyển lặp lại hoặc đung đưa trong không gian 3D">
        <select
          id="motion-type"
          className="select"
          value={motion.type ?? 'none'}
          onChange={(e) => {
            const t = e.target.value as LayerMotionType
            if (t === 'none') {
              setMotion({ type: 'none' })
            } else if (t === 'drift') {
              setMotion({
                type: 'drift',
                speed: motion.speed ?? 40,
                loopWidth: motion.loopWidth ?? 3000,
                amplitude: motion.amplitude ?? [1500, 12, 0]
              })
            } else if (t === 'wind' || t === 'sway') {
              setMotion({
                type: t,
                speed: motion.speed ?? 0.6,
                amplitude: motion.amplitude ?? [8, 2, 1.2]
              })
            } else if (t === 'float') {
              setMotion({
                type: 'float',
                speed: motion.speed ?? 0.4,
                amplitude: motion.amplitude ?? [4, 15, 0]
              })
            } else if (t === 'wiggle') {
              setMotion({
                type: 'wiggle',
                speed: motion.speed ?? 1.5,
                amplitude: motion.amplitude ?? [15, 15, 0]
              })
            } else if (t === 'pulse') {
              setMotion({
                type: 'pulse',
                speed: motion.speed ?? 0.5,
                amplitude: motion.amplitude ?? [0.05, 0.05, 0]
              })
            }
          }}
        >
          <option value="none">Không có (Đứng yên)</option>
          <option value="drift">Trôi theo hướng &amp; lặp mượt (Sương mù / Mưa / Mây)</option>
          <option value="wind">Gió lay động (Cây cối / Lá / Cành)</option>
          <option value="sway">Lắc lư nhẹ (Nhịp điệu)</option>
          <option value="float">Nổi bồng bềnh (Nước / Đảo bay)</option>
          <option value="wiggle">Rung rinh hữu cơ (After Effects Wiggle)</option>
          <option value="pulse">Nhịp thở nhẹ (Co giãn)</option>
        </select>
      </Row>

      {motion.type && motion.type !== 'none' && (
        <>
          {motion.type === 'drift' && (
            <>
              <Row label="Hướng trôi" title="Chọn hướng di chuyển (trái, phải, lên, xuống, chéo)">
                <select
                  id="motion-direction"
                  className="select"
                  value={typeof motion.direction === 'string' ? motion.direction : Math.round(parseDirectionAngle(motion.direction))}
                  onChange={(e) => {
                    const val = e.target.value
                    const num = Number(val)
                    setMotion({ direction: isNaN(num) ? (val as DriftDirection) : num })
                  }}
                >
                  <option value="right">➡️ Sang phải (0°)</option>
                  <option value="up-right">↗️ Chéo lên - phải (45°)</option>
                  <option value="up">⬆️ Lên trên (90°)</option>
                  <option value="up-left">↖️ Chéo lên - trái (135°)</option>
                  <option value="left">⬅️ Sang trái (180°)</option>
                  <option value="down-left">↙️ Chéo xuống - trái (225° - Mưa xiên)</option>
                  <option value="down">⬇️ Xuống dưới (270° - Mưa rơi)</option>
                  <option value="down-right">↘️ Chéo xuống - phải (315°)</option>
                </select>
              </Row>

              <Row label="Góc chéo (°)" title="Góc hướng trôi tùy ý theo độ (0° - 360°)">
                <NumberInput
                  axis="deg"
                  value={Math.round(parseDirectionAngle(motion.direction))}
                  min={0}
                  max={360}
                  step={5}
                  precision={0}
                  onChange={(v) => setMotion({ direction: v })}
                />
              </Row>

              <Row label="Kiểu lặp" title="Phương thức lặp: Cuộn pixel vô hạn (cửa ra nối cửa vào như After Effects Offset), Ping-pong hoặc Trôi liên tục">
                <select
                  id="motion-loop-mode"
                  className="select"
                  value={motion.loopMode === 'ping-pong' ? 'ping-pong' : motion.loopMode === 'continuous' ? 'continuous' : 'uv'}
                  onChange={(e) => setMotion({ loopMode: e.target.value as DriftLoopMode })}
                >
                  <option value="uv">🌀 Cuộn vô hạn cửa ra - vào (Pixel Wrap / AE Offset)</option>
                  <option value="ping-pong">🌊 Lượn qua lại êm ái (Ping-Pong)</option>
                  <option value="continuous">➡️ Trôi liên tục một chiều (Continuous)</option>
                </select>
              </Row>
            </>
          )}

          <Row label="Tốc độ" title="Tốc độ trôi (px/s) hoặc chu kỳ nhịp (Hz)">
            <NumberInput
              axis="spd"
              value={motion.speed ?? (motion.type === 'drift' ? 40 : 0.6)}
              step={motion.type === 'drift' ? 2 : 0.05}
              precision={motion.type === 'drift' ? 0 : 2}
              onChange={(v, _k) => setMotion({ speed: v })}
            />
          </Row>

          <Row label="Biên độ" title="Độ dịch chuyển (X, Y) và góc nghiêng (Z)">
            {[0, 1, 2].map((i) => (
              <NumberInput
                key={i}
                axis={'xyz'[i]}
                value={motion.amplitude?.[i] ?? 0}
                step={motion.type === 'pulse' ? 0.01 : 1}
                precision={motion.type === 'pulse' ? 2 : 1}
                onChange={(v, k) => setAmp(i, v, k)}
              />
            ))}
          </Row>

          {motion.type === 'drift' && motion.loopMode === 'ping-pong' && (
            <Row label="Độ rộng loop" title="Khoảng cách trôi qua trước khi đảo chiều (px)">
              <NumberInput
                axis="px"
                value={motion.loopWidth ?? 3000}
                min={200}
                step={100}
                precision={0}
                onChange={(v) => setMotion({ loopWidth: v })}
              />
            </Row>
          )}

          <Row label="Lệch pha" title="Lệch pha giúp các layer không chuyển động đồng thời">
            <NumberInput
              axis="φ"
              value={motion.phase ?? 0}
              step={0.5}
              precision={1}
              onChange={(v) => setMotion({ phase: v })}
            />
          </Row>
        </>
      )}
    </div>
  )
}
