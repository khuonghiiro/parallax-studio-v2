import { useState, useMemo, useEffect } from 'react'
import { formatFaceLabel, type Model3D } from './types'
import { AssemblyViewport, type GizmoMode } from './AssemblyViewport'
import { FaceInspector } from './FaceInspector'
import { AssemblyAssetSidebar } from './AssemblyAssetSidebar'
import { Mesh2DTextureEditor } from './Mesh2DTextureEditor'
import { saveModel3D } from './models3dStorage'
import { insertModel3DToScene } from './insertModel3D'
import { clearTextureCache, resolveFaceTexture, type ResolvedTexture } from './textureResolver'
import {
  IconCube,
  IconSplitView,
  IconImage,
  IconAxisMove,
  IconAxisRotate,
  IconWireframe
} from '../../icons'

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
  const [workspaceView, setWorkspaceView] = useState<'3d' | '2d' | 'split'>('split')
  const [selectedResolvedTexture, setSelectedResolvedTexture] = useState<ResolvedTexture | null>(null)
  const [showWireframe, setShowWireframe] = useState(true)
  const [meshOnlyPixels, setMeshOnlyPixels] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [showAxes, setShowAxes] = useState(true)
  const [cameraPreset, setCameraPreset] = useState<'front' | 'left' | 'right' | 'top' | 'iso'>('iso')
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('translate')
  const [meshEditMode, setMeshEditMode] = useState<'none' | 'erase' | 'select'>('none')
  const [inserting, setInserting] = useState(false)
  const [showMesh2D, setShowMesh2D] = useState(true)

  const selectedFace = useMemo(() => {
    return model.faces.find((f) => f.id === selectedFaceId) || null
  }, [model.faces, selectedFaceId])

  useEffect(() => {
    let active = true
    if (!selectedFace?.assetPath) {
      setSelectedResolvedTexture(null)
      return
    }
    resolveFaceTexture(selectedFace.assetPath).then((res) => {
      if (active) setSelectedResolvedTexture(res)
    })
    return () => {
      active = false
    }
  }, [selectedFace?.assetPath])

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

  const handleUpdateFace = (faceId: string, updates: Partial<Model3D['faces'][0]>) => {
    setModel((prev) => ({
      ...prev,
      faces: prev.faces.map((f) => (f.id === faceId ? { ...f, ...updates } : f))
    }))
  }

  const handleDropAsset = (
    assetPath: string,
    pos3D?: [number, number, number],
    hitFaceId?: string | null
  ) => {
    if (hitFaceId) {
      handleAssignAssetToFace(assetPath)
      setSelectedFaceId(hitFaceId)
    } else {
      const newId = 'face-' + Math.random().toString(36).slice(2, 7)
      const baseName =
        assetPath
          .split(/[\\/]/)
          .pop()
          ?.replace(/\.[^/.]+$/, '') || 'Mặt mới'
      const newFace = {
        id: newId,
        name: baseName.slice(0, 20),
        assetPath,
        width: 500,
        height: 500,
        position: pos3D || [0, 0, 0],
        rotation: [0, 0, 0] as [number, number, number]
      }
      setModel((prev) => ({
        ...prev,
        faces: [...prev.faces, newFace]
      }))
      setSelectedFaceId(newId)
    }
  }

  const handleToggleMeshCell = (faceId: string, cellKey: string) => {
    setModel((prev) => ({
      ...prev,
      faces: prev.faces.map((f) => {
        if (f.id !== faceId) return f
        const currentHidden = new Set(f.hiddenCells || [])
        if (currentHidden.has(cellKey)) {
          currentHidden.delete(cellKey)
        } else {
          currentHidden.add(cellKey)
        }
        return {
          ...f,
          hiddenCells: Array.from(currentHidden)
        }
      })
    }))
  }

  const handleToggleSelectCell = (faceId: string, cellKey: string) => {
    setModel((prev) => ({
      ...prev,
      faces: prev.faces.map((f) => {
        if (f.id !== faceId) return f
        const currentSelected = new Set(f.selectedCells || [])
        if (currentSelected.has(cellKey)) {
          currentSelected.delete(cellKey)
        } else {
          currentSelected.add(cellKey)
        }
        return {
          ...f,
          selectedCells: Array.from(currentSelected)
        }
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
            <span>Xưởng Lắp Ráp 3D</span>
          </div>

          {/* Quick Viewport Toggles */}
          <div className="header-view-controls">
            {/* Workspace View Mode: Split / 3D / 2D */}
            <div className="view-mode-tabs" title="Chế độ xem khung hình">
              <button
                type="button"
                className={`view-mode-tab-btn${workspaceView === 'split' ? ' active' : ''}`}
                onClick={() => setWorkspaceView('split')}
                title="Chia đôi: Vừa chỉnh 2D vừa xem 3D realtime"
              >
                <IconSplitView style={{ width: 13, height: 13 }} />
                <span>2D & 3D</span>
              </button>
              <button
                type="button"
                className={`view-mode-tab-btn${workspaceView === '3d' ? ' active' : ''}`}
                onClick={() => setWorkspaceView('3d')}
                title="Toàn màn hình không gian 3D"
              >
                <IconCube style={{ width: 13, height: 13 }} />
                <span>3D</span>
              </button>
              <button
                type="button"
                className={`view-mode-tab-btn${workspaceView === '2d' ? ' active' : ''}`}
                onClick={() => setWorkspaceView('2d')}
                title="Toàn màn hình chỉnh mặt phẳng ảnh 2D"
              >
                <IconImage style={{ width: 13, height: 13 }} />
                <span>2D</span>
              </button>
            </div>

            {/* 3D Axis Manipulator Gizmo Modes */}
            <div className="cam-preset-group" title="Trục thao tác 3D (Manipulator Gizmo)">
              <button
                type="button"
                className={`preset-btn${gizmoMode === 'translate' ? ' active' : ''}`}
                onClick={() => setGizmoMode('translate')}
                title="Trục dời vị trí 3D (Translate)"
              >
                <IconAxisMove style={{ width: 12, height: 12 }} />
                <span>Dời</span>
              </button>
              <button
                type="button"
                className={`preset-btn${gizmoMode === 'rotate' ? ' active' : ''}`}
                onClick={() => setGizmoMode('rotate')}
                title="Trục xoay góc 3D (Rotate)"
              >
                <IconAxisRotate style={{ width: 12, height: 12 }} />
                <span>Xoay</span>
              </button>
              <button
                type="button"
                className={`preset-btn${gizmoMode === 'off' ? ' active' : ''}`}
                onClick={() => setGizmoMode('off')}
                title="Ẩn trục (kéo tự do)"
              >
                Tắt
              </button>
            </div>

            <label className="toggle-chip" title="Bật/tắt hiển thị lưới dây đa giác Wireframe">
              <input
                type="checkbox"
                checked={showWireframe}
                onChange={(e) => setShowWireframe(e.target.checked)}
              />
              <IconWireframe style={{ width: 12, height: 12 }} />
              <span>Mesh</span>
            </label>

            <label className="toggle-chip" title="Chỉ hiện khung lưới (mesh) tại các vùng ảnh có pixel">
              <input
                type="checkbox"
                checked={meshOnlyPixels}
                onChange={(e) => setMeshOnlyPixels(e.target.checked)}
              />
              <span>Chỉ pixel</span>
            </label>

            <label className="toggle-chip" title="Hiện lưới mặt sàn 3D">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              <span>Sàn</span>
            </label>
            <label className="toggle-chip" title="Hiện trục tọa độ không gian 3D">
              <input
                type="checkbox"
                checked={showAxes}
                onChange={(e) => setShowAxes(e.target.checked)}
              />
              <span>Trục</span>
            </label>

            <label
              className={`toggle-chip${meshEditMode === 'select' ? ' active' : ''}`}
              title="Bật chế độ chọn ô lưới để uốn/bẻ (hoặc giữ Shift + Click trực tiếp trên 3D)"
            >
              <input
                type="checkbox"
                checked={meshEditMode === 'select'}
                onChange={(e) => setMeshEditMode(e.target.checked ? 'select' : 'none')}
              />
              <span>Chọn ô (Shift)</span>
            </label>

            <label
              className={`toggle-chip${meshEditMode === 'erase' ? ' active' : ''}`}
              title="Bật chế độ gọt/tỉa từng ô lưới (hoặc giữ phím Alt + Click trực tiếp trên 3D)"
            >
              <input
                type="checkbox"
                checked={meshEditMode === 'erase'}
                onChange={(e) => setMeshEditMode(e.target.checked ? 'erase' : 'none')}
              />
              <span>Gọt (Alt)</span>
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

          {/* Cột giữa: Viewport 3D / 2D Photoshop Mesh Plane / Split Screen */}
          <div className="assembly-viewport-panel">
            {workspaceView === '3d' && (
              <>
                <AssemblyViewport
                  model={model}
                  selectedFaceId={selectedFaceId}
                  showWireframe={showWireframe}
                  meshOnlyPixels={meshOnlyPixels}
                  showGrid={showGrid}
                  showAxes={showAxes}
                  cameraPreset={cameraPreset}
                  gizmoMode={gizmoMode}
                  meshEditMode={meshEditMode}
                  onSelectFace={setSelectedFaceId}
                  onUpdateFace={handleUpdateFace}
                  onDropAsset={handleDropAsset}
                  onToggleMeshCell={handleToggleMeshCell}
                  onToggleSelectCell={handleToggleSelectCell}
                />
                <div className="viewport-hint">
                  Chuột giữa: Xoay 3D | Chuột trái: Kéo di chuyển layer / Trục thao tác | Shift+Click: Chọn ô uốn | Alt+Click: Gọt tỉa ô lưới
                </div>
              </>
            )}

            {workspaceView === '2d' && (
              <Mesh2DTextureEditor
                face={selectedFace}
                resolvedTexture={selectedResolvedTexture}
                onUpdateFace={handleUpdateFace}
                showMesh={showMesh2D}
                onToggleMesh={() => setShowMesh2D((prev) => !prev)}
              />
            )}

            {workspaceView === 'split' && (
              <div className="assembly-split-container">
                <div className="assembly-split-pane left-pane">
                  <div className="pane-header-tab">
                    <span className="pane-title">🎨 Mặt phẳng 2D (Photoshop Grid)</span>
                    <span>{selectedFace ? formatFaceLabel(selectedFace.name) : 'Chưa chọn'}</span>
                  </div>
                  <Mesh2DTextureEditor
                    face={selectedFace}
                    resolvedTexture={selectedResolvedTexture}
                    onUpdateFace={handleUpdateFace}
                    showMesh={showMesh2D}
                    onToggleMesh={() => setShowMesh2D((prev) => !prev)}
                  />
                </div>
                <div className="assembly-split-pane">
                  <div className="pane-header-tab">
                    <span className="pane-title">🧊 Không gian 3D (Realtime Preview)</span>
                    <span>{model.name}</span>
                  </div>
                  <AssemblyViewport
                    model={model}
                    selectedFaceId={selectedFaceId}
                    showWireframe={showWireframe}
                    meshOnlyPixels={meshOnlyPixels}
                    showGrid={showGrid}
                    showAxes={showAxes}
                    cameraPreset={cameraPreset}
                    gizmoMode={gizmoMode}
                    meshEditMode={meshEditMode}
                    onSelectFace={setSelectedFaceId}
                    onUpdateFace={handleUpdateFace}
                    onDropAsset={handleDropAsset}
                    onToggleMeshCell={handleToggleMeshCell}
                    onToggleSelectCell={handleToggleSelectCell}
                  />
                </div>
              </div>
            )}
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
