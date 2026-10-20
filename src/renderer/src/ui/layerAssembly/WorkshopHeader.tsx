import type { LayerComposite } from './types'
import type { AssemblyWorkspaceView } from './LayerAssemblyDialog'
import { Select } from '../controls'
import { IconLayers, IconPlus, IconX, IconDownload, IconUpload, IconScissors, IconColumns4 } from '../icons'
import { exportCompositeToGitProject, importCompositeFromGitProject } from './layerAssemblyGitExport'

export type WorkshopPrimaryMode = 'assembly' | 'cutter'

const COMPOSITE_CATEGORY_OPTIONS: { value: LayerComposite['category']; label: string }[] = [
  { value: 'scene', label: '🏞️ Cảnh lắp sẵn (Scene Prefab)' },
  { value: 'nature', label: '🌳 Thiên nhiên & Địa hình' },
  { value: 'character', label: '🧑 Nhân vật 2.5D' },
  { value: 'prop', label: '🏮 Đạo cụ & Vật phẩm' },
  { value: 'architecture', label: '🏛️ Kiến trúc & Hang động' },
  { value: 'custom', label: '✨ Tuỳ chỉnh' }
]

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
  onNewModel,
  hasCustomColumns = false,
  onResetColumns
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
  hasCustomColumns?: boolean
  onResetColumns?: () => void
}) {
  const hasBase64Images = composite.layers.some((l) => typeof l.imageUrl === 'string' && l.imageUrl.startsWith('data:image/'))

  const handleExportGit = async () => {
    await exportCompositeToGitProject(composite, setComposite)
  }

  const handleImportGit = async () => {
    await importCompositeFromGitProject(setComposite)
  }

  return <header className="layer-workshop-header">
    <div className="lw-brand" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}><IconLayers width={18} height={18} /><div><strong>Xưởng Layer & Cảnh</strong><small>2.5D · Vật lý · Ánh sáng</small></div></div>
    <input aria-label="Tên cụm layer" className="input-text sm lw-name" style={{ width: 145, minWidth: 110 }} value={composite.name} onChange={(e) => setComposite({ ...composite, name: e.target.value })} />
    <div style={{ width: 132, flexShrink: 0 }} title="Phân loại mẫu lắp ráp (chọn 'Cảnh lắp sẵn' để lắp nguyên phân cảnh có mặt đất, hang động & ánh sáng rồi lấy ra dùng ngay)">
      <Select
        size="sm"
        value={composite.category}
        options={COMPOSITE_CATEGORY_OPTIONS}
        onChange={(val) => setComposite({ ...composite, category: val as LayerComposite['category'] })}
      />
    </div>
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
        {onResetColumns && (
          <button
            type="button"
            className={`view-mode-tab-btn lw-reset-cols-btn${hasCustomColumns ? ' modified' : ''}`}
            onClick={onResetColumns}
            title="Đặt lại độ rộng 4 cột về mặc định (260px · 50/50 · 330px). Bạn có thể kéo các vách ngăn giữa 4 cột để tuỳ chỉnh rộng/hẹp."
          >
            <IconColumns4 width={12} height={12} /> Mặc định 4 cột
          </button>
        )}
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
