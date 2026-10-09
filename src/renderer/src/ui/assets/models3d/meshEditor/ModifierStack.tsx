import type { Face3D } from '../types'

interface ModifierItem {
  id: string
  name: string
  icon: string
  enabled: boolean
  summary: string
  onToggle: () => void
  onRemove: () => void
}

interface ModifierStackProps {
  face: Face3D
  onUpdateFace: (patch: Partial<Face3D>) => void
}

export function ModifierStack({ face, onUpdateFace }: ModifierStackProps) {
  const items: ModifierItem[] = []

  // 1. Simple Deform (Bend X / Y / Lateral / Arc / Taper)
  const hasBend =
    Boolean(face.bendX) ||
    Boolean(face.bendY) ||
    Boolean(face.bendLateral) ||
    Boolean(face.arcAngle) ||
    (face.taperRatio !== undefined && face.taperRatio !== 1)
  if (hasBend) {
    const parts: string[] = []
    if (face.bendX) parts.push(`BendX: ${face.bendX}%`)
    if (face.bendY) parts.push(`BendY: ${face.bendY}%`)
    if (face.bendLateral) parts.push(`S-Curl: ${face.bendLateral}%`)
    if (face.arcAngle) parts.push(`Arc: ${face.arcAngle}°`)
    if (face.taperRatio !== undefined && face.taperRatio !== 1) parts.push(`Taper: ${face.taperRatio}x`)

    items.push({
      id: 'simple-deform',
      name: 'Uốn cong (Simple Deform)',
      icon: '🌀',
      enabled: true,
      summary: parts.join(' · '),
      onToggle: () => {
        // Toggle bend
      },
      onRemove: () => {
        onUpdateFace({
          bendX: 0,
          bendY: 0,
          bendLateral: 0,
          arcAngle: undefined,
          taperRatio: undefined
        })
      }
    })
  }

  // 2. Depth Profile
  if (face.depthProfile && face.depthProfile !== 'none') {
    items.push({
      id: 'depth-profile',
      name: `Độ sâu 2.5D (${face.depthProfile})`,
      icon: '✨',
      enabled: true,
      summary: `Cường độ: ${face.depthIntensity ?? 50}%`,
      onToggle: () => {},
      onRemove: () => {
        onUpdateFace({ depthProfile: 'none', depthIntensity: 0 })
      }
    })
  }

  // 3. Motion
  if (face.motionType && face.motionType !== 'none') {
    items.push({
      id: 'motion',
      name: `Chuyển động AE (${face.motionType})`,
      icon: '🎬',
      enabled: true,
      summary: `Tốc độ: ${(face.motionSpeed ?? 1).toFixed(1)}x · Biên độ: ${face.motionAmplitude ?? 20}%`,
      onToggle: () => {},
      onRemove: () => {
        onUpdateFace({ motionType: 'none' })
      }
    })
  }

  // 4. Sub-mesh erase / Hidden cells
  if (face.hiddenCells && face.hiddenCells.length > 0) {
    items.push({
      id: 'cell-erase',
      name: 'Gọt tỉa ô lưới (Cell Trim)',
      icon: '✂️',
      enabled: true,
      summary: `Đã gọt ${face.hiddenCells.length} ô`,
      onToggle: () => {},
      onRemove: () => {
        onUpdateFace({ hiddenCells: [] })
      }
    })
  }

  if (items.length === 0) {
    return (
      <div className="modifier-stack-empty">
        <span className="trim-hint-text">Lưới phẳng nguyên bản, chưa áp dụng bộ biến dạng nào.</span>
      </div>
    )
  }

  return (
    <div className="modifier-stack-box">
      <div className="trim-header-row">
        <span className="field-sub-label">Chuỗi biến dạng (Modifier Stack):</span>
        <button
          type="button"
          className="btn xs secondary"
          onClick={() =>
            onUpdateFace({
              bendX: 0,
              bendY: 0,
              bendLateral: 0,
              arcAngle: undefined,
              taperRatio: undefined,
              depthProfile: 'none',
              depthIntensity: 0,
              motionType: 'none',
              hiddenCells: []
            })
          }
          title="Xóa tất cả các hiệu ứng biến dạng về phẳng"
        >
          Đặt lại tất cả
        </button>
      </div>

      <div className="modifier-list" style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((item) => (
          <div key={item.id} className="modifier-item-row">
            <div className="modifier-info">
              <span className="modifier-icon">{item.icon}</span>
              <div className="modifier-text">
                <span className="modifier-name">{item.name}</span>
                <span className="modifier-summary">{item.summary}</span>
              </div>
            </div>
            <button
              type="button"
              className="modifier-remove-btn"
              onClick={item.onRemove}
              title={`Xóa ${item.name}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
