import { useState, useMemo } from 'react'
import { useEditor } from '../../store/editor'
import { assetStore } from '../../project/assets'
import { BUILTIN_COMPOSITES } from './layerAssemblyStorage'
import type { AssembledLayerItem } from './types'
import { IconImage, IconLayers, IconPlus } from '../icons'
import { useLayerAssetImage } from './useLayerAssetImage'

export interface LayerAssemblySidebarProps {
  onAddLayerFromAsset: (name: string, path: string, url?: string) => void
  onAppendPresetLayers: (layers: AssembledLayerItem[]) => void
}

// Danh sách các vật liệu mẫu thiên nhiên & đạo cụ có sẵn trong assets để người dùng chọn nhanh
const BUILTIN_NATURE_ASSETS = [
  { path: 'assembly_3d/modular/nature_grass.png', name: 'Bụi cỏ xanh' },
  { path: 'assembly_3d/modular/nature_flower_stem.png', name: 'Thân cành hoa' },
  { path: 'assembly_3d/modular/nature_flower_petal.png', name: 'Cánh hoa đỏ' },
  { path: 'assembly_3d/modular/nature_flower_center.png', name: 'Nhụy hoa vàng' },
  { path: 'assembly_3d/modular/nature_leaf.png', name: 'Nhánh lá cây' },
  { path: 'assembly_3d/modular/decor_flower_box.png', name: 'Bồn hoa ban công' },
  { path: 'assembly_3d/modular/decor_window.png', name: 'Cửa sổ Tudor' },
  { path: 'demo_transparent/layer5_foreground_vines.png', name: 'Dây leo rủ' },
  { path: 'demos/sparkle_fireflies.gif', name: 'Đom đóm (GIF)' }
]

export function LayerAssemblySidebar({
  onAddLayerFromAsset,
  onAppendPresetLayers
}: LayerAssemblySidebarProps) {
  const [activeTab, setActiveTab] = useState<'project' | 'builtin' | 'presets'>('project')
  const projectAssets = useEditor((s) => s.project.assets)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredProjectAssets = useMemo(() => {
    if (!searchTerm.trim()) return projectAssets
    const q = searchTerm.toLowerCase()
    return projectAssets.filter((a) => a.name.toLowerCase().includes(q))
  }, [projectAssets, searchTerm])

  const filteredBuiltin = useMemo(() => {
    if (!searchTerm.trim()) return BUILTIN_NATURE_ASSETS
    const q = searchTerm.toLowerCase()
    return BUILTIN_NATURE_ASSETS.filter((a) => a.name.toLowerCase().includes(q))
  }, [searchTerm])

  return (
    <div
      className="layer-workshop-sidebar"
      style={{
        width: '270px',
        background: 'var(--bg-2)',
        borderRight: '1px solid var(--line-soft)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* 1. Tabs Switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line-soft)', background: 'var(--bg-1)', flexShrink: 0 }}>
        <button
          type="button"
          className={`tab${activeTab === 'project' ? ' active' : ''}`}
          style={{ flex: 1, height: '34px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: 0 }}
          onClick={() => setActiveTab('project')}
          title="Tài nguyên ảnh của dự án hiện tại"
        >
          <IconImage width={12} height={12} /> Dự án ({projectAssets.length})
        </button>
        <button
          type="button"
          className={`tab${activeTab === 'builtin' ? ' active' : ''}`}
          style={{ flex: 1, height: '34px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: 0 }}
          onClick={() => setActiveTab('builtin')}
          title="Vật liệu mẫu có sẵn (hoa, cỏ, lá, cành)"
        >
          <IconImage width={12} height={12} /> Có sẵn
        </button>
        <button
          type="button"
          className={`tab${activeTab === 'presets' ? ' active' : ''}`}
          style={{ flex: 1, height: '34px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: 0 }}
          onClick={() => setActiveTab('presets')}
          title="Cụm layer lắp sẵn"
        >
          <IconLayers width={12} height={12} /> Mẫu sẵn
        </button>
      </div>

      {/* 2. Search Input */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line-soft)', flexShrink: 0 }}>
        <input
          type="text"
          className="input-text sm"
          placeholder="Tìm kiếm tài nguyên..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', fontSize: '11px' }}
        />
      </div>

      {/* 3. Main Content List */}
      <div style={{ flex: '1 1 0%', overflowY: 'auto', padding: '8px', minHeight: 0 }}>
        {activeTab === 'project' && (
          filteredProjectAssets.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {filteredProjectAssets.map((asset) => {
                const rt = assetStore.get(asset.id)
                const thumbUrl = rt?.thumbUrl || rt?.url
                const fullUrl = rt?.url || rt?.thumbUrl
                return (
                  <div
                    key={asset.id}
                    style={{
                      background: 'var(--bg-1)',
                      border: '1px solid var(--line-soft)',
                      borderRadius: '4px',
                      padding: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => onAddLayerFromAsset(asset.name, asset.id, fullUrl)}
                    title={`Click để thêm layer: ${asset.name}`}
                  >
                    <div
                      style={{
                        height: '75px',
                        background: 'var(--bg-0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        borderRadius: '3px'
                      }}
                    >
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={asset.name}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          draggable={false}
                        />
                      ) : (
                        <IconImage width={20} height={20} style={{ opacity: 0.4 }} />
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={asset.name}
                    >
                      {asset.name}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '11px' }}>
              Chưa có ảnh trong dự án. Bạn có thể sang tab <b>Có sẵn</b> để chọn hoa lá mẫu.
            </div>
          )
        )}

        {activeTab === 'builtin' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {filteredBuiltin.map((item) => (
              <BuiltinAssetCard
                key={item.path}
                item={item}
                onSelect={() => onAddLayerFromAsset(item.name, item.path)}
              />
            ))}
          </div>
        )}

        {activeTab === 'presets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {BUILTIN_COMPOSITES.map((preset) => (
              <div
                key={preset.id}
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--line-soft)',
                  borderRadius: '5px',
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {preset.name}
                  </span>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-dim)' }}>
                    {preset.layers.length} lớp xếp chồng
                  </span>
                </div>
                <button
                  type="button"
                  className="btn xs primary"
                  style={{ flexShrink: 0 }}
                  onClick={() => onAppendPresetLayers(preset.layers)}
                  title="Ghép các layer từ mẫu này vào cụm hiện tại"
                >
                  <IconPlus width={10} height={10} /> Ghép
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BuiltinAssetCard({
  item,
  onSelect
}: {
  item: { path: string; name: string }
  onSelect: () => void
}) {
  const imageUrl = useLayerAssetImage(item.path)

  return (
    <div
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--line-soft)',
        borderRadius: '4px',
        padding: '4px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        transition: 'all 0.15s ease'
      }}
      onClick={onSelect}
      title={`Click để thêm ${item.name} làm layer mới`}
    >
      <div
        style={{
          height: '75px',
          background: 'var(--bg-0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: '3px'
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            draggable={false}
          />
        ) : (
          <IconImage width={20} height={20} style={{ opacity: 0.4 }} />
        )}
      </div>
      <span
        style={{
          fontSize: '10px',
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
        title={item.name}
      >
        {item.name}
      </span>
    </div>
  )
}
