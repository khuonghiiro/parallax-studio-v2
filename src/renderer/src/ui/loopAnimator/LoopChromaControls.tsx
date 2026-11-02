import React from 'react'
import { ColorInput } from '../controls/ColorPicker'
import { IconEyedropper, IconWand } from '../icons'
import { useLoopAnimator } from './loopAnimatorState'

interface Props {
  eyedropperActive: boolean
  onToggleEyedropper: () => void
  onAutoDetect: () => void
}

/** Thanh trượt có nhãn + giá trị, căn cột gọn gàng */
export function LoopRangeField({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange
}: {
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}): React.ReactElement {
  return (
    <label className="la-range">
      <span className="la-range-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="la-range-value">{display}</span>
    </label>
  )
}

const KEY_SWATCHES = ['#00ff00', '#ff00ff', '#0000ff', '#ffffff', '#000000']

/** Khối tách nền Chroma Key: bật/tắt, chọn màu nền, chấm màu, tự nhận nền và 3 thanh tinh chỉnh */
export function LoopChromaControls({ eyedropperActive, onToggleEyedropper, onAutoDetect }: Props): React.ReactElement {
  const chromaKey = useLoopAnimator((s) => s.chromaKey)
  const setChromaKey = useLoopAnimator((s) => s.setChromaKey)
  const pct = (v: number): string => `${Math.round(v * 100)}%`

  return (
    <div className={`loop-chroma-bar${chromaKey.enabled ? ' is-on' : ''}`} data-mcp-region="loop_animator_chroma">
      <div className="loop-ctrl-group">
        <label className="la-switch" title="Bật tách nền theo màu (Chroma Key)">
          <input type="checkbox" checked={chromaKey.enabled} onChange={(e) => setChromaKey({ enabled: e.target.checked })} />
          <span className="la-switch-track" aria-hidden />
          <span className="la-switch-text">Tách nền</span>
        </label>
        {chromaKey.enabled && (
          <>
            <ColorInput value={chromaKey.keyColor} onChange={(v) => setChromaKey({ keyColor: v })} compact showText={false} title="Màu nền cần xoá" />
            <div className="loop-swatches" role="group" aria-label="Màu nền nhanh">
              {KEY_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`loop-swatch${chromaKey.keyColor.toLowerCase() === c ? ' active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setChromaKey({ keyColor: c })}
                  title={`Xoá nền ${c}`}
                  aria-label={`Xoá nền ${c}`}
                />
              ))}
            </div>
            <button type="button" className={`la-btn la-btn--sm ${eyedropperActive ? 'la-btn--primary' : 'la-btn--outline'}`} onClick={onToggleEyedropper} title="Bấm rồi chấm vào nền trên ảnh gốc để lấy màu">
              <IconEyedropper width={12} height={12} />
              <span>{eyedropperActive ? 'Đang chấm…' : 'Chấm màu'}</span>
            </button>
            <button type="button" className="la-btn la-btn--outline la-btn--sm" onClick={onAutoDetect} title="Tự nhận diện màu nền ở 4 góc ảnh">
              <IconWand width={12} height={12} />
              <span>Tự nhận nền</span>
            </button>
          </>
        )}
      </div>
      {chromaKey.enabled && (
        <div className="loop-chroma-sliders">
          <LoopRangeField label="Độ nhạy" value={chromaKey.similarity} display={pct(chromaKey.similarity)} min={0.05} max={0.75} step={0.01} onChange={(v) => setChromaKey({ similarity: v })} />
          <LoopRangeField label="Mềm biên" value={chromaKey.smoothness} display={pct(chromaKey.smoothness)} min={0.01} max={0.35} step={0.01} onChange={(v) => setChromaKey({ smoothness: v })} />
          <LoopRangeField label="Khử ám màu" value={chromaKey.spill} display={pct(chromaKey.spill)} min={0} max={1} step={0.05} onChange={(v) => setChromaKey({ spill: v })} />
        </div>
      )}
    </div>
  )
}
