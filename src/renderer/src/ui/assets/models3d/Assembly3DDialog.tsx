import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { formatFaceLabel, type Face3D, type Model3D } from './types'
import { AssemblyViewport } from './AssemblyViewport'
import { FaceInspector } from './FaceInspector'
import { AssemblyAssetSidebar } from './AssemblyAssetSidebar'
import { Mesh2DTextureEditor } from './Mesh2DTextureEditor'
import { AssemblyHeaderBar, DEFAULT_VIEW_STATE, type AssemblyViewState } from './AssemblyHeaderBar'
import { saveModel3D } from './models3dStorage'
import { insertModel3DToScene } from './insertModel3D'
import { clearTextureCache, resolveFaceTexture, type ResolvedTexture } from './textureResolver'
import { useAssemblyHistory } from './useAssemblyHistory'
import { useAssemblyShortcuts } from './useAssemblyShortcuts'
import { deleteFace, duplicateFace, newFaceId, nudgeFace, patchFace, toggleFaceFlag } from './assemblyFaceOps'
import { registerAssemblySession } from './assemblyBridge'
import { IconCube, IconImage } from '../../icons'

interface Assembly3DDialogProps {
  isOpen: boolean
  initialModel?: Model3D
  model?: Model3D
  onClose: () => void
  onSaved?: (model: Model3D) => void
}

const DISCRETE = { discrete: true }

/** Toggles a key in a face's cell list (hidden / selected cells). */
function toggleCell(faces: Face3D[], faceId: string, cellKey: string, field: 'hiddenCells' | 'selectedCells'): Face3D[] {
  return faces.map((f) => {
    if (f.id !== faceId) return f
    const set = new Set(f[field] || [])
    if (set.has(cellKey)) set.delete(cellKey)
    else set.add(cellKey)
    return { ...f, [field]: Array.from(set) }
  })
}

function useSelectedTexture(assetPath?: string): ResolvedTexture | null {
  const [resolved, setResolved] = useState<ResolvedTexture | null>(null)
  useEffect(() => {
    let active = true
    if (!assetPath) {
      setResolved(null)
      return
    }
    resolveFaceTexture(assetPath).then((res) => {
      if (active) setResolved(res)
    })
    return () => {
      active = false
    }
  }, [assetPath])
  return resolved
}

export function Assembly3DDialog({ isOpen, initialModel, model: modelProp, onClose, onSaved }: Assembly3DDialogProps) {
  const activeInitial = initialModel || modelProp || {
    id: `model-${Math.random().toString(36).slice(2, 7)}`,
    name: 'Mô hình 3D Mới',
    faces: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  const { model, setModel, undo, redo, canUndo, canRedo, setGestureActive } = useAssemblyHistory(activeInitial)
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(activeInitial.faces[0]?.id || null)
  const [view, setView] = useState<AssemblyViewState>(DEFAULT_VIEW_STATE)
  const [frameToken, setFrameToken] = useState(0)
  const [inserting, setInserting] = useState(false)

  const selectedFace = useMemo(() => model.faces.find((f) => f.id === selectedFaceId) || null, [model.faces, selectedFaceId])
  const selectedTexture = useSelectedTexture(selectedFace?.assetPath)
  const onViewChange = useCallback((patch: Partial<AssemblyViewState>) => setView((v) => ({ ...v, ...patch })), [])
  const setFaces = useCallback(
    (fn: (faces: Face3D[]) => Face3D[], opts?: { discrete?: boolean }) => setModel((m) => ({ ...m, faces: fn(m.faces) }), opts),
    [setModel]
  )

  useAssemblyShortcuts(isOpen, {
    undo,
    redo,
    frame: () => setFrameToken((t) => t + 1),
    duplicate: () => {
      if (!selectedFaceId) return
      const res = duplicateFace(model.faces, selectedFaceId)
      setFaces(() => res.faces, DISCRETE)
      if (res.newId) setSelectedFaceId(res.newId)
    },
    remove: () => {
      if (!selectedFaceId) return
      const res = deleteFace(model.faces, selectedFaceId)
      setFaces(() => res.faces, DISCRETE)
      setSelectedFaceId(res.nextSelected)
    },
    nudge: (delta) => selectedFaceId && setFaces((faces) => nudgeFace(faces, selectedFaceId, delta)),
    toggleHidden: () => selectedFaceId && setFaces((faces) => toggleFaceFlag(faces, selectedFaceId, 'hidden'), DISCRETE),
    toggleLocked: () => selectedFaceId && setFaces((faces) => toggleFaceFlag(faces, selectedFaceId, 'locked'), DISCRETE)
  })

  const modelRef = useRef(model)
  modelRef.current = model
  const selectedFaceIdRef = useRef(selectedFaceId)
  selectedFaceIdRef.current = selectedFaceId

  const handleClose = useCallback(() => {
    clearTextureCache()
    onClose()
  }, [onClose])

  const captureFnRef = useRef<(() => string | null) | null>(null)

  const handleSave = useCallback(() => {
    let toSave = modelRef.current
    try {
      const thumb = captureFnRef.current ? captureFnRef.current() : null
      if (thumb) {
        toSave = { ...toSave, thumbnailDataUrl: thumb }
      }
    } catch (e) {
      console.warn('[Assembly3DDialog] Failed to capture clean thumbnail on save:', e)
    }
    saveModel3D(toSave)
    onSaved?.(toSave)
    handleClose()
  }, [handleClose, onSaved])

  const handleInsert = useCallback(async (): Promise<string[]> => {
    setInserting(true)
    try {
      let toSave = modelRef.current
      try {
        const thumb = captureFnRef.current ? captureFnRef.current() : null
        if (thumb) {
          toSave = { ...toSave, thumbnailDataUrl: thumb }
        }
      } catch (e) {
        console.warn('[Assembly3DDialog] Failed to capture clean thumbnail on insert:', e)
      }
      const ids = await insertModel3DToScene({ model: toSave })
      onSaved?.(toSave)
      handleClose()
      return ids
    } catch (err) {
      console.error('[Assembly3DDialog] Error inserting model to scene:', err)
      return []
    } finally {
      setInserting(false)
    }
  }, [handleClose, onSaved])

  useEffect(() => {
    if (!isOpen) return
    return registerAssemblySession({
      getModel: () => modelRef.current,
      setModel: (next) => setModel(next, DISCRETE),
      getSelectedFaceId: () => selectedFaceIdRef.current,
      setSelectedFaceId: (id) => setSelectedFaceId(id),
      save: handleSave,
      insert: handleInsert,
      close: handleClose,
      captureScreenshot: () => (captureFnRef.current ? captureFnRef.current() : null)
    })
  }, [isOpen, handleSave, handleInsert, handleClose, setModel])

  if (!isOpen) return null

  const handleAssignAssetToFace = (assetPath: string, width?: number, height?: number) => {
    const targetId = selectedFaceId || model.faces[0]?.id
    if (!targetId) return
    setFaces((faces) => faces.map((f) => (f.id === targetId
      ? { ...f, assetPath, width: width && width > 0 ? width : f.width, height: height && height > 0 ? height : f.height }
      : f)), DISCRETE)
  }

  const handleUpdateFace = (faceId: string, updates: Partial<Face3D>) => setFaces((faces) => patchFace(faces, faceId, updates))

  const handleDropAsset = (assetPath: string, pos3D?: [number, number, number], hitFaceId?: string | null) => {
    if (hitFaceId) {
      setFaces((faces) => patchFace(faces, hitFaceId, { assetPath }), DISCRETE)
      setSelectedFaceId(hitFaceId)
      return
    }
    const id = newFaceId()
    const baseName = assetPath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, '') || 'Mặt mới'
    const face: Face3D = { id, name: baseName.slice(0, 24), assetPath, width: 500, height: 500, position: pos3D || [0, 0, 0], rotation: [0, 0, 0] }
    setFaces((faces) => [...faces, face], DISCRETE)
    setSelectedFaceId(id)
  }

  const viewport = (
    <AssemblyViewport
      model={model}
      selectedFaceId={selectedFaceId}
      showWireframe={view.showWireframe}
      meshOnlyPixels={view.meshOnlyPixels}
      showGrid={view.showGrid}
      showAxes={view.showAxes}
      cameraPreset={view.cameraPreset}
      gizmoMode={view.gizmoMode}
      meshEditMode={view.meshEditMode}
      frameToken={frameToken}
      onSelectFace={setSelectedFaceId}
      onUpdateFace={handleUpdateFace}
      onDropAsset={handleDropAsset}
      onToggleMeshCell={(faceId, key) => setFaces((faces) => toggleCell(faces, faceId, key, 'hiddenCells'), DISCRETE)}
      onToggleSelectCell={(faceId, key) => setFaces((faces) => toggleCell(faces, faceId, key, 'selectedCells'), DISCRETE)}
      onGestureChange={setGestureActive}
      onRegisterCapture={(fn) => {
        captureFnRef.current = fn
      }}
    />
  )
  const editor2D = (
    <Mesh2DTextureEditor
      face={selectedFace}
      resolvedTexture={selectedTexture}
      onUpdateFace={handleUpdateFace}
      showMesh={view.showMesh2D}
      onToggleMesh={() => onViewChange({ showMesh2D: !view.showMesh2D })}
    />
  )
  const hiddenCount = model.faces.filter((f) => f.hidden).length

  return (
    <div className="assembly-modal-overlay">
      <div className="assembly-modal-content">
        <AssemblyHeaderBar
          view={view}
          onViewChange={onViewChange}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onFrame={() => setFrameToken((t) => t + 1)}
          onClose={handleClose}
        />

        {/* Body: assets | viewport | inspector */}
        <div className="assembly-modal-body">
          <AssemblyAssetSidebar
            model={model}
            selectedFace={selectedFace}
            onAssignAssetToFace={handleAssignAssetToFace}
            modelFaces={model.faces}
            onSelectFace={setSelectedFaceId}
            onApplyFaces={(faces, selectId) => {
              setFaces(() => faces, DISCRETE)
              if (selectId) setSelectedFaceId(selectId)
            }}
          />

          <div className="assembly-viewport-panel">
            {view.workspaceView === '3d' && (
              <>
                {viewport}
                <div className="viewport-hint">
                  Chuột giữa: xoay · Chuột phải / kéo nền: dời khung · Cuộn: thu phóng · Kéo mặt: di chuyển (Shift bước 10) · F: lấy nét
                </div>
              </>
            )}

            {view.workspaceView === '2d' && editor2D}

            {view.workspaceView === 'split' && (
              <div className="assembly-split-container">
                <div className="assembly-split-pane left-pane">
                  <div className="pane-header-tab">
                    <span className="pane-title"><IconImage width={12} height={12} /> Lưới ảnh 2D</span>
                    <span>{selectedFace ? formatFaceLabel(selectedFace.name) : 'Chưa chọn'}</span>
                  </div>
                  {editor2D}
                </div>
                <div className="assembly-split-pane">
                  <div className="pane-header-tab">
                    <span className="pane-title"><IconCube width={12} height={12} /> Không gian 3D</span>
                    <span>{model.name}</span>
                  </div>
                  {viewport}
                </div>
              </div>
            )}
          </div>

          <div className="assembly-inspector-panel">
            <FaceInspector
              model={model}
              selectedFaceId={selectedFaceId}
              imageSize={selectedTexture ? { width: selectedTexture.width, height: selectedTexture.height } : null}
              onChangeModel={setModel}
              onSelectFace={setSelectedFaceId}
            />
          </div>
        </div>

        <div className="assembly-modal-footer">
          <span className="footer-status">
            <strong>{model.faces.length}</strong> mặt{hiddenCount > 0 && <> · {hiddenCount} đang ẩn</>} · Tỉ lệ{' '}
            <strong>{(model.scale * 100).toFixed(0)}%</strong>
          </span>
          <div className="footer-actions">
            <button type="button" className="btn secondary" onClick={handleClose}>Hủy</button>
            <button type="button" className="btn secondary" onClick={handleSave}>Lưu mô hình</button>
            <button type="button" className="btn primary" onClick={handleInsert} disabled={inserting}>
              {inserting ? 'Đang thêm…' : '+ Thêm vào cảnh hiện tại'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
