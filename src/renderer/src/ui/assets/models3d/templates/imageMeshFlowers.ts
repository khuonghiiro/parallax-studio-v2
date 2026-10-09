import { face, FRONT, type AssemblyTemplate, type TemplateFaceSpec } from '../assemblyTemplateKit'
import type { ImageMeshVariant } from '../imageMeshTypes'
import { slot, mesh, STEM_POLYGON } from './templateCommon'

export const flowerVariants: ImageMeshVariant[] = [
  { id: 'standard', label: 'Tiêu chuẩn', en: 'Standard', scale: [1, 1, 1], bend: 1 },
  { id: 'slender', label: 'Nhỏ / cong nhẹ', en: 'Compact / gently curved', scale: [0.75, 0.75, 0.75], bend: 0.6 },
  { id: 'curled', label: 'Uốn xoăn cánh', en: 'Curled / wavy petals', scale: [1.1, 1.1, 1.1], bend: 1.8 },
  { id: 'wide', label: 'Lớn / cong rõ', en: 'Large / strongly curved', scale: [1.3, 1.3, 1.3], bend: 1.2 }
]

export const petalSlot = slot(
  'petal',
  'Cánh hoa',
  'Petal',
  [2, 3],
  'One isolated flattened flower petal, broad tip at top, narrow attachment at bottom center touching the bottom edge. No center disk, leaves or stem.',
  'Một cánh hoa trải phẳng, đầu rộng ở trên, gốc hẹp ở chính giữa mép dưới; ảnh được dùng lại cho sáu cánh.'
)

export const flowerCenterSlot = slot(
  'center',
  'Nhụy hoa',
  'Flower center',
  [1, 1],
  'Circular flower center viewed straight on, centered, filling 92% of square canvas, transparent outside disk, no petals.',
  'Nhụy tròn chính diện, ở giữa và chiếm 92% ảnh vuông; ngoài nhụy trong suốt.'
)

export const stemSlot = slot(
  'stem',
  'Thân cây',
  'Stem',
  [1, 10],
  'Straight vertical plant stem, same width throughout, top and bottom ends touch canvas edges, transparent sides, no leaves.',
  'Thân thẳng đứng chạm mép trên/dưới, hai bên trong suốt, không kèm lá.'
)

/**
 * Viền mesh cánh hoa chuẩn hoa tự nhiên:
 * Đáy cuống hẹp ở mép dưới, thân cánh xòe rộng bầu tròn dạng muỗng (spoon petal),
 * hai thùy tròn mềm mại ôm lấy đỉnh với khía hõm nhẹ ở giữa tâm đỉnh cánh.
 */
export const FLOWER_PETAL_POLYGON: Array<[number, number]> = [
  [0.44, 0.0],
  [0.56, 0.0],
  [0.66, 0.12],
  [0.80, 0.28],
  [0.92, 0.50],
  [0.96, 0.70],
  [0.90, 0.88],
  [0.74, 0.98],
  [0.60, 0.96],
  [0.50, 0.93],
  [0.40, 0.96],
  [0.26, 0.98],
  [0.10, 0.88],
  [0.04, 0.70],
  [0.08, 0.50],
  [0.20, 0.28],
  [0.34, 0.12]
]

/** Viền mesh nhụy hoa tròn: đĩa tròn 16 cạnh đều */
export const FLOWER_CENTER_POLYGON: Array<[number, number]> = Array.from({ length: 16 }, (_, i) => {
  const rad = (i * 2 * Math.PI) / 16
  return [
    Math.round((0.5 + 0.46 * Math.cos(rad)) * 1000) / 1000,
    Math.round((0.5 + 0.46 * Math.sin(rad)) * 1000) / 1000
  ]
})

export function flowerFaces(): TemplateFaceSpec[] {
  // Sắp xếp 6 cánh hoa theo 2 tầng so le (z-layering offset) để triệt tiêu hoàn toàn z-fighting
  const petals = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3
    const sinA = Math.sin(a)
    const cosA = Math.cos(a)
    // Cánh lẻ hơi nhô lên trước (Z = -3), cánh chẵn hơi lùi về sau (Z = 3)
    const zOffset = i % 2 === 0 ? 3 : -3

    // Pháp tuyến hơi ngửa ra ngoài tạo độ cong chén tự nhiên (cup depth)
    const n: [number, number, number] = [sinA * 0.18, cosA * 0.18, -0.98]

    return mesh(
      face(
        `Cánh ${i + 1}`,
        160,
        240,
        [sinA * 115, 150 + cosA * 115, zOffset],
        n,
        [sinA, cosA, 0],
        {
          bendX: 28,
          bendY: 24,
          bendRegion: 'top',
          silhouettePolygon: FLOWER_PETAL_POLYGON
        }
      ),
      'petal',
      'ridge',
      10
    )
  })

  return [
    mesh(
      face('Thân', 40, 400, [0, -50, 12], FRONT, undefined, {
        silhouettePolygon: STEM_POLYGON
      }),
      'stem'
    ),
    ...petals,
    mesh(
      face('Nhụy', 100, 100, [0, 150, -14], FRONT, undefined, {
        silhouettePolygon: FLOWER_CENTER_POLYGON
      }),
      'center',
      'sphere',
      20
    )
  ]
}

export const FLOWER_TEMPLATE: AssemblyTemplate = {
  id: 'mesh-flower',
  label: 'Mesh ảnh · Bông hoa',
  category: 'nature',
  hint: '3 ảnh: cánh, nhụy, thân → hoa sáu cánh cong xếp tầng, thay ảnh tạo nhiều loài',
  en: {
    label: 'Image mesh · Flower',
    hint: '3 images: petal, center, stem → layered curved petals with interchangeable textures'
  },
  imageRecipe: {
    slots: [petalSlot, flowerCenterSlot, stemSlot],
    variants: flowerVariants
  },
  faces: flowerFaces
}
