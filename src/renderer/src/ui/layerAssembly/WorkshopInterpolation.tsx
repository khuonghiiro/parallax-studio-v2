import type { BoneKeyframe } from '@shared/layerRig'
import { Select } from '../controls'
import { RigNumber } from './WorkshopRigPanel'
import { DEFAULT_BEZIER } from './workshopAnimation'
import { cubicBezierProgress } from '../../engine/boneEasing'

export function WorkshopInterpolation({ keyframe, onChange }: {
  keyframe: BoneKeyframe; onChange: (patch: Partial<BoneKeyframe>) => void
}) {
  const curve = keyframe.bezier ?? DEFAULT_BEZIER
  const points = Array.from({ length: 41 }, (_, i) => `${10 + i * 3},${74 - cubicBezierProgress(i / 40, curve) * 56}`).join(' ')
  return <div className="lw-interpolation-editor">
    <span className="lw-form-label">Nội suy từ key này đến key kế tiếp</span>
    <Select size="sm" value={keyframe.easing} options={[
      { value: 'smooth', label: 'Mượt · Spline' }, { value: 'linear', label: 'Đều · Linear' },
      { value: 'ease-in', label: 'Tăng tốc · Ease In' }, { value: 'ease-out', label: 'Giảm tốc · Ease Out' },
      { value: 'ease-in-out', label: 'Tăng / giảm tốc · Ease In/Out' },
      { value: 'hold', label: 'Giữ tư thế · Hold' }, { value: 'bezier', label: 'Tùy chỉnh · Cubic Bezier' }
    ]} onChange={(v) => onChange({ easing: v as BoneKeyframe['easing'], bezier: v === 'bezier' ? curve : undefined })} />
    {keyframe.easing === 'bezier' && <>
      <svg className="lw-bezier-preview" viewBox="0 0 140 92" role="img" aria-label="Đường cong nội suy Bezier">
        <path d="M10 18V74H130" className="lw-bezier-axis" />
        <polyline points={points} className="lw-bezier-curve" />
      </svg>
      <div className="lw-rig-grid">{(['X1', 'Y1', 'X2', 'Y2'] as const).map((label, i) =>
        <RigNumber key={label} label={label} value={curve[i]} step={0.05}
          min={i % 2 === 0 ? 0 : undefined} max={i % 2 === 0 ? 1 : undefined}
          onChange={(v) => { const next = [...curve] as typeof curve; next[i] = v; onChange({ bezier: next }) }} />)}
      </div>
      <p>Y ngoài khoảng 0–1 tạo đà hoặc độ nảy. X điều chỉnh nhịp thời gian.</p>
    </>}
  </div>
}
