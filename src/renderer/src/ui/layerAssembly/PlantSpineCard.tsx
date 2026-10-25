import { useEffect, useState } from 'react'
import { PLANT_SPINE_PRESETS, type PlantSpine } from '@shared/plantSpine'
import type { LayerComposite } from './types'
import { resamplePlantSpinePoints, setPlantSpineJointCount, subdividePlantSpine, type PlantSpineAction } from './workshopPlantSpines'
import { setPlantSpineEditorState } from './plantSpineEditorStore'
import { PlantMotionSection } from './PlantMotionSection'

type NumKey = 'amplitude' | 'speed' | 'stiffness' | 'flexibility' | 'turbulence' | 'lean' | 'phaseOffset' | 'reach' | 'verticalBob'
type SliderDef = { key: NumKey; label: string; min: number; max: number; step: number; unit?: string; hint: string }
type Patch = (p: Partial<PlantSpine>, key?: string) => void

const PRIMARY_SLIDERS: SliderDef[] = [
  { key: 'amplitude', label: 'Biên độ uốn (cung)', min: 0, max: 40, step: 0.5, unit: '°', hint: 'Góc uốn tối đa tại ngọn khi đung đưa vòng cung' },
  { key: 'verticalBob', label: 'Nhún lên xuống', min: 0, max: 0.6, step: 0.02, unit: '', hint: 'Độ co giãn & nhún lên xuống theo chiều dọc thân cây (squash & stretch)' },
  { key: 'speed', label: 'Tốc độ nhịp', min: 0.05, max: 3, step: 0.05, unit: '/s', hint: 'Số nhịp đung đưa mỗi giây' },
  { key: 'lean', label: 'Nghiêng theo gió', min: -30, max: 30, step: 0.5, unit: '°', hint: 'Độ nghiêng cố định (dương = sang phải)' },
  { key: 'phaseOffset', label: 'Độ lệch pha', min: 0, max: 3, step: 0.05, unit: 's', hint: 'Cho nhiều cây đung đưa so le tự nhiên' }
]

const SECONDARY_SLIDERS: SliderDef[] = [
  { key: 'stiffness', label: 'Độ cứng thân', min: 0, max: 1, step: 0.05, hint: '0 = cả thân cong mềm · 1 = chỉ ngọn cong' },
  { key: 'flexibility', label: 'Rung ngọn phụ', min: 0, max: 1, step: 0.05, hint: 'Ngọn/lá phất thêm nhịp phụ' },
  { key: 'turbulence', label: 'Gió giật', min: 0, max: 1, step: 0.05, hint: 'Gió thổi thất thường, lúc mạnh lúc nhẹ' },
  { key: 'reach', label: 'Bán kính uốn', min: 0, max: 400, step: 5, unit: 'px', hint: '0 = toàn bộ layer uốn theo xương' }
]

function SliderList({ spine, defs, patch }: { spine: PlantSpine; defs: SliderDef[]; patch: Patch }) {
  return (
    <div className="lw-plant-sliders">
      {defs.map((s) => {
        const value = (spine[s.key] as number | undefined) ?? 0
        return (
          <label key={s.key} className="lw-plant-slider" title={s.hint}>
            <span className="lw-plant-slider-label">{s.label}</span>
            <input type="range" min={s.min} max={s.max} step={s.step} value={value}
              onChange={(e) => patch({ [s.key]: Number(e.target.value) }, `plant:${spine.id}:${s.key}`)} />
            <span className="lw-plant-slider-val">{value}{s.unit ?? ''}</span>
          </label>
        )
      })}
    </div>
  )
}

/** Quản lý số lượng & độ mịn khớp uốn (nhập trực tiếp, tăng giảm, mẫu nhanh, nhân đôi, giảm nửa, chia đều). */
function JointBox({ spine, patch }: { spine: PlantSpine; patch: Patch }) {
  const [jointInput, setJointInput] = useState<string>(String(spine.points.length))
  useEffect(() => setJointInput(String(spine.points.length)), [spine.points.length, spine.id])
  const commit = (target: number) => {
    const clamped = Math.max(2, Math.min(32, Math.round(target)))
    if (clamped !== spine.points.length) patch({ points: setPlantSpineJointCount(spine.points, clamped) })
    setJointInput(String(clamped))
  }
  const n = spine.points.length
  return (
    <div className="lw-plant-group-box">
      <div className="lw-plant-row-between">
        <span className="lw-plant-section-label">📍 Khớp uốn thân cây</span>
        <div className="lw-plant-joint-stepper">
          <button type="button" className="lw-plant-stepper-btn" onClick={() => commit(n - 1)} disabled={n <= 2} title="Giảm 1 khớp uốn (tối thiểu 2)">−</button>
          <input type="number" min={2} max={32} className="lw-plant-joint-input" value={jointInput} aria-label="Số lượng khớp uốn"
            title="Nhập trực tiếp số lượng khớp uốn (2 - 32 khớp) rồi nhấn Enter"
            onChange={(e) => setJointInput(e.target.value)} onBlur={() => commit(Number(jointInput) || n)}
            onKeyDown={(e) => { if (e.key === 'Enter') { commit(Number(jointInput) || n); e.currentTarget.blur() } }} />
          <span className="lw-plant-joint-unit">khớp</span>
          <button type="button" className="lw-plant-stepper-btn" onClick={() => commit(n + 1)} disabled={n >= 32} title="Tăng 1 khớp uốn (tối đa 32)">+</button>
        </div>
      </div>
      <div className="lw-plant-joint-presets">
        <span className="lw-plant-joint-presets-label">Mẫu nhanh:</span>
        {[3, 5, 8, 12, 16].map((cnt) => (
          <button key={cnt} type="button" className={`lw-plant-joint-preset-chip${n === cnt ? ' active' : ''}`} onClick={() => commit(cnt)} title={`Chia đều thành ${cnt} khớp`}>{cnt}</button>
        ))}
      </div>
      <div className="lw-plant-joint-bar">
        <button type="button" className="lw-plant-subdivide-btn" onClick={() => patch({ points: subdividePlantSpine(spine.points) })} title="Nhân đôi số khớp uốn (chèn trung điểm) để uốn nắn thân cây mượt mà hơn">➕ x2 khớp</button>
        <button type="button" className="lw-plant-subdivide-btn" onClick={() => commit(Math.max(2, Math.round(n / 2)))} disabled={n <= 2} title="Giảm nửa số khớp uốn để uốn nhanh đơn giản">➖ Giảm nửa</button>
        <button type="button" className="lw-plant-resample-btn" onClick={() => patch({ points: resamplePlantSpinePoints(spine.points, 55) })} title="Chia lại các khớp uốn cách đều nhau dọc thân cành cây (~55px/khớp)">📏 Chia đều</button>
      </div>
      <div className="lw-plant-joint-hint">
        💡 Nhập số hoặc bấm <b>+ / −</b> để điều chỉnh số lượng khớp · Rê chuột trên kẻ nhấn <b>+</b> để thêm · Hover điểm đỏ nhấn <b>−</b> hoặc <b>Del</b> để xoá
      </div>
    </div>
  )
}

function LayerBindBox({ spine, composite, patch }: { spine: PlantSpine; composite: LayerComposite; patch: Patch }) {
  const toggle = (id: string) => {
    const next = spine.layerIds.includes(id) ? spine.layerIds.filter((l) => l !== id) : [...spine.layerIds, id]
    if (next.length) patch({ layerIds: next })
  }
  return (
    <div className="lw-plant-group-box">
      <div className="lw-plant-row-between">
        <span className="lw-plant-section-label">Layer uốn theo xương ({spine.layerIds.length}/{composite.layers.length})</span>
        {spine.layerIds.length < composite.layers.length && (
          <button type="button" className="lw-plant-mini-link" onClick={() => patch({ layerIds: composite.layers.map((l) => l.id) })}>Gắn tất cả</button>
        )}
      </div>
      <div className="lw-plant-chips">
        {composite.layers.map((l, idx) => (
          <button key={l.id} type="button" className={`lw-plant-chip${spine.layerIds.includes(l.id) ? ' active' : ''}`} onClick={() => toggle(l.id)}
            title={spine.layerIds.includes(l.id) ? 'Bỏ gắn layer này' : 'Gắn layer này vào xương'}>
            #{idx + 1} {l.name}
          </button>
        ))}
      </div>
    </div>
  )
}

function WindTab({ spine, composite, patch }: { spine: PlantSpine; composite: LayerComposite; patch: Patch }) {
  return (
    <>
      <div className="lw-plant-group-box">
        <div className="lw-plant-section-label">🌬️ Nhịp &amp; Biên độ đung đưa{spine.motion ? ' (dùng khi Hoà trộn gió > 0)' : ''}</div>
        <SliderList spine={spine} defs={PRIMARY_SLIDERS} patch={patch} />
      </div>
      <div className="lw-plant-group-box">
        <div className="lw-plant-section-label">🌿 Độ dẻo thân &amp; Gió giật</div>
        <SliderList spine={spine} defs={SECONDARY_SLIDERS} patch={patch} />
      </div>
      <div className="lw-plant-group-box">
        <div className="lw-plant-section-label">Áp nhanh thông số mẫu</div>
        <div className="lw-plant-chips">
          {PLANT_SPINE_PRESETS.map((p) => (
            <button key={p.id} type="button" className="lw-plant-chip" onClick={() => patch(p.params)}>{p.label}</button>
          ))}
        </div>
      </div>
      <LayerBindBox spine={spine} composite={composite} patch={patch} />
    </>
  )
}

function CardHead({ spine, index, patch, run }: { spine: PlantSpine; index: number; patch: Patch; run: (a: PlantSpineAction, key?: string) => void }) {
  return (
    <div className="lw-plant-card-head">
      <span className="lw-plant-index-badge">#{index + 1}</span>
      <input className="lw-plant-name" value={spine.name} onChange={(e) => patch({ name: e.target.value }, `plant:${spine.id}:name`)} aria-label="Tên xương motion" />
      <label className="lw-plant-toggle" title="Bật/tắt chuyển động của xương này">
        <input type="checkbox" checked={spine.enabled !== false} onChange={(e) => patch({ enabled: e.target.checked })} />
        <span>Bật</span>
      </label>
      <button type="button" className="btn xs lw-plant-del-btn" title="Xoá xương chuyển động này"
        onClick={(e) => { e.stopPropagation(); run({ action: 'delete', id: spine.id }) }}>
        Xoá
      </button>
    </div>
  )
}

/** Thẻ một xương motion: tên, bật/tắt, khớp uốn, tab Gió & Độ uốn / Nhịp & Quỹ đạo riêng. */
export function PlantSpineCard({ spine, index, composite, selected, run }: {
  spine: PlantSpine
  index: number
  composite: LayerComposite
  selected: boolean
  run: (action: PlantSpineAction, key?: string) => void
}) {
  const [subTab, setSubTab] = useState<'wind' | 'custom'>(spine.motion ? 'custom' : 'wind')
  const patch: Patch = (p, key) => run({ action: 'update', id: spine.id, patch: p }, key)
  const others = (composite.plantSpines ?? []).length - 1
  return (
    <div className={`lw-plant-card${selected ? ' selected' : ''}`} onClick={() => setPlantSpineEditorState({ selectedSpineId: spine.id })}>
      <CardHead spine={spine} index={index} patch={patch} run={run} />
      {!selected && (
        <div className="lw-plant-card-summary">
          <span>{spine.motion ? `✨ Nhịp riêng (${spine.motion.duration}s)` : `🌬️ ±${spine.amplitude}°${(spine.verticalBob ?? 0) > 0 ? ` · nhún ${(spine.verticalBob! * 100).toFixed(0)}%` : ''} · ${spine.speed}/s`}</span>
          <span>• {spine.layerIds.length} layer</span>
          <span className="lw-plant-expand-hint">Bấm để chỉnh ▾</span>
        </div>
      )}
      {selected && (
        <div className="lw-plant-card-body" onClick={(e) => e.stopPropagation()}>
          <div className="lw-plant-card-tabs">
            <button type="button" className={`lw-plant-card-tab${subTab === 'wind' ? ' active' : ''}`} onClick={() => setSubTab('wind')}>🎛️ Gió &amp; Độ uốn</button>
            <button type="button" className={`lw-plant-card-tab${subTab === 'custom' ? ' active' : ''}`} onClick={() => setSubTab('custom')}>🎬 Nhịp &amp; Quỹ đạo {spine.motion ? '●' : ''}</button>
          </div>
          <JointBox spine={spine} patch={patch} />
          {subTab === 'wind' ? (
            <WindTab spine={spine} composite={composite} patch={patch} />
          ) : (
            <PlantMotionSection spine={spine} patch={patch}
              onApplyToOthers={others > 0 ? (stagger) => run({ action: 'copy-motion', id: spine.id, stagger }) : undefined} />
          )}
        </div>
      )}
    </div>
  )
}
