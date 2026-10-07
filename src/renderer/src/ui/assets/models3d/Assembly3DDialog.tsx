import { useState, useMemo } from 'react'
import type { Model3D } from './types'
import { AssemblyViewport } from './AssemblyViewport'
import { FaceInspector } from './FaceInspector'
import { AssemblyAssetSidebar } from './AssemblyAssetSidebar'
import { saveModel3D } from './models3dStorage'
import { insertModel3DToScene } from './insertModel3D'
import { clearTextureCache } from './textureResolver'
import { IconCube } from '../../icons'

interface Assembly3DDialogProps {
  isOpen: boolean
  initialModel: Model3D
  onClose: () => void
  onSaved?: (model: Model3D) => void
}

export function Assembly3DDialog({
  isOpen,
  initialModel,
  onClose,
  onSaved
}: Assembly3DDialogProps) {
  const [model, setModel] = useState<Model3D>(initialModel)
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(
    initialModel.faces[0]?.id || null
  )
  const [showWireframe, setShowWireframe] = useState(true)
  const [meshOnlyPixels, setMeshOnlyPixels] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [showAxes, setShowAxes] = useState(true)
  const [cameraPreset, setCameraPreset] = useState<'front' | 'left' | 'right' | 'top' | 'iso'>('iso')
  const [inserting, setInserting] = useState(false)

  const selectedFace = useMemo(() => {
    return model.faces.find((f) => f.id === selectedFaceId) || null
  }, [model.faces, selectedFaceId])

  if (!isOpen) return null

  const handleClose = () => {
    clearTextureCache()
    onClose()
  }

  const handleSave = () => {
    saveModel3D(model)
    onSaved?.(model)
    handleClose()
  }

  const handleInsert = async () => {
    setInserting(true)
    try {
      await insertModel3DToScene({ model })
      onSaved?.(model)
      handleClose()
    } catch (err) {
      console.error('[Assembly3DDialog] Error inserting model to scene:', err)
    } finally {
      setInserting(false)
    }
  }

  const handleAssignAssetToFace = (assetPath: string, width?: number, height?: number) => {
    const targetId = selectedFaceId || model.faces[0]?.id
    if (!targetId) return

    setModel((prev) => ({
      ...prev,
      faces: prev.faces.map((f) => {
        if (f.id === targetId) {
          return {
            ...f,
            assetPath,
            width: width && width > 0 ? width : f.width,
            height: height && height > 0 ? height : f.height
          }
        }
        return f
      })
    }))
  }

  return (
    <div className="assembly-modal-overlay">
      <div className="assembly-modal-content">
        {/* Top Header */}
        <div className="assembly-modal-header">
          <div className="header-title">
            <IconCube width={18} height={18} />
            <span>Xưởng Lắp Ráp 3D (2.5D Origami & Spatial Projection)</span>
          </div>

          {/* Quick Viewport Toggles */}
          <div className="header-view-controls">
            <label className="toggle-chip" title="Bật/tắt hiển thị lưới dây đa giác để căn chỉnh mép khít nhau">
              <input
                type="checkbox"
                checked={showWireframe}
                onChange={(e) => setShowWireframe(e.target.checked)}
              />
              <span>Hiện Mesh</span>
            </label>

            <label className="toggle-chip" title="Chỉ hiện khung lưới (mesh) tại các vùng ảnh có pixel, ẩn khung lưới ở phần nền trong suốt">
              <input
                type="checkbox"
                checked={meshOnlyPixels}
                onChange={(e) => setMeshOnlyPixels(e.target.checked)}
              />
              <span>Chỉ mesh có pixel</span>
            </label>

            <label className="toggle-chip">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              <span>Lưới sàn</span>
            </label>
            <label className="toggle-chip">
              <input
                type="checkbox"
                checked={showAxes}
                onChange={(e) => setShowAxes(e.target.checked)}
              />
              <span>Trục tọa độ</span>
            </label>

            {/* Camera Presets */}
            <div className="cam-preset-group">
              <button
                type="button"
                className={`preset-btn${cameraPreset === 'front' ? ' active' : ''}`}
                onClick={() => setCameraPreset('front')}
                title="Nhìn thẳng chính diện"
              >
                Chính diện
              </button>
              <button
                type="button"
                className={`preset-btn${cameraPreset === 'left' ? ' active' : ''}`}
                onClick={() => setCameraPreset('left')}
                title="Góc nhìn bên trái"
              >
                Hông trái
              </button>
              <button
                type="button"
                className={`preset-btn${cameraPreset === 'right' ? ' active' : ''}`}
                onClick={() => setCameraPreset('right')}
                title="Góc nhìn bên phải"
              >
                Hông phải
              </button>
              <button
                type="button"
                className={`preset-btn${cameraPreset === 'top' ? ' active' : ''}`}
                onClick={() => setCameraPreset('top')}
                title="Góc nhìn từ trên nóc"
              >
                Từ trên
              </button>
              <button
                type="button"
                className={`preset-btn${cameraPreset === 'iso' ? ' active' : ''}`}
                onClick={() => setCameraPreset('iso')}
                title="Phối cảnh 3D lập thể"
              >
                3D Phối cảnh
              </button>
            </div>
          </div>

          <button type="button" className="close-btn" onClick={handleClose} title="Đóng">
            ×
          </button>
        </div>

        {/* Modal Body: 3-column Layout (Left: Assembly Assets | Center: 3D Viewport | Right: Face Inspector) */}
        <div className="assembly-modal-body">
          {/* Cột trái: Tài nguyên lắp ráp có hình ảnh chi tiết */}
          <AssemblyAssetSidebar
            selectedFace={selectedFace}
            onAssignAssetToFace={handleAssignAssetToFace}
            modelFaces={model.faces}
            onSelectFace={setSelectedFaceId}
          />

          {/* Cột giữa: Viewport 3D với hình ảnh và pixel-mesh */}
          <div className="assembly-viewport-panel">
            <AssemblyViewport
              model={model}
              selectedFaceId={selectedFaceId}
              showWireframe={showWireframe}
              meshOnlyPixels={meshOnlyPixels}
              showGrid={showGrid}
              showAxes={showAxes}
              cameraPreset={cameraPreset}
              onSelectFace={setSelectedFaceId}
            />
            <div className="viewport-hint">
              Kéo chuột trái: Xoay | Chuột phải/Shift+Kéo: Di chuyển | Lăn chuột: Phóng to/Thu nhỏ | Bấm vào mặt phẳng để chọn
            </div>
          </div>

          {/* Cột phải: Inspector điều chỉnh thông số từng mặt */}
          <div className="assembly-inspector-panel">
            <FaceInspector
              model={model}
              selectedFaceId={selectedFaceId}
              onChangeModel={setModel}
              onSelectFace={setSelectedFaceId}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="assembly-modal-footer">
          <span className="footer-status">
            Tổng cộng <strong>{model.faces.length}</strong> mặt phẳng | Tỉ lệ phóng: <strong>{(model.scale * 100).toFixed(0)}%</strong>
          </span>
          <div className="footer-actions">
            <button type="button" className="btn secondary" onClick={handleClose}>
              Hủy
            </button>
            <button type="button" className="btn secondary" onClick={handleSave}>
              Lưu mô hình
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={handleInsert}
              disabled={inserting}
            >
              {inserting ? 'Đang thêm...' : '+ Thêm vào Cảnh hiện tại'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
