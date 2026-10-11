import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BuiltInAssetCategory, BuiltInAssetItem, BuiltInCatalogResult } from '@shared/ipc'
import { importAudio, importBuiltInAsset, importImages } from '../../actions'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { IconBriefcase, IconCube, IconFolder, IconGrid, IconImage, IconLayerAssembly, IconLayers, IconMusic, IconPlus } from '../icons'
import { AssetCatalogModal } from './AssetCatalogModal'
import { BuiltInAssetBar } from './BuiltInAssetBar'
import { BuiltInAssetGrid } from './BuiltInAssetGrid'
import { ProjectAssetList } from './ProjectAssetList'
import { Model3DList } from './Model3DList'
import { LayerAssemblyList } from '../layerAssembly/LayerAssemblyList'
import { MusicPanel } from './MusicPanel'
import { getStoredComposites } from '../layerAssembly/layerAssemblyStorage'
import { getStoredModels3D, fetchAsset3DsCatalog } from './models3d/models3dStorage'
import { sortAssetCategories } from './types'
import { getVisiblePublicAssets, addCustomPublicAsset } from './publicAssetStorage'

type AssetSubTab = 'builtin' | 'project' | '3d' | 'assembly' | 'music'

export function AssetPanel() {
  const projectAssets = useEditor((s) => s.project.assets)
  const [subTab, setSubTab] = useState<AssetSubTab>('builtin')
  const [catalog, setCatalog] = useState<BuiltInCatalogResult | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false)
  const [assemblyCount, setAssemblyCount] = useState<number>(() => getStoredComposites().length)
  const [model3DCount, setModel3DCount] = useState<number>(() => getStoredModels3D().length)
  const [publicVersion, setPublicVersion] = useState(0)

  const audioCount = useMemo(() => {
    const projectAudio = projectAssets.filter((a) => a.kind === 'audio').length
    return projectAudio + 1 // + 1 mẫu có sẵn (chuông gió)
  }, [projectAssets])

  useEffect(() => {
    fetchAsset3DsCatalog().then(({ models }) => {
      if (Array.isArray(models)) {
        setModel3DCount(models.length)
      }
    })
    const handleModelsChange = () => setModel3DCount(getStoredModels3D().length)
    window.addEventListener('models3d:changed', handleModelsChange)
    window.addEventListener('storage', handleModelsChange)
    return () => {
      window.removeEventListener('models3d:changed', handleModelsChange)
      window.removeEventListener('storage', handleModelsChange)
    }
  }, [])

  useEffect(() => {
    const handleCompChange = () => setAssemblyCount(getStoredComposites().length)
    window.addEventListener('layerComposites:changed', handleCompChange)
    return () => window.removeEventListener('layerComposites:changed', handleCompChange)
  }, [])

  useEffect(() => {
    const handlePubChange = () => setPublicVersion((v) => v + 1)
    window.addEventListener('publicAssets:changed', handlePubChange)
    return () => window.removeEventListener('publicAssets:changed', handlePubChange)
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

  const visiblePublicItems = useMemo<BuiltInAssetItem[]>(() => {
    return getVisiblePublicAssets(items)
  }, [items, publicVersion])

  // Count items per category
  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = { all: visiblePublicItems.length }
    categories.forEach((cat) => {
      if (cat.id !== 'all') {
        counts[cat.id] = visiblePublicItems.filter((it) => cat.folder && it.folder === cat.folder).length
      }
    })
    return counts
  }, [categories, visiblePublicItems])

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

  const publicFileInputRef = useRef<HTMLInputElement | null>(null)

  const handleUploadPublic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const currentCat = categories.find((c) => c.id === selectedCategory)
    const targetFolder = currentCat?.folder || 'uploads'

    for (const file of Array.from(files)) {
      try {
        const buffer = new Uint8Array(await file.arrayBuffer())
        if (window.api?.importBuiltInAssetFile) {
          await window.api.importBuiltInAssetFile({
            name: file.name,
            buffer,
            folder: targetFolder
          })
        } else {
          const reader = new FileReader()
          reader.onload = () => {
            addCustomPublicAsset(file.name, reader.result as string, file.size, targetFolder)
            loadCatalog()
          }
          reader.readAsDataURL(file)
        }
      } catch (err) {
        console.error('[AssetPanel] Error importing public file:', err)
      }
    }
    e.target.value = ''
    await loadCatalog()
  }

  return (
    <div className="asset-panel-wrapper">
      {/* Header with import actions */}
      <div className="asset-top-header">
        <span className="asset-top-header-label">
          {subTab === 'builtin' && <IconGrid width={14} height={14} />}
          {subTab === '3d' && <IconCube width={14} height={14} />}
          {subTab === 'assembly' && <IconLayerAssembly width={14} height={14} />}
          {subTab === 'music' && <IconMusic width={14} height={14} />}
          {subTab === 'project' && <IconBriefcase width={14} height={14} />}
          <span>
            {subTab === 'builtin' && 'Kho mẫu có sẵn'}
            {subTab === '3d' && 'Mô hình 3D'}
            {subTab === 'assembly' && 'Cụm layer lắp ráp'}
            {subTab === 'music' && 'Âm thanh & Nhạc nền'}
            {subTab === 'project' && 'Tệp trong dự án'}
          </span>
        </span>
        <span className="spacer" />

        <input
          ref={publicFileInputRef}
          type="file"
          accept="image/*,audio/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleUploadPublic}
        />

        {subTab === 'builtin' ? (
          <button
            type="button"
            className="btn sm asset-action-btn-highlight"
            onClick={() => publicFileInputRef.current?.click()}
            title="Thêm tệp ảnh hoặc âm thanh vào kho tài nguyên Công khai (dùng chung cho mọi dự án)"
          >
            <IconPlus /> Ảnh công khai
          </button>
        ) : subTab === '3d' ? (
          <button
            type="button"
            className="btn sm asset-action-btn-highlight"
            onClick={() => window.dispatchEvent(new CustomEvent('assembly:open'))}
            title="Mở xưởng tạo mô hình 3D từ các diện ảnh phẳng"
          >
            <IconPlus /> Tạo 3D
          </button>
        ) : subTab === 'assembly' ? (
          <button
            type="button"
            className="btn sm asset-action-btn-highlight"
            onClick={() => window.dispatchEvent(new CustomEvent('layerAssembly:open'))}
            title="Mở xưởng lắp ráp layer xếp chồng 2.5D"
          >
            <IconPlus /> Tạo lắp ráp
          </button>
        ) : subTab === 'music' ? (
          <button
            type="button"
            id="music-tab-add-btn"
            className="btn sm asset-action-btn-highlight"
            onClick={() => importAudio(useEditor.getState().time, useView.getState().audioSelectedCategory)}
            title="Thêm tệp âm thanh (mp3, wav, ogg, aac...) từ máy tính vào dự án"
          >
            <IconPlus /> Thêm audio
          </button>
        ) : (
          <>
            <button
              type="button"
              id="import-images"
              className="btn sm asset-action-btn-highlight"
              onClick={() => importImages(false)}
              title="Nhập ảnh riêng cho dự án hiện tại (tài nguyên nội bộ)"
            >
              <IconPlus /> Ảnh dự án
            </button>
            <button
              type="button"
              id="import-audio"
              className="btn sm icon asset-action-btn-highlight"
              onClick={() => importAudio(useEditor.getState().time, useView.getState().audioSelectedCategory)}
              title="Nhập nhạc nền từ máy tính vào mốc thời gian hiện tại"
            >
              <IconMusic />
            </button>
          </>
        )}
      </div>

      {/* Subtabs: Built-in Library vs 3D Assembled Models vs Layer Assembly vs Music vs Project Assets */}
      <div className="asset-subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'builtin'}
          className={`asset-subtab-btn${subTab === 'builtin' ? ' active' : ''}`}
          onClick={() => setSubTab('builtin')}
          title="Kho mẫu có sẵn tích hợp (6 tệp)"
        >
          <IconGrid width={13} height={13} />
          <span className="asset-subtab-label">Kho mẫu</span>
          <span className="asset-subtab-badge">{visiblePublicItems.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === '3d'}
          className={`asset-subtab-btn${subTab === '3d' ? ' active' : ''}`}
          onClick={() => setSubTab('3d')}
          title={`Mô hình 3D lắp ráp (${model3DCount} mô hình)`}
        >
          <IconCube width={13} height={13} />
          <span className="asset-subtab-label">3D</span>
          <span className="asset-subtab-badge">{model3DCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'assembly'}
          className={`asset-subtab-btn${subTab === 'assembly' ? ' active' : ''}`}
          onClick={() => setSubTab('assembly')}
          title="Chi tiết & vật liệu lắp ráp layer xếp chồng 2.5D (4 cụm)"
        >
          <IconLayerAssembly width={13} height={13} />
          <span className="asset-subtab-label">Lắp ráp</span>
          <span className="asset-subtab-badge">{assemblyCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          id="asset-subtab-music-btn"
          aria-selected={subTab === 'music'}
          className={`asset-subtab-btn${subTab === 'music' ? ' active' : ''}`}
          onClick={() => setSubTab('music')}
          title={`Tài nguyên âm thanh & nhạc nền (${audioCount} tệp)`}
        >
          <IconMusic width={13} height={13} />
          <span className="asset-subtab-label">Nhạc</span>
          <span className="asset-subtab-badge">{audioCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'project'}
          className={`asset-subtab-btn${subTab === 'project' ? ' active' : ''}`}
          onClick={() => setSubTab('project')}
          title="Tệp tài nguyên trong dự án (5 tệp)"
        >
          <IconBriefcase width={13} height={13} />
          <span className="asset-subtab-label">Dự án</span>
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
      ) : subTab === '3d' ? (
        <Model3DList />
      ) : subTab === 'assembly' ? (
        <LayerAssemblyList />
      ) : subTab === 'music' ? (
        <MusicPanel />
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
