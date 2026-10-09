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
