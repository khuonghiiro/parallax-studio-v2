import type { Face3D, Model3D } from './types'
import type { FaceEdge } from './assemblyGeometry'
import type { SetModelOptions } from './useAssemblyHistory'
import { MeshCurvatureEditor } from './MeshCurvatureEditor'
import { FaceTransformFields } from './FaceTransformFields'
import { FaceShapeTools } from './FaceShapeTools'
import { FaceList } from './FaceList'
import { TemplateGallery } from './TemplateGallery'
import { addFoldedFace, centerFaces, newFaceId, patchFace } from './assemblyFaceOps'

interface FaceInspectorProps {
  model: Model3D
  selectedFaceId: string | null
  /** Natural size of the selected face image (for "fit aspect"). */
  imageSize: { width: number; height: number } | null
  onChangeModel: (updated: Model3D, opts?: SetModelOptions) => void
  onSelectFace: (faceId: string | null) => void
}

const DISCRETE: SetModelOptions = { discrete: true }

export function FaceInspector({ model, selectedFaceId, imageSize, onChangeModel, onSelectFace }: FaceInspectorProps) {
  const selectedFace = model.faces.find((f) => f.id === selectedFaceId) || model.faces[0]

  const setFaces = (faces: Face3D[], opts?: SetModelOptions) => onChangeModel({ ...model, faces }, opts)

  const handleUpdateFace = (patch: Partial<Face3D>) => {
    if (selectedFace) setFaces(patchFace(model.faces, selectedFace.id, patch))
  }

  const handleAddFace = () => {
    const id = newFaceId()
    const face: Face3D = {
      id,
      name: `Mặt ${model.faces.length + 1}`,
      color: '#38bdf8',
      width: 500,
      height: 500,
      position: [0, 0, 0],
      rotation: [0, 0, 0]
    }
    setFaces([...model.faces, face], DISCRETE)
    onSelectFace(id)
  }

  const handleFold = (edge: FaceEdge) => {
    if (!selectedFace) return
    const res = addFoldedFace(model.faces, selectedFace.id, edge)
    setFaces(res.faces, DISCRETE)
    if (res.newId) onSelectFace(res.newId)
  }

  return (
    <div className="face-inspector-container">
      {/* Model name & global scale */}
      <div className="inspector-section">
        <div className="inspector-row">
          <label htmlFor="assembly-model-name">Tên mô hình</label>
          <input id="assembly-model-name" type="text" className="input-text" value={model.name}
            onChange={(e) => onChangeModel({ ...model, name: e.target.value })} />
        </div>
        <div className="inspector-row global-scale-row">
          <label title="Phóng to / thu nhỏ đồng bộ toàn bộ các mặt của mô hình">Tỉ lệ tổng thể</label>
          <div className="range-with-value">
            <input type="range" min="0.1" max="2.5" step="0.05" value={model.scale}
              onChange={(e) => onChangeModel({ ...model, scale: Number(e.target.value) })} />
            <span className="scale-badge">{(model.scale * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Geometry-only templates (keep user images) */}
      <details className="inspector-section fi-collapsible" open>
        <summary className="section-title">
          <span>Khuôn mẫu lắp ghép</span>
        </summary>
        <TemplateGallery
          faces={model.faces}
          onApply={(faces, selectId) => {
            setFaces(faces, DISCRETE)
            if (selectId) onSelectFace(selectId)
          }}
        />
      </details>

      <FaceList
        faces={model.faces}
        selectedId={selectedFace?.id ?? null}
        onSelect={onSelectFace}
        onChange={(faces) => setFaces(faces, DISCRETE)}
        onAdd={handleAddFace}
      />

      {/* Selected face editor */}
      {selectedFace && (
        <div className="inspector-section active-face-editor">
          <div className="section-title">
            <span className="fi-ellipsis">Chi tiết: {selectedFace.name}</span>
            {selectedFace.locked && <span className="fi-badge">Đã khóa</span>}
          </div>
          <div className="inspector-row">
            <label htmlFor="assembly-face-name">Tên mặt</label>
            <input id="assembly-face-name" type="text" className="input-text" value={selectedFace.name}
              onChange={(e) => handleUpdateFace({ name: e.target.value })} />
          </div>
          <div className="inspector-row">
            <label htmlFor="assembly-face-texture">Ảnh texture</label>
            <input id="assembly-face-texture" type="text" className="input-text" placeholder="thư-mục/ảnh.png"
              value={selectedFace.assetPath || ''} onChange={(e) => handleUpdateFace({ assetPath: e.target.value })} />
          </div>
          <FaceTransformFields face={selectedFace} onUpdate={handleUpdateFace} />
          <FaceShapeTools
            face={selectedFace}
            imageSize={imageSize}
            onUpdate={handleUpdateFace}
            onFold={handleFold}
            onCenterModel={() => setFaces(centerFaces(model.faces), DISCRETE)}
          />
          <MeshCurvatureEditor face={selectedFace} onUpdateFace={handleUpdateFace} />
        </div>
      )}
    </div>
  )
}
