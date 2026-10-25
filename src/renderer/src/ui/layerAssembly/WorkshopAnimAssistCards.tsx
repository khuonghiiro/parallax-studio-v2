import { useState } from 'react'
import type { LayerRig } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { setAnimAssist, useAnimAssist } from './animAssistStore'
import {
  DEFAULT_SECONDARY,
  SECONDARY_PRESETS,
  bakeSecondaryMotion,
  secondaryBoneIds,
  type SecondaryMotionSettings
} from './workshopSecondaryMotion'
import '../../styles/layerWorkshopAnimAssist.css'

function Slider({ label, value, min, max, step, unit = '', onChange, hint }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string; hint?: string; onChange: (v: number) => void
}) {
  return (
    <label className="lw-assist-slider" title={hint}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{value}{unit}</output>
    </label>
  )
}

function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: Array<[T, string, string?]>; onChange: (v: T) => void }) {
  return (
    <div className="lw-assist-seg">
      {options.map(([v, label, hint]) => (
        <button key={String(v)} type="button" title={hint} className={value === v ? 'active' : ''} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  )
}

/** Thẻ "Công cụ dựng chuyển động": IK, Onion skin, Quỹ đạo — bật/tắt nhanh cũng có trên thanh nổi (I / O / P). */
export function WorkshopAnimAssistCard() {
  const a = useAnimAssist()
  return (
    <div className="lw-card-section lw-anim-assist-card">
      <div className="lw-card-header"><span className="lw-card-title">🦾 Công cụ tạo dáng chuyên nghiệp</span></div>
      <div className="lw-assist-row">
        <span className="lw-assist-label">IK kéo ngọn (I)</span>
        <Segmented value={a.ik ? 'on' : 'off'} options={[['on', 'Bật'], ['off', 'Tắt (FK)']]} onChange={(v) => setAnimAssist({ ik: v === 'on' })} />
      </div>
      {a.ik && (
        <div className="lw-assist-row">
          <span className="lw-assist-label">Chuỗi IK</span>
          <Segmented value={a.ikChain} options={[[2, '2 xương', 'Cẳng tay + bắp tay'], [3, '3 xương', 'Bàn tay + cẳng tay + bắp tay'], [4, '4 xương', 'Chuỗi dài: đuôi, tóc, rắn']]} onChange={(v) => setAnimAssist({ ikChain: v })} />
        </div>
      )}
      <div className="lw-assist-row">
        <span className="lw-assist-label">Onion skin (O)</span>
        <Segmented value={a.onion ? 'on' : 'off'} options={[['on', 'Bật'], ['off', 'Tắt']]} onChange={(v) => setAnimAssist({ onion: v === 'on' })} />
      </div>
      {a.onion && (
        <>
          <Slider label="Số bóng mỗi phía" value={a.onionCount} min={1} max={5} step={1} onChange={(onionCount) => setAnimAssist({ onionCount })} />
          <Slider label="Cách nhau" value={a.onionStep} min={0.03} max={0.5} step={0.01} unit="s" onChange={(onionStep) => setAnimAssist({ onionStep })} />
        </>
      )}
      <div className="lw-assist-row">
        <span className="lw-assist-label">Quỹ đạo (P)</span>
        <Segmented value={a.path ? 'on' : 'off'} options={[['on', 'Bật'], ['off', 'Tắt']]} onChange={(v) => setAnimAssist({ path: v === 'on' })} />
      </div>
      <p className="lw-assist-hint">
        Kéo <strong>ngọn</strong> xương để IK (Ctrl khi kéo = chỉ xoay 1 xương), kéo <strong>thân</strong> để xoay, kéo <strong>khớp gốc</strong> để dời.
        Mỗi lần thả chuột tự ghi key tại đầu phát. Bóng vàng = trước, xanh = sau; hình thoi trên quỹ đạo = keyframe.
      </p>
    </div>
  )
}

/** Thẻ "Chuyển động thứ cấp (vật lý)": tóc, đuôi, vải tự trễ và nảy theo xương cha, nướng thành keyframe. */
export function WorkshopSecondaryMotionCard({ rig, boneId, setComposite, onDone }: {
  rig: LayerRig
  boneId: string | null
  setComposite: (update: (prev: LayerComposite) => LayerComposite) => void
  onDone?: () => void
}) {
  const [s, setS] = useState<SecondaryMotionSettings>(DEFAULT_SECONDARY)
  const [result, setResult] = useState('')
  const bone = rig.bones.find((b) => b.id === boneId)
  const ids = bone ? secondaryBoneIds(rig, bone.id, s.includeRoot) : []
  const patch = (p: Partial<SecondaryMotionSettings>) => setS((prev) => ({ ...prev, ...p }))
  const bake = () => {
    if (!bone) return
    try {
      let summary = ''
      setComposite((c) => {
        const r = bakeSecondaryMotion(c, bone.id, s)
        summary = `✓ Đã nướng vật lý cho ${r.boneIds.length} xương · ${r.keyCount} keyframe · Ctrl+Z để hoàn tác`
        return r.composite
      })
      setResult(summary)
      onDone?.()
    } catch (err) {
      setResult(`Lỗi: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return (
    <div className="lw-card-section lw-secondary-card">
      <div className="lw-card-header"><span className="lw-card-title">🌊 Chuyển động thứ cấp (vật lý)</span></div>
      <p className="lw-assist-hint">Chọn xương gốc của nhánh tóc / đuôi / vải. Sau khi đã có động tác chính, bấm nướng: nhánh tự trễ nhịp và nảy theo quán tính.</p>
      <div className="lw-secondary-target">{bone ? `Nhánh: ${bone.name} → ${ids.length} xương` : 'Chưa chọn xương'}</div>
      <div className="lw-assist-row">
        <Segmented
          value={SECONDARY_PRESETS.find((p) => p.settings.stiffness === s.stiffness && p.settings.damping === s.damping)?.id ?? 'custom'}
          options={SECONDARY_PRESETS.map((p) => [p.id, p.label] as [string, string])}
          onChange={(id) => { const p = SECONDARY_PRESETS.find((x) => x.id === id); if (p) patch(p.settings) }}
        />
      </div>
      <Slider label="Độ cứng" value={s.stiffness} min={0} max={1} step={0.05} hint="Cứng = bật về nhanh, ít trễ" onChange={(stiffness) => patch({ stiffness })} />
      <Slider label="Giảm chấn" value={s.damping} min={0} max={1} step={0.05} hint="Cao = ít nảy qua lại" onChange={(damping) => patch({ damping })} />
      <Slider label="Cường độ" value={s.strength} min={0} max={2} step={0.05} hint="Nhân độ lệch quán tính" onChange={(strength) => patch({ strength })} />
      <Slider label="Góc tối đa" value={s.maxAngle} min={5} max={120} step={1} unit="°" onChange={(maxAngle) => patch({ maxAngle })} />
      <Slider label="Lực gió (Wind)" value={s.windSpeed ?? 0} min={-2} max={2} step={0.1} hint="Lực gió thổi ngang (Spine 4.2 Physics / SpringBone)" onChange={(windSpeed) => patch({ windSpeed })} />
      <Slider label="Nhiễu gió" value={s.windTurbulence ?? 0.3} min={0} max={1} step={0.05} hint="Độ phập phồng tự nhiên của luồng gió" onChange={(windTurbulence) => patch({ windTurbulence })} />
      <Slider label="Trọng lực" value={s.gravity ?? 0} min={-1} max={1} step={0.05} hint="Trọng lực kéo rủ xuống (+) hoặc bay lên (-)" onChange={(gravity) => patch({ gravity })} />
      <label className="lw-rig-check">
        <input type="checkbox" checked={s.includeRoot} onChange={(e) => patch({ includeRoot: e.target.checked })} />
        <span>Tính cả xương đang chọn</span>
      </label>
      <div className="lw-rig-actions">
        <button type="button" className="btn sm primary" disabled={!bone || !ids.length} onClick={bake}>🌊 Nướng vật lý cho nhánh</button>
      </div>
      {result && <div className="lw-secondary-result" role="status">{result}</div>}
    </div>
  )
}
