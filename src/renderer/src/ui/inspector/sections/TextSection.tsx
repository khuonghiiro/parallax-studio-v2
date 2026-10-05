import type { TextProps } from '@shared/types'
import { ColorInput, NumberInput, Row, Switch, TextInput } from '../../controls'
import { FONTS, type Setter } from '../types'

export function TextSection({ props, set }: { props: TextProps; set: Setter }) {
  const p = (fn: (tp: TextProps) => void, key?: string): void =>
    set((l) => {
      if (l.type === 'text') fn(l.props)
    }, key)
  return (
    <div className="section">
      <div className="section-title">Text</div>
      <TextInput id="text-content" multiline value={props.text} onCommit={(v) => p((t) => void (t.text = v), 'text')} />
      <div style={{ height: 6 }} />
      <Row label="Font">
        <select className="select" value={props.fontFamily} onChange={(e) => p((t) => void (t.fontFamily = e.target.value))}>
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Cỡ / Độ đậm">
        <NumberInput axis="px" value={props.fontSize} min={6} max={600} step={1} precision={0} onChange={(v, k) => p((t) => void (t.fontSize = v), k)} />
        <select className="select" value={props.fontWeight} onChange={(e) => p((t) => void (t.fontWeight = Number(e.target.value)))}>
          {[400, 500, 600, 700, 800].map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Giãn chữ">
        <NumberInput axis="↔" value={props.letterSpacing} min={-20} max={100} step={0.5} precision={1} onChange={(v, k) => p((t) => void (t.letterSpacing = v), k)} />
      </Row>
      <Row label="Màu">
        <ColorInput value={props.color} onChange={(v, k) => p((t) => void (t.color = v), k)} />
      </Row>
      <Row label="Đổ bóng">
        <Switch on={props.shadow} onChange={(v) => p((t) => void (t.shadow = v))} />
      </Row>
    </div>
  )
}
