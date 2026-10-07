import type { Face3D, Model3D, PresetType } from './types'
import { generatePresetFaces } from './models3dStorage'
import { IconPlus, IconTrash, IconPlay } from '../../icons'

interface FaceInspectorProps {
  model: Model3D
  selectedFaceId: string | null
  onChangeModel: (updated: Model3D) => void
  onSelectFace: (faceId: string | null) => void
}

export function FaceInspector({
  model,
  selectedFaceId,
  onChangeModel,
  onSelectFace
}: FaceInspectorProps) {
  const selectedFace = model.faces.find((f) => f.id === selectedFaceId) || model.faces[0]

  const handleApplyPreset = (type: PresetType) => {
    const newFaces = generatePresetFaces(type)
    onChangeModel({
      ...model,
      faces: newFaces
    })
    if (newFaces.length > 0) onSelectFace(newFaces[0].id)
  }

  const handleUpdateFace = (patch: Partial<Face3D>) => {
    if (!selectedFace) return
    const updatedFaces = model.faces.map((f) => {
      if (f.id === selectedFace.id) return { ...f, ...patch }
      return f
    })
    onChangeModel({
      ...model,
      faces: updatedFaces
    })
  }

  const handleAddFace = () => {
    const newId = 'face-' + Math.random().toString(36).slice(2, 7)
    const newFace: Face3D = {
      id: newId,
      name: `Mặt phẳng ${model.faces.length + 1}`,
      color: '#38bdf8',
      width: 500,
      height: 500,
      position: [0, 0, 0],
      rotation: [0, 0, 0]
    }
    onChangeModel({
      ...model,
      faces: [...model.faces, newFace]
    })
    onSelectFace(newId)
  }

  const handleDeleteFace = (id: string) => {
    if (model.faces.length <= 1) return
    const remaining = model.faces.filter((f) => f.id !== id)
    onChangeModel({
      ...model,
      faces: remaining
    })
    if (selectedFaceId === id) {
      onSelectFace(remaining[0]?.id || null)
    }
  }

  return (
    <div className="face-inspector-container">
      {/* Model Name and Global Scale */}
      <div className="inspector-section">
        <div className="inspector-row">
          <label>Tên mô hình</label>
          <input
            type="text"
            className="input-text"
            value={model.name}
            onChange={(e) => onChangeModel({ ...model, name: e.target.value })}
          />
        </div>

        {/* Global Scaling Mechanism */}
        <div className="inspector-row global-scale-row">
          <label title="Hệ số phóng to / thu nhỏ toàn bộ các mặt phẳng của mô hình 3D đồng bộ">
            Tỉ lệ tổng thể (Scale)
          </label>
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
      </div>

      {/* Auto-Mesh Generator / Presets */}
      <div className="inspector-section">
        <div className="section-title">
          <span>Tự động tạo Mesh (Presets)</span>
        </div>
        <div className="preset-buttons-grid">
          <button
            type="button"
            className="btn xs secondary"
            onClick={() => handleApplyPreset('cottage')}
            title="Tự động tính góc bẻ mái dốc và tường hông 5 mặt khép kín"
          >
            Ngôi nhà mái dốc
          </button>
          <button
            type="button"
            className="btn xs secondary"
            onClick={() => handleApplyPreset('cube')}
            title="Khối hộp 6 mặt vuông khép kín"
          >
            Khối hộp 6 mặt
          </button>
          <button
            type="button"
            className="btn xs secondary"
            onClick={() => handleApplyPreset('corner')}
            title="Mặt dựng gập góc 90 độ"
          >
            Góc phố chữ L
          </button>
          <button
            type="button"
            className="btn xs secondary"
            onClick={() => handleApplyPreset('room')}
            title="Không gian nội thất phòng mở"
          >
            Phòng trưng bày
          </button>
        </div>
      </div>

      {/* Faces List Tabs */}
      <div className="inspector-section faces-list-section">
        <div className="section-title">
          <span>Danh sách mặt ({model.faces.length})</span>
          <button
            type="button"
            className="btn xs icon"
            onClick={handleAddFace}
            title="Thêm mặt phẳng mới"
          >
            <IconPlus width={12} height={12} /> Thêm mặt
          </button>
        </div>

        <div className="faces-chip-list">
          {model.faces.map((f, idx) => {
            const isSelected = f.id === selectedFace?.id
            return (
              <div
                key={f.id}
                className={`face-chip${isSelected ? ' active' : ''}`}
                onClick={() => onSelectFace(f.id)}
              >
                <span className="chip-idx">{idx + 1}</span>
                <span className="chip-name">{f.name}</span>
                {model.faces.length > 1 && (
                  <button
                    type="button"
                    className="chip-del"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteFace(f.id)
                    }}
                    title="Xóa mặt phẳng này"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected Face Property Editor */}
      {selectedFace && (
        <div className="inspector-section active-face-editor">
          <div className="section-title">
            <span>Chi tiết: {selectedFace.name}</span>
          </div>

          <div className="inspector-row">
            <label>Tên mặt</label>
            <input
              type="text"
              className="input-text"
              value={selectedFace.name}
              onChange={(e) => handleUpdateFace({ name: e.target.value })}
            />
          </div>

          <div className="inspector-row">
            <label>Tệp Texture (Assets)</label>
            <input
              type="text"
              className="input-text"
              placeholder="house/origami_front.png"
              value={selectedFace.assetPath || ''}
              onChange={(e) => handleUpdateFace({ assetPath: e.target.value })}
            />
          </div>

          {/* Width & Height */}
          <div className="inspector-grid-2">
            <div className="inspector-field">
              <label>Rộng (W)</label>
              <input
                type="number"
                className="input-text"
                value={selectedFace.width}
                onChange={(e) => handleUpdateFace({ width: Number(e.target.value) })}
              />
            </div>
            <div className="inspector-field">
              <label>Cao (H)</label>
              <input
                type="number"
                className="input-text"
                value={selectedFace.height}
                onChange={(e) => handleUpdateFace({ height: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Position X, Y, Z */}
          <div className="inspector-field-group">
            <label className="group-label">Vị trí (Position X, Y, Z)</label>
            <div className="inspector-grid-3">
              <div className="inspector-field">
                <span className="axis-tag tag-x">X</span>
                <input
                  type="number"
                  className="input-text"
                  value={selectedFace.position[0]}
                  onChange={(e) =>
                    handleUpdateFace({
                      position: [Number(e.target.value), selectedFace.position[1], selectedFace.position[2]]
                    })
                  }
                />
              </div>
              <div className="inspector-field">
                <span className="axis-tag tag-y">Y</span>
                <input
                  type="number"
                  className="input-text"
                  value={selectedFace.position[1]}
                  onChange={(e) =>
                    handleUpdateFace({
                      position: [selectedFace.position[0], Number(e.target.value), selectedFace.position[2]]
                    })
                  }
                />
              </div>
              <div className="inspector-field">
                <span className="axis-tag tag-z">Z</span>
                <input
                  type="number"
                  className="input-text"
                  value={selectedFace.position[2]}
                  onChange={(e) =>
                    handleUpdateFace({
                      position: [selectedFace.position[0], selectedFace.position[1], Number(e.target.value)]
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* Rotation: Bẻ hướng & Tạo độ nghiêng */}
          <div className="inspector-field-group">
            <label className="group-label">Xoay: Bẻ hướng & Độ nghiêng (°)</label>
            
            {/* Pitch (X) - Độ nghiêng dốc */}
            <div className="rot-slider-row">
              <span className="rot-label" title="Độ nghiêng mái dốc (Pitch)">
                Độ nghiêng (X)
              </span>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={selectedFace.rotation[0]}
                onChange={(e) =>
                  handleUpdateFace({
                    rotation: [Number(e.target.value), selectedFace.rotation[1], selectedFace.rotation[2]]
                  })
                }
              />
              <span className="deg-value">{selectedFace.rotation[0]}°</span>
            </div>

            {/* Yaw (Y) - Bẻ hướng tường */}
            <div className="rot-slider-row">
              <span className="rot-label" title="Góc bẻ hướng tường hông (Yaw)">
                Bẻ hướng (Y)
              </span>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={selectedFace.rotation[1]}
                onChange={(e) =>
                  handleUpdateFace({
                    rotation: [selectedFace.rotation[0], Number(e.target.value), selectedFace.rotation[2]]
                  })
                }
              />
              <span className="deg-value">{selectedFace.rotation[1]}°</span>
            </div>

            {/* Roll (Z) */}
            <div className="rot-slider-row">
              <span className="rot-label" title="Xoay nghiêng mặt phẳng (Roll)">
                Xoay lật (Z)
              </span>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={selectedFace.rotation[2]}
                onChange={(e) =>
                  handleUpdateFace({
                    rotation: [selectedFace.rotation[0], selectedFace.rotation[1], Number(e.target.value)]
                  })
                }
              />
              <span className="deg-value">{selectedFace.rotation[2]}°</span>
            </div>

            {/* Quick angle snap presets */}
            <div className="quick-snaps">
              <button
                type="button"
                className="snap-btn"
                onClick={() =>
                  handleUpdateFace({ rotation: [selectedFace.rotation[0], 90, selectedFace.rotation[2]] })
                }
              >
                Gập 90°
              </button>
              <button
                type="button"
                className="snap-btn"
                onClick={() =>
                  handleUpdateFace({ rotation: [selectedFace.rotation[0], -90, selectedFace.rotation[2]] })
                }
              >
                Gập -90°
              </button>
              <button
                type="button"
                className="snap-btn"
                onClick={() =>
                  handleUpdateFace({ rotation: [46, selectedFace.rotation[1], selectedFace.rotation[2]] })
                }
              >
                Dốc 46°
              </button>
              <button
                type="button"
                className="snap-btn"
                onClick={() =>
                  handleUpdateFace({ rotation: [-46, selectedFace.rotation[1], selectedFace.rotation[2]] })
                }
              >
                Dốc -46°
              </button>
              <button
                type="button"
                className="snap-btn"
                onClick={() =>
                  handleUpdateFace({ rotation: [-90, 0, 0] })
                }
              >
                Nằm ngang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
