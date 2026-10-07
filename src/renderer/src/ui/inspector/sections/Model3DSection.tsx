import { useState } from 'react'
import type { Layer, Vec3 } from '@shared/types'
import { NumberInput, Row } from '../../controls'
import { rescaleModel3DInstance } from '../../assets/models3d/insertModel3D'
import { getStoredModels3D } from '../../assets/models3d/models3dStorage'
import { Assembly3DDialog } from '../../assets/models3d/Assembly3DDialog'
import type { Model3D } from '../../assets/models3d/types'
import { useEditor } from '../../../store/editor'
import { IconCube, IconPen } from '../../icons'

export function Model3DSection({ layer }: { layer: Layer }) {
  const model3d = layer.model3d
  const [editingModel, setEditingModel] = useState<Model3D | null>(null)

  if (!model3d) return null

  const curScale = model3d.globalScale || 1.0
  const center: Vec3 = model3d.centerPosition ?? [0, 0, 0]

  const handleScaleChange = (newScale: number) => {
    const val = Math.max(0.05, Math.min(5.0, Number(newScale.toFixed(2))))
    rescaleModel3DInstance(model3d.instanceId, val)
  }

  const handleCenterChange = (axisIdx: 0 | 1 | 2, val: number) => {
    const newCenter: Vec3 = [...center]
    newCenter[axisIdx] = val
    rescaleModel3DInstance(model3d.instanceId, curScale, newCenter)
  }

  const handleOpenStudio = () => {
    const stored = getStoredModels3D()
    const found = stored.find((m) => m.id === model3d.modelId)
    if (found) {
      setEditingModel(found)
    } else {
      // Create temporary model with current layer's model info
      setEditingModel({
        id: model3d.modelId,
        name: model3d.modelName,
        category: 'custom',
        scale: model3d.initialScale || 1.0,
        faces: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    }
  }

  return (
    <div className="section" style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '8px' }}>
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <IconCube width={14} height={14} style={{ color: 'var(--accent-cyan)' }} />
        <span>Mô Hình 3D Lắp Ráp</span>
      </div>

      <Row label="Mô hình">
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>
          {model3d.modelName}
        </span>
      </Row>

      <Row
        label="Tỉ lệ tổng thể"
        title="Co giãn kích thước toàn bộ các mặt phẳng của mô hình 3D này trong cảnh"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.05"
            value={curScale}
            onChange={(e) => handleScaleChange(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
          />
          <NumberInput
            axis="x"
            value={Number((curScale).toFixed(2))}
            step={0.05}
            min={0.05}
            max={5.0}
            onChange={handleScaleChange}
          />
        </div>
      </Row>

      <Row label="Tâm mô hình X" title="Tọa độ tâm ngang X của mô hình 3D trong phân cảnh">
        <NumberInput
          axis="X"
          value={center[0]}
          step={10}
          onChange={(v) => handleCenterChange(0, v)}
        />
      </Row>

      <Row label="Tâm mô hình Y" title="Tọa độ tâm đứng Y của mô hình 3D trong phân cảnh">
        <NumberInput
          axis="Y"
          value={center[1]}
          step={10}
          onChange={(v) => handleCenterChange(1, v)}
        />
      </Row>

      <Row label="Tâm mô hình Z" title="Độ sâu trục Z của mô hình 3D trong phân cảnh">
        <NumberInput
          axis="Z"
          value={center[2]}
          step={20}
          onChange={(v) => handleCenterChange(2, v)}
        />
      </Row>

      <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
        <button
          type="button"
          className="btn xs secondary"
          style={{ flex: 1 }}
          onClick={handleOpenStudio}
          title="Mở Xưởng Lắp Ráp 3D để chỉnh sửa vị trí, góc bẻ các mặt phẳng"
        >
          <IconPen width={11} height={11} /> Sửa trong Xưởng 3D
        </button>
      </div>

      {editingModel && (
        <Assembly3DDialog
          isOpen={true}
          initialModel={editingModel}
          onClose={() => setEditingModel(null)}
          onSaved={() => setEditingModel(null)}
        />
      )}
    </div>
  )
}
