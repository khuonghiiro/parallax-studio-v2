import React from 'react'
import { ColorInput } from '../controls/ColorPicker'
import { IconEyedropper, IconWand } from '../icons'
import { useLoopAnimator } from './loopAnimatorState'
import { resolveLoopIsolationMode } from './loopChromaProcessor'
import type { LoopShadowMode, LoopShadowType } from './types'

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

const SHADOW_MODES: { id: LoopShadowMode; label: string; title: string }[] = [
  { id: 'off', label: 'Xoá bóng', title: 'Xoá toàn bộ bóng và quầng bán trong suốt cùng nền' },
  { id: 'include', label: '☁️ Lấy cả bóng', title: 'Giữ lại cả vật thể chính lẫn bóng mờ / hào quang bán trong suốt' },
  { id: 'only', label: '👻 Chỉ lấy bóng', title: 'Chỉ trích xuất riêng lớp bóng mờ / hào quang bán trong suốt' }
]

const SHADOW_TYPES: { id: LoopShadowType; label: string; title: string }[] = [
  { id: 'auto', label: 'Tự động', title: 'Tự nhận diện cả hào quang sáng và bóng tối' },
  { id: 'light', label: 'Mây/Sáng', title: 'Chỉ giữ hào quang sáng / tia sáng / mây khói' },
  { id: 'dark', label: 'Bóng tối', title: 'Chỉ giữ bóng đổ tối dưới chân vật thể' }
]

/** Khối tách nền Chroma Key: bật/tắt, chọn màu nền, chấm màu, tự nhận nền, 3 thanh tinh chỉnh và thanh Bóng mờ */
export function LoopChromaControls({ eyedropperActive, onToggleEyedropper, onAutoDetect }: Props): React.ReactElement {
  const chromaKey = useLoopAnimator((s) => s.chromaKey)
  const setChromaKey = useLoopAnimator((s) => s.setChromaKey)
  const pct = (v: number): string => `${Math.round(v * 100)}%`

  const shadowMode: LoopShadowMode = chromaKey.shadowMode ?? 'off'
  const shadowType: LoopShadowType = chromaKey.shadowType ?? 'auto'
  const shadowRetention = chromaKey.shadowRetention ?? 68
  const shadowSolidThreshold = chromaKey.shadowSolidThreshold ?? 62
  const shadowUnmixColor = chromaKey.shadowUnmixColor !== false
  const fullKey = resolveLoopIsolationMode(chromaKey) === 'all'

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
            <label
              className="la-switch loop-isolation-switch"
              title={
                fullKey
                  ? 'Đang TÁCH TOÀN BỘ: xoá cả nền bên trong lẫn bên ngoài viền kín (vòng tròn chỉ còn lại viền). Tắt để chỉ tách nền ngoài.'
                  : 'Đang CHỈ TÁCH NỀN NGOÀI: giữ nguyên phần nền nằm kín bên trong viền (ruột vòng tròn). Bật để tách toàn bộ.'
              }
            >
              <input
                type="checkbox"
                checked={fullKey}
                onChange={(e) => setChromaKey({ isolationMode: e.target.checked ? 'all' : 'outer_only' })}
              />
              <span className="la-switch-track" aria-hidden />
              <span className="la-switch-text">{fullKey ? 'Tách toàn bộ' : 'Chỉ nền ngoài'}</span>
            </label>
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
        <>
          <div className="loop-chroma-sliders">
            <LoopRangeField label="Độ nhạy" value={chromaKey.similarity} display={pct(chromaKey.similarity)} min={0.05} max={0.75} step={0.01} onChange={(v) => setChromaKey({ similarity: v })} />
            <LoopRangeField label="Mềm biên" value={chromaKey.smoothness} display={pct(chromaKey.smoothness)} min={0.01} max={0.35} step={0.01} onChange={(v) => setChromaKey({ smoothness: v })} />
            <LoopRangeField label="Khử ám màu" value={chromaKey.spill} display={pct(chromaKey.spill)} min={0} max={1} step={0.05} onChange={(v) => setChromaKey({ spill: v })} />
          </div>

          <div className="loop-shadow-row">
            <div className="loop-ctrl-group">
              <span className="la-label">Bóng mờ:</span>
              <div className="la-seg" role="group" aria-label="Chế độ tách bóng mờ">
                {SHADOW_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`la-seg-btn${shadowMode === m.id ? ' active' : ''}`}
                    onClick={() => setChromaKey({ shadowMode: m.id })}
                    title={m.title}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {shadowMode !== 'off' && (
              <>
                <div className="loop-ctrl-group">
                  <span className="la-label">Loại:</span>
                  <div className="la-seg" role="group" aria-label="Loại bóng mờ">
                    {SHADOW_TYPES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`la-seg-btn${shadowType === t.id ? ' active' : ''}`}
                        onClick={() => setChromaKey({ shadowType: t.id })}
                        title={t.title}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="loop-shadow-sliders">
                  <LoopRangeField
                    label="Độ đậm"
                    value={shadowRetention}
                    display={`${Math.round(shadowRetention)}%`}
                    min={5}
                    max={100}
                    step={1}
                    onChange={(v) => setChromaKey({ shadowRetention: v })}
                  />
                  <LoopRangeField
                    label="Độ đặc"
                    value={shadowSolidThreshold}
                    display={`${Math.round(shadowSolidThreshold)}%`}
                    min={30}
                    max={90}
                    step={1}
                    onChange={(v) => setChromaKey({ shadowSolidThreshold: v })}
                  />
                  <label className="la-check" title="Tự động giải phương trình pha màu (Color Unmixing) để khử sạch ánh xanh/hồng ám trên bóng mờ và hào quang">
                    <input
                      type="checkbox"
                      checked={shadowUnmixColor}
                      onChange={(e) => setChromaKey({ shadowUnmixColor: e.target.checked })}
                    />
                    <span>Khử ám nền</span>
                  </label>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
