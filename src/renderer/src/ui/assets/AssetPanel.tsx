import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BuiltInAssetCategory, BuiltInAssetItem, BuiltInCatalogResult } from '@shared/ipc'
import { importAudio, importBuiltInAsset, importImages } from '../../actions'
import { useEditor } from '../../store/editor'
import { IconCube, IconFolder, IconImage, IconLayers, IconMusic, IconPlus } from '../icons'
import { AssetCatalogModal } from './AssetCatalogModal'
import { BuiltInAssetBar } from './BuiltInAssetBar'
import { BuiltInAssetGrid } from './BuiltInAssetGrid'
import { ProjectAssetList } from './ProjectAssetList'
import { Model3DList } from './Model3DList'
import { LayerAssemblyList } from '../layerAssembly/LayerAssemblyList'
import { getStoredComposites } from '../layerAssembly/layerAssemblyStorage'
import { sortAssetCategories } from './types'

type AssetSubTab = 'builtin' | 'project' | '3d' | 'assembly'

export function AssetPanel() {
  const projectAssets = useEditor((s) => s.project.assets)
  const [subTab, setSubTab] = useState<AssetSubTab>('builtin')
  const [catalog, setCatalog] = useState<BuiltInCatalogResult | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false)
  const [assemblyCount, setAssemblyCount] = useState<number>(() => getStoredComposites().length)

  useEffect(() => {
    const handleCompChange = () => setAssemblyCount(getStoredComposites().length)
    window.addEventListener('layerComposites:changed', handleCompChange)
    return () => window.removeEventListener('layerComposites:changed', handleCompChange)
  }, [])

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

  useEffect(() => {
    const handleOpen = () => setSubTab('assembly')
    window.addEventListener('layerAssembly:open', handleOpen)
    return () => window.removeEventListener('layerAssembly:open', handleOpen)
  }, [])

  const categories = useMemo<BuiltInAssetCategory[]>(() => {
    const list = catalog?.categories ?? [
      { id: 'all', folder: '', title: 'Tất cả tài nguyên', icon: 'all', order: 0 }
    ]
    return sortAssetCategories(list)
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
    const curTime = useEditor.getState().time
    await importBuiltInAsset(item, addLayer, curTime)
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
          onClick={() => importAudio(useEditor.getState().time)}
          title="Nhập nhạc nền từ máy tính vào mốc thời gian hiện tại"
        >
          <IconMusic />
        </button>
      </div>

      {/* Subtabs: Built-in Library vs Project Assets vs 3D Assembled Models */}
      <div className="asset-subtabs">
        <button
          type="button"
          className={`asset-subtab-btn${subTab === 'builtin' ? ' active' : ''}`}
          onClick={() => setSubTab('builtin')}
        >
          <IconFolder width={13} height={13} />
          <span>Tất cả</span>
          <span className="asset-subtab-badge">{items.length}</span>
        </button>
        <button
          type="button"
          className={`asset-subtab-btn${subTab === 'project' ? ' active' : ''}`}
          onClick={() => setSubTab('project')}
        >
          <IconImage width={13} height={13} />
          <span>Dự án</span>
          <span className="asset-subtab-badge">{projectAssets.length}</span>
        </button>
        <button
          type="button"
          className={`asset-subtab-btn${subTab === '3d' ? ' active' : ''}`}
          onClick={() => setSubTab('3d')}
          title="Mô hình 3D lắp ráp từ các diện ảnh phẳng 2.5D"
        >
          <IconCube width={13} height={13} />
          <span>3D</span>
        </button>
        <button
          type="button"
          className={`asset-subtab-btn${subTab === 'assembly' ? ' active' : ''}`}
          onClick={() => setSubTab('assembly')}
          title="Chi tiết & vật liệu lắp ráp layer xếp chồng 2.5D"
        >
          <IconLayers width={13} height={13} />
          <span>Lắp ráp</span>
          <span className="asset-subtab-badge">{assemblyCount}</span>
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
      ) : subTab === 'project' ? (
        <div className="panel-body">
          <ProjectAssetList />
        </div>
      ) : subTab === '3d' ? (
        <Model3DList />
      ) : (
        <LayerAssemblyList />
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
