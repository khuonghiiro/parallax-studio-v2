import type { SolidProps } from '@shared/types'
import { ColorInput, NumberInput, Row, Switch } from '../../controls'
import type { Setter } from '../types'

export function SolidSection({ props, set }: { props: SolidProps; set: Setter }) {
  const p = (fn: (sp: SolidProps) => void, key?: string): void =>
    set((l) => {
      if (l.type === 'solid') fn(l.props)
    }, key)
  return (
    <div className="section">
      <div className="section-title">Solid / Gradient</div>
      <Row label="Màu trên">
        <ColorInput value={props.color} onChange={(v, k) => p((s) => void (s.color = v), k)} />
      </Row>
      <Row label="Gradient">
        <Switch on={props.gradient} onChange={(v) => p((s) => void (s.gradient = v))} />
      </Row>
      {props.gradient && (
        <Row label="Màu dưới">
          <ColorInput value={props.color2} onChange={(v, k) => p((s) => void (s.color2 = v), k)} />
        </Row>
      )}
      <Row label="Hoạ tiết / Lưới" title="Thêm lưới toạ độ hoặc sọc để nhìn rõ phối cảnh chiều sâu mặt đất">
        <select
          className="select"
          value={props.pattern ?? 'none'}
          onChange={(e) => p((s) => void (s.pattern = e.target.value as any))}
        >
          <option value="none">Trơn / Gradient</option>
          <option value="grid">Lưới phối cảnh 3D (Grid)</option>
          <option value="stripes">Sọc chiều sâu</option>
          <option value="dots">Chấm toạ độ</option>
        </select>
      </Row>
      {props.pattern && props.pattern !== 'none' && (
        <Row label="Cỡ lưới">
          <NumberInput
            axis="px"
            value={props.gridSize ?? 40}
            min={16}
            max={200}
            step={5}
            precision={0}
            onChange={(v, k) => p((s) => void (s.gridSize = v), k)}
          />
        </Row>
      )}
      <Row label="Rộng / Cao">
        <NumberInput axis="w" value={props.width} min={1} step={2} precision={0} onChange={(v, k) => p((s) => void (s.width = v), k)} />
        <NumberInput axis="h" value={props.height} min={1} step={2} precision={0} onChange={(v, k) => p((s) => void (s.height = v), k)} />
      </Row>
    </div>
  )
}
