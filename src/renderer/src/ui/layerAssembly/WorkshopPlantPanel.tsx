import { useEffect, useRef, useState } from 'react'
import { PLANT_SPINE_PRESETS, type PlantSpine } from '@shared/plantSpine'
import type { LayerComposite } from './types'
import {
  WIND_WEATHER_PRESETS,
  applyPlantSpineAction,
  buildAutoPlantSpinePoints,
  createPlantSpine,
  resolveSpineLayerIds,
  type PlantSpineAction,
  type PlantSpineDirection,
  type PlantSpineTarget,
  type WindWeatherPreset
} from './workshopPlantSpines'
import { setPlantSpineEditorState, usePlantSpineEditor } from './plantSpineEditorStore'
import { PlantSpineCard } from './PlantSpineCard'
import { WorkshopLayerMotionHarmonyCard } from './WorkshopLayerMotionHarmonyCard'
import {
  generateCustomPlantMotion,
  type PlantCustomPatternId,
  PLANT_CUSTOM_PATTERNS
} from './plantMotionRecord'
import { SegmentedTabs } from '../primitives'
import {
  IconMotionHarmonyWave,
  IconPlantAddSpine,
  IconPlantSpineBranch,
  IconTabWindMotion
} from './LayerWorkshopStudioIcons'
import '../../styles/layerWorkshopPlant.css'
import '../../styles/layerWorkshopPlantMotion.css'

interface PanelProps {
  composite: LayerComposite
  setComposite: (update: (prev: LayerComposite) => LayerComposite, key?: string) => void
  selectedIds: string[]
  isPlaying: boolean
  onTogglePlay: () => void
}

export type WindPanelSubTab = 'spines' | 'create' | 'harmony'

const TARGETS: Array<[PlantSpineTarget, string, string]> = [
  ['selected', 'Lớp đang chọn', 'Gắn trục gió vào các lớp đang chọn'],
  ['all', 'Toàn cụm', 'Gắn trục gió vào tất cả các lớp trong mẫu'],
  ['auto', 'Tự nhận khi vẽ 2D', 'Khi kéo chuột vẽ trên sân khấu 2D, tự gắn vào lớp mà nét vẽ đi qua']
]

const DIRECTION_OPTIONS: Array<{ id: PlantSpineDirection; label: string; hint: string }> = [
  { id: 'up', label: '↑ Mọc lên', hint: 'Gốc ở dưới, ngọn ở trên (Cây cối, bụi cỏ, bông hoa)' },
  { id: 'horizontal', label: '→ Vươn ngang', hint: 'Gốc bên trái, ngọn bên phải (Cành vươn ngang, cờ bay)' },
  { id: 'down', label: '↓ Rủ xuống', hint: 'Gốc ở trên, đuôi rủ xuống (Dây leo, mái tóc dài, tà áo)' }
]

const WIND_LEAN_PRESETS: Array<{ lean: number; label: string; hint: string }> = [
  { lean: -12, label: '← Gió tạt trái', hint: 'Nghiêng theo chiều gió thổi sang trái (-12°)' },
  { lean: 0, label: '↕ Đung đưa cân', hint: 'Đung đưa cân đối quanh trục thẳng đứng (0°)' },
  { lean: 12, label: 'Gió tạt phải →', hint: 'Nghiêng theo chiều gió thổi sang phải (+12°)' }
]

/** Tab "Gió": Studio điều khiển thời tiết gió trực tiếp, quản lý trục uốn tự nhiên & Hòa âm 2.5D. */
export function WorkshopPlantPanel({
  composite,
  setComposite,
  selectedIds,
  isPlaying,
  onTogglePlay
}: PanelProps) {
  const editor = usePlantSpineEditor()
  const spines = composite.plantSpines ?? []
  const [subTab, setSubTab] = useState<WindPanelSubTab>(() => (spines.length > 0 ? 'spines' : 'create'))
  const [error, setError] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [newName, setNewName] = useState('')
  const [direction, setDirection] = useState<PlantSpineDirection>('up')
  const [initMode, setInitMode] = useState<'custom' | 'pattern' | 'preset'>('custom')
  const [customAmp, setCustomAmp] = useState<number>(13)
  const [customSpeed, setCustomSpeed] = useState<number>(0.85)
  const [customStiff, setCustomStiff] = useState<number>(0.28)
  const [newPattern, setNewPattern] = useState<PlantCustomPatternId>('sine')
  const prevSpineCountRef = useRef(spines.length)

  // Khi người dùng vẽ trực tiếp trục mới trên Sân khấu 2D, tự chuyển về tab Trục gió và chọn trục mới
  useEffect(() => {
    if (spines.length > prevSpineCountRef.current) {
      const newest = spines[spines.length - 1]
      if (newest) {
        setPlantSpineEditorState({ selectedSpineId: newest.id, live: true })
      }
      setSubTab('spines')
    }
    prevSpineCountRef.current = spines.length
  }, [spines])

  const activeSpine = spines.find((s) => s.id === editor.selectedSpineId) ?? spines[0] ?? null
  const activeMotionLayers = composite.layers.filter((l) => l.motion && l.motion.type !== 'none').length

  const run = (action: PlantSpineAction, key?: string) => {
    try {
      setComposite((c) => applyPlantSpineAction(c, action), key)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  /** Áp nhanh cấp độ gió: nếu đã có trục thì cập nhật tức thì; nếu chưa có trục mà có layer thì tự tạo trục đầu tiên và chạy ngay! */
  const handleApplyWeatherPreset = (weather: WindWeatherPreset) => {
    setCustomAmp(weather.params.amplitude)
    setCustomSpeed(weather.params.speed)
    setCustomStiff(weather.params.stiffness)

    if (spines.length > 0) {
      run(
        {
          action: 'apply-weather',
          patch: weather.params,
          stagger: spines.length > 1
        },
        `plant:weather:${weather.id}`
      )
      setPlantSpineEditorState({ live: true })
      setSubTab('spines')
      return
    }

    if (composite.layers.length > 0) {
      const targetIds = resolveSpineLayerIds(
        composite,
        editor.target === 'auto' ? 'selected' : editor.target,
        selectedIds
      )
      const points = buildAutoPlantSpinePoints(composite, targetIds, 0, direction)
      const autoSpine: PlantSpine = {
        ...createPlantSpine({
          points,
          layerIds: targetIds,
          preset: editor.preset,
          name: `Trục gió ${weather.label}`
        }),
        ...weather.params
      }
      run({ action: 'add', spine: autoSpine }, `plant:auto-weather:${weather.id}`)
      setPlantSpineEditorState({ selectedSpineId: autoSpine.id, live: true })
      setSubTab('spines')
    }
  }

  const handleApplyWindLean = (lean: number) => {
    if (spines.length === 0) return
    run({ action: 'apply-weather', patch: { lean } }, `plant:lean:${lean}`)
    setPlantSpineEditorState({ live: true })
  }

  const handleQuickCreateSpine = () => {
    if (composite.layers.length === 0) {
      setError('Cần ít nhất 1 lớp trong mẫu để tạo trục gió.')
      return
    }
    const targetIds = resolveSpineLayerIds(
      composite,
      editor.target === 'auto' ? 'selected' : editor.target,
      selectedIds
    )
    const points = buildAutoPlantSpinePoints(composite, targetIds, spines.length, direction)
    const defaultLabel =
      newName.trim() ||
      (targetIds.length === 1
        ? `Trục gió ${composite.layers.find((l) => l.id === targetIds[0])?.name || 'Lớp'}`
        : `Trục gió #${spines.length + 1}`)

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
      setSubTab('spines')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const isWindLive = editor.live || isPlaying
  const currentLean = activeSpine?.lean ?? 0

  return (
    <div className="lw-plant-panel" id="layer-assembly-plant-panel">
      {/* 1. Studio Wind Weather & Live Preview Card */}
      <div className="lw-card-section lw-wind-studio-card">
        <div className="lw-moho-frame0-bar">
          <span className={`lw-frame-mode-badge ${isWindLive && spines.length > 0 ? 'is-setup' : ''}`}>
            <IconTabWindMotion width={11} height={11} />
            <span>
              {spines.length === 0
                ? 'Chưa có trục gió'
                : isWindLive
                  ? `Gió trực tiếp · ${spines.length} trục`
                  : `Tạm dừng · ${spines.length} trục`}
            </span>
          </span>
          <div className="lw-wind-head-controls">
            <button
              type="button"
              className={`lw-moho-opt-pill${editor.live ? ' active' : ''}`}
              onClick={() => setPlantSpineEditorState({ live: !editor.live })}
              aria-pressed={editor.live}
              title="Xem trực tiếp chuyển động gió trên sân khấu 2D/3D mà không cần chạy timeline"
            >
              <span>{editor.live ? '● Trực tiếp' : '○ Tĩnh'}</span>
            </button>
            <button type="button" className="btn xs primary" onClick={onTogglePlay}>
              {isPlaying ? '⏸ Dừng' : '▶ Phát'}
            </button>
            <button
              type="button"
              className={`btn xs${showGuide ? ' active' : ''}`}
              onClick={() => setShowGuide((v) => !v)}
              title="Hướng dẫn vẽ và chỉnh đốt uốn trực tiếp trên Sân khấu 2D"
            >
              ?
            </button>
          </div>
        </div>

        {/* 1-Click Cấp độ gió (Beaufort Studio Presets) */}
        <div className="lw-wind-weather-grid" role="group" aria-label="Cấp độ gió nhanh">
          {WIND_WEATHER_PRESETS.map((w) => {
            const isMatched =
              activeSpine &&
              !activeSpine.motion &&
              Math.abs(activeSpine.amplitude - w.params.amplitude) <= 1.5 &&
              Math.abs(activeSpine.speed - w.params.speed) <= 0.15
            return (
              <button
                key={w.id}
                type="button"
                className={`lw-studio-preset-item lw-wind-weather-btn${isMatched ? ' active' : ''}`}
                disabled={composite.layers.length === 0}
                onClick={() => handleApplyWeatherPreset(w)}
                title={
                  spines.length > 0
                    ? `${w.hint} (Áp ngay lên các trục gió đang bật)`
                    : `${w.hint} (Tự tạo trục gió đầu tiên và xem trực tiếp)`
                }
              >
                <span className="lw-studio-preset-name">{w.label}</span>
                <small className="lw-studio-preset-meta">{w.meta}</small>
              </button>
            )
          })}
        </div>

        {/* Hướng gió tạt */}
        <div className="lw-angle-seg-bar compact" role="group" aria-label="Hướng gió tạt">
          {WIND_LEAN_PRESETS.map((item) => {
            const active = spines.length > 0 && Math.abs(currentLean - item.lean) <= 2
            return (
              <button
                key={item.lean}
                type="button"
                className={`lw-angle-seg-btn${active ? ' active' : ''}`}
                disabled={spines.length === 0}
                onClick={() => handleApplyWindLean(item.lean)}
                title={item.hint}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {showGuide && (
          <div className="lw-plant-hint">
            <strong>Thao tác trực tiếp trên Sân khấu 2D:</strong>
            <ul>
              <li>
                <strong>Vẽ trục tự do:</strong> Đặt chuột tại <strong>Gốc</strong> kéo tới <strong>Ngọn</strong> (cây, cành, tóc, tà áo) để tự sinh chuỗi đốt uốn đều nhau.
              </li>
              <li>
                <strong>Thêm / Xoá đốt uốn:</strong> Rê dọc trục nhấn <kbd>+</kbd> để chèn đốt; trỏ vào đốt nhấn <kbd>-</kbd> hoặc <kbd>Del</kbd> để xoá.
              </li>
              <li>
                <strong>Ghi nhịp tay:</strong> Nắm vòng tròn ở ngọn kéo lắc hoặc nhấn <kbd>R</kbd> để vẽ quỹ đạo chuyển động riêng.
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* 2. Thanh 3 Sub-Tabs chuẩn Studio */}
      <SegmentedTabs<WindPanelSubTab>
        variant="segmented"
        size="sm"
        ariaLabel="Phân khu Gió & Chuyển động mềm"
        value={subTab}
        onChange={setSubTab}
        items={[
          {
            id: 'spines',
            label: 'Trục gió',
            icon: <IconPlantSpineBranch width={12} height={12} />,
            badge: spines.length || undefined,
            badgeTone: spines.length > 0 ? 'cyan' : 'neutral',
            title: 'Danh sách các trục xương gió, tinh chỉnh biên độ, độ dẻo, đốt uốn và quỹ đạo riêng'
          },
          {
            id: 'create',
            label: 'Tạo trục',
            icon: <IconPlantAddSpine width={12} height={12} />,
            title: 'Tạo mới trục gió 1-Click theo hướng mọc (Mọc lên / Vươn ngang / Rủ xuống) hoặc vẽ tay'
          },
          {
            id: 'harmony',
            label: 'Hòa âm 2.5D',
            icon: <IconMotionHarmonyWave width={12} height={12} />,
            badge: activeMotionLayers || undefined,
            title: 'Phân bổ dao động sóng hài (Thở, Đung đưa, Lơ lửng) theo tầng chiều sâu Z 2.5D'
          }
        ]}
      />

      {error && (
        <div className="lw-error" role="alert">
          {error}
        </div>
      )}

      {/* SUB-TAB 1: DANH SÁCH TRỤC GIÓ ĐANG CÓ */}
      {subTab === 'spines' && (
        <>
          <div className="lw-plant-list-header">
            <span className="lw-plant-section-label">Danh sách trục gió ({spines.length})</span>
            <span className="lw-plant-list-tools">
              {spines.length > 1 && (
                <>
                  <button
                    type="button"
                    className="btn xs"
                    onClick={() => run({ action: 'phase', mode: 'stagger' })}
                    title="So le nhịp theo tỉ lệ vàng (0.618s) để nhiều cành/cây đung đưa tự nhiên không trùng nhịp"
                  >
                    So le pha
                  </button>
                  <button
                    type="button"
                    className="btn xs"
                    onClick={() => run({ action: 'phase', mode: 'sync' })}
                    title="Đồng bộ tất cả các trục về cùng một pha (lệch pha = 0s)"
                  >
                    Đồng pha
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn xs"
                onClick={() => setSubTab('create')}
                title="Mở bảng tạo thêm trục gió mới"
              >
                + Thêm trục
              </button>
              {spines.length > 0 && (
                <button
                  type="button"
                  className="btn xs lw-muted-danger-btn"
                  onClick={() => run({ action: 'clear' })}
                  title="Xoá toàn bộ các trục gió trong mẫu"
                >
                  Xoá hết
                </button>
              )}
            </span>
          </div>

          <div className="lw-plant-list">
            {spines.length === 0 && (
              <div className="lw-plant-empty">
                <p>Chưa có trục gió nào trong mẫu.</p>
                <p className="lw-plant-draw-note">
                  Bấm chọn nhanh một <strong>Cấp độ gió</strong> ở trên, kéo chuột vẽ từ <strong>Gốc → Ngọn</strong> trên Sân khấu 2D, hoặc tạo trục theo hướng mọc.
                </p>
                <button type="button" className="btn xs primary" onClick={() => setSubTab('create')}>
                  + Thiết lập &amp; Tạo trục gió mới
                </button>
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
        </>
      )}

      {/* SUB-TAB 2: TẠO MỚI TRỤC GIÓ (1-CLICK WIZARD + VẼ TAY) */}
      {subTab === 'create' && (
        <div className="lw-card-section lw-plant-create-card">
          <div className="lw-card-header">
            <span className="lw-card-title">Thiết lập Trục gió mới</span>
            <span className="lw-card-badge">1-Click / Vẽ 2D</span>
          </div>

          <input
            type="text"
            className="lw-plant-name"
            placeholder={`Tên trục gió (VD: Cành lá #${spines.length + 1})…`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />

          <div className="lw-plant-section-label">1. Hướng mọc từ Gốc tới Ngọn</div>
          <div className="lw-angle-seg-bar compact" role="radiogroup" aria-label="Hướng mọc của trục gió">
            {DIRECTION_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={direction === opt.id}
                className={`lw-angle-seg-btn${direction === opt.id ? ' active' : ''}`}
                onClick={() => setDirection(opt.id)}
                title={opt.hint}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="lw-plant-section-label">2. Phạm vi Lớp gắn trục</div>
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

          <div className="lw-plant-section-label">3. Đặc tính chuyển động khởi tạo</div>
          <div className="lw-plant-submode-bar">
            <button
              type="button"
              className={`lw-plant-submode-btn${initMode === 'custom' ? ' active' : ''}`}
              onClick={() => setInitMode('custom')}
            >
              Tự chỉnh
            </button>
            <button
              type="button"
              className={`lw-plant-submode-btn${initMode === 'pattern' ? ' active' : ''}`}
              onClick={() => setInitMode('pattern')}
            >
              Nhịp sóng
            </button>
            <button
              type="button"
              className={`lw-plant-submode-btn${initMode === 'preset' ? ' active' : ''}`}
              onClick={() => setInitMode('preset')}
            >
              Mẫu vật chất
            </button>
          </div>

          {initMode === 'custom' && (
            <div className="lw-plant-sliders lw-plant-init-box">
              <label className="lw-plant-slider" title="Góc uốn tối đa tại ngọn">
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
                <span className="lw-plant-slider-label">Nhịp gió</span>
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
              <label className="lw-plant-slider" title="0 = cả thân uốn mềm · 1 = gốc vững, chỉ ngọn cong">
                <span className="lw-plant-slider-label">Độ cứng gốc</span>
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
              <div className="lw-plant-sliders lw-plant-pattern-sliders">
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
              title="Tự động sinh trục xương theo hướng mọc đã chọn và phát thử trực tiếp"
            >
              + Tạo trục gió &amp; Xem ngay
            </button>
          </div>
          <div className="lw-plant-draw-note">
            Mẹo: Bạn cũng có thể kéo chuột trực tiếp trên <strong>Sân khấu 2D</strong> từ <strong>Gốc → Ngọn</strong> để vẽ đường cong trục uốn theo hình dáng bất kỳ.
          </div>
        </div>
      )}

      {/* SUB-TAB 3: HÒA ÂM DAO ĐỘNG LAYER 2.5D */}
      {subTab === 'harmony' && (
        <WorkshopLayerMotionHarmonyCard
          composite={composite}
          selectedIds={selectedIds}
          setComposite={setComposite}
        />
      )}
    </div>
  )
}
