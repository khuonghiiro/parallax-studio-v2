import { useMemo } from 'react'
import { computeBoneTail } from './mohoRigHelpers'
import { skeletonRect } from './creatures/creatureRigFit'
import type { CreatureRigBuild } from './creatures/creatureRigTypes'

/** Xem trước khung xương sinh vật dạng sơ đồ (giống ô preview của Moho Character Wizard) trước khi dựng. */
export function CreatureSkeletonPreview({ build }: { build: CreatureRigBuild }) {
  const view = useMemo(() => {
    const r = skeletonRect(build.bones)
    const pad = 14
    return {
      x: r.minX - pad,
      y: r.minY - pad,
      w: Math.max(40, r.maxX - r.minX + pad * 2),
      h: Math.max(40, r.maxY - r.minY + pad * 2)
    }
  }, [build])
  const stroke = Math.max(1.6, Math.min(view.w, view.h) / 70)

  return (
    <svg
      className="lw-creature-preview-svg"
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Sơ đồ khung xương ${build.bones.length} xương`}
    >
      {build.bones.map((b) => {
        const tail = computeBoneTail(b)
        const side = build.roles[b.id]?.side ?? 'c'
        return (
          <g key={b.id} className={`lw-creature-preview-bone side-${side}`}>
            <line x1={b.x} y1={b.y} x2={tail.x} y2={tail.y} strokeWidth={stroke} strokeLinecap="round" />
            <circle cx={b.x} cy={b.y} r={stroke * 1.05} />
          </g>
        )
      })}
    </svg>
  )
}
