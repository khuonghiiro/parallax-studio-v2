import { useEffect } from 'react'
import { toggleMotionSketchArmed, useMotionSketch } from './motionSketchStore'
import { getAnimAssist, setAnimAssist, useAnimAssist } from './animAssistStore'
import { useLayerAssemblyCalloutPrefs, toggleCalloutEnabled } from './LayerAssemblyCalloutOverlay'
import '../../styles/layerWorkshopAnimAssist.css'

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (['input', 'textarea', 'select'].includes(el.tagName?.toLowerCase()) || el.isContentEditable)
}

/** Phím tắt tab Animation: I = IK · O = Onion skin · P = Quỹ đạo · L = Bóng layer (D = bút vẽ do lớp vẽ động tác xử lý). */
function useAssistKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.toLowerCase()
      const s = getAnimAssist()
      if (key === 'i') setAnimAssist({ ik: !s.ik })
      else if (key === 'o') setAnimAssist({ onion: !s.onion })
      else if (key === 'p') setAnimAssist({ path: !s.path })
      else if (key === 'l') toggleCalloutEnabled()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Thanh công cụ nổi trên Bố cục 2D (tab Animation): bút vẽ động tác, IK, Onion skin, Quỹ đạo, Bóng layer. */
export function AnimAssistChips() {
  const sketch = useMotionSketch()
  const assist = useAnimAssist()
  const callouts = useLayerAssemblyCalloutPrefs()
  useAssistKeys()
  const chip = (active: boolean, label: string, kbd: string, title: string, onClick: () => void, extra = '') => (
    <button type="button" className={`lw-anim-chip${active ? ` active${extra}` : ''}`} title={title} onClick={onClick}>
      {label} <kbd>{kbd}</kbd>
    </button>
  )
  return (
    <div className="lw-anim-chips">
      <div className="lw-anim-chips-row" role="toolbar" aria-label="Công cụ hoạt họa">
        {chip(sketch.armed, sketch.armed ? '● Đang vẽ' : '✏️ Bút vẽ', 'D', 'Bật/tắt bút vẽ động tác: diễn động tác bằng chuột, app ghi thành keyframe', () => toggleMotionSketchArmed(), ' recording')}
        {chip(assist.ik, `🦾 IK ${assist.ikChain}`, 'I', 'Kéo ngọn xương thì cả chuỗi xương cha xoay theo (Ctrl khi kéo = đảo tạm)', () => setAnimAssist({ ik: !assist.ik }))}
        {chip(assist.onion, '👻 Onion', 'O', 'Hiện bóng mờ khung xương ở các thời điểm trước (vàng) và sau (xanh)', () => setAnimAssist({ onion: !assist.onion }))}
        {chip(assist.path, '〰 Quỹ đạo', 'P', 'Hiện đường đi của ngọn xương đang chọn trong cả clip', () => setAnimAssist({ path: !assist.path }))}
        <button
          type="button"
          className={`lw-anim-chip${callouts.enabled ? ' active' : ''}`}
          title="Bật/tắt bóng tròn chọn nhanh layer (phím L)"
          onClick={callouts.toggleEnabled}
        >
          🫧 Bóng <kbd>L</kbd>
        </button>
        {callouts.enabled && (
          <div className="lw-callout-style-group" role="group" aria-label="Kiểu dây nối bóng layer">
            <button
              type="button"
              className={`lw-anim-chip style-sub${callouts.lineStyle === 'bezier' ? ' active' : ''}`}
              title="Kiểu dây nối Vòng cung mềm mại (ReactFlow Bezier)"
              onClick={() => callouts.changeLineStyle('bezier')}
            >
              〜 Cung
            </button>
            <button
              type="button"
              className={`lw-anim-chip style-sub${callouts.lineStyle === 'smoothstep' ? ' active' : ''}`}
              title="Kiểu dây nối Vuông góc bo tròn (ReactFlow SmoothStep)"
              onClick={() => callouts.changeLineStyle('smoothstep')}
            >
              ∟ Vuông
            </button>
          </div>
        )}
      </div>
      {sketch.armed && sketch.status && <span className="lw-anim-chip-status">{sketch.status}</span>}
    </div>
  )
}
