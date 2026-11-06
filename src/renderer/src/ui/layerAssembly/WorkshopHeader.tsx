import { useState, useMemo, useRef } from 'react'
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
  IconX,
  IconFolder
} from '../icons'
import {
  IconSidebarLeftCollapse,
  IconSidebarLeftExpand,
  IconSidebarRightCollapse,
  IconSidebarRightExpand
} from '../workspaceIcons'
import type { BuiltInAssetCategory } from '@shared/ipc'
import {
  useAssetManifestStore,
  getActiveCategoriesForModule
} from '../../store/assetManifest'
import {
  exportLayerCompositeToJson,
  importLayerCompositeFromJson
} from './layerAssemblyStorage'
import { toast } from '../../actions'

export type WorkshopPrimaryMode = 'assembly' | 'cutter'

const FALLBACK_CATEGORY_OPTIONS: { value: LayerComposite['category']; label: string }[] = [
  { value: 'scene', label: '🏞️ Cảnh lắp sẵn (Prefab)' },
  { value: 'character', label: '🧑 Nhân vật 2.5D (Rig)' },
  { value: 'nature', label: '🌳 Thiên nhiên & Cây cỏ' },
  { value: 'animal', label: '🐾 Động vật & Thú cưng' },
  { value: 'prop', label: '🏮 Đạo cụ & Vật phẩm' },
  { value: 'architecture', label: '🏛️ Kiến trúc & Nội thất' },
  { value: 'custom', label: '✨ Tự tạo & Đã lưu' }
]

function getCategoryEmoji(catId: string): string {
  const map: Record<string, string> = {
    scene: '🏞️',
    character: '🧑',
    nature: '🌳',
    animal: '🐾',
    prop: '🏮',
    architecture: '🏛️',
    custom: '📦'
  }
  return map[catId] || '🏷️'
}

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
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isSavingCategory, setIsSavingCategory] = useState(false)

  const manifestModules = useAssetManifestStore((s) => s.modules)
  const manifestRevision = useAssetManifestStore((s) => s.revision)

  // Danh sách thể loại nạp động từ manifest layer_25d
  const categoryOptions = useMemo(() => {
    const rawCats = getActiveCategoriesForModule(manifestModules, 'layer_25d').filter(
      (c) => c.id !== 'all'
    )
    const list = rawCats.length > 0
      ? rawCats.map((c) => ({
          value: c.id,
          label: `${getCategoryEmoji(c.id)} ${c.title || c.shortTitle || c.id}`
        }))
      : FALLBACK_CATEGORY_OPTIONS

    // Đảm bảo thể loại hiện tại của composite luôn có trong danh sách nếu chưa có
    if (composite.category && !list.some((o) => o.value === composite.category)) {
      list.push({
        value: composite.category,
        label: `🏷️ ${composite.category}`
      })
    }

    // Tuỳ chọn tạo mới thể loại theo yêu cầu
    return [
      ...list,
      { value: '__create_new_category__', label: '✨ Tạo mới thể loại…' }
    ]
  }, [manifestModules, manifestRevision, composite.category])

  // Xử lý khi chọn category từ dropdown
  const handleCategorySelect = (val: string) => {
    if (val === '__create_new_category__') {
      setNewCategoryName('')
      setIsNewCategoryModalOpen(true)
      return
    }
    setComposite({ ...composite, category: val as LayerComposite['category'] })
  }

  // Lưu thể loại mới vào manifest
  const handleSaveNewCategory = async () => {
    const trimmed = newCategoryName.trim()
    if (!trimmed) {
      toast('Vui lòng nhập tên thể loại mới')
      return
    }
    setIsSavingCategory(true)
    try {
      const slugId = trimmed
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || `cat_${Date.now().toString(36)}`

      const newCategory: BuiltInAssetCategory = {
        id: slugId,
        title: trimmed,
        shortTitle: trimmed.length > 10 ? trimmed.slice(0, 10) : trimmed,
        folder: `layer-assemblies/${slugId}`,
        icon: 'folder',
        iconText: trimmed.slice(0, 2).toUpperCase(),
        accent: '#ec4899',
        status: 'active',
        order: 50
      }

      await useAssetManifestStore.getState().upsertCategory('layer_25d', newCategory)
      setComposite({ ...composite, category: slugId })
      toast(`Đã tạo và lưu thể loại mới: "${trimmed}" vào manifest`)
      setIsNewCategoryModalOpen(false)
    } catch (err) {
      toast(`Lỗi khi tạo thể loại: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsSavingCategory(false)
    }
  }

  // Xuất file JSON (layer cụm 2.5D)
  const handleExportJson = () => {
    try {
      const jsonStr = exportLayerCompositeToJson(composite, true)
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safeName = (composite.name || 'layer-composite')
        .replace(/[/\\?%*:|"<>]/g, '_')
        .trim()
      a.href = url
      a.download = `${safeName}.composite.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast(`Đã xuất tệp JSON cụm layer "${composite.name}"`)
    } catch (err) {
      toast(`Lỗi xuất JSON: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Mở hộp thoại chọn file JSON (layer cụm 2.5D)
  const handleTriggerImportJson = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  // Nạp file JSON khi người dùng chọn
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const parsedComp = importLayerCompositeFromJson(text)
        setComposite(parsedComp)
        toast(`Đã nạp thành công cụm layer 2.5D: "${parsedComp.name}"`)
      } catch (err) {
        toast(`Tệp JSON không hợp lệ: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    reader.readAsText(file)
  }

  return (
    <header className="layer-workshop-header" data-mcp-region="layer_assembly_header">
      {/* Hidden file input for Import JSON */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="lw-header-left">
        <div className="lw-brand">
          <IconLayers width={17} height={17} />
          <div>
            <strong>Xưởng Layer 2.5D</strong>
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
            options={categoryOptions}
            onChange={handleCategorySelect}
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
          portal
          label="Tệp ▾"
          btnClassName="sm"
          align="right"
          disabled={busy}
          title="Nạp / Xuất tệp JSON cụm layer 2.5D và đặt lại bố cục cột"
        >
          <div className="menu-label">Tệp mẫu & Bố cục</div>
          <button type="button" className="menu-item" onClick={handleTriggerImportJson}>
            <IconUpload width={12} height={12} /> Import JSON (layer cụm 2.5D)
          </button>
          <button
            type="button"
            className="menu-item"
            disabled={!composite.layers.length}
            onClick={handleExportJson}
          >
            <IconDownload width={12} height={12} /> Export JSON (layer cụm 2.5D)
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
          onClick={save}
          disabled={busy || !composite.layers.length}
          className="btn sm lw-btn-save-model"
          title="Lưu mẫu vào kho ứng dụng để tái sử dụng nhanh"
        >
          {busy ? 'Đang lưu…' : 'Lưu mẫu'}
        </button>
        <button
          type="button"
          className="btn sm primary lw-btn-insert-scene"
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

      {/* Modal Tạo mới thể loại */}
      {isNewCategoryModalOpen && (
        <div className="lw-confirm-backdrop" onClick={() => !isSavingCategory && setIsNewCategoryModalOpen(false)}>
          <div
            className="lw-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: '16px 20px', borderRadius: '8px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <strong style={{ fontSize: '13px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IconFolder width={15} height={15} /> Tạo mới thể loại mẫu 2.5D
              </strong>
              <button
                type="button"
                className="btn sm icon ghost"
                onClick={() => setIsNewCategoryModalOpen(false)}
                disabled={isSavingCategory}
              >
                <IconX width={13} height={13} />
              </button>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
              Nhập tên thể loại phân loại mới. Nhãn này sẽ được lưu vào manifest để dùng lại và hiển thị trên Timeline/Workflow:
            </p>
            <input
              type="text"
              autoFocus
              className="input-text sm"
              placeholder="VD: Quái vật, Xe cộ, Cổ trang..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveNewCategory()
                if (e.key === 'Escape') setIsNewCategoryModalOpen(false)
              }}
              style={{ width: '100%', marginBottom: '16px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setIsNewCategoryModalOpen(false)}
                disabled={isSavingCategory}
              >
                Huỷ
              </button>
              <button
                type="button"
                className="btn sm primary"
                onClick={() => void handleSaveNewCategory()}
                disabled={isSavingCategory || !newCategoryName.trim()}
              >
                {isSavingCategory ? 'Đang lưu…' : 'Tạo và Áp dụng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
