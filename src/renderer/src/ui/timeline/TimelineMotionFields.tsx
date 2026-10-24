import type { EaseName, EaseOptions } from '@shared/types'
import { ease } from '../../animation/easing'
import { NumberInput } from '../controls'

export function TimelineMotionFields({ mode, options, setOptions }: {
  mode: EaseName; options: EaseOptions; setOptions: (options: EaseOptions) => void
}) {
  const field = (label: string, key: keyof EaseOptions, initial: number, min: number, max: number, percent = false) =>
    <div className="tl-motion-field"><span>{label}</span><NumberInput value={(options[key] ?? initial) * (percent ? 100 : 1)}
      onChange={value => setOptions({ ...options, [key]: key === 'cycles' ? Math.round(value) : value / (percent ? 100 : 1) })} min={min} max={max}
      step={1} precision={0} suffix={percent ? '%' : ''} /></div>
  return <div className="tl-motion-fields">
    {['easeIn', 'easeOut', 'easeInOut', 'easeInOutStrong'].includes(mode) && field('Độ mượt', 'strength', 1, 0, 100, true)}
    {(mode === 'pulse' || mode === 'blink') && field('Số nhịp trong đoạn', 'cycles', 3, 1, 30)}
    {mode === 'hold' && field('Giữ đến % thời lượng', 'holdUntil', 1, 1, 100, true)}
    {mode === 'blink' && field('Thời gian ở giá trị đầu', 'duty', .5, 5, 95, true)}
    {mode === 'linear' && <p>Tốc độ không đổi giữa hai mốc. Kéo giãn khoảng thời gian để chuyển động chậm hơn.</p>}
  </div>
}

export function TimelineMotionCurve({ mode, options }: { mode: EaseName; options: EaseOptions }) {
  const path = Array.from({ length: 241 }, (_, i) => `${i ? 'L' : 'M'}${8 + i},${72 - ease(mode, i / 240, options) * 60}`).join(' ')
  return <svg className="tl-motion-curve" viewBox="0 0 256 84" role="img" aria-label="Xem trước giá trị nội suy từ mốc đầu tới mốc cuối">
    <path className="tl-motion-grid" d="M8 12H248M8 42H248M8 72H248M8 12V72M128 12V72M248 12V72" />
    <path d={path} className="tl-motion-path" />
  </svg>
}
