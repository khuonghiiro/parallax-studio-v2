import type { PointerEvent, MouseEvent } from 'react'
import type { PlantSpine, PlantSpinePoint } from '@shared/plantSpine'
import { evaluatePlantSpine, plantStaticPose } from '../../engine/plantSpine'
import { grabbedSpine, plantGrabHandle } from './plantSpineEdit'

export const toPlantPath = (pts: PlantSpinePoint[]) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

/** Một xương thực vật: đường nghỉ (nét đứt) + đường đang uốn + gốc / ngọn. */
export function PlantSpineShape({ spine, time, selected, grabAngle }: {
  spine: PlantSpine
  time: number
  selected: boolean
  grabAngle?: number
}) {
  const frame = evaluatePlantSpine(grabAngle !== undefined ? grabbedSpine(spine, grabAngle) : spine, time)
  const root = frame.rest[0]
  const tip = frame.bent[frame.bent.length - 1]
  return (
    <g className={`lw-plant-spine${selected ? ' selected' : ''}${spine.enabled === false ? ' disabled' : ''}`}>
      <path d={toPlantPath(frame.rest)} className="lw-plant-rest" />
      <path d={toPlantPath(frame.bent)} className="lw-plant-bent" />
      <circle cx={root.x} cy={root.y} r={5} className="lw-plant-root" />
      <circle cx={tip.x} cy={tip.y} r={3.5} className="lw-plant-tip" />
    </g>
  )
}

/** Bóng biên độ: 2 dáng cực trái/phải + cung quỹ đạo ngọn, giúp thấy ngay cây sẽ đung đưa rộng tới đâu. */
function SwayRange({ spine }: { spine: PlantSpine }) {
  const amp = Math.abs(spine.amplitude)
  const lean = spine.lean ?? 0
  if (amp < 0.25 && Math.abs(lean) < 0.25) return null
  const left = plantStaticPose(spine, lean - amp)
  const right = plantStaticPose(spine, lean + amp)
  const arc: PlantSpinePoint[] = []
  for (let k = 0; k <= 12; k++) {
    const pose = plantStaticPose(spine, lean - amp + (2 * amp * k) / 12)
    arc.push(pose[pose.length - 1])
  }
  const center = plantStaticPose(spine, lean)
  return (
    <g className="lw-plant-range" pointerEvents="none">
      <path d={toPlantPath(left)} className="lw-plant-range-ghost" />
      <path d={toPlantPath(right)} className="lw-plant-range-ghost" />
      {Math.abs(lean) >= 0.25 && <path d={toPlantPath(center)} className="lw-plant-range-lean" />}
      <path d={toPlantPath(arc)} className="lw-plant-range-arc" />
    </g>
  )
}

export interface SelectedHandlesProps {
  spine: PlantSpine
  grabbing: boolean
  onBodyDown: (e: PointerEvent) => void
  onBodyDoubleClick: (e: MouseEvent) => void
  onPointDown: (e: PointerEvent, index: number) => void
  onPointDoubleClick: (e: MouseEvent, index: number) => void
  onGrabDown: (e: PointerEvent) => void
}

/** Tay nắm của xương đang chọn: thân (dời cả xương), chấm điểm (sửa dáng), tay nắm ngọn (dạy cây đung đưa). */
export function SelectedSpineHandles(props: SelectedHandlesProps) {
  const { spine, grabbing } = props
  const tip = spine.points[spine.points.length - 1]
  const grab = plantGrabHandle(spine.points)
  const amp = Math.abs(spine.amplitude)
  const lean = spine.lean ?? 0
  return (
    <g className="lw-plant-handles">
      {!grabbing && <SwayRange spine={spine} />}
      <path
        d={toPlantPath(spine.points)}
        className="lw-plant-body-hit"
        onPointerDown={props.onBodyDown}
        onDoubleClick={props.onBodyDoubleClick}
      >
        <title>Kéo để dời cả xương · Nhấp đúp để thêm điểm uốn</title>
      </path>
      {spine.points.map((p, i) => (
        <rect
          key={i}
          x={p.x - 4.5}
          y={p.y - 4.5}
          width={9}
          height={9}
          rx={2}
          className={`lw-plant-point${i === 0 ? ' root' : ''}`}
          onPointerDown={(e) => props.onPointDown(e, i)}
          onDoubleClick={(e) => props.onPointDoubleClick(e, i)}
        >
          <title>{i === 0 ? 'Gốc xương — kéo để dời' : 'Kéo để sửa dáng · Nhấp đúp để xoá điểm'}</title>
        </rect>
      ))}
      <line x1={tip.x} y1={tip.y} x2={grab.x} y2={grab.y} className="lw-plant-grab-stem" />
      <g className={`lw-plant-grab${grabbing ? ' active' : ''}`} onPointerDown={props.onGrabDown}>
        <circle cx={grab.x} cy={grab.y} r={11} className="lw-plant-grab-ring" />
        <path d={`M${grab.x - 5},${grab.y} l3,-3 m-3,3 l3,3 M${grab.x + 5},${grab.y} l-3,-3 m3,3 l-3,3`} className="lw-plant-grab-arrows" />
        <title>Nắm ngọn kéo qua lại để dạy cây đung đưa (thả ra là cây lặp lại nhịp vừa lắc)</title>
      </g>
      <text x={spine.points[0].x + 9} y={spine.points[0].y + 16} className="lw-plant-label">
        {`${spine.name} · ±${amp.toFixed(1)}°${Math.abs(lean) >= 0.25 ? ` · nghiêng ${lean.toFixed(1)}°` : ''}`}
      </text>
    </g>
  )
}
