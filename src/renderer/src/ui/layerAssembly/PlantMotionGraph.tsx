import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from 'react'
import type { PlantSpineMotion } from '@shared/plantSpine'
import { samplePlantMotion, samplePlantMotionStretch } from '../../engine/plantMotion'
import { insertPlantKey, movePlantKey, removePlantKey } from './plantMotionEdit'
import { PlantMotionGraphTools } from './PlantMotionGraphTools'

const W = 260
const H = 104
const PAD = 8
const MAX_DOTS = 90

/** Thao tác chuột / phím trên đồ thị: kéo mốc 2 chiều, nhấp đúp thêm, chuột phải / Delete xoá, mũi tên tinh chỉnh. */
function useGraphEditing(motion: PlantSpineMotion, onChange: (m: PlantSpineMotion) => void, svgRef: RefObject<SVGSVGElement | null>, peak: number) {
  const dragRef = useRef<{ index: number; peak: number } | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [dragPeak, setDragPeak] = useState<number | null>(null)
  const sel = selected !== null && selected < motion.keys.length ? selected : null
  const toSvg = (clientX: number, clientY: number) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r || !r.width || !r.height) return { sx: 0, sy: 0 }
    return { sx: ((clientX - r.left) / r.width) * W, sy: ((clientY - r.top) / r.height) * H }
  }
  const timeAt = (sx: number) => ((sx - PAD) / (W - PAD * 2)) * motion.duration
  const removeAt = (index: number) => {
    const next = removePlantKey(motion, index)
    if (next !== motion) { onChange(next); setSelected(null) }
  }
  return {
    sel, setSelected, dragPeak, removeAt,
    onDotDown: (e: PointerEvent, index: number) => {
      e.stopPropagation()
      if (e.button !== 0) return
      svgRef.current?.setPointerCapture(e.pointerId)
      dragRef.current = { index, peak }
      setSelected(index)
      setDragPeak(peak)
    },
    onMove: (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const { sx, sy } = toSvg(e.clientX, e.clientY)
      let t = timeAt(sx)
      let angle = (H / 2 - sy) / ((H / 2 - PAD) / d.peak)
      if (e.shiftKey) { angle = Math.round(angle); t = Math.round(t / 0.05) * 0.05 }
      onChange(movePlantKey(motion, d.index, t, angle))
    },
    onUp: () => { dragRef.current = null; setDragPeak(null) },
    onDoubleClick: (e: MouseEvent) => {
      const res = insertPlantKey(motion, timeAt(toSvg(e.clientX, e.clientY).sx))
      if (res.motion !== motion) onChange(res.motion)
      if (res.index >= 0) setSelected(res.index)
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (sel === null) return
      const k = motion.keys[sel]
      const step = e.shiftKey ? 5 : 1
      const moves: Record<string, [number, number]> = { ArrowUp: [0, step], ArrowDown: [0, -step], ArrowLeft: [-0.02 * step, 0], ArrowRight: [0.02 * step, 0] }
      if (e.key === 'Delete' || e.key === 'Backspace' || e.key === '-') { e.preventDefault(); e.stopPropagation(); removeAt(sel) }
      else if (moves[e.key]) { e.preventDefault(); e.stopPropagation(); onChange(movePlantKey(motion, sel, k.t + moves[e.key][0], k.angle + moves[e.key][1])) }
    }
  }
}

/**
 * Biểu đồ nhịp thực vật (Graph Editor thu gọn): trục ngang = thời gian 1 chu kỳ, trục dọc = góc ngọn.
 *  - Kéo chấm theo 2 chiều (Shift = bắt tròn 1° / 0.05s) · Nhấp đúp vùng trống = thêm mốc · Chuột phải = xoá mốc.
 *  - Chọn mốc rồi dùng phím ↑↓ (góc) ←→ (thời gian), Delete / − để xoá. Đường nét đứt = độ nhún dọc thân.
 */
export function PlantMotionGraph({ motion, onChange }: { motion: PlantSpineMotion; onChange: (next: PlantSpineMotion) => void }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const computedPeak = useMemo(() => Math.max(5, ...motion.keys.map((k) => Math.abs(k.angle))) * 1.15, [motion.keys])
  const edit = useGraphEditing(motion, onChange, svgRef, computedPeak)
  const peak = edit.dragPeak ?? computedPeak
  const scale = (H / 2 - PAD) / peak
  const x = (t: number) => PAD + (t / motion.duration) * (W - PAD * 2)
  const y = (a: number) => H / 2 - a * scale
  const sel = edit.sel
  const showDots = motion.keys.length <= MAX_DOTS
  const stretchOn = motion.keys.some((k) => k.stretch !== undefined) || !!motion.verticalBob
  const curve: string[] = []
  const stretch: string[] = []
  for (let k = 0, steps = 140; k <= steps; k++) {
    const t = (motion.duration * k) / steps
    curve.push(`${k ? 'L' : 'M'}${x(t).toFixed(1)},${y(samplePlantMotion(motion, t)).toFixed(1)}`)
    if (stretchOn) stretch.push(`${k ? 'L' : 'M'}${x(t).toFixed(1)},${(H / 2 - samplePlantMotionStretch(motion, t) * (H / 2 - PAD)).toFixed(1)}`)
  }
  return (
    <div className="lw-plant-motion-graph" data-mcp-region="layer_assembly_plant_graph">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} tabIndex={0} onPointerMove={edit.onMove} onPointerUp={edit.onUp} onPointerCancel={edit.onUp}
        onDoubleClick={edit.onDoubleClick} onKeyDown={edit.onKeyDown} onPointerDown={() => edit.setSelected(null)}
        aria-label="Biểu đồ góc ngọn theo thời gian — nhấp đúp để thêm mốc, chuột phải để xoá">
        <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} className="lw-plant-graph-zero" />
        {stretchOn && <path d={stretch.join(' ')} className="lw-plant-graph-stretch" />}
        <path d={curve.join(' ')} className="lw-plant-graph-curve" />
        {sel !== null && <line x1={x(motion.keys[sel].t)} x2={x(motion.keys[sel].t)} y1={PAD / 2} y2={H - PAD / 2} className="lw-plant-graph-cursor" />}
        {showDots && motion.keys.map((k, i) => (
          <circle key={i} cx={x(k.t)} cy={y(k.angle)} r={sel === i ? 4.6 : 3.4} className={`lw-plant-graph-key${sel === i ? ' active' : ''}`}
            onPointerDown={(e) => edit.onDotDown(e, i)} onContextMenu={(e) => { e.preventDefault(); edit.removeAt(i) }}>
            <title>{`${k.t.toFixed(2)}s · ${k.angle.toFixed(1)}° — kéo để sửa (Shift = bắt tròn), chuột phải để xoá`}</title>
          </circle>
        ))}
      </svg>
      <div className="lw-plant-graph-meta">
        <span>0s</span>
        <span>{showDots ? `↕ ±${peak.toFixed(0)}° · ${motion.keys.length} mốc` : `${motion.keys.length} mốc — bấm “Làm gọn” để sửa từng mốc`}</span>
        <span>{motion.duration.toFixed(2)}s</span>
      </div>
      <PlantMotionGraphTools motion={motion} selected={sel} onChange={onChange} onSelect={edit.setSelected} onRemove={edit.removeAt} />
    </div>
  )
}
