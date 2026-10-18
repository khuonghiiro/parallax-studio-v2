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
import { PlantSpineCard } from './PlantSpineCard'
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

const TARGETS: Array<[PlantSpineTarget, string, string]> = [
  ['selected', '🎯 Layer đang chọn', 'Gắn vào các layer đang chọn ở tab Layer'],
  ['all', '🌳 Toàn bộ cây', 'Gắn vào mọi layer trong cụm thực vật'],
  ['auto', '✏️ Tự nhận khi vẽ', 'Khi kéo chuột vẽ xương trên khung 2D, tự gắn vào layer mà nét vẽ đi qua']
]

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
              <strong>Hoặc tự vẽ tay:</strong> Kéo chuột trên <em>Bố cục 2D</em> từ <strong>GỐC</strong> lên <strong>NGỌN</strong> của cây/cành. Đường vẽ dài sẽ tự sinh đủ các khớp ô vuông đều đặn (~60px/khớp).
            </li>
            <li>
              <strong>Thêm & Xoá khớp uốn:</strong> Rê chuột trên đường kẻ nhấn <kbd>+</kbd> để thêm khớp; hover vào khớp (hiện <strong>đỏ</strong>) nhấn <kbd>-</kbd> hoặc <kbd>Del</kbd> để xoá điểm uốn. Càng nhiều khớp thì uốn cong càng mượt.
            </li>
            <li>
              <strong>Sửa dáng & Ghi nhịp:</strong> Kéo <strong>chấm vuông</strong> để uốn trục xương · nắm <strong>vòng tròn 4 chiều ở ngọn</strong> lắc uốn cong và nhún lên xuống.
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
          <span className="lw-plant-list-tools">
            {spines.length > 1 && (
              <>
                <button type="button" className="btn xs" onClick={() => run({ action: 'phase', mode: 'stagger' })}
                  title="So le nhịp: mỗi xương lệch pha khác nhau (tỉ lệ vàng) để cả bụi cỏ / hàng cây không lắc đồng loạt như rô-bốt">
                  🌾 So le nhịp
                </button>
                <button type="button" className="btn xs" onClick={() => run({ action: 'phase', mode: 'sync' })}
                  title="Đồng bộ: mọi xương lắc cùng pha (lệch pha = 0)">
                  ⏸ Đồng bộ
                </button>
              </>
            )}
            <button type="button" className="btn xs lw-plant-clear-btn" onClick={() => run({ action: 'clear' })}>
              Xoá tất cả
            </button>
          </span>
        )}
      </div>

      <div className="lw-plant-list">
        {spines.length === 0 && (
          <div className="lw-plant-empty">
            Chưa có chuyển động thực vật nào. Bấm <strong>&ldquo;⚡ + Tạo mới chuyển động ngay&rdquo;</strong> ở trên hoặc kéo vẽ trên Bố cục 2D.
          </div>
        )}
        {spines.map((s, idx) => (
          <PlantSpineCard
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
