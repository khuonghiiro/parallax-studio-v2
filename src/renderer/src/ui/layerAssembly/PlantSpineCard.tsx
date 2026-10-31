import { useEffect, useState } from 'react'
import { PLANT_SPINE_PRESETS, type PlantSpine } from '@shared/plantSpine'
import type { LayerComposite } from './types'
import {
  resamplePlantSpinePoints,
  setPlantSpineJointCount,
  subdividePlantSpine,
  type PlantSpineAction
} from './workshopPlantSpines'
import { setPlantSpineEditorState } from './plantSpineEditorStore'
import { PlantMotionSection } from './PlantMotionSection'

type NumKey =
  | 'amplitude'
  | 'speed'
  | 'stiffness'
  | 'flexibility'
  | 'turbulence'
  | 'lean'
  | 'phaseOffset'
  | 'reach'
  | 'verticalBob'
type SliderDef = { key: NumKey; label: string; min: number; max: number; step: number; unit?: string; hint: string }
type Patch = (p: Partial<PlantSpine>, key?: string) => void

const PRIMARY_SLIDERS: SliderDef[] = [
  { key: 'amplitude', label: 'Biên độ uốn', min: 0, max: 40, step: 0.5, unit: '°', hint: 'Góc uốn tối đa tại ngọn khi đung đưa vòng cung' },
  { key: 'speed', label: 'Nhịp gió', min: 0.05, max: 3, step: 0.05, unit: '/s', hint: 'Số nhịp đung đưa mỗi giây' },
  { key: 'lean', label: 'Độ nghiêng gió', min: -30, max: 30, step: 0.5, unit: '°', hint: 'Góc tạt nghiêng cố định theo chiều gió (- trái · + phải)' },
  { key: 'verticalBob', label: 'Nhún dọc thân', min: 0, max: 0.6, step: 0.02, unit: '', hint: 'Độ co giãn & nhún dọc thân khi gió dập (Squash & Stretch)' },
  { key: 'phaseOffset', label: 'Độ trễ pha', min: 0, max: 3, step: 0.05, unit: 's', hint: 'Lệch nhịp giữa các cành/bụi cây để chuyển động tự nhiên' }
]

const SECONDARY_SLIDERS: SliderDef[] = [
  { key: 'stiffness', label: 'Độ cứng gốc', min: 0, max: 1, step: 0.05, hint: '0 = cả thân uốn mềm · 1 = gốc đứng vững, chỉ ngọn cong' },
  { key: 'flexibility', label: 'Độ dẻo ngọn', min: 0, max: 1, step: 0.05, hint: 'Ngọn lá / đuôi tóc phất thêm sóng phụ mềm mại' },
  { key: 'turbulence', label: 'Độ giật gió', min: 0, max: 1, step: 0.05, hint: 'Biến thiên ngẫu nhiên lúc gió lặng lúc gió dồn' },
  { key: 'reach', label: 'Bán kính uốn', min: 0, max: 400, step: 5, unit: 'px', hint: '0 = uốn toàn bộ layer · >0 = chỉ uốn vùng quanh trục' }
]

function SliderList({ spine, defs, patch }: { spine: PlantSpine; defs: SliderDef[]; patch: Patch }) {
  return (
    <div className="lw-plant-sliders">
      {defs.map((s) => {
        const value = (spine[s.key] as number | undefined) ?? 0
        return (
          <label key={s.key} className="lw-plant-slider" title={s.hint}>
            <span className="lw-plant-slider-label">{s.label}</span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={value}
              onChange={(e) => patch({ [s.key]: Number(e.target.value) }, `plant:${spine.id}:${s.key}`)}
            />
            <span className="lw-plant-slider-val">
              {value}
              {s.unit ?? ''}
            </span>
          </label>
        )
      })}
    </div>
  )
}

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
        <span className="lw-plant-section-label">Đốt uốn dọc trục</span>
        <div className="lw-plant-joint-stepper">
          <button
            type="button"
            className="lw-plant-stepper-btn"
            onClick={() => commit(n - 1)}
            disabled={n <= 2}
            title="Giảm 1 đốt uốn (tối thiểu 2)"
          >
            −
          </button>
          <input
            type="number"
            min={2}
            max={32}
            className="lw-plant-joint-input"
            value={jointInput}
            aria-label="Số lượng đốt uốn"
            title="Nhập trực tiếp số đốt uốn (2 - 32) rồi nhấn Enter"
            onChange={(e) => setJointInput(e.target.value)}
            onBlur={() => commit(Number(jointInput) || n)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commit(Number(jointInput) || n)
                e.currentTarget.blur()
              }
            }}
          />
          <span className="lw-plant-joint-unit">đốt</span>
          <button
            type="button"
            className="lw-plant-stepper-btn"
            onClick={() => commit(n + 1)}
            disabled={n >= 32}
            title="Tăng 1 đốt uốn (tối đa 32)"
          >
            +
          </button>
        </div>
      </div>
      <div className="lw-plant-joint-presets">
        <span className="lw-plant-joint-presets-label">Mật độ:</span>
        {[3, 5, 8, 12, 16].map((cnt) => (
          <button
            key={cnt}
            type="button"
            className={`lw-plant-joint-preset-chip${n === cnt ? ' active' : ''}`}
            onClick={() => commit(cnt)}
            title={`Chia đều trục thành ${cnt} đốt uốn`}
          >
            {cnt}
          </button>
        ))}
        <button
          type="button"
          className="lw-plant-joint-preset-chip"
          onClick={() => patch({ points: subdividePlantSpine(spine.points) })}
          title="Nhân đôi số đốt uốn để đường cong mịn hơn"
        >
          ×2
        </button>
        <button
          type="button"
          className="lw-plant-joint-preset-chip"
          onClick={() => patch({ points: resamplePlantSpinePoints(spine.points, 55) })}
          title="Phân bố lại các đốt cách đều ~55px"
        >
          Đều
        </button>
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
        <span className="lw-plant-section-label">
          Lớp gắn theo trục ({spine.layerIds.length}/{composite.layers.length})
        </span>
        {spine.layerIds.length < composite.layers.length && (
          <button
            type="button"
            className="lw-plant-mini-link"
            onClick={() => patch({ layerIds: composite.layers.map((l) => l.id) })}
          >
            Gắn tất cả
          </button>
        )}
      </div>
      <div className="lw-plant-chips">
        {composite.layers.map((l, idx) => (
          <button
            key={l.id}
            type="button"
            className={`lw-plant-chip${spine.layerIds.includes(l.id) ? ' active' : ''}`}
            onClick={() => toggle(l.id)}
            title={spine.layerIds.includes(l.id) ? 'Bỏ gắn lớp này' : 'Gắn lớp này vào trục gió'}
          >
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
        <div className="lw-plant-section-label">
          Biên độ &amp; Nhịp gió{spine.motion ? ' (áp khi Hòa trộn gió > 0)' : ''}
        </div>
        <SliderList spine={spine} defs={PRIMARY_SLIDERS} patch={patch} />
      </div>
      <div className="lw-plant-group-box">
        <div className="lw-plant-section-label">Độ dẻo thân &amp; Gió giật</div>
        <SliderList spine={spine} defs={SECONDARY_SLIDERS} patch={patch} />
      </div>
      <div className="lw-plant-group-box">
        <div className="lw-plant-section-label">Đặc tính vật chất mẫu</div>
        <div className="lw-plant-chips">
          {PLANT_SPINE_PRESETS.map((p) => (
            <button key={p.id} type="button" className="lw-plant-chip" onClick={() => patch(p.params)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <LayerBindBox spine={spine} composite={composite} patch={patch} />
    </>
  )
}

function CardHead({
  spine,
  index,
  patch,
  run
}: {
  spine: PlantSpine
  index: number
  patch: Patch
  run: (a: PlantSpineAction, key?: string) => void
}) {
  return (
    <div className="lw-plant-card-head">
      <span className="lw-plant-index-badge">#{index + 1}</span>
      <input
        className="lw-plant-name"
        value={spine.name}
        onChange={(e) => patch({ name: e.target.value }, `plant:${spine.id}:name`)}
        aria-label="Tên trục gió"
      />
      <label className="lw-plant-toggle" title="Bật/tắt hiệu ứng gió của trục này">
        <input
          type="checkbox"
          checked={spine.enabled !== false}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        <span>Bật</span>
      </label>
      <button
        type="button"
        className="btn xs lw-muted-danger-btn lw-plant-del-btn"
        title="Xoá trục gió này"
        onClick={(e) => {
          e.stopPropagation()
          run({ action: 'delete', id: spine.id })
        }}
      >
        Xoá
      </button>
    </div>
  )
}

/** Thẻ cấu hình một trục gió: đốt uốn, thông số vật lý gió hoặc đồ thị quỹ đạo riêng. */
export function PlantSpineCard({
  spine,
  index,
  composite,
  selected,
  run
}: {
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
    <div
      className={`lw-plant-card${selected ? ' selected' : ''}`}
      onClick={() => setPlantSpineEditorState({ selectedSpineId: spine.id })}
    >
      <CardHead spine={spine} index={index} patch={patch} run={run} />
      {!selected && (
        <div className="lw-plant-card-summary">
          <span>
            {spine.motion
              ? `Quỹ đạo riêng (${spine.motion.duration}s)`
              : `±${spine.amplitude}° · ${spine.speed}/s${spine.lean ? ` · nghiêng ${spine.lean > 0 ? '+' : ''}${spine.lean}°` : ''}`}
          </span>
          <span>· {spine.points.length} đốt · {spine.layerIds.length} lớp</span>
          <span className="lw-plant-expand-hint">Mở ▾</span>
        </div>
      )}
      {selected && (
        <div className="lw-plant-card-body" onClick={(e) => e.stopPropagation()}>
          <div className="lw-plant-card-tabs">
            <button
              type="button"
              className={`lw-plant-card-tab${subTab === 'wind' ? ' active' : ''}`}
              onClick={() => setSubTab('wind')}
            >
              Thông số gió &amp; Độ dẻo
            </button>
            <button
              type="button"
              className={`lw-plant-card-tab${subTab === 'custom' ? ' active' : ''}`}
              onClick={() => setSubTab('custom')}
            >
              Quỹ đạo riêng {spine.motion ? '●' : ''}
            </button>
          </div>
          <JointBox spine={spine} patch={patch} />
          {subTab === 'wind' ? (
            <WindTab spine={spine} composite={composite} patch={patch} />
          ) : (
            <PlantMotionSection
              spine={spine}
              patch={patch}
              onApplyToOthers={
                others > 0 ? (stagger) => run({ action: 'copy-motion', id: spine.id, stagger }) : undefined
              }
            />
          )}
        </div>
      )}
    </div>
  )
}
