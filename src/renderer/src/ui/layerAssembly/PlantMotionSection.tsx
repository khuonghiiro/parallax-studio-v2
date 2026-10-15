import { useEffect } from 'react'
import type { PlantSpine, PlantSpineMotion } from '@shared/plantSpine'
import { getPlantSpineEditorState, setPlantSpineEditorState, usePlantSpineEditor, type PlantGrabMode } from './plantSpineEditorStore'
import type { PlantRecordEnd } from './plantMotionRecord'
import { mirrorPlantMotion, scalePlantMotion } from './plantMotionRecord'
import { PlantMotionGraph } from './PlantMotionGraph'

function Seg<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string, string]>; onChange: (v: T) => void }) {
  return (
    <div className="lw-plant-seg" role="radiogroup">
      {options.map(([v, label, hint]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} title={hint}
          className={value === v ? 'active' : ''} onClick={(e) => { e.stopPropagation(); onChange(v) }}>{label}</button>
      ))}
    </div>
  )
}

const GRAB_MODES: Array<[PlantGrabMode, string, string]> = [
  ['record', '✍️ Ghi chuyển động', 'Nắm ngọn kéo theo nhịp bạn muốn — app ghi lại đúng từng cử động và lặp lại'],
  ['learn', '🌬️ Học nhịp gió', 'Nắm ngọn lắc qua lại — app chỉ học biên độ / nghiêng / tốc độ cho gió tự động']
]
const RECORD_ENDS: Array<[PlantRecordEnd, string, string]> = [
  ['loop', '🔁 Lặp đúng cử chỉ', 'Phát lặp lại đúng cử chỉ vừa vẽ, tự khép vòng liền mạch'],
  ['spring', '🪀 Thả là nảy về', 'Sau khi thả tay, cây bật nảy tắt dần về tư thế nghỉ như lò xo']
]

function MotionSlider({ label, value, min, max, step, unit, hint, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string; hint: string; onChange: (v: number) => void
}) {
  return (
    <label className="lw-plant-slider" title={hint} onClick={(e) => e.stopPropagation()}>
      <span className="lw-plant-slider-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="lw-plant-slider-val">{value}{unit ?? ''}</span>
    </label>
  )
}

/** Mục "Chuyển động" của xương thực vật: ghi chuyển động vẽ tay, biểu đồ sửa mốc và tinh chỉnh phát lại. */
export function PlantMotionSection({ spine, patch }: {
  spine: PlantSpine
  patch: (p: Partial<PlantSpine>, key?: string) => void
}) {
  const editor = usePlantSpineEditor()
  const motion = spine.motion
  const setMotion = (m: PlantSpineMotion, key?: string) => patch({ motion: m }, key)
  return (
    <div className="lw-plant-motion" onClick={(e) => e.stopPropagation()}>
      <div className="lw-plant-motion-head">
        <span className="lw-plant-section-label">🎬 Chuyển động</span>
        <span className={`lw-plant-motion-badge${motion ? ' recorded' : ''}`}>{motion ? '✍️ Vẽ tay' : '🌬️ Gió tự nhiên'}</span>
      </div>
      <div className="lw-plant-motion-row"><span>Tay nắm ngọn</span>
        <Seg value={editor.grabMode} options={GRAB_MODES} onChange={(grabMode) => setPlantSpineEditorState({ grabMode })} />
      </div>
      <div className="lw-plant-motion-row"><span>Khi thả tay</span>
        <Seg value={editor.recordEnd} options={RECORD_ENDS} onChange={(recordEnd) => setPlantSpineEditorState({ recordEnd })} />
      </div>
      <button type="button" className={`btn sm lw-plant-record-btn${editor.pathRecord ? ' armed' : ''}`}
        title="Bật rồi nhấn giữ chuột ở bất kỳ đâu trên Bố cục 2D: ngọn cây bám theo bút, thả chuột để lưu (phím R)"
        onClick={() => setPlantSpineEditorState({ pathRecord: !editor.pathRecord })}>
        {editor.pathRecord ? '● Đang chờ vẽ quỹ đạo — nhấn giữ trên khung (R để tắt)' : '● Ghi chuyển động mới bằng vẽ quỹ đạo (R)'}
      </button>
      {!motion && (
        <p className="lw-plant-motion-hint">
          Nắm <strong>vòng tròn ở ngọn</strong> kéo theo nhịp bạn muốn, hoặc bật <strong>R</strong> rồi vẽ quỹ đạo ngọn bằng chuột.
          Thả chuột là cây phát lại đúng chuyển động — xuất video giữ nguyên.
        </p>
      )}
      {motion && (
        <>
          <PlantMotionGraph motion={motion} onChange={(m) => setMotion(m, `plant:${spine.id}:motion-graph`)} />
          <MotionSlider label="Tốc độ phát" value={motion.speed ?? 1} min={0.1} max={4} step={0.05} unit="×"
            hint="Nhanh / chậm hơn nhịp tay đã ghi" onChange={(speed) => setMotion({ ...motion, speed }, `plant:${spine.id}:motion-speed`)} />
          <MotionSlider label="Ngọn trễ nhịp" value={motion.lag ?? 0} min={0} max={1} step={0.01} unit="s"
            hint="Ngọn đi sau gốc → thân mềm đánh roi tự nhiên" onChange={(lag) => setMotion({ ...motion, lag }, `plant:${spine.id}:motion-lag`)} />
          <MotionSlider label="Trộn gió" value={motion.windMix ?? 0} min={0} max={1} step={0.05}
            hint="Chồng thêm gió tự nhiên (theo các thông số gió bên dưới)" onChange={(windMix) => setMotion({ ...motion, windMix }, `plant:${spine.id}:motion-wind`)} />
          <div className="lw-plant-actions">
            <button type="button" className="btn sm" title="Lật chiều trái ↔ phải" onClick={() => setMotion(mirrorPlantMotion(motion))}>⇋ Lật chiều</button>
            <button type="button" className="btn sm" title="Tăng biên độ 25%" onClick={() => setMotion(scalePlantMotion(motion, 1.25))}>＋ Mạnh hơn</button>
            <button type="button" className="btn sm" title="Giảm biên độ 20%" onClick={() => setMotion(scalePlantMotion(motion, 0.8))}>－ Nhẹ hơn</button>
            <button type="button" className="btn sm" title="Xoá bản ghi, quay về gió tự nhiên" onClick={() => patch({ motion: undefined })}>Về gió tự nhiên</button>
          </div>
        </>
      )}
    </div>
  )
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (['input', 'textarea', 'select'].includes(el.tagName?.toLowerCase()) || el.isContentEditable)
}

/** Thanh nổi trên Bố cục 2D (tab Thực vật): chế độ tay nắm, vẽ quỹ đạo ngọn (R), kiểu kết thúc. */
export function PlantMotionChips() {
  const editor = usePlantSpineEditor()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'r') return
      e.preventDefault()
      setPlantSpineEditorState({ pathRecord: !getPlantSpineEditorState().pathRecord })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const chip = (active: boolean, label: string, title: string, onClick: () => void, extra = '') => (
    <button type="button" className={`lw-anim-chip${active ? ` active${extra}` : ''}`} title={title} onClick={onClick}>{label}</button>
  )
  const status = editor.pathRecord
    ? (editor.selectedSpineId ? 'Nhấn giữ chuột trên khung và vẽ quỹ đạo ngọn — thả để lưu' : 'Chọn một xương trước (click gần xương)')
    : ''
  return (
    <div className="lw-anim-chips lw-plant-motion-chips">
      <div className="lw-anim-chips-row" role="toolbar" aria-label="Công cụ chuyển động thực vật">
        {chip(editor.pathRecord, editor.pathRecord ? '● Đang ghi quỹ đạo  R' : '● Vẽ quỹ đạo ngọn  R', 'Bật/tắt vẽ quỹ đạo: ngọn cây bám theo bút và ghi thành chuyển động', () => setPlantSpineEditorState({ pathRecord: !editor.pathRecord }), ' recording')}
        {chip(editor.grabMode === 'record', editor.grabMode === 'record' ? '✍️ Tay nắm: ghi' : '🌬️ Tay nắm: học gió', 'Đổi hành vi của vòng tròn ở ngọn: ghi chuyển động vẽ tay ↔ học nhịp gió', () => setPlantSpineEditorState({ grabMode: editor.grabMode === 'record' ? 'learn' : 'record' }))}
        {chip(editor.recordEnd === 'spring', editor.recordEnd === 'spring' ? '🪀 Thả: nảy về' : '🔁 Thả: lặp lại', 'Kết thúc bản ghi: lặp đúng cử chỉ ↔ bật nảy tắt dần về nghỉ', () => setPlantSpineEditorState({ recordEnd: editor.recordEnd === 'spring' ? 'loop' : 'spring' }))}
      </div>
      {status && <span className="lw-anim-chip-status">{status}</span>}
    </div>
  )
}
