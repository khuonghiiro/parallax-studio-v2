import type { ParticleProps, Vec3 } from '@shared/types'
import { PARTICLE_PRESETS } from '../../../animation/presets'
import { ColorInput, NumberInput, Row, Switch } from '../../controls'
import { IconWand } from '../../icons'
import type { Setter } from '../types'

export function ParticleSection({ props, set }: { props: ParticleProps; set: Setter }) {
  const p = (fn: (pp: ParticleProps) => void, key?: string): void =>
    set((l) => {
      if (l.type === 'particles') fn(l.props)
    }, key)
  const vec = (field: 'velocity' | 'area', i: number, v: number, k: string): void =>
    p((pp) => {
      const next = [...pp[field]] as Vec3
      next[i] = v
      pp[field] = next
    }, k)
  return (
    <div className="section">
      <div className="section-title">
        Particles <span className="spacer" />
        <button className="btn sm" title="Đổi seed ngẫu nhiên" onClick={() => p((pp) => void (pp.seed = Math.floor(Math.random() * 1e6)))}>
          <IconWand /> Seed
        </button>
      </div>
      <Row label="Mẫu hạt" title="Chọn nhanh các hiệu ứng hạt và thời tiết">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, width: '100%', minWidth: 0 }}>
          {Object.entries(PARTICLE_PRESETS).map(([key, item]) => (
            <button
              key={key}
              className="btn sm ghost"
              style={{ flex: '1 1 50px', padding: '2px 4px', fontSize: '9.5px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onClick={() => p((pp) => Object.assign(pp, item.props))}
              title={item.hint}
            >
              {item.label.split(' / ')[0]}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Số lượng">
        <NumberInput axis="#" value={props.count} min={1} max={20000} step={5} precision={0} onChange={(v, k) => p((pp) => void (pp.count = Math.round(v)), k)} />
      </Row>
      <Row label="Kích thước">
        <NumberInput axis="px" value={props.size} min={0.5} max={200} step={0.1} precision={1} onChange={(v, k) => p((pp) => void (pp.size = v), k)} />
      </Row>
      <Row label="Màu">
        <ColorInput value={props.color} onChange={(v, k) => p((pp) => void (pp.color = v), k)} />
      </Row>
      <Row label="Vận tốc">
        {[0, 1, 2].map((i) => (
          <NumberInput key={i} axis={'xyz'[i]} value={props.velocity[i]} step={0.5} precision={0} onChange={(v, k) => vec('velocity', i, v, k)} />
        ))}
      </Row>
      <Row label="Vùng phát">
        {[0, 1, 2].map((i) => (
          <NumberInput key={i} axis={'xyz'[i]} value={props.area[i]} min={10} step={5} precision={0} onChange={(v, k) => vec('area', i, v, k)} />
        ))}
      </Row>
      <Row label="Lắc lư">
        <NumberInput axis="~" value={props.sway} min={0} max={1000} step={0.5} precision={0} onChange={(v, k) => p((pp) => void (pp.sway = v), k)} />
      </Row>
      <Row label="Nhấp nháy">
        <Switch on={props.twinkle} onChange={(v) => p((pp) => void (pp.twinkle = v))} />
      </Row>
      <Row label="Phát sáng">
        <Switch on={props.glow} onChange={(v) => p((pp) => void (pp.glow = v))} />
      </Row>
    </div>
  )
}
