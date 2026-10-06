import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BuiltInAssetCategory, BuiltInAssetItem, BuiltInCatalogResult } from '@shared/ipc'
import { importAudio, importBuiltInAsset, importImages } from '../../actions'
import { useEditor } from '../../store/editor'
import { IconFolder, IconImage, IconMusic, IconPlus } from '../icons'
import { AssetCatalogModal } from './AssetCatalogModal'
import { BuiltInAssetBar } from './BuiltInAssetBar'
import { BuiltInAssetGrid } from './BuiltInAssetGrid'
import { ProjectAssetList } from './ProjectAssetList'

type AssetSubTab = 'builtin' | 'project'

export function AssetPanel() {
  const projectAssets = useEditor((s) => s.project.assets)
  const [subTab, setSubTab] = useState<AssetSubTab>('builtin')
  const [catalog, setCatalog] = useState<BuiltInCatalogResult | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false)

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.getBuiltInCatalog()
      setCatalog(res)
    } catch (err) {
      console.error('[AssetPanel] Error loading built-in catalog:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  const categories = useMemo<BuiltInAssetCategory[]>(() => {
    return catalog?.categories ?? [
      { id: 'all', folder: '', title: 'Tất cả tài nguyên', icon: 'all' }
    ]
  }, [catalog])

  const items = useMemo<BuiltInAssetItem[]>(() => {
    return catalog?.items ?? []
  }, [catalog])

  // Count items per category
  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length }
    categories.forEach((cat) => {
      if (cat.id !== 'all') {
        counts[cat.id] = items.filter((it) => cat.folder && it.folder === cat.folder).length
      }
    })
    return counts
  }, [categories, items])

  const handleImportItem = async (item: BuiltInAssetItem, addLayer: boolean) => {
    await importBuiltInAsset(item, addLayer)
  }

  const handleSaveManifest = async (jsonContent: string): Promise<boolean> => {
    try {
      const res = await window.api.saveBuiltInManifest(jsonContent)
      if (res.ok && res.catalog) {
        setCatalog(res.catalog)
        return true
      }
      if (res.error) {
        window.alert(`Không lưu được cấu hình:\n${res.error}`)
      }
      return false
    } catch (err) {
      window.alert(`Lỗi lưu cấu hình:\n${String(err)}`)
      return false
    }
  }

  const handleOpenFolder = () => {
    const cat = categories.find((c) => c.id === selectedCategory)
    window.api.openBuiltInFolder(cat?.folder)
  }

  return (
    <div className="asset-panel-wrapper">
      {/* Header with import actions */}
      <div className="asset-top-header">
        <IconImage width={14} height={14} />
        <span>Tài nguyên</span>
        <span className="spacer" />
        <button
          type="button"
          id="import-images"
          className="btn sm"
          onClick={() => importImages(false)}
          title="Nhập thêm ảnh từ máy tính"
        >
          <IconPlus /> Ảnh
        </button>
        <button
          type="button"
          id="import-audio"
          className="btn sm icon"
          onClick={importAudio}
          title="Nhập nhạc nền từ máy tính"
        >
          <IconMusic />
        </button>
      </div>

      {/* Subtabs: Built-in Library vs Project Assets */}
      <div className="asset-subtabs">
        <button
          type="button"
          className={`asset-subtab-btn${subTab === 'builtin' ? ' active' : ''}`}
          onClick={() => setSubTab('builtin')}
        >
          <IconFolder width={13} height={13} />
          <span>Thư viện</span>
          <span className="asset-subtab-badge">{items.length}</span>
        </button>
        <button
          type="button"
          className={`asset-subtab-btn${subTab === 'project' ? ' active' : ''}`}
          onClick={() => setSubTab('project')}
        >
          <IconImage width={13} height={13} />
          <span>Trong dự án</span>
          <span className="asset-subtab-badge">{projectAssets.length}</span>
        </button>
      </div>

      {/* Main Content Area */}
      {subTab === 'builtin' ? (
        <div className="asset-main-layout">
          <BuiltInAssetBar
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            itemCounts={itemCounts}
            onOpenJsonModal={() => setIsJsonModalOpen(true)}
            onOpenFolder={handleOpenFolder}
          />
          <BuiltInAssetGrid
            categories={categories}
            items={items}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onImportItem={handleImportItem}
            onReload={loadCatalog}
            onOpenJsonModal={() => setIsJsonModalOpen(true)}
            loading={loading}
          />
        </div>
      ) : (
        <div className="panel-body">
          <ProjectAssetList />
        </div>
      )}

      {/* JSON Manifest Editor Modal */}
      <AssetCatalogModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        initialJson={catalog?.rawJson || ''}
        onSave={handleSaveManifest}
        onOpenFolder={handleOpenFolder}
      />
    </div>
  )
}
