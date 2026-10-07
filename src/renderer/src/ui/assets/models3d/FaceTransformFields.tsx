import type { Face3D } from './types'
import { NumberInput } from '../../controls'

type Vec3 = [number, number, number]

interface FaceTransformFieldsProps {
  face: Face3D
  onUpdate: (patch: Partial<Face3D>) => void
}

const AXES = ['x', 'y', 'z'] as const

const ROTATION_ROWS: { axis: 0 | 1 | 2; label: string; title: string }[] = [
  { axis: 0, label: 'Nghiêng', title: 'Xoay quanh trục X (Pitch) – ngả mặt phẳng ra trước / sau' },
  { axis: 1, label: 'Quay', title: 'Xoay quanh trục Y (Yaw) – quay mặt phẳng sang trái / phải' },
  { axis: 2, label: 'Lật', title: 'Xoay quanh trục Z (Roll) – lật nghiêng trong mặt phẳng' }
]

const ANGLE_PRESETS: { label: string; title: string; apply: (r: Vec3) => Vec3 }[] = [
  { label: '0°', title: 'Đặt lại góc xoay về 0°', apply: () => [0, 0, 0] },
  { label: 'Y +90°', title: 'Quay vuông góc sang phải (Y = 90°)', apply: (r) => [r[0], 90, r[2]] },
  { label: 'Y −90°', title: 'Quay vuông góc sang trái (Y = −90°)', apply: (r) => [r[0], -90, r[2]] },
  { label: 'X +45°', title: 'Ngả về sau 45° (X = 45°)', apply: (r) => [45, r[1], r[2]] },
  { label: 'X −45°', title: 'Ngả về trước 45° (X = −45°)', apply: (r) => [-45, r[1], r[2]] },
  { label: 'Nằm phẳng', title: 'Đặt nằm ngang song song mặt sàn (X = −90°)', apply: () => [-90, 0, 0] }
]

function withAxis(v: Vec3, axis: number, value: number): Vec3 {
  const next = [...v] as Vec3
  next[axis] = value
  return next
}

/** Size, position, rotation and quick alignment for one assembly face (AE-style fields). */
export function FaceTransformFields({ face, onUpdate }: FaceTransformFieldsProps) {
  const pos = face.position
  const rot = face.rotation
  const alignments: { label: string; title: string; patch: () => Partial<Face3D> }[] = [
    { label: 'Mép trái', title: 'Đặt X = −W/2', patch: () => ({ position: withAxis(pos, 0, -Math.round(face.width / 2)) }) },
    { label: 'X = 0', title: 'Căn giữa theo trục X', patch: () => ({ position: withAxis(pos, 0, 0) }) },
    { label: 'Mép phải', title: 'Đặt X = +W/2', patch: () => ({ position: withAxis(pos, 0, Math.round(face.width / 2)) }) },
    { label: 'Y = 0', title: 'Đặt cao độ về mặt sàn (Y = 0)', patch: () => ({ position: withAxis(pos, 1, 0) }) },
    {
      label: 'Đối xứng X',
      title: 'Lật sang phía đối diện qua trục X (đảo X và góc Y, Z)',
      patch: () => ({ position: [-pos[0], pos[1], pos[2]], rotation: [rot[0], -rot[1], -rot[2]] })
    }
  ]

  return (
    <>
      <div className="fi-group">
        <span className="fi-group-label">Kích thước</span>
        <div className="fi-grid-2">
          <NumberInput axis="W" value={face.width} step={1} precision={0} min={1}
            onChange={(v) => onUpdate({ width: Math.round(v) })} />
          <NumberInput axis="H" value={face.height} step={1} precision={0} min={1}
            onChange={(v) => onUpdate({ height: Math.round(v) })} />
        </div>
      </div>

      <div className="fi-group">
        <span className="fi-group-label">Vị trí</span>
        <div className="fi-grid-3">
          {AXES.map((a, i) => (
            <NumberInput key={a} axis={a} value={pos[i]} step={1} precision={0}
              onChange={(v) => onUpdate({ position: withAxis(pos, i, Math.round(v)) })} />
          ))}
        </div>
      </div>

      <div className="fi-group">
        <span className="fi-group-label">Xoay (°)</span>
        {ROTATION_ROWS.map(({ axis, label, title }) => (
          <div key={axis} className="fi-rot-row" title={title}>
            <span className={`fi-axis-dot axis-${AXES[axis]}`}>{AXES[axis].toUpperCase()}</span>
            <span className="fi-rot-label">{label}</span>
            <input type="range" min={-180} max={180} step={1} value={rot[axis]}
              className={`fi-range axis-${AXES[axis]}`}
              onChange={(e) => onUpdate({ rotation: withAxis(rot, axis, Number(e.target.value)) })} />
            <div className="fi-rot-num">
              <NumberInput value={rot[axis]} step={1} precision={0} min={-180} max={180} suffix="°"
                onChange={(v) => onUpdate({ rotation: withAxis(rot, axis, Math.round(v)) })} />
            </div>
          </div>
        ))}
        <div className="fi-chip-grid">
          {ANGLE_PRESETS.map((p) => (
            <button key={p.label} type="button" className="fi-chip" title={p.title}
              onClick={() => onUpdate({ rotation: p.apply(rot) })}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="fi-group">
        <span className="fi-group-label">Căn chỉnh nhanh</span>
        <div className="fi-chip-grid">
          {alignments.map((a) => (
            <button key={a.label} type="button" className="fi-chip" title={a.title} onClick={() => onUpdate(a.patch())}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
