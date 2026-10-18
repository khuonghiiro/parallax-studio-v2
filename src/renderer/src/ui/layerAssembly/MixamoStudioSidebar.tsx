import { useId } from 'react'
import type { LayerBone, MotionViewAngle } from '@shared/layerRig'
import type { ProceduralMotionPreset } from './workshopRigPresets'
import { MOTION_PRESETS } from './workshopRigPresets'
import { MixamoMannequinPreview } from './MixamoMannequinPreview'
import { IconCamera, IconPlay, IconPlus, IconSettings } from '../icons'

export const VIEW_ANGLES: Array<{ id: MotionViewAngle; label: string; sub: string; degrees: string }> = [
  { id: 'front', label: 'Chính diện', sub: 'Nhìn thẳng', degrees: '0°' },
  { id: 'diagonal', label: 'Góc chéo', sub: 'Nghiêng 3/4', degrees: '45°' },
  { id: 'side', label: 'Góc ngang', sub: 'Nhìn bên', degrees: '90°' },
  { id: 'back', label: 'Sau lưng', sub: 'Quay lưng', degrees: '180°' }
]

export interface MixamoStudioSidebarProps {
  previewBones: LayerBone[]
  angle: MotionViewAngle
  onAngle: (a: MotionViewAngle) => void
  preset: ProceduralMotionPreset | 'blank'
  onPreset: (p: ProceduralMotionPreset | 'blank') => void
  name: string
  onName: (v: string) => void
  duration: number
  onDuration: (v: number) => void
  loop: boolean
  onLoop: (v: boolean) => void
  autoBindSoft: boolean
  onAutoBindSoft: (v: boolean) => void
}

function AnglePicker({ angle, onAngle }: Pick<MixamoStudioSidebarProps, 'angle' | 'onAngle'>) {
  return (
    <section className="mx-card" data-mcp-region="layer_assembly_mixamo_angles">
      <header className="mx-card-head">
        <span className="mx-card-title"><IconCamera width={13} height={13} /> Góc nhìn nhân vật</span>
        <span className="mx-card-hint">Tự đổi biên độ sải tay & chân</span>
      </header>
      <div className="mx-angle-grid" role="radiogroup" aria-label="Góc nhìn">
        {VIEW_ANGLES.map((a) => (
          <button key={a.id} type="button" role="radio" aria-checked={angle === a.id} className={`mx-angle${angle === a.id ? ' active' : ''}`}
            onClick={() => onAngle(a.id)} title={`${a.label} · ${a.sub}`}>
            <span className="mx-angle-deg">{a.degrees}</span>
            <span className="mx-angle-label">{a.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function PresetPicker({ preset, onPreset }: Pick<MixamoStudioSidebarProps, 'preset' | 'onPreset'>) {
  return (
    <section className="mx-card mx-card-grow" data-mcp-region="layer_assembly_mixamo_presets">
      <header className="mx-card-head">
        <span className="mx-card-title"><IconPlay width={12} height={12} /> Thư viện động tác</span>
        <span className="mx-card-hint">{MOTION_PRESETS.length} mẫu chuẩn</span>
      </header>
      <div className="mx-preset-grid">
        {MOTION_PRESETS.map((p) => (
          <button key={p.id} type="button" className={`mx-preset${preset === p.id ? ' active' : ''}`} onClick={() => onPreset(p.id)} title={p.name}>
            <span className="mx-preset-icon" aria-hidden="true">{p.icon}</span>
            <span className="mx-preset-text">
              <span className="mx-preset-name">{p.name.split(' (')[0]}</span>
              <span className="mx-preset-meta">{p.duration}s</span>
            </span>
          </button>
        ))}
        <button type="button" className={`mx-preset blank${preset === 'blank' ? ' active' : ''}`} onClick={() => onPreset('blank')} title="Tạo clip trống để tự diễn hoạt">
          <span className="mx-preset-icon" aria-hidden="true"><IconPlus width={13} height={13} /></span>
          <span className="mx-preset-text">
            <span className="mx-preset-name">Tạo trống</span>
            <span className="mx-preset-meta">Tự diễn hoạt</span>
          </span>
        </button>
      </div>
    </section>
  )
}

function ClipSettings(props: MixamoStudioSidebarProps) {
  const nameId = useId()
  const durationId = useId()
  return (
    <section className="mx-card" data-mcp-region="layer_assembly_mixamo_settings">
      <header className="mx-card-head">
        <span className="mx-card-title"><IconSettings width={13} height={13} /> Thông số clip</span>
      </header>
      <div className="mx-form-grid">
        <label className="mx-field" htmlFor={nameId}>
          <span>Tên động tác</span>
          <input id={nameId} className="lw-input" value={props.name} onChange={(e) => props.onName(e.target.value)} />
        </label>
        <label className="mx-field" htmlFor={durationId}>
          <span>Thời lượng (giây)</span>
          <input id={durationId} className="lw-input" type="number" step={0.1} min={0.2} max={60} value={props.duration}
            onChange={(e) => props.onDuration(Number(e.target.value))} />
        </label>
      </div>
      <div className="mx-checks">
        <label className="mx-check"><input type="checkbox" checked={props.loop} onChange={(e) => props.onLoop(e.target.checked)} /> Lặp chu kỳ</label>
        <label className="mx-check"><input type="checkbox" checked={props.autoBindSoft} onChange={(e) => props.onAutoBindSoft(e.target.checked)} /> Tự gắn lưới uốn mềm (Mesh 2D)</label>
      </div>
    </section>
  )
}

/** Cột phải Studio Mixamo: xem thử khung xương, góc nhìn, thư viện động tác, thông số clip. */
export function MixamoStudioSidebar(props: MixamoStudioSidebarProps) {
  return (
    <aside className="mx-side" data-mcp-region="layer_assembly_mixamo_sidebar" aria-label="Xem thử và chọn động tác">
      <div className="mx-preview-card" data-mcp-region="layer_assembly_mixamo_preview">
        <MixamoMannequinPreview preset={props.preset} viewAngle={props.angle} duration={props.duration} customBones={props.previewBones} height={190} />
      </div>
      <AnglePicker angle={props.angle} onAngle={props.onAngle} />
      <PresetPicker preset={props.preset} onPreset={props.onPreset} />
      <ClipSettings {...props} />
    </aside>
  )
}
