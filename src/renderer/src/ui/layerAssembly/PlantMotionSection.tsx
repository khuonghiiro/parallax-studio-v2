import { useEffect, useState } from 'react'
import type { PlantSpine, PlantSpineMotion } from '@shared/plantSpine'
import {
  getPlantSpineEditorState,
  setPlantSpineEditorState,
  usePlantSpineEditor,
  type PlantGrabMode
} from './plantSpineEditorStore'
import {
  PLANT_CUSTOM_PATTERNS,
  generateCustomPlantMotion,
  mirrorPlantMotion,
  scalePlantMotion,
  type PlantCustomPatternId,
  type PlantRecordEnd
} from './plantMotionRecord'
import { PlantMotionGraph } from './PlantMotionGraph'
import { useLayerAssemblyCalloutPrefs, toggleCalloutEnabled } from './LayerAssemblyCalloutOverlay'

function Seg<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: Array<[T, string, string]>
  onChange: (v: T) => void
}) {
  return (
    <div className="lw-plant-seg" role="radiogroup">
      {options.map(([v, label, hint]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          title={hint}
          className={value === v ? 'active' : ''}
          onClick={(e) => {
            e.stopPropagation()
            onChange(v)
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const GRAB_MODES: Array<[PlantGrabMode, string, string]> = [
  ['record', '✍️ Ghi cử động', 'Nắm ngọn kéo theo nhịp bạn muốn — app ghi lại đúng từng cử động và lặp lại'],
  ['learn', '🌬️ Học nhịp gió', 'Nắm ngọn lắc qua lại — app học biên độ / nghiêng / tốc độ cho gió tự động']
]
const RECORD_ENDS: Array<[PlantRecordEnd, string, string]> = [
  ['loop', '🔁 Lặp liền mạch', 'Phát lặp lại đúng cử chỉ vừa vẽ, tự khép vòng liền mạch'],
  ['spring', '🪀 Nảy lò xo', 'Sau khi thả tay, cây bật nảy tắt dần về tư thế nghỉ như lò xo']
]

function MotionSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  hint,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  hint: string
  onChange: (v: number) => void
}) {
  return (
    <label className="lw-plant-slider" title={hint} onClick={(e) => e.stopPropagation()}>
      <span className="lw-plant-slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="lw-plant-slider-val">
        {value}
        {unit ?? ''}
      </span>
    </label>
  )
}

/** Mục "Chuyển động tùy chỉnh & Quỹ đạo" của xương thực vật: tạo mới bằng bộ tạo nhịp hoặc vẽ tay. */
export function PlantMotionSection({
  spine,
  patch
}: {
  spine: PlantSpine
  patch: (p: Partial<PlantSpine>, key?: string) => void
}) {
  const editor = usePlantSpineEditor()
  const motion = spine.motion
  const [pattern, setPattern] = useState<PlantCustomPatternId>('sine')
  const [leftAngle, setLeftAngle] = useState<number>(-Math.round(spine.amplitude || 14))
  const [rightAngle, setRightAngle] = useState<number>(Math.round(spine.amplitude || 16))
  const [cycleDuration, setCycleDuration] = useState<number>(
    motion?.duration ?? Number((1 / Math.max(0.2, spine.speed || 0.7)).toFixed(1))
  )
  const [createMode, setCreateMode] = useState<'builder' | 'draw'>('builder')

  const setMotion = (m: PlantSpineMotion, key?: string) => patch({ motion: m }, key)

  const handleGenerateCustomMotion = () => {
    const generated = generateCustomPlantMotion({
      pattern,
      leftAngle,
      rightAngle,
      duration: cycleDuration,
      lag: motion?.lag ?? 0.1,
      windMix: motion?.windMix ?? 0.15,
      speed: motion?.speed ?? 1
    })
    setPlantSpineEditorState({ live: true })
    setMotion(generated, `plant:${spine.id}:motion-gen`)
  }

  return (
    <div className="lw-plant-motion" onClick={(e) => e.stopPropagation()}>
      <div className="lw-plant-motion-head">
        <span className="lw-plant-section-label">🎬 Thiết kế nhịp chuyển động riêng</span>
        <span className={`lw-plant-motion-badge${motion ? ' recorded' : ''}`}>
          {motion ? `✨ Nhịp riêng (${motion.keys.length} mốc)` : '🌬️ Đang dùng gió cơ bản'}
        </span>
      </div>

      {/* Bộ chuyển chế độ tạo chuyển động: Tự tạo bằng thông số vs Vẽ tay trên khung */}
      <div className="lw-plant-submode-bar">
        <button
          type="button"
          className={`lw-plant-submode-btn${createMode === 'builder' ? ' active' : ''}`}
          onClick={() => setCreateMode('builder')}
        >
          ⚡ Tạo bằng bộ thiết kế nhịp
        </button>
        <button
          type="button"
          className={`lw-plant-submode-btn${createMode === 'draw' ? ' active' : ''}`}
          onClick={() => setCreateMode('draw')}
        >
          ✍️ Vẽ tay trên khung 2D
        </button>
      </div>

      {createMode === 'builder' ? (
        <div className="lw-plant-builder-box">
          <div className="lw-plant-section-label">1. Chọn kiểu nhịp chuyển động muốn tạo</div>
          <div className="lw-plant-pattern-grid">
            {PLANT_CUSTOM_PATTERNS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`lw-plant-pattern-chip${pattern === p.id ? ' active' : ''}`}
                title={p.desc}
                onClick={() => setPattern(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="lw-plant-section-label">2. Chỉnh biên độ trái/phải & chu kỳ lặp</div>
          <div className="lw-plant-sliders">
            <MotionSlider
              label="Uốn sang trái"
              value={leftAngle}
              min={-42}
              max={0}
              step={1}
              unit="°"
              hint="Góc nghiêng tối đa về phía bên trái"
              onChange={setLeftAngle}
            />
            <MotionSlider
              label="Uốn sang phải"
              value={rightAngle}
              min={0}
              max={42}
              step={1}
              unit="°"
              hint="Góc nghiêng tối đa về phía bên phải"
              onChange={setRightAngle}
            />
            <MotionSlider
              label="Chu kỳ 1 vòng"
              value={cycleDuration}
              min={0.4}
              max={8}
              step={0.1}
              unit="s"
              hint="Thời gian hoàn thành 1 chu kỳ chuyển động (giây)"
              onChange={setCycleDuration}
            />
          </div>

          <button
            type="button"
            className="btn sm primary lw-plant-generate-btn"
            onClick={handleGenerateCustomMotion}
          >
            ✨ {motion ? 'Cập nhật lại đồ thị nhịp này' : 'Tạo ngay chuyển động mới'}
          </button>
        </div>
      ) : (
        <div className="lw-plant-builder-box">
          <div className="lw-plant-motion-row">
            <span>Tay nắm ngọn</span>
            <Seg
              value={editor.grabMode}
              options={GRAB_MODES}
              onChange={(grabMode) => setPlantSpineEditorState({ grabMode })}
            />
          </div>
          <div className="lw-plant-motion-row">
            <span>Khi thả tay</span>
            <Seg
              value={editor.recordEnd}
              options={RECORD_ENDS}
              onChange={(recordEnd) => setPlantSpineEditorState({ recordEnd })}
            />
          </div>
          <button
            type="button"
            className={`btn sm lw-plant-record-btn${editor.pathRecord ? ' armed' : ''}`}
            title="Bật rồi nhấn giữ chuột ở bất kỳ đâu trên Bố cục 2D: ngọn cây bám theo bút, thả chuột để lưu (phím R)"
            onClick={() => setPlantSpineEditorState({ pathRecord: !editor.pathRecord })}
          >
            {editor.pathRecord
              ? '● Đang chờ vẽ quỹ đạo trên khung 2D (Bấm R để tắt)'
              : '✍️ Bật bút vẽ quỹ đạo ngọn trên khung 2D (Phím R)'}
          </button>
          <p className="lw-plant-motion-hint">
            Mẹo: Bạn cũng có thể nắm trực tiếp <strong>vòng tròn xanh ở ngọn xương</strong> trên Bố cục 2D và lắc theo nhịp tay mong muốn.
          </p>
        </div>
      )}

      {motion && (
        <div className="lw-plant-recorded-box">
          <div className="lw-plant-section-label">
            📈 Đồ thị mốc nhịp (Kéo chấm vàng lên/xuống để sửa từng mốc)
          </div>
          <PlantMotionGraph
            motion={motion}
            onChange={(m) => setMotion(m, `plant:${spine.id}:motion-graph`)}
          />
          <div className="lw-plant-sliders">
            <MotionSlider
              label="Tốc độ phát"
              value={motion.speed ?? 1}
              min={0.1}
              max={4}
              step={0.05}
              unit="×"
              hint="Nhanh / chậm hơn chu kỳ gốc"
              onChange={(speed) => setMotion({ ...motion, speed }, `plant:${spine.id}:motion-speed`)}
            />
            <MotionSlider
              label="Ngọn trễ nhịp"
              value={motion.lag ?? 0}
              min={0}
              max={1}
              step={0.01}
              unit="s"
              hint="Ngọn đi sau gốc → thân mềm uốn lượn tự nhiên"
              onChange={(lag) => setMotion({ ...motion, lag }, `plant:${spine.id}:motion-lag`)}
            />
            <MotionSlider
              label="Hoà trộn gió"
              value={motion.windMix ?? 0}
              min={0}
              max={1}
              step={0.05}
              hint="Chồng thêm gió tự nhiên lên chuyển động này"
              onChange={(windMix) =>
                setMotion({ ...motion, windMix }, `plant:${spine.id}:motion-wind`)
              }
            />
          </div>
          <div className="lw-plant-actions">
            <button
              type="button"
              className="btn sm"
              title="Lật chiều trái ↔ phải"
              onClick={() => setMotion(mirrorPlantMotion(motion))}
            >
              ⇋ Lật chiều
            </button>
            <button
              type="button"
              className="btn sm"
              title="Tăng biên độ 25%"
              onClick={() => setMotion(scalePlantMotion(motion, 1.25))}
            >
              ＋ Mạnh hơn
            </button>
            <button
              type="button"
              className="btn sm"
              title="Giảm biên độ 20%"
              onClick={() => setMotion(scalePlantMotion(motion, 0.8))}
            >
              － Nhẹ hơn
            </button>
            <button
              type="button"
              className="btn sm"
              title="Xoá nhịp riêng, quay về thông số gió tự nhiên"
              onClick={() => patch({ motion: undefined })}
            >
              ↺ Về gió tự nhiên
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return (
    !!el &&
    (['input', 'textarea', 'select'].includes(el.tagName?.toLowerCase()) || el.isContentEditable)
  )
}

/** Thanh nổi trên Bố cục 2D (tab Thực vật): chế độ tay nắm, vẽ quỹ đạo ngọn (R), kiểu kết thúc, bóng layer (L). */
export function PlantMotionChips() {
  const editor = usePlantSpineEditor()
  const callouts = useLayerAssemblyCalloutPrefs()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'r') {
        e.preventDefault()
        setPlantSpineEditorState({ pathRecord: !getPlantSpineEditorState().pathRecord })
      } else if (k === 'l') {
        e.preventDefault()
        toggleCalloutEnabled()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const chip = (
    active: boolean,
    label: string,
    title: string,
    onClick: () => void,
    extra = '',
    kbd = ''
  ) => (
    <button
      type="button"
      className={`lw-anim-chip${active ? ` active${extra}` : ''}`}
      title={title}
      onClick={onClick}
    >
      {label} {kbd && <kbd>{kbd}</kbd>}
    </button>
  )
  const status = editor.pathRecord
    ? editor.selectedSpineId
      ? 'Nhấn giữ chuột trên khung và vẽ quỹ đạo ngọn — thả để lưu'
      : 'Chọn một xương trước (click gần xương)'
    : ''
  return (
    <div className="lw-anim-chips lw-plant-motion-chips">
      <div className="lw-anim-chips-row" role="toolbar" aria-label="Công cụ chuyển động thực vật">
        {chip(
          editor.pathRecord,
          editor.pathRecord ? '● Đang vẽ' : '● Quỹ đạo',
          'Bật/tắt vẽ quỹ đạo: ngọn cây bám theo bút và ghi thành chuyển động (R)',
          () => setPlantSpineEditorState({ pathRecord: !editor.pathRecord }),
          ' recording',
          'R'
        )}
        {chip(
          editor.grabMode === 'record',
          editor.grabMode === 'record' ? '✍️ Ghi nhịp' : '🌬️ Nhịp gió',
          'Đổi hành vi của vòng tròn ở ngọn: ghi chuyển động vẽ tay ↔ học nhịp gió',
          () =>
            setPlantSpineEditorState({
              grabMode: editor.grabMode === 'record' ? 'learn' : 'record'
            })
        )}
        {chip(
          editor.recordEnd === 'spring',
          editor.recordEnd === 'spring' ? '🪀 Nảy về' : '🔁 Lặp lại',
          'Kết thúc bản ghi: lặp đúng cử chỉ ↔ bật nảy tắt dần về nghỉ',
          () =>
            setPlantSpineEditorState({
              recordEnd: editor.recordEnd === 'spring' ? 'loop' : 'spring'
            })
        )}
        <button
          type="button"
          className={`lw-anim-chip${callouts.enabled ? ' active' : ''}`}
          title={`Bóng chọn nhanh Layer (L) · Click: ${callouts.enabled ? 'Tắt' : 'Bật'} · Chuột phải / Nhấp đúp: Đổi kiểu dây (${callouts.lineStyle === 'smoothstep' ? 'Vuông bo → Cung tròn' : 'Cung tròn → Vuông bo'})`}
          onClick={callouts.toggleEnabled}
          onDoubleClick={(e) => {
            e.stopPropagation()
            callouts.changeLineStyle(callouts.lineStyle === 'smoothstep' ? 'bezier' : 'smoothstep')
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            callouts.changeLineStyle(callouts.lineStyle === 'smoothstep' ? 'bezier' : 'smoothstep')
          }}
        >
          {callouts.enabled
            ? `🫧 Bóng (${callouts.lineStyle === 'smoothstep' ? '∟' : '〜'})`
            : '🫧 Bóng'} <kbd>L</kbd>
        </button>
      </div>
      {status && <span className="lw-anim-chip-status">{status}</span>}
    </div>
  )
}
