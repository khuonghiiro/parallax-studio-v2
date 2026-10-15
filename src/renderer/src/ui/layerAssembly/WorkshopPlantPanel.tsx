import { useState } from 'react'
import { PLANT_SPINE_PRESETS, type PlantSpine } from '@shared/plantSpine'
import type { LayerComposite } from './types'
import {
  applyPlantSpineAction,
  buildAutoPlantSpinePoints,
  createPlantSpine,
  resolveSpineLayerIds,
  type PlantSpineAction,
  type PlantSpineTarget
} from './workshopPlantSpines'
import { setPlantSpineEditorState, usePlantSpineEditor } from './plantSpineEditorStore'
import { PlantMotionSection } from './PlantMotionSection'
import { generateCustomPlantMotion, type PlantCustomPatternId, PLANT_CUSTOM_PATTERNS } from './plantMotionRecord'
import '../../styles/layerWorkshopPlant.css'
import '../../styles/layerWorkshopPlantMotion.css'

interface PanelProps {
  composite: LayerComposite
  setComposite: (update: (prev: LayerComposite) => LayerComposite, key?: string) => void
  selectedIds: string[]
  isPlaying: boolean
  onTogglePlay: () => void
}

type NumKey =
  | 'amplitude'
  | 'speed'
  | 'stiffness'
  | 'flexibility'
  | 'turbulence'
  | 'lean'
  | 'phaseOffset'
  | 'reach'

const PRIMARY_SLIDERS: Array<{
  key: NumKey
  label: string
  min: number
  max: number
  step: number
  unit?: string
  hint: string
}> = [
  { key: 'amplitude', label: 'Biên độ uốn', min: 0, max: 40, step: 0.5, unit: '°', hint: 'Góc uốn tối đa tại ngọn' },
  { key: 'speed', label: 'Tốc độ nhịp', min: 0.05, max: 3, step: 0.05, unit: '/s', hint: 'Số nhịp đung đưa mỗi giây' },
  { key: 'lean', label: 'Nghiêng theo gió', min: -30, max: 30, step: 0.5, unit: '°', hint: 'Độ nghiêng cố định (dương = sang phải)' },
  { key: 'phaseOffset', label: 'Độ lệch pha', min: 0, max: 3, step: 0.05, unit: 's', hint: 'Cho nhiều cây đung đưa so le tự nhiên' }
]

const SECONDARY_SLIDERS: Array<{
  key: NumKey
  label: string
  min: number
  max: number
  step: number
  unit?: string
  hint: string
}> = [
  { key: 'stiffness', label: 'Độ cứng thân', min: 0, max: 1, step: 0.05, hint: '0 = cả thân cong mềm · 1 = chỉ ngọn cong' },
  { key: 'flexibility', label: 'Rung ngọn phụ', min: 0, max: 1, step: 0.05, hint: 'Ngọn/lá phất thêm nhịp phụ' },
  { key: 'turbulence', label: 'Gió giật', min: 0, max: 1, step: 0.05, hint: 'Gió thổi thất thường, lúc mạnh lúc nhẹ' },
  { key: 'reach', label: 'Bán kính uốn', min: 0, max: 400, step: 5, unit: 'px', hint: '0 = toàn bộ layer uốn theo xương' }
]

const TARGETS: Array<[PlantSpineTarget, string, string]> = [
  ['selected', '🎯 Layer đang chọn', 'Gắn vào các layer đang chọn ở tab Layer'],
  ['all', '🌳 Toàn bộ cây', 'Gắn vào mọi layer trong cụm thực vật'],
  ['auto', '✏️ Tự nhận khi vẽ', 'Khi kéo chuột vẽ xương trên khung 2D, tự gắn vào layer mà nét vẽ đi qua']
]

function SpineCard({
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
  const patch = (p: Partial<PlantSpine>, key?: string) =>
    run({ action: 'update', id: spine.id, patch: p }, key)

  const toggleLayer = (id: string) => {
    const has = spine.layerIds.includes(id)
    const next = has ? spine.layerIds.filter((l) => l !== id) : [...spine.layerIds, id]
    if (next.length) patch({ layerIds: next })
  }

  return (
    <div
      className={`lw-plant-card${selected ? ' selected' : ''}`}
      onClick={() => setPlantSpineEditorState({ selectedSpineId: spine.id })}
    >
      <div className="lw-plant-card-head">
        <span className="lw-plant-index-badge">#{index + 1}</span>
        <input
          className="lw-plant-name"
          value={spine.name}
          onChange={(e) => patch({ name: e.target.value }, `plant:${spine.id}:name`)}
          aria-label="Tên xương thực vật"
        />
        <label className="lw-plant-toggle" title="Bật/tắt chuyển động của xương này">
          <input
            type="checkbox"
            checked={spine.enabled !== false}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          <span>Bật</span>
        </label>
        <button
          type="button"
          className="btn xs lw-plant-del-btn"
          title="Xoá xương chuyển động này"
          onClick={(e) => {
            e.stopPropagation()
            run({ action: 'delete', id: spine.id })
          }}
        >
          Xoá
        </button>
      </div>

      {!selected && (
        <div className="lw-plant-card-summary">
          <span>{spine.motion ? `✨ Nhịp riêng (${spine.motion.duration}s)` : `🌬️ ±${spine.amplitude}° · ${spine.speed}/s`}</span>
          <span>• {spine.layerIds.length} layer</span>
          <span className="lw-plant-expand-hint">Bấm để chỉnh ▾</span>
        </div>
      )}

      {selected && (
        <div className="lw-plant-card-body" onClick={(e) => e.stopPropagation()}>
          {/* 2 Sub-tabs trong thẻ xương: Thông số Gió vs Tạo Nhịp & Quỹ đạo riêng */}
          <div className="lw-plant-card-tabs">
            <button
              type="button"
              className={`lw-plant-card-tab${subTab === 'wind' ? ' active' : ''}`}
              onClick={() => setSubTab('wind')}
            >
              🎛️ Gió & Độ uốn
            </button>
            <button
              type="button"
              className={`lw-plant-card-tab${subTab === 'custom' ? ' active' : ''}`}
              onClick={() => setSubTab('custom')}
            >
              🎬 Nhịp & Quỹ đạo {spine.motion ? '●' : ''}
            </button>
          </div>

          {subTab === 'wind' ? (
            <>
              <div className="lw-plant-group-box">
                <div className="lw-plant-section-label">
                  🌬️ Nhịp & Biên độ đung đưa{spine.motion ? ' (dùng khi Hoà trộn gió > 0)' : ''}
                </div>
                <div className="lw-plant-sliders">
                  {PRIMARY_SLIDERS.map((s) => {
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
                          onChange={(e) =>
                            patch({ [s.key]: Number(e.target.value) }, `plant:${spine.id}:${s.key}`)
                          }
                        />
                        <span className="lw-plant-slider-val">
                          {value}
                          {s.unit ?? ''}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="lw-plant-group-box">
                <div className="lw-plant-section-label">🌿 Độ dẻo thân & Gió giật</div>
                <div className="lw-plant-sliders">
                  {SECONDARY_SLIDERS.map((s) => {
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
                          onChange={(e) =>
                            patch({ [s.key]: Number(e.target.value) }, `plant:${spine.id}:${s.key}`)
                          }
                        />
                        <span className="lw-plant-slider-val">
                          {value}
                          {s.unit ?? ''}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="lw-plant-group-box">
                <div className="lw-plant-section-label">Áp nhanh thông số mẫu</div>
                <div className="lw-plant-chips">
                  {PLANT_SPINE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="lw-plant-chip"
                      onClick={() => patch(p.params)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lw-plant-group-box">
                <div className="lw-plant-row-between">
                  <span className="lw-plant-section-label">
                    Layer uốn theo xương ({spine.layerIds.length}/{composite.layers.length})
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
                      onClick={() => toggleLayer(l.id)}
                      title={
                        spine.layerIds.includes(l.id)
                          ? 'Bỏ gắn layer này'
                          : 'Gắn layer này vào xương'
                      }
                    >
                      #{idx + 1} {l.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <PlantMotionSection spine={spine} patch={patch} />
          )}
        </div>
      )}
    </div>
  )
}

/** Tab "Thực vật": tạo mới chuyển động cây cỏ nhanh hoặc vẽ xương cong + chỉnh nhịp đung đưa. */
export function WorkshopPlantPanel({
  composite,
  setComposite,
  selectedIds,
  isPlaying,
  onTogglePlay
}: PanelProps) {
  const editor = usePlantSpineEditor()
  const [error, setError] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [newName, setNewName] = useState('')
  const [initMode, setInitMode] = useState<'custom' | 'pattern' | 'preset'>('custom')
  const [customAmp, setCustomAmp] = useState<number>(14)
  const [customSpeed, setCustomSpeed] = useState<number>(0.85)
  const [customStiff, setCustomStiff] = useState<number>(0.25)
  const [newPattern, setNewPattern] = useState<PlantCustomPatternId>('sine')

  const spines = composite.plantSpines ?? []

  const run = (action: PlantSpineAction, key?: string) => {
    try {
      setComposite((c) => applyPlantSpineAction(c, action), key)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleQuickCreateSpine = () => {
    if (composite.layers.length === 0) {
      setError('Cần có ít nhất 1 layer trong cụm để tạo chuyển động thực vật.')
      return
    }
    const targetIds = resolveSpineLayerIds(
      composite,
      editor.target === 'auto' ? 'selected' : editor.target,
      selectedIds
    )
    const points = buildAutoPlantSpinePoints(composite, targetIds, spines.length)
    const defaultLabel =
      newName.trim() ||
      (targetIds.length === 1
        ? `Chuyển động ${composite.layers.find((l) => l.id === targetIds[0])?.name || 'Cây'}`
        : `Chuyển động cây #${spines.length + 1}`)

    const baseSpine = createPlantSpine({
      points,
      layerIds: targetIds,
      preset: editor.preset,
      name: defaultLabel
    })

    let finalSpine: PlantSpine = baseSpine
    if (initMode === 'custom') {
      finalSpine = {
        ...baseSpine,
        amplitude: customAmp,
        speed: customSpeed,
        stiffness: customStiff,
        flexibility: 0.45,
        turbulence: 0.25
      }
    } else if (initMode === 'pattern') {
      finalSpine = {
        ...baseSpine,
        amplitude: customAmp,
        speed: customSpeed,
        stiffness: customStiff,
        motion: generateCustomPlantMotion({
          pattern: newPattern,
          leftAngle: -customAmp,
          rightAngle: customAmp,
          duration: Number((1 / Math.max(0.2, customSpeed)).toFixed(2))
        })
      }
    }

    try {
      setComposite((c) => applyPlantSpineAction(c, { action: 'add', spine: finalSpine }), 'plant:quick-add')
      setPlantSpineEditorState({ selectedSpineId: finalSpine.id, live: true })
      setNewName('')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="lw-plant-panel" id="layer-assembly-plant-panel">
      {/* Thanh điều khiển Phát xem thử & Live Preview cố định trên đầu */}
      <div className="lw-plant-topbar">
        <button type="button" className="btn sm primary" onClick={onTogglePlay}>
          {isPlaying ? '⏸ Dừng phát' : '▶ Phát thử'}
        </button>
        <label
          className="lw-plant-live"
          title="Cây tự đung đưa ngay trong tab này mà không cần bấm phát timeline"
        >
          <input
            type="checkbox"
            checked={editor.live}
            onChange={(e) => setPlantSpineEditorState({ live: e.target.checked })}
          />
          <span>🌬️ Xem trực tiếp</span>
        </label>
        <button
          type="button"
          className={`btn xs lw-plant-help-btn${showGuide ? ' active' : ''}`}
          onClick={() => setShowGuide((v) => !v)}
          title="Xem mẹo vẽ xương và điều khiển ngọn cây trên khung 2D"
        >
          ? Mẹo 2D
        </button>
      </div>

      {showGuide && (
        <div className="lw-plant-hint">
          🌿 <strong>Thao tác trực tiếp trên Bố cục 2D:</strong>
          <ul>
            <li>
              <strong>Tạo bằng 1-Click:</strong> Dùng hộp <em>Tạo mới chuyển động</em> bên dưới để tự sinh trục xương từ gốc lên ngọn ngay lập tức.
            </li>
            <li>
              <strong>Hoặc tự vẽ tay:</strong> Kéo chuột trên <em>Bố cục 2D</em> từ <strong>GỐC</strong> lên <strong>NGỌN</strong> của cây/cành.
            </li>
            <li>
              <strong>Sửa dáng & Ghi nhịp:</strong> Kéo <strong>chấm vuông</strong> để uốn trục xương · nắm <strong>vòng tròn ở ngọn</strong> lắc theo nhịp tay hoặc bấm <kbd>R</kbd> để vẽ quỹ đạo.
            </li>
          </ul>
        </div>
      )}

      {/* Khối 1: Tạo Mới Chuyển Động Thực Vật (1-Click Wizard + Tuỳ chỉnh riêng) */}
      <div className="lw-plant-create-card">
        <div className="lw-plant-create-head">
          <span className="lw-plant-create-title">➕ Tạo mới Chuyển động Thực vật</span>
          <span className="lw-plant-create-sub">Tự tạo hoặc vẽ</span>
        </div>

        <input
          type="text"
          className="lw-plant-name"
          placeholder={`Tên chuyển động mới (VD: Nhánh cây #${spines.length + 1})...`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        <div className="lw-plant-section-label">1. Áp dụng cho Layer nào?</div>
        <div className="lw-plant-chips">
          {TARGETS.map(([id, title, hint]) => (
            <button
              key={id}
              type="button"
              title={hint}
              className={`lw-plant-chip${editor.target === id ? ' active' : ''}`}
              onClick={() => setPlantSpineEditorState({ target: id })}
            >
              {id === 'selected' ? `${title} (${selectedIds.length})` : title}
            </button>
          ))}
        </div>

        <div className="lw-plant-section-label">2. Chọn cách thiết lập chuyển động mới</div>
        <div className="lw-plant-submode-bar">
          <button
            type="button"
            className={`lw-plant-submode-btn${initMode === 'custom' ? ' active' : ''}`}
            onClick={() => setInitMode('custom')}
            title="Tự chỉnh biên độ uốn, tốc độ nhịp và độ cứng thân"
          >
            🎛️ Tự chỉnh
          </button>
          <button
            type="button"
            className={`lw-plant-submode-btn${initMode === 'pattern' ? ' active' : ''}`}
            onClick={() => setInitMode('pattern')}
            title="Tạo đồ thị nhịp sóng, nhịp đôi, gió dồn hoặc bật nảy lò xo"
          >
            🌊 Nhịp sóng
          </button>
          <button
            type="button"
            className={`lw-plant-submode-btn${initMode === 'preset' ? ' active' : ''}`}
            onClick={() => setInitMode('preset')}
            title="Chọn nhanh từ 6 kiểu cây có sẵn"
          >
            🌱 Mẫu cây
          </button>
        </div>

        {initMode === 'custom' && (
          <div className="lw-plant-sliders lw-plant-init-box">
            <label className="lw-plant-slider" title="Góc uốn tối đa tại ngọn cây">
              <span className="lw-plant-slider-label">Biên độ uốn</span>
              <input
                type="range"
                min={1}
                max={38}
                step={0.5}
                value={customAmp}
                onChange={(e) => setCustomAmp(Number(e.target.value))}
              />
              <span className="lw-plant-slider-val">{customAmp}°</span>
            </label>
            <label className="lw-plant-slider" title="Số nhịp đung đưa mỗi giây">
              <span className="lw-plant-slider-label">Tốc độ nhịp</span>
              <input
                type="range"
                min={0.1}
                max={2.5}
                step={0.05}
                value={customSpeed}
                onChange={(e) => setCustomSpeed(Number(e.target.value))}
              />
              <span className="lw-plant-slider-val">{customSpeed}/s</span>
            </label>
            <label className="lw-plant-slider" title="0 = cả thân mềm · 1 = chỉ ngọn cong">
              <span className="lw-plant-slider-label">Độ cứng thân</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={customStiff}
                onChange={(e) => setCustomStiff(Number(e.target.value))}
              />
              <span className="lw-plant-slider-val">{customStiff}</span>
            </label>
          </div>
        )}

        {initMode === 'pattern' && (
          <div className="lw-plant-init-box">
            <div className="lw-plant-pattern-grid">
              {PLANT_CUSTOM_PATTERNS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`lw-plant-pattern-chip${newPattern === p.id ? ' active' : ''}`}
                  title={p.desc}
                  onClick={() => setNewPattern(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="lw-plant-sliders" style={{ marginTop: 6 }}>
              <label className="lw-plant-slider">
                <span className="lw-plant-slider-label">Biên độ lắc</span>
                <input
                  type="range"
                  min={2}
                  max={36}
                  step={1}
                  value={customAmp}
                  onChange={(e) => setCustomAmp(Number(e.target.value))}
                />
                <span className="lw-plant-slider-val">±{customAmp}°</span>
              </label>
              <label className="lw-plant-slider">
                <span className="lw-plant-slider-label">Tốc độ chu kỳ</span>
                <input
                  type="range"
                  min={0.15}
                  max={2.5}
                  step={0.05}
                  value={customSpeed}
                  onChange={(e) => setCustomSpeed(Number(e.target.value))}
                />
                <span className="lw-plant-slider-val">{customSpeed}/s</span>
              </label>
            </div>
          </div>
        )}

        {initMode === 'preset' && (
          <div className="lw-plant-chips lw-plant-init-box">
            {PLANT_SPINE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`lw-plant-chip${editor.preset === p.id ? ' active' : ''}`}
                onClick={() => setPlantSpineEditorState({ preset: p.id })}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <div className="lw-plant-create-actions">
          <button
            type="button"
            className="btn sm primary lw-plant-create-btn"
            onClick={handleQuickCreateSpine}
            title="Tự động tạo trục xương từ gốc lên ngọn và áp dụng ngay chuyển động mới"
          >
            ⚡ + Tạo mới chuyển động ngay
          </button>
        </div>
        <div className="lw-plant-draw-note">
          💡 Hoặc đặt trỏ chuột lên <strong>Bố cục 2D</strong> kéo từ <strong>Gốc → Ngọn</strong> để tự vẽ trục xương theo ý muốn.
        </div>
      </div>

      {error && (
        <div className="lw-error" role="alert">
          {error}
        </div>
      )}

      {/* Khối 2: Danh sách các Xương & Chuyển động đã tạo */}
      <div className="lw-plant-list-header">
        <span className="lw-plant-section-label">
          🌿 Danh sách chuyển động thực vật ({spines.length})
        </span>
        {spines.length > 0 && (
          <button
            type="button"
            className="btn xs lw-plant-clear-btn"
            onClick={() => run({ action: 'clear' })}
          >
            Xoá tất cả
          </button>
        )}
      </div>

      <div className="lw-plant-list">
        {spines.length === 0 && (
          <div className="lw-plant-empty">
            Chưa có chuyển động thực vật nào. Bấm <strong>&ldquo;⚡ + Tạo mới chuyển động ngay&rdquo;</strong> ở trên hoặc kéo vẽ trên Bố cục 2D.
          </div>
        )}
        {spines.map((s, idx) => (
          <SpineCard
            key={s.id}
            spine={s}
            index={idx}
            composite={composite}
            selected={editor.selectedSpineId === s.id}
            run={run}
          />
        ))}
      </div>
    </div>
  )
}
