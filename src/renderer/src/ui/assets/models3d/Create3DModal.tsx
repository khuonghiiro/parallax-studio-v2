import type { Model3D, PresetType } from './types'
import { generatePresetFaces } from './models3dStorage'
import {
  COTTAGE_THUMBNAIL,
  CUBE_THUMBNAIL,
  CORNER_THUMBNAIL,
  ROOM_THUMBNAIL
} from './templateThumbnails'
import { IconCube, IconPlus } from '../../icons'

interface Create3DModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (model: Model3D) => void
}

interface TemplateOption {
  id: string
  preset: PresetType | 'custom'
  name: string
  subtitle: string
  facesCount: number
  category: 'architecture' | 'props' | 'room' | 'custom'
  image: string
  buildModel: () => Model3D
}

export function Create3DModal({ isOpen, onClose, onSelectTemplate }: Create3DModalProps) {
  if (!isOpen) return null

  const templates: TemplateOption[] = [
    {
      id: 'template-cottage',
      preset: 'cottage',
      name: 'Ngôi Nhà Mái Dốc (Cottage)',
      subtitle: 'Mặt tiền A-frame, 2 vách hông, 2 mái nghiêng gập & 2 mặt ống khói',
      facesCount: 7,
      category: 'architecture',
      image: COTTAGE_THUMBNAIL,
      buildModel: () => ({
        id: 'model-cottage-' + Math.random().toString(36).slice(2, 7),
        name: 'Ngôi Nhà Tudor 3D Mới',
        description: 'Ngôi nhà châu Âu lắp ráp từ ảnh phẳng 2.5D',
        category: 'architecture',
        thumbnailDataUrl: COTTAGE_THUMBNAIL,
        scale: 0.6,
        faces: generatePresetFaces('cottage'),
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    },
    {
      id: 'template-cube',
      preset: 'cube',
      name: 'Khối Hộp Diêm (Cubic Box)',
      subtitle: '6 mặt đa giác vuông khép kín, làm thùng hàng, biển hiệu hoặc bục',
      facesCount: 6,
      category: 'props',
      image: CUBE_THUMBNAIL,
      buildModel: () => ({
        id: 'model-cube-' + Math.random().toString(36).slice(2, 7),
        name: 'Khối Hộp 3D Mới',
        description: 'Khối hộp chữ nhật 6 mặt đa giác vuông',
        category: 'props',
        thumbnailDataUrl: CUBE_THUMBNAIL,
        scale: 0.5,
        faces: generatePresetFaces('cube', { w: 500, h: 500, d: 500 }),
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    },
    {
      id: 'template-corner',
      preset: 'corner',
      name: 'Góc Phố Chữ L (L-Corner)',
      subtitle: '2 mặt dựng bẻ góc 90° kết hợp mặt sàn vỉa hè có chiều sâu',
      facesCount: 3,
      category: 'architecture',
      image: CORNER_THUMBNAIL,
      buildModel: () => ({
        id: 'model-corner-' + Math.random().toString(36).slice(2, 7),
        name: 'Góc Phố 3D Mới',
        description: 'Hai mặt tiền nhà phố bẻ vuông góc 90°',
        category: 'architecture',
        thumbnailDataUrl: CORNER_THUMBNAIL,
        scale: 0.6,
        faces: generatePresetFaces('corner', { w: 600, h: 600, d: 600 }),
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    },
    {
      id: 'template-room',
      preset: 'room',
      name: 'Căn Phòng Mở (Room Interior)',
      subtitle: 'Không gian nội thất 3 mặt tường và sàn phòng bao bọc',
      facesCount: 4,
      category: 'room',
      image: ROOM_THUMBNAIL,
      buildModel: () => ({
        id: 'model-room-' + Math.random().toString(36).slice(2, 7),
        name: 'Căn Phòng 3D Mới',
        description: 'Không gian phòng nội thất 3 mặt tường và sàn',
        category: 'room',
        thumbnailDataUrl: ROOM_THUMBNAIL,
        scale: 0.7,
        faces: generatePresetFaces('room', { w: 700, h: 500, d: 700 }),
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    }
  ]

  const handlePick = (tmpl: TemplateOption) => {
    const model = tmpl.buildModel()
    onSelectTemplate(model)
    onClose()
  }

  return (
    <div className="assembly-modal-overlay" onClick={onClose}>
      <div
        className="create-3d-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '95%',
          maxWidth: '780px',
          background: 'var(--bg-2)',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--line-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-3)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--accent)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconCube width={18} height={18} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                Tạo Mô Hình 3D Mới từ Khung Mẫu (Templates)
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                Chọn cấu trúc mẫu kèm hình ảnh trực quan để bắt đầu lắp ráp trong Xưởng 3D
              </div>
            </div>
          </div>
          <button type="button" className="btn xs ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Templates Grid with Visual Pictures */}
        <div
          style={{
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '14px',
            maxHeight: '65vh',
            overflowY: 'auto'
          }}
        >
          {templates.map((t) => (
            <div
              key={t.id}
              className="template-card"
              onClick={() => handlePick(t)}
              style={{
                background: 'var(--bg-1)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Picture Area */}
              <div
                style={{
                  height: '140px',
                  background: 'var(--bg-0)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottom: '1px solid var(--line-soft)'
                }}
              >
                <img
                  src={t.image}
                  alt={t.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    background: 'var(--accent-cyan)',
                    color: '#000',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                >
                  3D MESH
                </span>
                <span
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    fontSize: '10.5px',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  {t.facesCount} mặt phẳng
                </span>
              </div>

              {/* Meta */}
              <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                  {t.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.35 }}>
                  {t.subtitle}
                </div>
              </div>

              {/* Action Button */}
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-3)',
                  borderTop: '1px solid var(--line-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end'
                }}
              >
                <button
                  type="button"
                  className="btn xs primary"
                  style={{ gap: '4px' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePick(t)
                  }}
                >
                  <IconPlus width={12} height={12} />
                  <span>Chọn mẫu này</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
