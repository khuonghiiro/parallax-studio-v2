import { useState, useEffect, useRef } from 'react'
import type { LayerComposite, AssembledLayerItem } from './types'
import { saveComposite } from './layerAssemblyStorage'
import { insertLayerCompositeToScene } from './insertLayerComposite'
import { captureCompositeThumbnail } from './layerAssemblyThumbnail'
import { registerLayerAssemblySession } from './layerAssemblyBridge'
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

  // Đăng ký active session cho MCP bridge điều khiển realtime
  useEffect(() => {
    return registerLayerAssemblySession({
      getComposite: () => composite,
      setComposite: (c) => setComposite(c),
      getSelectedLayerId: () => selectedLayerId,
      setSelectedLayerId: (id) => setSelectedLayerId(id),
      getIsPlaying: () => isPlaying,
      setIsPlaying: (p) => setIsPlaying(p),
      getTime: () => animTime,
      setTime: (t) => setAnimTime(t),
      save: handleSave,
      insertToScene: handleInsertToScene,
      close: onClose
    })
  }, [composite, selectedLayerId, isPlaying, animTime, onClose])

  // Cập nhật thuộc tính của 1 layer
  const handleUpdateLayer = (id: string, patch: Partial<AssembledLayerItem>) => {
    setComposite((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, ...patch } : l))
    }))
  }

  // Thêm layer từ ảnh 2D
  const handleAddLayerFromAsset = (name: string, assetPath: string, imageUrl?: string) => {
    const count = composite.layers.length
    // Tự động phân tầng khoảng cách Z: layer sau ở xa (Z dương), layer trước ở gần (Z âm)
    const defaultZ = count === 0 ? 50 : count === 1 ? 0 : -50 * (count - 1)

    const newLayer: AssembledLayerItem = {
      id: `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      assetPath,
      imageUrl,
      x: 0,
      y: 0,
      z: defaultZ,
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

  // Mở rộng hoặc thu nhỏ kích thước khung camera
  const handleExpandFrame = (delta: number) => {
    setComposite((prev) => ({
      ...prev,
      width: Math.max(200, Math.min(4000, prev.width + delta)),
      height: Math.max(200, Math.min(4000, prev.height + delta))
    }))
  }

  // Tự động mở rộng kích thước khung vừa khít tất cả các layer đang có
  const handleFitFrameToLayers = () => {
    if (composite.layers.length === 0) return
    let minX = -100
    let maxX = 100
    let minY = -100
    let maxY = 100

    composite.layers.forEach((l) => {
      // Ước tính kích thước layer theo scale (kích thước ảnh chuẩn ~380px)
      const halfW = 190 * (l.scale || 1)
      const halfH = 190 * (l.scale || 1)
      minX = Math.min(minX, l.x - halfW)
      maxX = Math.max(maxX, l.x + halfW)
      minY = Math.min(minY, l.y - halfH)
      maxY = Math.max(maxY, l.y + halfH)
    })

    const pad = 60
    const neededW = Math.max(400, Math.ceil((Math.max(Math.abs(minX), Math.abs(maxX)) * 2 + pad) / 50) * 50)
    const neededH = Math.max(400, Math.ceil((Math.max(Math.abs(minY), Math.abs(maxY)) * 2 + pad) / 50) * 50)

    setComposite((prev) => ({
      ...prev,
      width: Math.min(4000, neededW),
      height: Math.min(4000, neededH)
    }))
  }

  const [isSaving, setIsSaving] = useState(false)

  // Lưu chi tiết cụm layer kèm kết xuất Thumbnail 2D
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const thumb = await captureCompositeThumbnail(composite)
      const toSave: LayerComposite = thumb ? { ...composite, thumbnail: thumb } : composite
      saveComposite(toSave)
      onClose()
    } catch (err) {
      console.error('[LayerAssemblyDialog] Error saving composite thumbnail:', err)
      saveComposite(composite)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  // Thêm vào cảnh hiện tại
  const handleInsertToScene = async () => {
    setIsSaving(true)
    try {
      const thumb = await captureCompositeThumbnail(composite)
      const toSave: LayerComposite = thumb ? { ...composite, thumbnail: thumb } : composite
      saveComposite(toSave)
      await insertLayerCompositeToScene({ composite: toSave })
      onClose()
    } catch (err) {
      console.error('[LayerAssemblyDialog] Error inserting composite:', err)
      saveComposite(composite)
      await insertLayerCompositeToScene({ composite })
      onClose()
    } finally {
      setIsSaving(false)
    }
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
              style={{ width: '54px', textAlign: 'center' }}
              title="Chiều rộng khung chi tiết"
            />
            <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>×</span>
            <input
              type="number"
              className="input-text sm"
              value={composite.height}
              onChange={(e) => setComposite({ ...composite, height: Number(e.target.value) || 600 })}
              style={{ width: '54px', textAlign: 'center' }}
              title="Chiều cao khung chi tiết"
            />
            <button
              type="button"
              className="btn xs"
              onClick={() => handleExpandFrame(100)}
              title="Mở rộng kích thước khung thêm +100px cả chiều rộng và chiều cao"
              style={{ padding: '2px 6px', fontSize: '10px', fontWeight: 600 }}
            >
              +100
            </button>
            <button
              type="button"
              className="btn xs"
              onClick={() => handleExpandFrame(-100)}
              title="Thu nhỏ kích thước khung bớt 100px (tối thiểu 200px)"
              style={{ padding: '2px 5px', fontSize: '10px', fontWeight: 600 }}
            >
              -100
            </button>
            <button
              type="button"
              className="btn xs"
              onClick={handleFitFrameToLayers}
              title="Tự động mở rộng khung vừa khít tất cả các layer đang có"
              style={{ padding: '2px 6px', fontSize: '10px' }}
            >
              📐 Vừa khít
            </button>
            <select
              className="input-text sm"
              style={{ fontSize: '10.5px', padding: '2px 4px', width: '90px' }}
              value=""
              onChange={(e) => {
                if (!e.target.value) return
                const [w, h] = e.target.value.split('x').map(Number)
                if (w && h) setComposite((prev) => ({ ...prev, width: w, height: h }))
              }}
              title="Chọn nhanh khổ kích thước chuẩn"
            >
              <option value="" disabled>Khổ mẫu...</option>
              <option value="550x600">550 × 600 (Mặc định)</option>
              <option value="800x800">800 × 800 (Vuông lớn)</option>
              <option value="1000x1000">1000 × 1000 (Vuông rộng)</option>
              <option value="1280x720">1280 × 720 (16:9 HD)</option>
              <option value="1920x1080">1920 × 1080 (16:9 FHD)</option>
              <option value="1080x1920">1080 × 1920 (9:16 Dọc)</option>
              <option value="800x1000">800 × 1000 (Dọc lớn)</option>
            </select>
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
              disabled={isSaving}
              title="Lưu lại cụm layer này vào thư viện để tái sử dụng"
            >
              {isSaving ? 'Đang lưu...' : 'Lưu mẫu'}
            </button>

            <button
              type="button"
              className="btn sm primary"
              onClick={handleInsertToScene}
              disabled={composite.layers.length === 0 || isSaving}
              title="Chèn toàn bộ các layer đã lắp ráp vào cảnh phân cảnh hiện tại"
            >
              <IconPlus width={12} height={12} /> {isSaving ? 'Đang lưu...' : 'Thêm vào cảnh hiện tại'}
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
                    <span className="pane-title"><IconImage width={12} height={12} /> Góc nhìn chính diện (Camera / 2D)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-faint)' }}>{composite.width} × {composite.height} px</span>
                      <button
                        type="button"
                        className="btn xs"
                        onClick={() => handleExpandFrame(100)}
                        title="Nới rộng khung thêm +100px chiều rộng và chiều cao"
                        style={{ padding: '1px 5px', fontSize: '10px' }}
                      >
                        +100px
                      </button>
                      <button
                        type="button"
                        className="btn xs"
                        onClick={handleFitFrameToLayers}
                        title="Tự động mở rộng khung vừa khít các layer"
                        style={{ padding: '1px 5px', fontSize: '10px' }}
                      >
                        📐 Vừa khít
                      </button>
                    </div>
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
