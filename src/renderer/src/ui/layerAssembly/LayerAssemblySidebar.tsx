import { useState, useMemo } from 'react'
import { useEditor } from '../../store/editor'
import { BUILTIN_COMPOSITES } from './layerAssemblyStorage'
import type { AssembledLayerItem } from './types'
import { IconImage, IconLayers, IconPlus } from '../icons'

export interface LayerAssemblySidebarProps {
  onAddLayerFromAsset: (name: string, path: string, url?: string) => void
  onAppendPresetLayers: (layers: AssembledLayerItem[]) => void
}

export function LayerAssemblySidebar({
  onAddLayerFromAsset,
  onAppendPresetLayers
}: LayerAssemblySidebarProps) {
  const [activeTab, setActiveTab] = useState<'assets' | 'presets'>('assets')
  const projectAssets = useEditor((s) => s.project.assets)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredAssets = useMemo(() => {
    if (!searchTerm.trim()) return projectAssets
    const q = searchTerm.toLowerCase()
    return projectAssets.filter((a) => a.name.toLowerCase().includes(q))
  }, [projectAssets, searchTerm])

  return (
    <div className="layer-workshop-sidebar">
      {/* Tabs Switcher: Ảnh 2D vs Mẫu lắp sẵn */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line-soft)', background: 'var(--bg-1)' }}>
        <button
          type="button"
          className={`tab${activeTab === 'assets' ? ' active' : ''}`}
          style={{ flex: 1, height: '34px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
          onClick={() => setActiveTab('assets')}
        >
          <IconImage width={12} height={12} /> Ảnh 2D ({projectAssets.length})
        </button>
        <button
          type="button"
          className={`tab${activeTab === 'presets' ? ' active' : ''}`}
          style={{ flex: 1, height: '34px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
          onClick={() => setActiveTab('presets')}
        >
          <IconLayers width={12} height={12} /> Mẫu sẵn
        </button>
      </div>

      {/* Search Input */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line-soft)' }}>
        <input
          type="text"
          className="input-text sm"
          placeholder={activeTab === 'assets' ? 'Tìm ảnh tài nguyên...' : 'Tìm mẫu lắp sẵn...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      {/* Main List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {activeTab === 'assets' ? (
          filteredAssets.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {filteredAssets.map((asset) => (
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
                  onClick={() => onAddLayerFromAsset(asset.name, asset.path || asset.id, asset.path)}
                  title={`Bấm để thêm ${asset.name} làm layer mới`}
                >
                  <div
                    style={{
                      height: '70px',
                      background: 'var(--bg-0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      borderRadius: '3px'
                    }}
                  >
                    <img
                      src={asset.path}
                      alt={asset.name}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      draggable={false}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {asset.name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '20px 8px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '11px' }}>
              Chưa có ảnh trong dự án. Hãy nhập thêm ảnh ở tab Tài nguyên.
            </div>
          )
        ) : (
          /* Presets List */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {BUILTIN_COMPOSITES.map((preset) => (
              <div
                key={preset.id}
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--line-soft)',
                  borderRadius: '5px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '11.5px', color: 'var(--text)' }}>{preset.name}</strong>
                  <span style={{ fontSize: '9.5px', color: 'var(--key)', fontWeight: 600 }}>
                    {preset.layers.length} layers
                  </span>
                </div>
                <p style={{ fontSize: '10px', color: 'var(--text-dim)', margin: 0, lineHeight: 1.3 }}>
                  {preset.description}
                </p>
                <button
                  type="button"
                  className="btn sm"
                  style={{ alignSelf: 'flex-start', fontSize: '10.5px', padding: '3px 8px' }}
                  onClick={() => onAppendPresetLayers(preset.layers)}
                  title="Ghép thêm các layer từ mẫu này vào cụm đang tạo"
                >
                  <IconPlus width={10} height={10} /> Ghép các layer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
