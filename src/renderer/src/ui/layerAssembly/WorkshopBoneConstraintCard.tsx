import type { LayerBone } from '@shared/layerRig'
import { CLEAR_ANGLE_LIMIT, hasAngleLimit, JOINT_LIMIT_PRESETS } from './boneConstraints'
import { IconJointLimitArc } from './LayerWorkshopStudioIcons'
import '../../styles/layerWorkshopCreatureRig.css'

export interface WorkshopBoneConstraintCardProps {
  bone: LayerBone
  patch: (patch: Partial<LayerBone>) => void
}

const rad = (deg: number) => (deg * Math.PI) / 180

/** Đường cung SVG quanh tâm (cx, cy) từ góc a0 tới a1 (độ, Y hướng xuống, thuận chiều kim đồng hồ). */
export function describeArc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const span = Math.max(0, Math.min(359.9, a1 - a0))
  const p0 = { x: cx + Math.cos(rad(a0)) * r, y: cy + Math.sin(rad(a0)) * r }
  const p1 = { x: cx + Math.cos(rad(a0 + span)) * r, y: cy + Math.sin(rad(a0 + span)) * r }
  return `M${cx} ${cy} L${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`
}

function LimitDial({ bone }: { bone: LayerBone }) {
  const limited = hasAngleLimit(bone)
  const a = bone.angle
  const tip = { x: 36 + Math.cos(rad(a)) * 28, y: 36 + Math.sin(rad(a)) * 28 }
  return (
    <svg className="lw-joint-limit-dial" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx={36} cy={36} r={30} className="lw-joint-limit-ring" />
      {limited ? (
        <path d={describeArc(36, 36, 30, a + (bone.minAngle as number), a + (bone.maxAngle as number))} className="lw-joint-limit-wedge" />
      ) : (
        <circle cx={36} cy={36} r={30} className="lw-joint-limit-wedge free" />
      )}
      <line x1={36} y1={36} x2={tip.x} y2={tip.y} className="lw-joint-limit-bone" />
      <circle cx={36} cy={36} r={3.5} className="lw-joint-limit-pivot" />
    </svg>
  )
}

/** Giới hạn góc xoay khớp chuẩn Adobe Animate (Joint › Constrain Rotation) & Moho (Angle Constraints). */
export function WorkshopBoneConstraintCard({ bone, patch }: WorkshopBoneConstraintCardProps) {
  const limited = hasAngleLimit(bone)
  const min = limited ? (bone.minAngle as number) : -45
  const max = limited ? (bone.maxAngle as number) : 45
  const activePreset = JOINT_LIMIT_PRESETS.find((p) => (p.range ? limited && p.range[0] === min && p.range[1] === max : !limited))?.id
  const setRange = (nextMin: number, nextMax: number) => {
    if (!Number.isFinite(nextMin) || !Number.isFinite(nextMax)) return
    const lo = Math.max(-360, Math.min(360, Math.min(nextMin, nextMax)))
    const hi = Math.max(-360, Math.min(360, Math.max(nextMin, nextMax)))
    patch({ minAngle: Math.round(lo), maxAngle: Math.round(hi) })
  }
  return (
    <div className="lw-joint-limit-card" data-mcp-region="layer_assembly_bone_constraints">
      <div className="lw-joint-limit-head">
        <span className="lw-joint-limit-title">
          <IconJointLimitArc width={13} height={13} /> Giới hạn góc khớp
        </span>
        <span className={`lw-card-badge${limited ? ' is-on' : ''}`}>{limited ? `${min}° … ${max}°` : 'Xoay tự do'}</span>
      </div>
      <div className="lw-joint-limit-body">
        <LimitDial bone={bone} />
        <div className="lw-joint-limit-fields">
          <label>
            <span className="lw-creature-option-label">Min (°)</span>
            <input type="number" className="lw-field-input" min={-360} max={360} value={min} onChange={(e) => setRange(e.target.valueAsNumber, max)} />
          </label>
          <label>
            <span className="lw-creature-option-label">Max (°)</span>
            <input type="number" className="lw-field-input" min={-360} max={360} value={max} onChange={(e) => setRange(min, e.target.valueAsNumber)} />
          </label>
        </div>
      </div>
      <div className="lw-creature-pills lw-joint-limit-presets" role="radiogroup" aria-label="Mẫu giới hạn khớp">
        {JOINT_LIMIT_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={activePreset === p.id}
            title={p.hint}
            className={`lw-creature-pill${activePreset === p.id ? ' active' : ''}`}
            onClick={() => (p.range ? setRange(p.range[0], p.range[1]) : patch({ ...CLEAR_ANGLE_LIMIT }))}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="lw-joint-limit-hint">Góc tính từ dáng gốc Frame 0, dương = theo chiều kim đồng hồ. IK, xoay FK và công cụ Thử khớp (Z) đều dừng tại giới hạn.</p>
    </div>
  )
}
