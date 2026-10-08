import { useState, useEffect, useRef } from 'react'
import type { Face3D, Model3D } from './types'
import type { FaceEdge } from './assemblyGeometry'
import type { SetModelOptions } from './useAssemblyHistory'
import { MeshCurvatureEditor } from './MeshCurvatureEditor'
import { FaceTransformFields } from './FaceTransformFields'
import { FaceShapeTools } from './FaceShapeTools'
import { FaceList } from './FaceList'
import { TemplateGallery } from './TemplateGallery'
import { ModelComposePanel } from './ModelComposePanel'
import { AssemblyLightingSection } from './AssemblyLightingSection'
import { FaceJoinSection } from './FaceJoinSection'
import { FaceClipSection } from './FaceClipSection'
import { addFoldedFace, centerFaces, newFaceId, patchFace } from './assemblyFaceOps'
import { IconCube, IconLayers, IconGrid, IconSun, IconPlus } from '../../icons'

export type InspectorTab = 'face' | 'layers' | 'templates' | 'lighting'

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
  const [activeTab, setActiveTab] = useState<InspectorTab>('face')
  const prevSelectedIdRef = useRef<string | null>(selectedFaceId)

  // Auto-switch to 'face' tab when user clicks/selects a face in 3D
  useEffect(() => {
    if (selectedFaceId && selectedFaceId !== prevSelectedIdRef.current) {
      setActiveTab('face')
    }
    prevSelectedIdRef.current = selectedFaceId
  }, [selectedFaceId])

  const selectedFace = model.faces.find((f) => f.id === selectedFaceId) || model.faces[0]
  const currentIndex = model.faces.findIndex((f) => f.id === selectedFace?.id)

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
    setActiveTab('face')
  }

  const handleFold = (edge: FaceEdge) => {
    if (!selectedFace) return
    const res = addFoldedFace(model.faces, selectedFace.id, edge)
    setFaces(res.faces, DISCRETE)
    if (res.newId) onSelectFace(res.newId)
  }

  const handleSelectFaceFromList = (id: string | null) => {
    onSelectFace(id)
    if (id) setActiveTab('face')
  }

  return (
    <div className="face-inspector-root">
      {/* Top Fixed Tabs Bar */}
      <div className="inspector-tabs-nav" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'face'}
          className={`inspector-tab-btn${activeTab === 'face' ? ' active' : ''}`}
          onClick={() => setActiveTab('face')}
          title="Chỉnh sửa thuộc tính mặt 3D đang chọn (Kích thước, vị trí, xoay, uốn cong)"
        >
          <IconCube width={13} height={13} />
          <span>Thuộc tính</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'layers'}
          className={`inspector-tab-btn${activeTab === 'layers' ? ' active' : ''}`}
          onClick={() => setActiveTab('layers')}
          title="Quản lý danh sách các mặt và cấu trúc mô hình"
        >
          <IconLayers width={13} height={13} />
          <span>Các mặt</span>
          <span className="inspector-tab-badge">{model.faces.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'templates'}
          className={`inspector-tab-btn${activeTab === 'templates' ? ' active' : ''}`}
          onClick={() => setActiveTab('templates')}
          title="Thư viện khuôn mẫu lắp ghép & ghép bộ phận"
        >
          <IconGrid width={13} height={13} />
          <span>Khuôn mẫu</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'lighting'}
          className={`inspector-tab-btn${activeTab === 'lighting' ? ' active' : ''}`}
          onClick={() => setActiveTab('lighting')}
          title="Thiết lập hướng nắng và bóng râm cảnh 3D"
        >
          <IconSun width={13} height={13} />
          <span>Ánh sáng</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="face-inspector-body">
        {/* TAB 1: FACE PROPERTIES */}
        {activeTab === 'face' && (
          <>
            {/* Quick Face Switcher Bar */}
            <div className="fi-face-bar">
              <div className="fi-face-bar-main">
                <span className="fi-face-idx" title="Thứ tự mặt trong mô hình">
                  {currentIndex >= 0 ? `${currentIndex + 1}/${model.faces.length}` : '—'}
                </span>
                <select
                  className="fi-face-select"
                  value={selectedFace?.id ?? ''}
                  onChange={(e) => onSelectFace(e.target.value || null)}
                  title="Chọn nhanh mặt 3D để chỉnh sửa"
                >
                  {model.faces.map((f, i) => (
                    <option key={f.id} value={f.id}>
                      {i + 1}. {f.name} {f.hidden ? ' (Ẩn)' : ''} {f.locked ? ' (Khóa)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn secondary fi-quick-add"
                onClick={handleAddFace}
                title="Tạo thêm mặt phẳng 3D mới"
              >
                <IconPlus width={12} height={12} />
                <span>Thêm mặt</span>
              </button>
            </div>

            {selectedFace ? (
              <div className="active-face-editor">
                {/* Face Basic Info Card */}
                <div className="fi-card">
                  <div className="inspector-row">
                    <label htmlFor="assembly-face-name">Tên mặt</label>
                    <input
                      id="assembly-face-name"
                      type="text"
                      className="input-text"
                      value={selectedFace.name}
                      onChange={(e) => handleUpdateFace({ name: e.target.value })}
                    />
                  </div>
                  <div className="inspector-row">
                    <label htmlFor="assembly-face-texture">Ảnh Texture</label>
                    <input
                      id="assembly-face-texture"
                      type="text"
                      className="input-text"
                      placeholder="Kéo ảnh từ cột trái hoặc nhập đường dẫn..."
                      value={selectedFace.assetPath || ''}
                      onChange={(e) => handleUpdateFace({ assetPath: e.target.value })}
                    />
                  </div>
                </div>

                {/* Transform Fields (W, H, X, Y, Z, Rotation, Presets) */}
                <FaceTransformFields face={selectedFace} onUpdate={handleUpdateFace} />

                {/* Shape, Opacity, Alpha Cutoff & Fold */}
                <FaceShapeTools
                  face={selectedFace}
                  imageSize={imageSize}
                  onUpdate={handleUpdateFace}
                  onFold={handleFold}
                  onCenterModel={() => setFaces(centerFaces(model.faces), DISCRETE)}
                />

                {/* Collapsible Advanced Face Tools */}
                <details className="fi-sub-collapsible">
                  <summary className="fi-sub-summary">
                    <span>🌊 Uốn cong & Chiều sâu 2.5D</span>
                    {(selectedFace.bendX || selectedFace.bendY || (selectedFace.depthProfile && selectedFace.depthProfile !== 'none')) ? (
                      <span className="fi-badge-active">Đang bật</span>
                    ) : null}
                  </summary>
                  <div className="fi-sub-body">
                    <MeshCurvatureEditor face={selectedFace} onUpdateFace={handleUpdateFace} />
                  </div>
                </details>

                <details className="fi-sub-collapsible">
                  <summary className="fi-sub-summary">
                    <span>🧲 Ghép hít 2 mặt khít cạnh</span>
                    {selectedFace.joinPoints ? <span className="fi-badge-active">Đã ghép</span> : null}
                  </summary>
                  <div className="fi-sub-body">
                    <FaceJoinSection
                      currentFace={selectedFace}
                      allFaces={model.faces}
                      onApplyJoin={(faces) => setFaces(faces, DISCRETE)}
                    />
                  </div>
                </details>

                <details className="fi-sub-collapsible">
                  <summary className="fi-sub-summary">
                    <span>✂️ Cắt mặt đâm xuyên (Clip)</span>
                    {selectedFace.clipBy?.length ? <span className="fi-badge-active">{selectedFace.clipBy.length}</span> : null}
                  </summary>
                  <div className="fi-sub-body">
                    <FaceClipSection
                      currentFace={selectedFace}
                      allFaces={model.faces}
                      onUpdateFace={handleUpdateFace}
                      onUpdateAllFaces={(faces) => setFaces(faces, DISCRETE)}
                    />
                  </div>
                </details>
              </div>
            ) : (
              <div className="fi-empty-state">
                <IconCube width={32} height={32} />
                <div className="fi-empty-title">Chưa chọn mặt 3D nào</div>
                <div className="fi-empty-desc">Bấm vào một mặt trên khung nhìn 3D hoặc bấm nút bên dưới để tạo mặt mới.</div>
                <button type="button" className="btn primary" onClick={handleAddFace}>
                  <IconPlus width={13} height={13} /> Thêm mặt mới
                </button>
              </div>
            )}
          </>
        )}

        {/* TAB 2: MODEL & FACE LIST */}
        {activeTab === 'layers' && (
          <>
            {/* Model Global Settings Card */}
            <div className="fi-card fi-model-card">
              <div className="section-title">
                <span>Cấu trúc mô hình</span>
              </div>
              <div className="inspector-row">
                <label htmlFor="assembly-model-name">Tên mô hình</label>
                <input
                  id="assembly-model-name"
                  type="text"
                  className="input-text"
                  value={model.name}
                  onChange={(e) => onChangeModel({ ...model, name: e.target.value })}
                />
              </div>
              <div className="inspector-row global-scale-row">
                <label title="Phóng to / thu nhỏ đồng bộ toàn bộ các mặt của mô hình">Tỉ lệ tổng thể</label>
                <div className="range-with-value">
                  <input
                    type="range"
                    min="0.1"
                    max="2.5"
                    step="0.05"
                    value={model.scale}
                    onChange={(e) => onChangeModel({ ...model, scale: Number(e.target.value) })}
                  />
                  <span className="scale-badge">{(model.scale * 100).toFixed(0)}%</span>
                </div>
              </div>
              <button
                type="button"
                className="btn secondary fst-btn"
                style={{ width: '100%', marginTop: '4px' }}
                onClick={() => setFaces(centerFaces(model.faces), DISCRETE)}
                title="Dời toàn bộ mô hình để tâm khung bao về gốc tọa độ"
              >
                Căn giữa toàn bộ mô hình
              </button>
            </div>

            {/* Face List */}
            <FaceList
              faces={model.faces}
              selectedId={selectedFace?.id ?? null}
              onSelect={handleSelectFaceFromList}
              onChange={(faces) => setFaces(faces, DISCRETE)}
              onAssignTexture={(faceId, assetPath, all) => {
                const nextFaces = all
                  ? model.faces.map((f) => ({ ...f, assetPath }))
                  : model.faces.map((f) => (f.id === faceId ? { ...f, assetPath } : f))
                setFaces(nextFaces, DISCRETE)
                if (!all) handleSelectFaceFromList(faceId)
              }}
              onAdd={handleAddFace}
            />
          </>
        )}

        {/* TAB 3: TEMPLATES & COMPOSE */}
        {activeTab === 'templates' && (
          <>
            <div className="inspector-section" style={{ borderBottom: 'none' }}>
              <div className="section-title" style={{ marginBottom: '8px' }}>
                <span>Khuôn mẫu lắp ghép</span>
              </div>
              <TemplateGallery
                faces={model.faces}
                onApply={(faces, selectId) => {
                  setFaces(faces, DISCRETE)
                  if (selectId) onSelectFace(selectId)
                }}
              />
            </div>

            <details className="inspector-section fi-collapsible" open>
              <summary className="section-title">
                <span>Ghép mô hình đã lưu (bộ phận)</span>
              </summary>
              <ModelComposePanel
                model={model}
                selectedFace={selectedFace}
                onApply={(faces, selectId) => {
                  setFaces(faces, DISCRETE)
                  if (selectId) onSelectFace(selectId)
                }}
              />
            </details>
          </>
        )}

        {/* TAB 4: LIGHTING & SHADOWS */}
        {activeTab === 'lighting' && (
          <AssemblyLightingSection
            lighting={model.lighting}
            onChange={(lighting) => onChangeModel({ ...model, lighting })}
          />
        )}
      </div>
    </div>
  )
}
