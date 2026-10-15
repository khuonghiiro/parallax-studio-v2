import { useMemo, useRef, useState, type PointerEvent } from 'react'
import type { PlantSpineMotion } from '@shared/plantSpine'
import { samplePlantMotion } from '../../engine/plantMotion'
import { setPlantMotionKeyAngle } from './plantMotionRecord'

const W = 260
const H = 96
const PAD = 6
const MAX_DOTS = 90

/**
 * Biểu đồ chuyển động vẽ tay (giống Graph Editor của After Effects, thu gọn):
 * trục ngang = thời gian một chu kỳ, trục dọc = góc ngọn. Kéo chấm lên/xuống để sửa từng mốc.
 */
export function PlantMotionGraph({ motion, onChange }: {
  motion: PlantSpineMotion
  onChange: (next: PlantSpineMotion) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ index: number; scale: number; y0: number; a0: number; peak: number } | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const computedPeak = useMemo(() => Math.max(5, ...motion.keys.map((k) => Math.abs(k.angle))) * 1.15, [motion.keys])
  const peak = active !== null && dragRef.current ? dragRef.current.peak : computedPeak
  const scale = (H / 2 - PAD) / peak
  const x = (t: number) => PAD + (t / motion.duration) * (W - PAD * 2)
  const y = (a: number) => H / 2 - a * scale
  const curve: string[] = []
  for (let k = 0, steps = 140; k <= steps; k++) {
    const t = (motion.duration * k) / steps
    curve.push(`${k ? 'L' : 'M'}${x(t).toFixed(1)},${y(samplePlantMotion(motion, t)).toFixed(1)}`)
  }

  const toSvgY = (clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    return rect && rect.height ? ((clientY - rect.top) / rect.height) * H : 0
  }
  const onDotDown = (e: PointerEvent, index: number) => {
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    dragRef.current = { index, scale, y0: toSvgY(e.clientY), a0: motion.keys[index].angle, peak }
    setActive(index)
  }
  const onMove = (e: PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const angle = d.a0 - (toSvgY(e.clientY) - d.y0) / d.scale
    onChange(setPlantMotionKeyAngle(motion, d.index, e.shiftKey ? Math.round(angle) : angle))
  }
  const onUp = () => {
    dragRef.current = null
    setActive(null)
  }
  const showDots = motion.keys.length <= MAX_DOTS
  const activeKey = active !== null ? motion.keys[active] : null

  return (
    <div className="lw-plant-motion-graph">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        aria-label="Biểu đồ góc ngọn theo thời gian">
        <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} className="lw-plant-graph-zero" />
        <path d={curve.join(' ')} className="lw-plant-graph-curve" />
        {showDots && motion.keys.map((k, i) => (
          <circle key={i} cx={x(k.t)} cy={y(k.angle)} r={active === i ? 4.5 : 3.2}
            className={`lw-plant-graph-key${active === i ? ' active' : ''}`} onPointerDown={(e) => onDotDown(e, i)}>
            <title>{`${k.t.toFixed(2)}s · ${k.angle.toFixed(1)}° — kéo lên/xuống để sửa (Shift = làm tròn)`}</title>
          </circle>
        ))}
      </svg>
      <div className="lw-plant-graph-meta">
        <span>0s</span>
        <span>{activeKey ? `◆ ${activeKey.t.toFixed(2)}s · ${activeKey.angle.toFixed(1)}°` : `↕ ±${peak.toFixed(0)}°`}</span>
        <span>{motion.duration.toFixed(2)}s</span>
      </div>
    </div>
  )
}
