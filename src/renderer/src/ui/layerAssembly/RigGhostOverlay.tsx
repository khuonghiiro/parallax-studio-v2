import { useMemo } from 'react'
import type { LayerRig } from '@shared/layerRig'
import { boneSegments, type Point2D } from './workshopMotionSketch'
import { useAnimAssist } from './animAssistStore'
import '../../styles/layerWorkshopAnimAssist.css'

/**
 * Onion skin + Quỹ đạo chuyển động (tab Animation), giống Toon Boom / Spine / After Effects:
 * - Bóng mờ khung xương ở vài thời điểm trước (đỏ) và sau (xanh) để canh nhịp động tác.
 * - Đường đi của ngọn xương đang chọn trong cả clip, chấm theo từng khung hình và hình thoi tại keyframe.
 */

const PATH_FPS = 24

function onionTimes(rig: LayerRig, time: number, count: number, step: number): Array<{ t: number; k: number }> {
  const out: Array<{ t: number; k: number }> = []
  for (let k = -count; k <= count; k++) {
    if (!k) continue
    let t = time + k * step
    if (rig.loop && rig.duration > 0) t = ((t % rig.duration) + rig.duration) % rig.duration
    if (t < -1e-6 || t > rig.duration + 1e-6) continue
    out.push({ t, k })
  }
  return out
}

function tailPath(rig: LayerRig, boneId: string): { points: Point2D[]; keys: Point2D[] } {
  const frames = Math.max(2, Math.min(600, Math.ceil(rig.duration * PATH_FPS)))
  const at = (t: number) => boneSegments(rig, t).find((s) => s.bone.id === boneId)?.tail
  const points: Point2D[] = []
  for (let i = 0; i <= frames; i++) {
    const p = at((rig.duration * i) / frames)
    if (p) points.push(p)
  }
  const keys = (rig.tracks[boneId] ?? []).map((k) => at(k.time)).filter((p): p is Point2D => !!p)
  return { points, keys }
}

const toPath = (pts: Point2D[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

export function RigGhostOverlay({ rig, width, height, time, boneId }: {
  rig: LayerRig | undefined
  width: number
  height: number
  time: number
  boneId: string | null
}) {
  const assist = useAnimAssist()
  const path = useMemo(
    () => (assist.path && rig && boneId && rig.bones.some((b) => b.id === boneId) ? tailPath(rig, boneId) : null),
    [assist.path, rig, boneId]
  )
  if (!rig?.bones.length || (!assist.onion && !path)) return null
  const ghosts = assist.onion ? onionTimes(rig, time, assist.onionCount, assist.onionStep) : []
  const current = boneId ? boneSegments(rig, time).find((s) => s.bone.id === boneId)?.tail : undefined
  return (
    <svg
      className="lw-rig-ghost-overlay"
      viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
      aria-label="Onion skin và quỹ đạo chuyển động"
      pointerEvents="none"
    >
      {ghosts.map(({ t, k }) => (
        <g key={k} className={`lw-onion ${k < 0 ? 'past' : 'future'}`} style={{ opacity: 0.75 - (Math.abs(k) - 1) * (0.5 / Math.max(1, assist.onionCount)) }}>
          {boneSegments(rig, t).map((s) => (
            <line key={s.bone.id} x1={s.head.x} y1={s.head.y} x2={s.tail.x} y2={s.tail.y} className="lw-onion-bone" />
          ))}
        </g>
      ))}
      {path && path.points.length > 1 && (
        <g className="lw-motion-path">
          <path d={toPath(path.points)} className="lw-motion-path-line" />
          {path.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={1.6} className="lw-motion-path-dot" />)}
          {path.keys.map((p, i) => (
            <rect key={`k${i}`} x={p.x - 3.5} y={p.y - 3.5} width={7} height={7} transform={`rotate(45 ${p.x} ${p.y})`} className="lw-motion-path-key" />
          ))}
          {current && <circle cx={current.x} cy={current.y} r={4.5} className="lw-motion-path-now" />}
        </g>
      )}
    </svg>
  )
}
