import type { Model3D, PresetType } from './types'
import { generatePresetFaces } from './models3dStorage'
import {
  ASSEMBLY_TEMPLATES,
  templateFaces,
  type AssemblyTemplate
} from './assemblyTemplates'
import {
  COTTAGE_THUMBNAIL,
  CUBE_THUMBNAIL,
  CORNER_THUMBNAIL,
  ROOM_THUMBNAIL
} from './templateThumbnails'

export type CreateCategory = 'all' | 'architecture' | 'props' | 'nature' | 'stage'

export interface CreateTemplateItem {
  id: string
  preset?: PresetType
  name: string
  subtitle: string
  facesCount: number
  category: 'architecture' | 'props' | 'nature' | 'stage'
  categoryLabel: string
  image?: string
  assemblyTemplate?: AssemblyTemplate
  buildModel: () => Model3D
}

export function buildBlankModel(): Model3D {
  return {
    id: 'model-custom-' + Math.random().toString(36).slice(2, 7),
    name: 'Mô hình 3D tự tạo mới',
    description: 'Mô hình 3D tùy biến tự do từ mặt phẳng cơ bản',
    category: 'custom',
    scale: 1.0,
    faces: [
      {
        id: 'face-1',
        name: 'Mặt chính 1',
        color: '#38bdf8',
        width: 600,
        height: 600,
        position: [0, 0, 0],
        rotation: [0, 0, 0]
      }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

function modelFromTemplate(tmpl: AssemblyTemplate, scale = 0.6): Model3D {
  const cat =
    tmpl.category === 'architecture'
      ? 'architecture'
      : tmpl.category === 'props'
      ? 'props'
      : tmpl.category === 'nature'
      ? 'props'
      : 'room'

  return {
    id: `model-${tmpl.id}-${Math.random().toString(36).slice(2, 7)}`,
    name: `${tmpl.label} 3D Mới`,
    description: tmpl.hint,
    category: cat,
    scale,
    faces: templateFaces(tmpl),
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

export const CATEGORY_TABS: Array<{ id: CreateCategory; label: string }> = [
  { id: 'all', label: 'Tất cả mẫu' },
  { id: 'architecture', label: 'Kiến trúc & Nhà cửa' },
  { id: 'props', label: 'Đạo cụ & Khối hộp' },
  { id: 'nature', label: 'Thiên nhiên & Cây cối' },
  { id: 'stage', label: 'Bối cảnh & Sân khấu' }
]

export const ALL_CREATE_TEMPLATES: CreateTemplateItem[] = [
  // 1. 4 Mẫu kinh điển có thumbnail SVG vẽ tay siêu nét
  {
    id: 'template-cottage',
    preset: 'cottage',
    name: 'Ngôi Nhà Mái Dốc (Cottage)',
    subtitle: 'Mặt tiền A-frame, 2 vách hông, 2 mái nghiêng gập & 2 mặt ống khói',
    facesCount: 7,
    category: 'architecture',
    categoryLabel: 'Kiến trúc',
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
    categoryLabel: 'Đạo cụ',
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
    category: 'stage',
    categoryLabel: 'Bối cảnh',
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
    category: 'stage',
    categoryLabel: 'Bối cảnh',
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
  },

  // 2. Mở rộng từ kho Assembly Templates
  ...ASSEMBLY_TEMPLATES.filter((t) => !['room-open', 'street-corner', 'box'].includes(t.id)).map(
    (t): CreateTemplateItem => {
      const facesCount = t.faces().length
      const catLabel =
        t.category === 'architecture'
          ? 'Kiến trúc'
          : t.category === 'props'
          ? 'Đạo cụ'
          : t.category === 'nature'
          ? 'Thiên nhiên'
          : 'Bối cảnh'

      return {
        id: `template-${t.id}`,
        name: t.label,
        subtitle: t.hint,
        facesCount,
        category: t.category,
        categoryLabel: catLabel,
        assemblyTemplate: t,
        buildModel: () => modelFromTemplate(t)
      }
    }
  )
]
