import { useState, useEffect, useRef } from 'react'
import type { LayerComposite, AssembledLayerItem } from './types'
import { saveComposite } from './layerAssemblyStorage'
import { insertLayerCompositeToScene } from './insertLayerComposite'
import { LayerAssemblyViewport } from './LayerAssemblyViewport'
import { LayerAssemblyInspector } from './LayerAssemblyInspector'
import { LayerAssemblySidebar } from './LayerAssemblySidebar'
import { IconLayers, IconPlus, IconX } from '../icons'
import '../../styles/layerAssembly.css'

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

  return (
    <div className="layer-workshop-modal" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      {/* 1. Header */}
      <div className="layer-workshop-header">
        <IconLayers width={16} height={16} />
        <strong style={{ fontSize: '13px', color: 'var(--text)' }}>Xưởng Lắp Ráp Layer</strong>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Tên chi tiết:</span>
          <input
            type="text"
            className="input-text sm"
            value={composite.name}
            onChange={(e) => setComposite({ ...composite, name: e.target.value })}
            style={{ width: '220px', fontWeight: 600 }}
          />
        </div>

        <span className="spacer" />

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

      {/* 2. Body: Sidebar | Viewport | Inspector */}
      <div className="layer-workshop-body">
        {/* Left Sidebar: Assets & Presets */}
        <LayerAssemblySidebar
          onAddLayerFromAsset={handleAddLayerFromAsset}
          onAppendPresetLayers={handleAppendPresetLayers}
        />

        {/* Center: Interactive 2.5D Viewport */}
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
  )
}
