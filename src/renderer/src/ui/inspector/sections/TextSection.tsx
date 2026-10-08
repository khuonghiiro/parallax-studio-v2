import type { TextProps } from '@shared/types'
import { ColorInput, NumberInput, Row, Select, Switch, TextInput } from '../../controls'
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
        <Select
          value={props.fontFamily}
          options={FONTS.map((f) => ({ value: f, label: f }))}
          onChange={(val) => p((t) => void (t.fontFamily = String(val)))}
        />
      </Row>
      <Row label="Cỡ / Độ đậm">
        <NumberInput axis="px" value={props.fontSize} min={6} max={600} step={1} precision={0} onChange={(v, k) => p((t) => void (t.fontSize = v), k)} />
        <Select
          value={props.fontWeight}
          options={[400, 500, 600, 700, 800].map((w) => ({
            value: w,
            label: `${w}`
          }))}
          onChange={(val) => p((t) => void (t.fontWeight = Number(val)))}
        />
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
