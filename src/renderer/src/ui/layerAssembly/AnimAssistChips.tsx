import { useEffect } from 'react'
import { toggleMotionSketchArmed, useMotionSketch } from './motionSketchStore'
import { getAnimAssist, setAnimAssist, useAnimAssist } from './animAssistStore'
import { useLayerAssemblyCalloutPrefs, toggleCalloutEnabled } from './LayerAssemblyCalloutOverlay'
import { useStepRecord } from './workshopStepRecord'
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

/** Thanh công cụ nổi trên Bố cục 2D (tab Animation): Xác nhận vị trí (Enter), Bút vẽ động tác, IK, Onion skin, Quỹ đạo, Bóng layer. */
export function AnimAssistChips({ onConfirmStep }: { onConfirmStep?: () => void }) {
  const sketch = useMotionSketch()
  const assist = useAnimAssist()
  const callouts = useLayerAssemblyCalloutPrefs()
  const stepRecord = useStepRecord()
  useAssistKeys()

  const chip = (active: boolean, label: string, kbd: string, title: string, onClick: () => void, extra = '') => (
    <button type="button" className={`lw-anim-chip${active ? ` active${extra}` : ''}`} title={title} onClick={onClick}>
      {label} <kbd>{kbd}</kbd>
    </button>
  )

  const statusText = stepRecord.status || (sketch.armed ? sketch.status : '')

  return (
    <div className="lw-anim-chips">
      <div className="lw-anim-chips-row" role="toolbar" aria-label="Công cụ hoạt họa">
        {onConfirmStep && (
          <button
            type="button"
            className={`lw-anim-chip lw-anim-chip-confirm${stepRecord.pendingConfirm ? ' pending' : ''}`}
            title={`Xác nhận tư thế xương hiện tại và tự nhảy sang mốc tiếp theo (+${stepRecord.stepDuration}s) · Phím tắt: Enter`}
            onClick={onConfirmStep}
          >
            ✓ Xác nhận <kbd>Enter ⏎</kbd>
          </button>
        )}
        {chip(
          sketch.armed,
          sketch.armed ? '● Đang vẽ' : '✏️ Bút vẽ',
          'D',
          'Bật/tắt bút vẽ tự do (Hoặc giữ trực tiếp Shift + Chuột trái trên xương để ghi Realtime ngay)',
          () => toggleMotionSketchArmed(),
          ' recording'
        )}
        {chip(
          assist.ik,
          `🦾 IK ${assist.ikChain}`,
          'I',
          'Kéo ngọn xương thì chuỗi xương chi xoay theo (Ctrl khi kéo = đảo tạm)',
          () => setAnimAssist({ ik: !assist.ik })
        )}
        {chip(
          assist.onion,
          '👻 Onion',
          'O',
          'Hiện bóng mờ khung xương ở các thời điểm trước (vàng) và sau (xanh)',
          () => setAnimAssist({ onion: !assist.onion })
        )}
        {chip(
          assist.path,
          '〰 Quỹ đạo',
          'P',
          'Hiện đường đi của ngọn xương đang chọn trong cả clip',
          () => setAnimAssist({ path: !assist.path })
        )}
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
      {statusText && <span className="lw-anim-chip-status">{statusText}</span>}
    </div>
  )
}
