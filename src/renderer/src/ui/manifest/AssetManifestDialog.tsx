import { useEffect, useMemo, useState } from 'react'
import type {
  BuiltInAssetCategory,
  ManifestAssetMeta,
  ManifestModuleData,
  ManifestModuleId
} from '@shared/ipc'
import { useToast } from '../../actions'
import { useAssetManifestStore } from '../../store/assetManifest'
import {
  IconAssetManifest,
  IconCheck,
  IconFolder,
  IconRefresh,
  IconTrash
} from '../icons'
import { ManifestCategorySection } from './ManifestCategorySection'
import { ManifestAssetSection } from './ManifestAssetSection'
import '../../styles/manifestDialog.css'

const MODULE_LIST: Array<{
  id: ManifestModuleId
  title: string
  file: string
}> = [
  {
    id: 'builtin',
    title: 'Kho Công Cộng 2D',
    file: 'manifests/builtin.json'
  },
  {
    id: 'layer_25d',
    title: 'Xưởng Lắp Ráp Layer 2.5D',
    file: 'manifests/layer-25d.json'
  },
  {
    id: 'loop_animator',
    title: 'Xưởng Tách Hoạt Ảnh Loop',
    file: 'manifests/loop-animator.json'
  },
  {
    id: 'model_3d',
    title: 'Xưởng Mô Hình 3D',
    file: 'manifests/model-3d.json'
  },
  {
    id: 'audio',
    title: 'Kho Âm Thanh & Nhạc Nền',
    file: 'manifests/audio.json'
  }
]

type ManifestTabMode = 'categories' | 'assets' | 'trash' | 'json'

export function AssetManifestDialog({ onClose }: { onClose: () => void }) {
  const modules = useAssetManifestStore((s) => s.modules)
  const activeItems = useAssetManifestStore((s) => s.items)
  const deletedItems = useAssetManifestStore((s) => s.deletedItems)
  const loading = useAssetManifestStore((s) => s.loading)
  const refreshCatalog = useAssetManifestStore((s) => s.refreshCatalog)
  const saveModuleJson = useAssetManifestStore((s) => s.saveModuleJson)
  const upsertAssetMeta = useAssetManifestStore((s) => s.upsertAssetMeta)
  const softDeleteAsset = useAssetManifestStore((s) => s.softDeleteAsset)
  const restoreAsset = useAssetManifestStore((s) => s.restoreAsset)
  const pruneManifests = useAssetManifestStore((s) => s.pruneManifests)
  const showToast = useToast((s) => s.show)

  const [activeModule, setActiveModule] = useState<ManifestModuleId>('builtin')
  const [tabMode, setTabMode] = useState<ManifestTabMode>('categories')
  const [saving, setSaving] = useState(false)
  const [rawJsonText, setRawJsonText] = useState('')
  const [rawJsonError, setRawJsonError] = useState<string | null>(null)

  useEffect(() => {
    void refreshCatalog(true)
  }, [refreshCatalog])

  const currentModuleData = useMemo<ManifestModuleData>(() => {
    return modules[activeModule] ?? modules.builtin
  }, [modules, activeModule])

  useEffect(() => {
    setRawJsonText(currentModuleData.rawJson || JSON.stringify(currentModuleData, null, 2))
    setRawJsonError(null)
  }, [currentModuleData])

  const handleSaveCategories = async (nextCategories: BuiltInAssetCategory[]): Promise<void> => {
    setSaving(true)
    try {
      let parsed: Record<string, unknown> = {}
      try {
        parsed = JSON.parse(currentModuleData.rawJson || '{}')
      } catch {
        parsed = {
          moduleId: activeModule,
          title: currentModuleData.title,
          description: currentModuleData.description,
          assets: currentModuleData.assets ?? {}
        }
      }
      parsed.categories = nextCategories
      const res = await saveModuleJson(activeModule, JSON.stringify(parsed, null, 2))
      if (res.ok) {
        showToast(`Đã lưu ${currentModuleData.title} & đồng bộ giao diện tức thì`)
      } else {
        showToast(res.error || 'Không thể lưu manifest — vui lòng kiểm tra quyền ghi file')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAssetMeta = async (relPath: string, meta: Partial<ManifestAssetMeta>): Promise<void> => {
    setSaving(true)
    try {
      const res = await upsertAssetMeta('builtin', relPath, meta)
      if (res.ok) {
        showToast(`Đã cập nhật thông tin tài nguyên "${relPath}"`)
      } else {
        showToast(res.error || 'Không thể lưu thông tin tài nguyên')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRawJson = async (): Promise<void> => {
    try {
      const parsed = JSON.parse(rawJsonText) as Record<string, unknown>
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.categories)) {
        setRawJsonError('JSON phải có mảng "categories" hợp lệ')
        return
      }
      setRawJsonError(null)
      setSaving(true)
      try {
        const res = await saveModuleJson(activeModule, JSON.stringify(parsed, null, 2))
        if (res.ok) {
          showToast(`Đã lưu JSON phân hệ ${currentModuleData.title}`)
        } else {
          setRawJsonError(res.error || 'Không thể ghi file JSON')
        }
      } finally {
        setSaving(false)
      }
    } catch (err) {
      setRawJsonError((err as Error)?.message || 'Cú pháp JSON không hợp lệ')
    }
  }

  const handleSoftDelete = async (relativePath: string): Promise<void> => {
    setSaving(true)
    try {
      const res = await softDeleteAsset(relativePath, false)
      if (res.ok) {
        showToast(`Đã chuyển "${relativePath}" vào kho tạm assets/_temp_deleted/`)
      }
    } finally {
      setSaving(false)
    }
  }

  const handlePermanentDelete = async (relativePath: string): Promise<void> => {
    setSaving(true)
    try {
      const res = await softDeleteAsset(relativePath, true)
      if (res.ok) {
        showToast(`Đã xoá vĩnh viễn "${relativePath}" và cập nhật manifest.json`)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = async (relativePath: string): Promise<void> => {
    setSaving(true)
    try {
      const res = await restoreAsset(relativePath)
      if (res.ok) {
        showToast(`Đã khôi phục "${relativePath}" về đúng thư mục gốc`)
      }
    } finally {
      setSaving(false)
    }
  }

  const handlePrune = async (): Promise<void> => {
    setSaving(true)
    try {
      const res = await pruneManifests()
      if (res.ok && res.report) {
        showToast(
          `Đã dò & làm sạch manifest.json (xoá ${res.report.removedAssets.length} mục mồ côi, thêm ${res.report.added.length} tệp mới)`
        )
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal manifest-modal"
        data-mcp-region="manifest_dialog"
        data-mcp-dialog="manifest"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="manifest-header">
          <div className="manifest-header-left">
            <span className="manifest-header-icon">
              <IconAssetManifest width={18} height={18} />
            </span>
            <div className="manifest-header-titles">
              <h3>
                Điều Phối Tài Nguyên Động & Manifest JSON
                <span className="manifest-version-badge">v2.0 Modular</span>
              </h3>
              <p className="manifest-header-sub">
                Điều phối trung tâm: <code>assets/manifest.json</code> · Các phân hệ nhỏ:{' '}
                <code>assets/manifests/*.json</code> · Kho tạm khôi phục: <code>assets/_temp_deleted/</code>
              </p>
            </div>
          </div>

          <div className="manifest-header-actions">
            <button
              id="manifest-reload-btn"
              type="button"
              className="btn ghost sm"
              disabled={loading || saving}
              onClick={() => void refreshCatalog(true)}
              title="Đọc lại toàn bộ manifest.json và các phân hệ ngay lập tức"
            >
              <IconRefresh width={13} height={13} /> Tải lại tức thì
            </button>
            <button
              id="manifest-close-btn"
              type="button"
              className="btn ghost icon sm"
              onClick={onClose}
              aria-label="Đóng hộp thoại Manifest"
              title="Đóng (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="manifest-body">
          {/* Left Sidebar: Module Selector */}
          <aside className="manifest-sidebar" data-mcp-region="manifest_sidebar">
            <div className="manifest-sidebar-label">Phân hệ JSON (Modules)</div>
            {MODULE_LIST.map((mod) => {
              const modCats = modules[mod.id]?.categories?.length ?? 0
              const isSelected = activeModule === mod.id
              return (
                <button
                  key={mod.id}
                  type="button"
                  className={`manifest-module-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => setActiveModule(mod.id)}
                >
                  <div className="manifest-module-btn-top">
                    <span>{mod.title}</span>
                    <span className="manifest-tab-count">{modCats} nhóm</span>
                  </div>
                  <span className="manifest-module-file">{mod.file}</span>
                </button>
              )
            })}

            <div className="manifest-sidebar-info-card">
              <div>
                <strong>Cơ chế Xoá & Khôi phục:</strong>
              </div>
              <div>
                • <strong>Xoá tạm:</strong> Chuyển file vào <code>assets/_temp_deleted/</code> và đổi trạng thái{' '}
                <code>&quot;status&quot;: &quot;deleted&quot;</code> để khôi phục bất cứ lúc nào.
              </div>
              <div>
                • <strong>Xoá hẳn:</strong> Xoá file trong thư mục rồi bấm <strong>Dò & Làm sạch JSON</strong> hoặc chạy{' '}
                <code>assets/prune-manifest.bat</code>.
              </div>
            </div>
          </aside>

          {/* Main Workspace */}
          <section className="manifest-workspace">
            <div className="manifest-toolbar">
              <div className="manifest-tabs">
                <button
                  type="button"
                  className={`manifest-tab-btn ${tabMode === 'categories' ? 'active' : ''}`}
                  onClick={() => setTabMode('categories')}
                >
                  <IconFolder width={13} height={13} />
                  <span>Chủ đề & Nhóm</span>
                  <span className="manifest-tab-count">{currentModuleData.categories?.length ?? 0}</span>
                </button>

                <button
                  type="button"
                  className={`manifest-tab-btn ${tabMode === 'assets' ? 'active' : ''}`}
                  onClick={() => setTabMode('assets')}
                >
                  <IconAssetManifest width={13} height={13} />
                  <span>Tài nguyên Kho</span>
                  <span className="manifest-tab-count">{activeItems.length}</span>
                </button>

                <button
                  type="button"
                  className={`manifest-tab-btn ${tabMode === 'trash' ? 'active' : ''}`}
                  onClick={() => setTabMode('trash')}
                >
                  <IconTrash width={13} height={13} />
                  <span>Kho tạm đã xoá</span>
                  <span className="manifest-tab-count">{deletedItems.length}</span>
                </button>

                <button
                  type="button"
                  className={`manifest-tab-btn ${tabMode === 'json' ? 'active' : ''}`}
                  onClick={() => setTabMode('json')}
                >
                  <span>JSON Trực tiếp</span>
                </button>
              </div>

              <div className="manifest-toolbar-right">
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  Tệp đang chọn: <code>assets/{currentModuleData.file}</code>
                </span>
              </div>
            </div>

            <div className="manifest-content">
              {tabMode === 'categories' && (
                <ManifestCategorySection
                  key={`${activeModule}-${currentModuleData.categories.length}`}
                  moduleId={activeModule}
                  moduleData={currentModuleData}
                  saving={saving}
                  onSaveCategories={handleSaveCategories}
                />
              )}

              {(tabMode === 'assets' || tabMode === 'trash') && (
                <ManifestAssetSection
                  mode={tabMode === 'trash' ? 'trash' : 'active'}
                  categories={modules.builtin?.categories ?? currentModuleData.categories ?? []}
                  items={activeItems}
                  deletedItems={deletedItems}
                  saving={saving}
                  onSaveAssetMeta={handleSaveAssetMeta}
                  onSoftDelete={handleSoftDelete}
                  onPermanentDelete={handlePermanentDelete}
                  onRestore={handleRestore}
                  onPrune={handlePrune}
                />
              )}

              {tabMode === 'json' && (
                <div className="manifest-json-wrap" data-mcp-region="manifest_json_editor">
                  <div className="manifest-status-banner">
                    <div>
                      Chỉnh sửa trực tiếp cấu trúc JSON của phân hệ <strong>{currentModuleData.title}</strong>. Lưu xong
                      app sẽ tự động đồng bộ lại toàn bộ chủ đề và icon.
                    </div>
                    <button
                      type="button"
                      className="btn primary sm"
                      disabled={saving}
                      onClick={() => void handleSaveRawJson()}
                    >
                      <IconCheck width={13} height={13} /> Lưu JSON phân hệ này
                    </button>
                  </div>
                  {rawJsonError && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius, 5px)',
                        background: 'rgba(239, 68, 68, 0.14)',
                        border: '1px solid #ef4444',
                        color: '#ef4444',
                        fontSize: 12
                      }}
                    >
                      Lỗi JSON: {rawJsonError}
                    </div>
                  )}
                  <textarea
                    className="manifest-json-textarea"
                    value={rawJsonText}
                    onChange={(e) => setRawJsonText(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
