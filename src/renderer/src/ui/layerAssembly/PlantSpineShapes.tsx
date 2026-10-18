import type { PointerEvent, MouseEvent } from 'react'
import type { PlantSpine, PlantSpinePoint } from '@shared/plantSpine'
import { evaluatePlantSpine, plantStaticPose } from '../../engine/plantSpine'
import { plantMotionRange } from '../../engine/plantMotion'
import { grabbedSpine, plantGrabHandle } from './plantSpineEdit'

export const toPlantPath = (pts: PlantSpinePoint[]) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

/** Một xương thực vật: đường nghỉ (nét đứt) + đường đang uốn + gốc / ngọn. */
export function PlantSpineShape({ spine, time, selected, grabAngle, grabStretch }: {
  spine: PlantSpine
  time: number
  selected: boolean
  grabAngle?: number
  grabStretch?: number
}) {
  const frame = evaluatePlantSpine(
    grabAngle !== undefined ? grabbedSpine(spine, grabAngle, grabStretch ?? 0) : spine,
    time
  )
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

/** Bóng biên độ: 2 dáng cực trái/phải + cung quỹ đạo ngọn + độ nhún lên xuống, giúp thấy ngay cây sẽ đung đưa rộng tới đâu. */
function SwayRange({ spine }: { spine: PlantSpine }) {
  const range = swayLimits(spine)
  if (!range) return null
  const { lo, hi, center } = range
  const bob = spine.verticalBob ?? 0
  const left = plantStaticPose(spine, lo, -bob * 0.4)
  const right = plantStaticPose(spine, hi, -bob * 0.4)
  const arc: PlantSpinePoint[] = []
  for (let k = 0; k <= 12; k++) {
    const a = lo + ((hi - lo) * k) / 12
    const u = k / 12
    const s = bob > 0 ? bob * Math.sin(u * Math.PI) * 0.5 - bob * 0.25 : 0
    const pose = plantStaticPose(spine, a, s)
    arc.push(pose[pose.length - 1])
  }
  const lean = center
  const centerPose = plantStaticPose(spine, center, bob * 0.5)
  return (
    <g className={`lw-plant-range${spine.motion ? ' recorded' : ''}`} pointerEvents="none">
      <path d={toPlantPath(left)} className="lw-plant-range-ghost" />
      <path d={toPlantPath(right)} className="lw-plant-range-ghost" />
      {bob > 0.04 && <path d={toPlantPath(centerPose)} className="lw-plant-range-ghost bob" />}
      {Math.abs(lean) >= 0.25 && <path d={toPlantPath(plantStaticPose(spine, center))} className="lw-plant-range-lean" />}
      <path d={toPlantPath(arc)} className="lw-plant-range-arc" />
    </g>
  )
}

/** Biên góc ngọn: theo bản ghi vẽ tay (min/max thật) hoặc theo gió (nghiêng ± biên độ). */
function swayLimits(spine: PlantSpine): { lo: number; hi: number; center: number } | null {
  if (spine.motion?.keys.length) {
    const { min, max } = plantMotionRange(spine.motion)
    const wind = Math.abs(spine.amplitude) * Math.min(1, Math.max(0, spine.motion.windMix ?? 0))
    if (max - min < 0.5 && wind < 0.25) return null
    return { lo: min - wind, hi: max + wind, center: 0 }
  }
  const amp = Math.abs(spine.amplitude)
  const lean = spine.lean ?? 0
  if (amp < 0.25 && Math.abs(lean) < 0.25) return null
  return { lo: lean - amp, hi: lean + amp, center: lean }
}

export interface SelectedHandlesProps {
  spine: PlantSpine
  grabbing: boolean
  hoveredPointIndex?: number | null
  hoverCurvePoint?: PlantSpinePoint | null
  onPointHover?: (index: number | null) => void
  onBodyDown: (e: PointerEvent) => void
  onBodyDoubleClick: (e: MouseEvent) => void
  onPointDown: (e: PointerEvent, index: number) => void
  onPointDoubleClick: (e: MouseEvent, index: number) => void
  onGrabDown: (e: PointerEvent) => void
  /** Chế độ tay nắm: ghi chuyển động vẽ tay hay học thông số gió. */
  grabMode?: 'record' | 'learn'
}

/** Tay nắm của xương đang chọn: thân (dời cả xương), chấm điểm (sửa dáng), tay nắm ngọn 4 chiều (uốn vòng cung & nhún lên xuống). */
export function SelectedSpineHandles(props: SelectedHandlesProps) {
  const { spine, grabbing, hoveredPointIndex, hoverCurvePoint, onPointHover } = props
  const tip = spine.points[spine.points.length - 1]
  const grab = plantGrabHandle(spine.points)
  const amp = Math.abs(spine.amplitude)
  const lean = spine.lean ?? 0
  const bob = spine.verticalBob ?? 0
  const grabTitle = props.grabMode === 'learn'
    ? 'Nắm ngọn lắc vòng cung (trái/phải) hoặc kéo lên/xuống (nhún co dãn) để học nhịp đung đưa'
    : 'Nắm ngọn kéo vòng cung hoặc lên/xuống — app ghi lại đúng chuyển động 2D và lặp lại khi thả chuột'
  return (
    <g className="lw-plant-handles">
      {!grabbing && <SwayRange spine={spine} />}
      <path
        d={toPlantPath(spine.points)}
        className="lw-plant-body-hit"
        onPointerDown={props.onBodyDown}
        onDoubleClick={props.onBodyDoubleClick}
      >
        <title>Kéo để dời cả xương · Nhấn phím '+' tại vị trí chuột để thêm điểm uốn</title>
      </path>
      {/* Vị trí preview thêm điểm uốn mới khi rê chuột dọc theo thân xương */}
      {hoverCurvePoint && !grabbing && (
        <g className="lw-plant-insert-preview" pointerEvents="none">
          <circle cx={hoverCurvePoint.x} cy={hoverCurvePoint.y} r={7.5} className="lw-plant-insert-ring" />
          <path
            d={`M${hoverCurvePoint.x - 3.5},${hoverCurvePoint.y} h7 M${hoverCurvePoint.x},${hoverCurvePoint.y - 3.5} v7`}
            className="lw-plant-insert-plus"
          />
          <text
            x={hoverCurvePoint.x + 10}
            y={hoverCurvePoint.y + 3.5}
            className="lw-plant-insert-hint"
          >
            Nhấn '+' thêm điểm
          </text>
        </g>
      )}
      {spine.points.map((p, i) => {
        const isHoverDelete = i === hoveredPointIndex && i > 0
        const isRoot = i === 0
        const size = isHoverDelete ? 11 : 9
        const half = size / 2
        return (
          <g key={i}>
            <rect
              x={p.x - half}
              y={p.y - half}
              width={size}
              height={size}
              rx={2}
              className={`lw-plant-point${isRoot ? ' root' : ''}${isHoverDelete ? ' hover-delete' : ''}`}
              onPointerDown={(e) => props.onPointDown(e, i)}
              onDoubleClick={(e) => props.onPointDoubleClick(e, i)}
              onPointerEnter={() => onPointHover?.(i)}
              onPointerLeave={() => onPointHover?.(null)}
            >
              <title>
                {isRoot
                  ? 'Gốc xương — kéo để dời cả thân cây'
                  : isHoverDelete
                    ? 'Điểm đỏ — Nhấn phím \'-\' hoặc \'Del\' để xoá điểm này'
                    : 'Kéo để sửa dáng · Nhấn \'-\' hoặc \'Del\' khi hover để xoá'}
              </title>
            </rect>
            {isHoverDelete && (
              <path
                d={`M${p.x - 3},${p.y} h6`}
                className="lw-plant-point-del-minus"
                pointerEvents="none"
              />
            )}
          </g>
        )
      })}
      <line x1={tip.x} y1={tip.y} x2={grab.x} y2={grab.y} className="lw-plant-grab-stem" />
      <g className={`lw-plant-grab${grabbing ? ' active' : ''}`} onPointerDown={props.onGrabDown}>
        <circle cx={grab.x} cy={grab.y} r={12} className="lw-plant-grab-ring" />
        {/* Biểu tượng 4 hướng: uốn vòng cung (trái-phải) và nhún co dãn (lên-xuống) */}
        <path
          d={`M${grab.x - 6},${grab.y} l3.5,-3.5 m-3.5,3.5 l3.5,3.5 M${grab.x + 6},${grab.y} l-3.5,-3.5 m3.5,3.5 l-3.5,3.5 M${grab.x},${grab.y - 6} l-3.5,3.5 m3.5,-3.5 l3.5,3.5 M${grab.x},${grab.y + 6} l-3.5,-3.5 m3.5,3.5 l-3.5,-3.5`}
          className="lw-plant-grab-arrows"
        />
        <title>{grabTitle}</title>
      </g>
      <text x={spine.points[0].x + 9} y={spine.points[0].y + 16} className="lw-plant-label">
        {spine.motion
          ? `${spine.name} · ✍️ vẽ tay ${spine.motion.duration.toFixed(1)}s · ${spine.motion.keys.length} mốc`
          : `${spine.name} · ±${amp.toFixed(1)}°${bob > 0 ? ` · nhún ${(bob * 100).toFixed(0)}%` : ''}${Math.abs(lean) >= 0.25 ? ` · nghiêng ${lean.toFixed(1)}°` : ''}`}
      </text>
    </g>
  )
}
