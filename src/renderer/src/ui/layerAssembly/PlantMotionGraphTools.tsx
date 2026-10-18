import type { PlantSpineMotion } from '@shared/plantSpine'
import { balancePlantMotion, insertPlantKey, movePlantKey, simplifyPlantMotion, smoothPlantMotion } from './plantMotionEdit'

function NumInput({ label, value, step, unit, onCommit }: { label: string; value: number; step: number; unit: string; onCommit: (v: number) => void }) {
  return (
    <label className="lw-plant-key-field" title={label}>
      <span>{label}</span>
      <input type="number" step={step} value={Number(value.toFixed(3))}
        onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onCommit(v) }}
        onKeyDown={(e) => e.stopPropagation()} />
      <em>{unit}</em>
    </label>
  )
}

/** Thanh công cụ đồ thị nhịp: nhập số chính xác cho mốc đang chọn + làm gọn / làm mượt / cân đối / thêm – xoá mốc. */
export function PlantMotionGraphTools({ motion, selected, onChange, onSelect, onRemove }: {
  motion: PlantSpineMotion
  selected: number | null
  onChange: (next: PlantSpineMotion) => void
  onSelect: (index: number | null) => void
  onRemove: (index: number) => void
}) {
  const key = selected !== null ? motion.keys[selected] : null
  const addAfter = () => {
    const i = selected ?? 0
    const a = motion.keys[i]
    const b = motion.keys[i + 1]
    const t = b ? (a.t + b.t) / 2 : (a.t + motion.duration) / 2
    const res = insertPlantKey(motion, t)
    if (res.motion !== motion) onChange(res.motion)
    if (res.index >= 0) onSelect(res.index)
  }
  return (
    <div className="lw-plant-graph-tools">
      {key && selected !== null ? (
        <div className="lw-plant-key-row">
          <span className="lw-plant-key-badge">◆ {selected + 1}/{motion.keys.length}</span>
          <NumInput label="Thời điểm" value={key.t} step={0.01} unit="s" onCommit={(t) => onChange(movePlantKey(motion, selected, t, key.angle))} />
          <NumInput label="Góc ngọn" value={key.angle} step={0.5} unit="°" onCommit={(a) => onChange(movePlantKey(motion, selected, key.t, a))} />
        </div>
      ) : (
        <p className="lw-plant-graph-hint">Nhấp đúp lên đồ thị để <b>thêm mốc</b> · kéo chấm vàng (cả ngang lẫn dọc) · chuột phải để <b>xoá</b> · chọn mốc rồi dùng ↑↓←→.</p>
      )}
      <div className="lw-plant-graph-actions">
        <button type="button" className="btn xs" onClick={addAfter} title="Chèn một mốc vào giữa mốc đang chọn và mốc kế tiếp">＋ Mốc</button>
        <button type="button" className="btn xs" disabled={selected === null || motion.keys.length <= 2} onClick={() => selected !== null && onRemove(selected)} title="Xoá mốc đang chọn (Delete)">－ Mốc</button>
        <button type="button" className="btn xs" disabled={motion.keys.length <= 12} onClick={() => { onChange(simplifyPlantMotion(motion, 12)); onSelect(null) }} title="Rút bản ghi dày đặc còn ~12 mốc giữ nguyên dáng — dễ sửa tay từng mốc">✂ Làm gọn</button>
        <button type="button" className="btn xs" onClick={() => onChange(smoothPlantMotion(motion))} title="Làm mượt đường cong, khử rung tay">〜 Làm mượt</button>
        <button type="button" className="btn xs" onClick={() => { onChange(balancePlantMotion(motion)); onSelect(null) }} title="Nửa sau chu kỳ là ảnh gương nửa đầu → lắc đều hai bên">⚖ Cân đối</button>
      </div>
    </div>
  )
}
