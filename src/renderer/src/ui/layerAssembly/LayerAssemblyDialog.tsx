import { useState, useEffect, useRef } from 'react'
import type { LayerComposite, AssembledLayerItem } from './types'
import { saveComposite } from './layerAssemblyStorage'
import { insertLayerCompositeToScene } from './insertLayerComposite'
import { LayerAssemblyViewport } from './LayerAssemblyViewport'
import { LayerAssembly3DViewport } from './LayerAssembly3DViewport'
import { LayerAssemblyTransportBar } from './LayerAssemblyTransportBar'
import { LayerAssemblyInspector } from './LayerAssemblyInspector'
import { LayerAssemblySidebar } from './LayerAssemblySidebar'
import { IconLayers, IconPlus, IconX, IconCube, IconSplit, IconImage } from '../icons'
import '../../styles/layerAssembly.css'

export type AssemblyWorkspaceView = '2d' | '3d' | 'split'

export interface LayerAssemblyDialogProps {
  initialComposite?: LayerComposite | null
  onClose: () => void
}

export function LayerAssemblyDialog({
  initialComposite,
  onClose
}: LayerAssemblyDialogProps) {
  const [composite, setComposite] = useState<LayerComposite>(() => {
    if (initialComposite) return JSON.parse(JSON.stringify(initialComposite))
    return {
      id: `comp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'Chi tiết Layer Mới',
      category: 'nature',
      width: 600,
      height: 600,
      layers: []
    }
  })

  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(() => {
    return composite.layers[0]?.id || null
  })

  // Chế độ xem: 2D, 3D, hoặc Chia đôi (Split view)
  const [workspaceView, setWorkspaceView] = useState<AssemblyWorkspaceView>('split')

  // Animation Playback Preview state
  const [isPlaying, setIsPlaying] = useState(true)
  const [animTime, setAnimTime] = useState(0)
  const animFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(performance.now())

  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      return
    }

    lastTimeRef.current = performance.now()
    const loop = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now
      setAnimTime((prev) => prev + dt)
      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isPlaying])

  // Cập nhật thuộc tính của 1 layer
  const handleUpdateLayer = (id: string, patch: Partial<AssembledLayerItem>) => {
    setComposite((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, ...patch } : l))
    }))
  }

  // Thêm layer từ ảnh 2D
  const handleAddLayerFromAsset = (name: string, assetPath: string, imageUrl?: string) => {
    const newLayer: AssembledLayerItem = {
      id: `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      assetPath,
      imageUrl,
      x: 0,
      y: 0,
      z: 0,
      scale: 1.0,
      rotation: 0,
      opacity: 1.0,
      motion: { type: 'sway', speed: 1.0, amplitude: 15, anchor: 'bottom' }
    }

    setComposite((prev) => ({
      ...prev,
      layers: [...prev.layers, newLayer]
    }))
    setSelectedLayerId(newLayer.id)
  }

  // Ghép các layer từ preset
  const handleAppendPresetLayers = (layers: AssembledLayerItem[]) => {
    const cloned = layers.map((l) => ({
      ...l,
      id: `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    }))
    setComposite((prev) => ({
      ...prev,
      layers: [...prev.layers, ...cloned]
    }))
  }

  // Thêm 1 layer rỗng
  const handleAddEmptyLayer = () => {
    handleAddLayerFromAsset(`Lớp ${composite.layers.length + 1}`, '')
  }

  // Xóa layer
  const handleDeleteLayer = (id: string) => {
    setComposite((prev) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.id !== id)
    }))
    if (selectedLayerId === id) {
      setSelectedLayerId(null)
    }
  }

  // Nhân bản layer
  const handleDuplicateLayer = (id: string) => {
    const target = composite.layers.find((l) => l.id === id)
    if (!target) return
    const dup: AssembledLayerItem = {
      ...target,
      id: `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${target.name} (Bản sao)`,
      x: target.x + 15,
      y: target.y + 15
    }
    setComposite((prev) => ({
      ...prev,
      layers: [...prev.layers, dup]
    }))
    setSelectedLayerId(dup.id)
  }

  // Đổi thứ tự layer
  const handleMoveLayerOrder = (id: string, direction: 'up' | 'down') => {
    const idx = composite.layers.findIndex((l) => l.id === id)
    if (idx < 0) return
    const nextLayers = [...composite.layers]
    const target = nextLayers[idx]
    if (direction === 'up' && idx > 0) {
      nextLayers[idx] = nextLayers[idx - 1]
      nextLayers[idx - 1] = target
    } else if (direction === 'down' && idx < nextLayers.length - 1) {
      nextLayers[idx] = nextLayers[idx + 1]
      nextLayers[idx + 1] = target
    }
    setComposite((prev) => ({ ...prev, layers: nextLayers }))
  }

  // Lưu chi tiết cụm layer
  const handleSave = () => {
    saveComposite(composite)
    onClose()
  }

  // Thêm vào cảnh hiện tại
  const handleInsertToScene = async () => {
    saveComposite(composite)
    await insertLayerCompositeToScene({ composite })
    onClose()
  }

  // Lắng nghe phím Escape để đóng modal, Space để Play/Pause
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.code === 'Space') {
        e.preventDefault()
        setIsPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="layer-workshop-overlay">
      <div className="layer-workshop-dialog">
        {/* 1. Header */}
        <div className="layer-workshop-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', flexShrink: 0 }}>
            <IconLayers width={16} height={16} />
            <strong style={{ fontSize: '13px', color: 'var(--text)' }}>Xưởng Lắp Ráp Layer</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Tên chi tiết:</span>
            <input
              type="text"
              className="input-text sm"
              value={composite.name}
              onChange={(e) => setComposite({ ...composite, name: e.target.value })}
              style={{ width: '180px', fontWeight: 600 }}
              placeholder="Tên chi tiết layer..."
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
            <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Khung:</span>
            <input
              type="number"
              className="input-text sm"
              value={composite.width}
              onChange={(e) => setComposite({ ...composite, width: Number(e.target.value) || 600 })}
              style={{ width: '56px', textAlign: 'center' }}
              title="Chiều rộng khung chi tiết"
            />
            <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>×</span>
            <input
              type="number"
              className="input-text sm"
              value={composite.height}
              onChange={(e) => setComposite({ ...composite, height: Number(e.target.value) || 600 })}
              style={{ width: '56px', textAlign: 'center' }}
              title="Chiều cao khung chi tiết"
            />
          </div>

          {/* Chuyển đổi View: 2D | 3D | Chia đôi */}
          <div className="view-mode-tabs" style={{ marginLeft: '16px' }} title="Bố cục khung làm việc">
            <button
              type="button"
              className={`view-mode-tab-btn${workspaceView === '2d' ? ' active' : ''}`}
              onClick={() => setWorkspaceView('2d')}
              title="Chế độ xem 2D (Căn chỉnh phẳng X, Y)"
            >
              <IconImage width={13} height={13} />
              <span>2D</span>
            </button>
            <button
              type="button"
              className={`view-mode-tab-btn${workspaceView === 'split' ? ' active' : ''}`}
              onClick={() => setWorkspaceView('split')}
              title="Hiển thị song song 2D và 3D cạnh nhau"
            >
              <IconSplit width={13} height={13} />
              <span>2D & 3D</span>
            </button>
            <button
              type="button"
              className={`view-mode-tab-btn${workspaceView === '3d' ? ' active' : ''}`}
              onClick={() => setWorkspaceView('3d')}
              title="Không gian 3D (Xem chiều sâu các layer xếp chồng trong không gian 3 chiều)"
            >
              <IconCube width={13} height={13} />
              <span>3D</span>
            </button>
          </div>

          {/* Cụm Action Buttons: Đẩy sát về góc phải */}
          <div className="layer-workshop-header-actions">
            <button
              type="button"
              className="btn sm"
              onClick={handleSave}
              title="Lưu lại cụm layer này vào thư viện để tái sử dụng"
            >
              Lưu mẫu
            </button>

            <button
              type="button"
              className="btn sm primary"
              onClick={handleInsertToScene}
              disabled={composite.layers.length === 0}
              title="Chèn toàn bộ các layer đã lắp ráp vào cảnh phân cảnh hiện tại"
            >
              <IconPlus width={12} height={12} /> Thêm vào cảnh hiện tại
            </button>

            <button
              type="button"
              className="btn sm icon"
              onClick={onClose}
              title="Đóng Xưởng Lắp Ráp Layer (Esc)"
            >
              <IconX width={14} height={14} />
            </button>
          </div>
        </div>

        {/* 2. Body: Sidebar | Viewport (2D / 3D / Split) | Inspector */}
        <div className="layer-workshop-body">
          {/* Left Sidebar: Assets & Presets */}
          <LayerAssemblySidebar
            onAddLayerFromAsset={handleAddLayerFromAsset}
            onAppendPresetLayers={handleAppendPresetLayers}
          />

          {/* Center: 2D / 3D / Split Viewport */}
          <div className="layer-workshop-center-area">
            {workspaceView === '2d' && (
              <LayerAssemblyViewport
                composite={composite}
                selectedLayerId={selectedLayerId}
                onSelectLayer={setSelectedLayerId}
                onUpdateLayer={handleUpdateLayer}
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying((p) => !p)}
                time={animTime}
                onSeekTime={(t) => setAnimTime(t)}
              />
            )}

            {workspaceView === '3d' && (
              <div style={{ position: 'relative', flex: '1 1 0%', height: '100%', overflow: 'hidden' }}>
                <LayerAssembly3DViewport
                  composite={composite}
                  selectedLayerId={selectedLayerId}
                  onSelectLayer={setSelectedLayerId}
                  onUpdateLayer={handleUpdateLayer}
                  time={animTime}
                />
                <LayerAssemblyTransportBar
                  isPlaying={isPlaying}
                  onTogglePlay={() => setIsPlaying((p) => !p)}
                  time={animTime}
                  onSeekTime={(t) => setAnimTime(t)}
                />
              </div>
            )}

            {workspaceView === 'split' && (
              <div className="layer-workshop-split-container">
                <div className="layer-workshop-split-pane left-pane">
                  <div className="pane-header-tab">
                    <span className="pane-title"><IconImage width={12} height={12} /> Mặt phẳng 2D</span>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-faint)' }}>{composite.width} × {composite.height} px</span>
                  </div>
                  <LayerAssemblyViewport
                    composite={composite}
                    selectedLayerId={selectedLayerId}
                    onSelectLayer={setSelectedLayerId}
                    onUpdateLayer={handleUpdateLayer}
                    isPlaying={isPlaying}
                    onTogglePlay={() => setIsPlaying((p) => !p)}
                    time={animTime}
                    onSeekTime={(t) => setAnimTime(t)}
                    hideTransport
                  />
                </div>
                <div className="layer-workshop-split-pane">
                  <div className="pane-header-tab">
                    <span className="pane-title"><IconCube width={12} height={12} /> Không gian 3D</span>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-faint)' }}>{composite.layers.length} layer</span>
                  </div>
                  <LayerAssembly3DViewport
                    composite={composite}
                    selectedLayerId={selectedLayerId}
                    onSelectLayer={setSelectedLayerId}
                    onUpdateLayer={handleUpdateLayer}
                    time={animTime}
                  />
                </div>
                <LayerAssemblyTransportBar
                  isPlaying={isPlaying}
                  onTogglePlay={() => setIsPlaying((p) => !p)}
                  time={animTime}
                  onSeekTime={(t) => setAnimTime(t)}
                />
              </div>
            )}
          </div>

          {/* Right Sidebar: Hierarchy & Animation Inspector */}
          <LayerAssemblyInspector
            composite={composite}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onUpdateLayer={handleUpdateLayer}
            onAddLayer={handleAddEmptyLayer}
            onDeleteLayer={handleDeleteLayer}
            onDuplicateLayer={handleDuplicateLayer}
            onMoveLayerOrder={handleMoveLayerOrder}
          />
        </div>
      </div>
    </div>
  )
}
