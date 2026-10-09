import type { LayerComposite } from './types'
import type { AssemblyWorkspaceView } from './LayerAssemblyDialog'
import { IconLayers, IconPlus, IconX } from '../icons'

export function WorkshopHeader({ composite, setComposite, view, setView, busy, save, insert, close }: {
  composite: LayerComposite; setComposite: (update: LayerComposite) => void
  view: AssemblyWorkspaceView; setView: (view: AssemblyWorkspaceView) => void
  busy: boolean; save: () => void; insert: () => void; close: () => void
}) {
  return <header className="layer-workshop-header">
    <div className="lw-brand"><IconLayers width={20} height={20} /><div><strong>Xưởng Lắp Ráp Layer</strong><small>Bố cục · Chiều sâu · Chuyển động</small></div></div>
    <input aria-label="Tên cụm layer" className="input-text sm lw-name" value={composite.name} onChange={(e) => setComposite({ ...composite, name: e.target.value })} />
    <div className="view-mode-tabs" aria-label="Bố cục vùng dựng">
      {(['2d', 'split', '3d'] as const).map((mode) => <button key={mode} className={`view-mode-tab-btn${view === mode ? ' active' : ''}`}
        aria-pressed={view === mode} onClick={() => setView(mode)}>{mode === 'split' ? '2D & 3D' : mode.toUpperCase()}</button>)}
    </div>
    <div className="layer-workshop-header-actions">
      <button className="btn sm" onClick={save} disabled={busy || !composite.layers.length}>{busy ? 'Đang xử lý…' : 'Lưu mẫu'}</button>
      <button className="btn sm primary" onClick={insert} disabled={busy || !composite.layers.length}><IconPlus width={13} height={13} /> Thêm vào cảnh</button>
      <button className="btn sm icon" onClick={close} disabled={busy} aria-label="Đóng xưởng"><IconX width={16} height={16} /></button>
    </div>
  </header>
}

export function WorkshopFrameControls({ composite, setComposite, estimate }: {
  composite: LayerComposite; setComposite: (update: LayerComposite) => void
  estimate: () => void
}) {
  const dimension = (key: 'width' | 'height', value: number) => setComposite({ ...composite, [key]: Math.max(200, Math.min(4000, Math.round(value) || 600)) })
  return <div className="lw-frame-controls">
    <strong>Khung dựng</strong>
    <label>W <input aria-label="Chiều rộng khung" type="number" min={200} max={4000} value={composite.width} onChange={(e) => dimension('width', Number(e.target.value))} /></label>
    <label>H <input aria-label="Chiều cao khung" type="number" min={200} max={4000} value={composite.height} onChange={(e) => dimension('height', Number(e.target.value))} /></label>
    <select aria-label="Khổ khung mẫu" className="input-text sm" value="" onChange={(e) => { const [width, height] = e.target.value.split('x').map(Number); setComposite({ ...composite, width, height }) }}>
      <option value="" disabled>Khổ mẫu…</option><option value="600x600">Vuông · 600 × 600</option>
      <option value="1920x1080">Ngang · 1920 × 1080</option><option value="1080x1920">Dọc · 1080 × 1920</option>
      <option value="1080x1080">Vuông · 1080 × 1080</option>
    </select>
    <button className="btn xs" onClick={() => setComposite({ ...composite, width: Math.min(4000, composite.width + 100), height: Math.min(4000, composite.height + 100) })}>+100</button>
    <button className="btn xs" onClick={() => setComposite({ ...composite, width: Math.max(200, composite.width - 100), height: Math.max(200, composite.height - 100) })}>−100</button>
    <button className="btn xs" disabled={!composite.layers.length} onClick={estimate} title="Ước lượng khung 2D theo ảnh tối đa 380 px, scale và góc xoay Z; chưa tính chuyển động/phối cảnh">Ước lượng khung</button>
    <span>+Z: phía sau · −Z: phía trước</span>
  </div>
}
