import { useState } from 'react'
import { PLANT_SPINE_PRESETS, type PlantSpine } from '@shared/plantSpine'
import type { LayerComposite } from './types'
import { applyPlantSpineAction, type PlantSpineAction, type PlantSpineTarget } from './workshopPlantSpines'
import { setPlantSpineEditorState, usePlantSpineEditor } from './plantSpineEditorStore'
import { PlantMotionSection } from './PlantMotionSection'
import '../../styles/layerWorkshopPlant.css'
import '../../styles/layerWorkshopPlantMotion.css'

interface PanelProps {
  composite: LayerComposite
  setComposite: (update: (prev: LayerComposite) => LayerComposite, key?: string) => void
  selectedIds: string[]
  isPlaying: boolean
  onTogglePlay: () => void
}

type NumKey = 'amplitude' | 'speed' | 'stiffness' | 'flexibility' | 'turbulence' | 'lean' | 'phaseOffset' | 'reach'

const SLIDERS: Array<{ key: NumKey; label: string; min: number; max: number; step: number; unit?: string; hint: string }> = [
  { key: 'amplitude', label: 'Biên độ uốn', min: 0, max: 40, step: 0.5, unit: '°', hint: 'Góc uốn tối đa tại ngọn' },
  { key: 'speed', label: 'Tốc độ', min: 0.05, max: 3, step: 0.05, unit: '/s', hint: 'Số nhịp đung đưa mỗi giây' },
  { key: 'stiffness', label: 'Độ cứng thân', min: 0, max: 1, step: 0.05, hint: '0 = cả thân cong mềm · 1 = chỉ ngọn cong' },
  { key: 'flexibility', label: 'Rung ngọn', min: 0, max: 1, step: 0.05, hint: 'Ngọn/lá phất thêm nhịp phụ' },
  { key: 'turbulence', label: 'Gió giật', min: 0, max: 1, step: 0.05, hint: 'Gió thổi thất thường, lúc mạnh lúc nhẹ' },
  { key: 'lean', label: 'Nghiêng theo gió', min: -30, max: 30, step: 0.5, unit: '°', hint: 'Độ nghiêng cố định (dương = sang phải)' },
  { key: 'phaseOffset', label: 'Lệch pha', min: 0, max: 3, step: 0.05, unit: 's', hint: 'Cho nhiều cây đung đưa so le' },
  { key: 'reach', label: 'Bán kính ảnh hưởng', min: 0, max: 400, step: 5, unit: 'px', hint: '0 = cả layer uốn theo xương' }
]

const TARGETS: Array<[PlantSpineTarget, string, string]> = [
  ['auto', 'Tự nhận theo nét vẽ', 'Gắn vào các layer mà nét vẽ đi qua (không cần chọn layer trước)'],
  ['selected', 'Layer đang chọn', 'Gắn vào các layer đang chọn ở tab Layer'],
  ['all', 'Toàn bộ layer', 'Gắn vào mọi layer (kể cả biến thể đang ẩn)']
]

function SpineCard({ spine, composite, selected, run }: {
  spine: PlantSpine
  composite: LayerComposite
  selected: boolean
  run: (action: PlantSpineAction, key?: string) => void
}) {
  const patch = (p: Partial<PlantSpine>, key?: string) => run({ action: 'update', id: spine.id, patch: p }, key)
  const toggleLayer = (id: string) => {
    const has = spine.layerIds.includes(id)
    const next = has ? spine.layerIds.filter((l) => l !== id) : [...spine.layerIds, id]
    if (next.length) patch({ layerIds: next })
  }
  return (
    <div className={`lw-plant-card${selected ? ' selected' : ''}`} onClick={() => setPlantSpineEditorState({ selectedSpineId: spine.id })}>
      <div className="lw-plant-card-head">
        <input
          className="lw-plant-name"
          value={spine.name}
          onChange={(e) => patch({ name: e.target.value }, `plant:${spine.id}:name`)}
          aria-label="Tên xương thực vật"
        />
        <label className="lw-plant-toggle" title="Bật/tắt chuyển động của xương này">
          <input type="checkbox" checked={spine.enabled !== false} onChange={(e) => patch({ enabled: e.target.checked })} />
          <span>Bật</span>
        </label>
        <button type="button" className="btn sm" title="Xoá xương" onClick={(e) => { e.stopPropagation(); run({ action: 'delete', id: spine.id }) }}>
          Xoá
        </button>
      </div>
      {selected && (
        <>
          <div className="lw-plant-section-label">Kiểu cây (áp nhanh thông số)</div>
          <div className="lw-plant-chips">
            {PLANT_SPINE_PRESETS.map((p) => (
              <button key={p.id} type="button" className="lw-plant-chip" onClick={() => patch(p.params)}>{p.label}</button>
            ))}
          </div>
          <div className="lw-plant-section-label">Layer uốn theo xương ({spine.layerIds.length})</div>
          <div className="lw-plant-chips">
            {composite.layers.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`lw-plant-chip${spine.layerIds.includes(l.id) ? ' active' : ''}`}
                onClick={() => toggleLayer(l.id)}
                title={spine.layerIds.includes(l.id) ? 'Bỏ gắn layer này' : 'Gắn layer này vào xương'}
              >
                {l.name}
              </button>
            ))}
          </div>
          <PlantMotionSection spine={spine} patch={patch} />
          <div className="lw-plant-section-label">
            🌬️ Gió tự nhiên{spine.motion ? ' (chỉ dùng khi Trộn gió > 0)' : ''}
          </div>
          <div className="lw-plant-sliders">
            {SLIDERS.map((s) => {
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
                  <span className="lw-plant-slider-val">{value}{s.unit ?? ''}</span>
                </label>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/** Tab "Thực vật": vẽ xương cong cho cây cỏ và chỉnh chuyển động đung đưa theo gió. */
export function WorkshopPlantPanel({ composite, setComposite, selectedIds, isPlaying, onTogglePlay }: PanelProps) {
  const editor = usePlantSpineEditor()
  const [error, setError] = useState('')
  const spines = composite.plantSpines ?? []
  const run = (action: PlantSpineAction, key?: string) => {
    try {
      setComposite((c) => applyPlantSpineAction(c, action), key)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="lw-plant-panel" id="layer-assembly-plant-panel">
      <div className="lw-plant-hint">
        🌿 <strong>Vẽ xương:</strong> kéo chuột trên <em>Bố cục 2D</em> từ <strong>GỐC</strong> lên <strong>NGỌN</strong> của cây.
        <ul>
          <li>✍️ <strong>Nắm vòng tròn ở ngọn</strong> kéo theo nhịp bạn muốn → app <strong>ghi lại đúng chuyển động</strong> và lặp lại. Hoặc bấm <kbd>R</kbd> rồi vẽ quỹ đạo ngọn ở bất kỳ đâu.</li>
          <li>🌬️ Muốn gió tự động: đổi tay nắm sang <em>Học nhịp gió</em> hoặc chỉnh các thanh trượt Gió tự nhiên.</li>
          <li>Kéo <strong>chấm vuông</strong> để sửa dáng · kéo <strong>thân xương</strong> để dời · nhấp đúp để thêm/xoá điểm.</li>
          <li>Click gần một xương để chọn · Alt / chuột giữa để dời khung.</li>
        </ul>
      </div>
      <div className="lw-plant-section-label">Gắn xương mới vào</div>
      <div className="lw-plant-chips">
        {TARGETS.map(([id, title, hint]) => (
          <button key={id} type="button" title={hint} className={`lw-plant-chip${editor.target === id ? ' active' : ''}`} onClick={() => setPlantSpineEditorState({ target: id })}>
            {id === 'selected' ? `${title} (${selectedIds.length})` : title}
          </button>
        ))}
      </div>
      <div className="lw-plant-section-label">Kiểu cây cho xương mới</div>
      <div className="lw-plant-chips">
        {PLANT_SPINE_PRESETS.map((p) => (
          <button key={p.id} type="button" className={`lw-plant-chip${editor.preset === p.id ? ' active' : ''}`} onClick={() => setPlantSpineEditorState({ preset: p.id })}>
            {p.label}
          </button>
        ))}
      </div>
      <label className="lw-plant-live" title="Cây tự đung đưa ngay trong tab này mà không cần bấm phát timeline">
        <input type="checkbox" checked={editor.live} onChange={(e) => setPlantSpineEditorState({ live: e.target.checked })} />
        <span>🌬️ Xem gió trực tiếp khi chỉnh</span>
      </label>
      <div className="lw-plant-actions">
        <button type="button" className="btn sm primary" onClick={onTogglePlay}>{isPlaying ? '⏸ Dừng xem thử' : '▶ Phát xem thử'}</button>
        {spines.length > 0 && <button type="button" className="btn sm" onClick={() => run({ action: 'clear' })}>Xoá tất cả xương</button>}
      </div>
      {error && <div className="lw-error" role="alert">{error}</div>}
      <div className="lw-plant-list">
        {spines.length === 0 && <div className="lw-plant-empty">Chưa có xương thực vật nào. Hãy vẽ một đường trên Bố cục 2D.</div>}
        {spines.map((s) => (
          <SpineCard key={s.id} spine={s} composite={composite} selected={editor.selectedSpineId === s.id} run={run} />
        ))}
      </div>
    </div>
  )
}
