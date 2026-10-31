import type { LayerComposite } from './types'
import type { AssemblyWorkspaceView } from './LayerAssemblyDialog'
import { Menu, Select } from '../controls'
import {
  IconColumns4,
  IconCube,
  IconDownload,
  IconImage,
  IconLayers,
  IconPlus,
  IconScissors,
  IconSplitView,
  IconUpload,
  IconX
} from '../icons'
import {
  IconSidebarLeftCollapse,
  IconSidebarLeftExpand,
  IconSidebarRightCollapse,
  IconSidebarRightExpand
} from '../workspaceIcons'
import { exportCompositeToGitProject, importCompositeFromGitProject } from './layerAssemblyGitExport'

export type WorkshopPrimaryMode = 'assembly' | 'cutter'

const COMPOSITE_CATEGORY_OPTIONS: { value: LayerComposite['category']; label: string }[] = [
  { value: 'scene', label: '🏞️ Cảnh lắp sẵn (Prefab)' },
  { value: 'character', label: '🧑 Nhân vật 2.5D (Rig)' },
  { value: 'nature', label: '🌳 Thiên nhiên & Cây cỏ' },
  { value: 'prop', label: '🏮 Đạo cụ & Vật phẩm' },
  { value: 'architecture', label: '🏛️ Kiến trúc & Nội thất' },
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
  onResetColumns,
  showPanelToggles = false,
  leftSidebarOpen = true,
  rightPanelOpen = true,
  onToggleLeftSidebar,
  onToggleRightPanel
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
  showPanelToggles?: boolean
  leftSidebarOpen?: boolean
  rightPanelOpen?: boolean
  onToggleLeftSidebar?: () => void
  onToggleRightPanel?: () => void
}) {
  const hasBase64Images = composite.layers.some(
    (l) => typeof l.imageUrl === 'string' && l.imageUrl.startsWith('data:image/')
  )

  const handleExportGit = async () => {
    await exportCompositeToGitProject(composite, setComposite)
  }

  const handleImportGit = async () => {
    await importCompositeFromGitProject(setComposite)
  }

  return (
    <header className="layer-workshop-header" data-mcp-region="layer_assembly_header">
      <div className="lw-header-left">
        <div className="lw-brand">
          <IconLayers width={17} height={17} />
          <div>
            <strong>Xưởng Layer 2.5D</strong>
            <small>Rigging · Animate · Mesh</small>
          </div>
        </div>
        <input
          aria-label="Tên cụm layer"
          className="input-text sm lw-name"
          value={composite.name}
          placeholder="Tên mẫu layer..."
          onChange={(e) => setComposite({ ...composite, name: e.target.value })}
        />
        <div
          className="lw-category-select"
          title="Phân loại mẫu lắp ráp (Nhân vật 2.5D, Cảnh lắp sẵn, Thiên nhiên, Đạo cụ...)"
        >
          <Select
            size="sm"
            value={composite.category}
            options={COMPOSITE_CATEGORY_OPTIONS}
            onChange={(val) => setComposite({ ...composite, category: val as LayerComposite['category'] })}
          />
        </div>
      </div>

      <div className="lw-header-center">
        <div className="view-mode-tabs" role="group" aria-label="Chế độ xưởng">
          <button
            type="button"
            className={`view-mode-tab-btn${primaryMode === 'assembly' ? ' active' : ''}`}
            aria-pressed={primaryMode === 'assembly'}
            onClick={() => setPrimaryMode('assembly')}
            title="Lắp ráp 2.5D, Tạo xương chuẩn Moho & Diễn hoạt Dope Sheet"
          >
            <IconLayers width={12} height={12} />
            <span>Lắp ráp & Diễn hoạt</span>
          </button>
          <button
            type="button"
            className={`view-mode-tab-btn${primaryMode === 'cutter' ? ' active' : ''}`}
            aria-pressed={primaryMode === 'cutter'}
            onClick={() => setPrimaryMode('cutter')}
            title="Cắt tách bộ phận nhân vật / vật thể từ ảnh gốc, tách nền trong suốt & đưa vào khung lắp"
          >
            <IconScissors width={12} height={12} />
            <span>Cắt tách Sprite</span>
          </button>
        </div>

        {primaryMode === 'assembly' && (
          <div className="view-mode-tabs lw-stage-view-tabs" role="group" aria-label="Bố cục vùng dựng">
            <button
              type="button"
              className={`view-mode-tab-btn${view === '2d' ? ' active' : ''}`}
              aria-pressed={view === '2d'}
              onClick={() => setView('2d')}
              title="Toàn màn hình sân khấu 2D (tối ưu khi Tạo xương & Vẽ hoạt ảnh)"
            >
              <IconImage width={12} height={12} />
              <span>2D</span>
            </button>
            <button
              type="button"
              className={`view-mode-tab-btn${view === 'split' ? ' active' : ''}`}
              aria-pressed={view === 'split'}
              onClick={() => setView('split')}
              title="Chia đôi song song Sân khấu 2D và Phối cảnh Chiều sâu 3D"
            >
              <IconSplitView width={12} height={12} />
              <span>2D & 3D</span>
            </button>
            <button
              type="button"
              className={`view-mode-tab-btn${view === '3d' ? ' active' : ''}`}
              aria-pressed={view === '3d'}
              onClick={() => setView('3d')}
              title="Toàn màn hình Không gian Chiều sâu 3D"
            >
              <IconCube width={12} height={12} />
              <span>3D</span>
            </button>
          </div>
        )}
      </div>

      <div className="layer-workshop-header-actions">
        {showPanelToggles && primaryMode === 'assembly' && (
          <div className="lw-panel-toggle-group" role="group" aria-label="Ẩn hiện hai cột bên">
            <button
              type="button"
              className={`btn sm icon ghost${leftSidebarOpen ? ' active' : ''}`}
              onClick={onToggleLeftSidebar}
              title={leftSidebarOpen ? 'Thu gọn cột Kho ảnh bên trái' : 'Mở cột Kho ảnh bên trái'}
              aria-pressed={leftSidebarOpen}
            >
              {leftSidebarOpen ? (
                <IconSidebarLeftCollapse width={14} height={14} />
              ) : (
                <IconSidebarLeftExpand width={14} height={14} />
              )}
            </button>
            <button
              type="button"
              className={`btn sm icon ghost${rightPanelOpen ? ' active' : ''}`}
              onClick={onToggleRightPanel}
              title={rightPanelOpen ? 'Thu gọn cột Xương & Animate bên phải' : 'Mở cột Xương & Animate bên phải'}
              aria-pressed={rightPanelOpen}
            >
              {rightPanelOpen ? (
                <IconSidebarRightCollapse width={14} height={14} />
              ) : (
                <IconSidebarRightExpand width={14} height={14} />
              )}
            </button>
          </div>
        )}

        <button
          type="button"
          className="btn sm lw-btn-new-model"
          onClick={onNewModel}
          disabled={busy}
          title="Tạo mẫu lắp ráp mới từ thư viện khuôn mẫu hoặc khung trắng"
        >
          <IconPlus width={12} height={12} />
          <span>Mẫu mới</span>
        </button>

        <Menu
          id="lw-file-menu"
          label={hasBase64Images ? 'Tệp · Git ●' : 'Tệp…'}
          btnClassName="sm"
          align="right"
          disabled={busy}
          title="Nạp / Xuất tệp JSON dự án Git và đặt lại bố cục cột"
        >
          <div className="menu-label">Tệp mẫu & Bố cục</div>
          <button type="button" className="menu-item" onClick={onNewModel}>
            <IconPlus width={12} height={12} /> Tạo mẫu mới…
          </button>
          <button type="button" className="menu-item" onClick={() => void handleImportGit()}>
            <IconUpload width={12} height={12} /> Nạp mẫu JSON từ dự án
          </button>
          <button
            type="button"
            className="menu-item"
            disabled={!composite.layers.length}
            onClick={() => void handleExportGit()}
          >
            <IconDownload width={12} height={12} /> Xuất ảnh PNG & JSON lên Git
            {hasBase64Images && <span className="hint">Khuyên dùng</span>}
          </button>
          {onResetColumns && (
            <>
              <div className="menu-sep" />
              <button type="button" className="menu-item" onClick={onResetColumns}>
                <IconColumns4 width={12} height={12} /> Đặt lại độ rộng 4 cột
                {hasCustomColumns && <span className="hint">Đang tuỳ chỉnh</span>}
              </button>
            </>
          )}
        </Menu>

        <button
          type="button"
          className="btn sm"
          onClick={save}
          disabled={busy || !composite.layers.length}
          title="Lưu mẫu vào kho ứng dụng để tái sử dụng nhanh"
        >
          {busy ? 'Đang lưu…' : 'Lưu mẫu'}
        </button>
        <button
          type="button"
          className="btn sm primary"
          onClick={insert}
          disabled={busy || !composite.layers.length}
          title="Đưa cụm layer 2.5D kèm xương & hoạt ảnh vào phân cảnh hiện tại"
        >
          <IconPlus width={13} height={13} />
          <span>Thêm vào cảnh</span>
        </button>
        <button type="button" className="btn sm icon" onClick={close} disabled={busy} aria-label="Đóng xưởng">
          <IconX width={15} height={15} />
        </button>
      </div>
    </header>
  )
}
