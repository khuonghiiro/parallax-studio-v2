import { useMemo } from 'react'
import type { LayerMotion } from '@shared/types'
import { sampleLayerMotion } from '../../../animation/proceduralMotion'

export function MotionPreview({ motion }: { motion: LayerMotion }) {
  const { paths, span } = useMemo(() => {
    const span = motion.duration || 4
    const values = Array.from({ length: 121 }, (_, i) => {
      const sample = sampleLayerMotion(motion, (motion.startTime ?? 0) + i / 120 * span)
      return motion.type === 'pulse' ? sample.scale.slice(0, 2).map((v) => v - 1)
        : sample.uvOffset ?? sample.position.slice(0, 2)
    })
    const max = Math.max(0.001, ...values.flat().map(Math.abs))
    const paths = [0, 1].map((axis) => values.map((v, i) =>
      `${i ? 'L' : 'M'}${(i * 2.5).toFixed(1)},${(40 - v[axis] / max * 30).toFixed(2)}`).join(' '))
    return { paths, span }
  }, [motion])
  return <figure className="motion-preview">
    <figcaption><span>PREVIEW · {motion.type === 'pulse' ? 'SCALE' : motion.type === 'drift' && (!motion.loopMode || ['uv', 'wrap'].includes(motion.loopMode)) ? 'UV OFFSET' : 'POSITION'}</span><span>X / Y · {span}s</span></figcaption>
    <svg viewBox="0 0 300 80" role="img" aria-label="Đồ thị X và Y chuẩn hóa theo biên độ; không phải trình sửa keyframe">
      <path className="motion-grid" d="M0 10H300 M0 40H300 M0 70H300 M75 0V80 M150 0V80 M225 0V80" />
      <path className="motion-curve-x" d={paths[0]} /><path className="motion-curve-y" d={paths[1]} />
    </svg>
  </figure>
}
