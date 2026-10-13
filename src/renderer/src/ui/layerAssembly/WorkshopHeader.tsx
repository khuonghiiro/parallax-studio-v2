import type { LayerComposite } from './types'
import type { AssemblyWorkspaceView } from './LayerAssemblyDialog'
import { IconLayers, IconPlus, IconX, IconDownload, IconUpload, IconScissors } from '../icons'
import { exportCompositeToGitProject, importCompositeFromGitProject } from './layerAssemblyGitExport'

export type WorkshopPrimaryMode = 'assembly' | 'cutter'

export function WorkshopHeader({
  composite,
  setComposite,
  primaryMode,
  setPrimaryMode,
  view,
  setView,
  busy,
  save,
  insert,
  close,
  onNewModel
}: {
  composite: LayerComposite
  setComposite: (update: LayerComposite) => void
  primaryMode: WorkshopPrimaryMode
  setPrimaryMode: (mode: WorkshopPrimaryMode) => void
  view: AssemblyWorkspaceView
  setView: (view: AssemblyWorkspaceView) => void
  busy: boolean
  save: () => void
  insert: () => void
  close: () => void
  onNewModel: () => void
}) {
  const hasBase64Images = composite.layers.some((l) => typeof l.imageUrl === 'string' && l.imageUrl.startsWith('data:image/'))

  const handleExportGit = async () => {
    await exportCompositeToGitProject(composite, setComposite)
  }

  const handleImportGit = async () => {
    await importCompositeFromGitProject(setComposite)
  }

  return <header className="layer-workshop-header">
    <div className="lw-brand"><IconLayers width={20} height={20} /><div><strong>Xưởng Lắp Ráp Layer</strong><small>Bố cục · Chiều sâu · Chuyển động</small></div></div>
    <input aria-label="Tên cụm layer" className="input-text sm lw-name" value={composite.name} onChange={(e) => setComposite({ ...composite, name: e.target.value })} />
    <div className="view-mode-tabs" aria-label="Chế độ xưởng">
      <button
        type="button"
        className={`view-mode-tab-btn${primaryMode === 'assembly' ? ' active' : ''}`}
        aria-pressed={primaryMode === 'assembly'}
        onClick={() => setPrimaryMode('assembly')}
        title="Bố cục 2D & Chiều sâu 3D (Lắp ráp layer, tạo xương, chuyển động)"
      >
        <IconLayers width={12} height={12} /> Bố cục & Chiều sâu
      </button>
      <button
        type="button"
        className={`view-mode-tab-btn${primaryMode === 'cutter' ? ' active' : ''}`}
        aria-pressed={primaryMode === 'cutter'}
        onClick={() => setPrimaryMode('cutter')}
        title="Chỉnh sửa phân tách các item trong ảnh, tách nền trong suốt & gán vào khung mẫu 2D"
      >
        <IconScissors width={12} height={12} /> Cắt tách Sprite & Khung mẫu
      </button>
    </div>
    {primaryMode === 'assembly' && (
      <div className="view-mode-tabs" aria-label="Bố cục vùng dựng" style={{ marginLeft: 2 }}>
        {(['2d', 'split', '3d'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`view-mode-tab-btn${view === mode ? ' active' : ''}`}
            aria-pressed={view === mode}
            onClick={() => setView(mode)}
          >
            {mode === 'split' ? '2D & 3D' : mode.toUpperCase()}
          </button>
        ))}
      </div>
    )}
    <div className="layer-workshop-header-actions">
      <button className="btn sm lw-btn-new-model" onClick={onNewModel} disabled={busy} title="Tạo mới một mẫu layer rỗng">
        <IconPlus width={13} height={13} /> Tạo mẫu mới
      </button>
      <button
        className="btn sm"
        onClick={handleImportGit}
        disabled={busy}
        title="Nạp mẫu layer từ tệp JSON đã lưu trong thư mục dự án (Git)"
      >
        <IconUpload width={13} height={13} /> Nạp JSON
      </button>
      <button
        className={`btn sm${hasBase64Images ? ' primary' : ''}`}
        onClick={handleExportGit}
        disabled={busy || !composite.layers.length}
        title="Xuất các ảnh PNG đã tẩy sửa vào thư mục assets/ và lưu tệp mẫu JSON để commit lên Git"
      >
        <IconDownload width={13} height={13} /> Xuất tệp Git
      </button>
      <button
        className="btn sm"
        onClick={save}
        disabled={busy || !composite.layers.length}
        title="Lưu mẫu vào bộ nhớ ứng dụng LocalStorage (để tái sử dụng nhanh)"
      >
        {busy ? 'Đang xử lý…' : 'Lưu mẫu (App)'}
      </button>
      <button className="btn sm primary" onClick={insert} disabled={busy || !composite.layers.length}><IconPlus width={13} height={13} /> Thêm vào cảnh</button>
      <button className="btn sm icon" onClick={close} disabled={busy} aria-label="Đóng xưởng"><IconX width={16} height={16} /></button>
    </div>
  </header>
}
