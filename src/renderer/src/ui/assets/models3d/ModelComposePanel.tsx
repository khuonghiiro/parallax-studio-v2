import { useEffect, useMemo, useState } from 'react'
import type { Face3D, Model3D } from './types'
import { fetchDiskModels3D, getStoredModels3D } from './models3dStorage'
import { appendModel, appendModelOnFace, type AppendModelResult } from './assemblyCompose'
import { IconPlus } from '../../icons'

interface ModelComposePanelProps {
  model: Model3D
  selectedFace: Face3D | undefined
  /** New face list + the first merged face to select. */
  onApply: (faces: Face3D[], selectId: string | null) => void
}

/** 3×3 mount points on the host face (UV, v up). */
const MOUNT_POINTS: Array<{ uv: [number, number]; label: string }> = [
  { uv: [0.2, 0.8], label: 'Trên trái' },
  { uv: [0.5, 0.8], label: 'Trên giữa' },
  { uv: [0.8, 0.8], label: 'Trên phải' },
  { uv: [0.2, 0.5], label: 'Giữa trái' },
  { uv: [0.5, 0.5], label: 'Chính giữa' },
  { uv: [0.8, 0.5], label: 'Giữa phải' },
  { uv: [0.2, 0.2], label: 'Dưới trái' },
  { uv: [0.5, 0.2], label: 'Dưới giữa' },
  { uv: [0.8, 0.2], label: 'Dưới phải' }
]

/**
 * "Ghép mô hình đã lưu": merges a saved 3D asset (window, door, chimney, plant…) into the
 * model being assembled — either mounted on the selected face at one of 9 points (the part
 * turns with that face), or placed beside the model. Images and mesh work are kept.
 */
export function ModelComposePanel({ model, selectedFace, onApply }: ModelComposePanelProps) {
  const [library, setLibrary] = useState<Model3D[]>(() => getStoredModels3D())
  const [query, setQuery] = useState('')
  const [mountIdx, setMountIdx] = useState(4)

  useEffect(() => {
    let alive = true
    fetchDiskModels3D().then((list) => alive && setLibrary(list))
    return () => {
      alive = false
    }
  }, [])

  const parts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return library
      .filter((m) => m.id !== model.id && m.faces.length > 0)
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .sort((a, b) => Number(b.category === 'decor') - Number(a.category === 'decor'))
  }, [library, model.id, query])

  const apply = (res: AppendModelResult) => onApply(res.faces, res.addedIds[0] ?? null)

  const mountOnFace = (part: Model3D) => {
    if (!selectedFace) return
    apply(appendModelOnFace(part, model, selectedFace, { uv: MOUNT_POINTS[mountIdx].uv }))
  }

  return (
    <div className="mc-root">
      <div className="mc-mount">
        <div className="mc-mount-pad" role="radiogroup" aria-label="Điểm gắn trên mặt đang chọn">
          {MOUNT_POINTS.map((p, i) => (
            <button
              key={p.label}
              type="button"
              role="radio"
              aria-checked={mountIdx === i}
              className={`mc-mount-dot${mountIdx === i ? ' active' : ''}`}
              title={p.label}
              onClick={() => setMountIdx(i)}
            />
          ))}
        </div>
        <p className="mc-mount-hint">
          {selectedFace
            ? <>Gắn lên mặt <b>{selectedFace.name}</b> tại điểm <b>{MOUNT_POINTS[mountIdx].label}</b> – bộ phận tự xoay theo mặt.</>
            : 'Chọn một mặt (vách/mái) để gắn bộ phận lên đó.'}
        </p>
      </div>

      <input
        type="search"
        className="input-text mc-search"
        placeholder="Tìm mô hình đã lưu…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Tìm mô hình đã lưu để ghép"
      />

      <div className="mc-list">
        {parts.map((m) => (
          <div key={m.id} className="mc-row" title={m.description || m.name}>
            <span className="mc-name">{m.name}</span>
            {m.category === 'decor' && <span className="mc-tag">Trang trí</span>}
            <span className="mc-meta">{m.faces.length} mặt</span>
            <button type="button" className="mc-btn primary" disabled={!selectedFace} onClick={() => mountOnFace(m)}
              title="Gắn lên mặt đang chọn tại điểm đã chọn">
              <IconPlus width={10} height={10} /> Gắn
            </button>
            <button type="button" className="mc-btn" onClick={() => apply(appendModel(m, model))}
              title="Đặt cạnh mô hình hiện tại (chân bằng nhau)">
              Cạnh
            </button>
          </div>
        ))}
        {parts.length === 0 && (
          <div className="mc-empty">Chưa có mô hình đã lưu. Hãy tạo bộ phận (VD: “Cửa sổ có bậu”) rồi lưu, sau đó ghép tại đây.</div>
        )}
      </div>
      <p className="fi-hint">Quy trình: tạo khung nhà → tạo từng bộ phận trang trí thành asset riêng → ghép lại tại đây (Ctrl+Z để hoàn tác).</p>
    </div>
  )
}
