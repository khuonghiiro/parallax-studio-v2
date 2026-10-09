import { aroundY, face, type AssemblyTemplate, type TemplateFaceSpec } from '../assemblyTemplateKit'
import type { Face3D } from '../types'
import type { ImageMeshVariant } from '../imageMeshTypes'
import { slot, mesh, standardVariants } from './templateCommon'

export const grassClumpVariants: ImageMeshVariant[] = [
  { id: 'standard', label: 'Bụi vừa (14 lá tỏa đều)', en: 'Medium clump (14 radial blades)', scale: [1, 1, 1], bend: 1 },
  { id: 'slender', label: 'Cỏ cao / vươn thẳng', en: 'Tall / upright shoots', scale: [0.85, 1.25, 0.85], bend: 0.65 },
  { id: 'wide', label: 'Bụi rậm / cong rủ', en: 'Dense / wide drooping bush', scale: [1.25, 0.85, 1.25], bend: 1.35 }
]

export const grassSlot = slot(
  'grass',
  'Bụi cỏ',
  'Grass tuft',
  [1, 1],
  'Single grass tuft front elevation, roots on bottom edge, blades point upward, 4% transparent padding at sides and top, real alpha between blades, no soil.',
  'Cỏ nhìn ngang, gốc sát mép dưới, ngọn hướng lên; alpha giữa từng lá cỏ, không kèm đất.'
)

export const grassBladeSlot = slot(
  'blade',
  'Phiến lá cỏ',
  'Grass blade',
  [1, 5],
  'One isolated tall slender grass blade, upright vertical, pointed tip at top center, root sheath at bottom edge. Transparent background with 4% padding at top and sides; real alpha cutout, no dirt or multiple blades.',
  'Một phiến lá cỏ đơn lẻ thuôn dài, ngọn nhọn ở đỉnh, gốc ở mép dưới; ảnh dùng chung cho toàn bộ các lá cỏ tỏa tròn 360° tạo thành khóm bụi rậm rạp.'
)

/** Viền mesh lá cỏ uốn lượn sang trái: từ gốc thẳng uốn cong dần sang trái */
export const GRASS_BLADE_CURVE_LEFT_POLYGON: Array<[number, number]> = [
  [0.46, 0.0],
  [0.54, 0.0],
  [0.50, 0.20],
  [0.42, 0.42],
  [0.30, 0.65],
  [0.17, 0.84],
  [0.08, 0.96],
  [0.04, 1.0],
  [0.02, 0.94],
  [0.08, 0.82],
  [0.20, 0.62],
  [0.32, 0.40],
  [0.41, 0.18]
]

/** Viền mesh lá cỏ xòe ngang sang trái (uốn cong mạnh sát đất) */
export const GRASS_BLADE_FAR_LEFT_POLYGON: Array<[number, number]> = [
  [0.46, 0.0],
  [0.54, 0.0],
  [0.47, 0.15],
  [0.36, 0.32],
  [0.22, 0.50],
  [0.10, 0.66],
  [0.03, 0.78],
  [0.01, 0.82],
  [0.01, 0.74],
  [0.11, 0.58],
  [0.24, 0.42],
  [0.37, 0.25],
  [0.41, 0.12]
]

/** Viền mesh lá cỏ uốn lượn sang phải: đối xứng với lá cong trái */
export const GRASS_BLADE_CURVE_RIGHT_POLYGON: Array<[number, number]> = [
  [0.46, 0.0],
  [0.54, 0.0],
  [0.59, 0.18],
  [0.68, 0.40],
  [0.80, 0.62],
  [0.92, 0.82],
  [0.98, 0.94],
  [0.96, 1.0],
  [0.92, 0.96],
  [0.83, 0.84],
  [0.70, 0.65],
  [0.58, 0.42],
  [0.50, 0.20]
]

/** Viền mesh lá cỏ xòe ngang sang phải (uốn cong mạnh sát đất) */
export const GRASS_BLADE_FAR_RIGHT_POLYGON: Array<[number, number]> = [
  [0.46, 0.0],
  [0.54, 0.0],
  [0.59, 0.12],
  [0.63, 0.25],
  [0.76, 0.42],
  [0.89, 0.58],
  [0.99, 0.74],
  [0.99, 0.82],
  [0.97, 0.78],
  [0.91, 0.66],
  [0.78, 0.50],
  [0.64, 0.32],
  [0.53, 0.15]
]

/** Viền mesh lá cỏ cao uốn vòm rủ ngọn */
export const GRASS_BLADE_DROOP_POLYGON: Array<[number, number]> = [
  [0.45, 0.0],
  [0.55, 0.0],
  [0.58, 0.30],
  [0.62, 0.60],
  [0.60, 0.82],
  [0.50, 0.97],
  [0.38, 0.98],
  [0.26, 0.91],
  [0.24, 0.86],
  [0.34, 0.92],
  [0.48, 0.90],
  [0.52, 0.78],
  [0.49, 0.55],
  [0.44, 0.28]
]

/** Viền mesh lá cỏ uốn lượn sóng hình chữ S */
export const GRASS_BLADE_S_CURVE_POLYGON: Array<[number, number]> = [
  [0.46, 0.0],
  [0.54, 0.0],
  [0.60, 0.25],
  [0.58, 0.50],
  [0.45, 0.72],
  [0.35, 0.90],
  [0.32, 1.0],
  [0.28, 0.94],
  [0.38, 0.75],
  [0.50, 0.52],
  [0.51, 0.26],
  [0.42, 0.12]
]

/** Viền mesh lá cỏ vươn thẳng thuôn nhọn */
export const GRASS_BLADE_UPRIGHT_POLYGON: Array<[number, number]> = [
  [0.44, 0.0],
  [0.56, 0.0],
  [0.60, 0.25],
  [0.58, 0.60],
  [0.55, 0.85],
  [0.50, 1.0],
  [0.45, 0.85],
  [0.42, 0.60],
  [0.40, 0.25]
]

export interface GrassBladeSpec {
  name: string
  deg: number
  w: number
  h: number
  tilt: number
  radius: number
  bendY: number
  bendX: number
  bendLateral: number
  region?: Face3D['bendRegion']
  polygon: Array<[number, number]>
}

export const GRASS_BLADES: GrassBladeSpec[] = [
  // 4 ngọn cỏ cao ở tâm: vươn cao, uốn vòm rủ ngọn và uốn lượn hình chữ S
  { name: 'Cỏ cao rủ 1', deg: 30, w: 76, h: 380, tilt: 8, radius: 4, bendY: 26, bendX: 20, bendLateral: -28, region: 'top', polygon: GRASS_BLADE_DROOP_POLYGON },
  { name: 'Cỏ cao thẳng 2', deg: 120, w: 70, h: 350, tilt: 10, radius: 5, bendY: 24, bendX: 20, bendLateral: 22, region: 'top', polygon: GRASS_BLADE_UPRIGHT_POLYGON },
  { name: 'Cỏ cao sóng 3', deg: 210, w: 76, h: 380, tilt: 9, radius: 4, bendY: 25, bendX: 20, bendLateral: -30, region: 'curl', polygon: GRASS_BLADE_S_CURVE_POLYGON },
  { name: 'Cỏ cao rủ 4', deg: 300, w: 72, h: 360, tilt: 11, radius: 5, bendY: 28, bendX: 22, bendLateral: 32, region: 'top', polygon: GRASS_BLADE_DROOP_POLYGON },

  // 5 ngọn cỏ tầm trung: uốn lượn tỏa đều vòng cung sang trái / phải
  { name: 'Cỏ uốn trái 1', deg: 20, w: 52, h: 260, tilt: 24, radius: 9, bendY: 38, bendX: 22, bendLateral: -38, region: 'all', polygon: GRASS_BLADE_CURVE_LEFT_POLYGON },
  { name: 'Cỏ uốn phải 2', deg: 90, w: 50, h: 250, tilt: 26, radius: 10, bendY: 40, bendX: 24, bendLateral: 42, region: 'all', polygon: GRASS_BLADE_CURVE_RIGHT_POLYGON },
  { name: 'Cỏ uốn trái 3', deg: 165, w: 52, h: 260, tilt: 23, radius: 9, bendY: 36, bendX: 22, bendLateral: -36, region: 'all', polygon: GRASS_BLADE_CURVE_LEFT_POLYGON },
  { name: 'Cỏ uốn phải 4', deg: 235, w: 50, h: 250, tilt: 28, radius: 11, bendY: 42, bendX: 24, bendLateral: 40, region: 'all', polygon: GRASS_BLADE_CURVE_RIGHT_POLYGON },
  { name: 'Cỏ sóng chữ S 5', deg: 310, w: 54, h: 270, tilt: 22, radius: 10, bendY: 35, bendX: 22, bendLateral: -32, region: 'curl', polygon: GRASS_BLADE_S_CURVE_POLYGON },

  // 5 ngọn cỏ tầng thấp: già hơn, xòe ngang uốn lượn sát đất sang hai bên
  { name: 'Cỏ xòe ngang trái 1', deg: 55, w: 36, h: 180, tilt: 46, radius: 14, bendY: 52, bendX: 24, bendLateral: -46, region: 'all', polygon: GRASS_BLADE_FAR_LEFT_POLYGON },
  { name: 'Cỏ xòe ngang phải 2', deg: 135, w: 32, h: 160, tilt: 52, radius: 15, bendY: 56, bendX: 25, bendLateral: 50, region: 'all', polygon: GRASS_BLADE_FAR_RIGHT_POLYGON },
  { name: 'Cỏ xòe ngang trái 3', deg: 195, w: 38, h: 190, tilt: 44, radius: 13, bendY: 50, bendX: 24, bendLateral: -44, region: 'all', polygon: GRASS_BLADE_FAR_LEFT_POLYGON },
  { name: 'Cỏ xòe ngang phải 4', deg: 275, w: 32, h: 160, tilt: 54, radius: 16, bendY: 58, bendX: 26, bendLateral: 52, region: 'all', polygon: GRASS_BLADE_FAR_RIGHT_POLYGON },
  { name: 'Cỏ xòe ngang trái 5', deg: 345, w: 36, h: 180, tilt: 48, radius: 14, bendY: 54, bendX: 25, bendLateral: -48, region: 'all', polygon: GRASS_BLADE_FAR_LEFT_POLYGON }
]

export function radialGrassFaces(): TemplateFaceSpec[] {
  const DEG_RAD = Math.PI / 180
  return GRASS_BLADES.map((b) => {
    const phi = b.deg * DEG_RAD
    const tRad = b.tilt * DEG_RAD
    const up: [number, number, number] = [
      Math.sin(phi) * Math.sin(tRad),
      Math.cos(tRad),
      -Math.cos(phi) * Math.sin(tRad)
    ]
    const n: [number, number, number] = [
      Math.sin(phi) * Math.cos(tRad),
      -Math.sin(tRad),
      -Math.cos(phi) * Math.cos(tRad)
    ]
    const rootX = b.radius * Math.sin(phi)
    const rootY = -140
    const rootZ = -b.radius * Math.cos(phi)
    const c: [number, number, number] = [
      rootX + up[0] * (b.h / 2),
      rootY + up[1] * (b.h / 2),
      rootZ + up[2] * (b.h / 2)
    ]
    return mesh(
      face(b.name, b.w, b.h, c, n, up, {
        bendX: b.bendX,
        bendY: b.bendY,
        bendLateral: b.bendLateral,
        bendRegion: b.region ?? 'all',
        silhouettePolygon: b.polygon
      }),
      'blade',
      'ridge',
      12
    )
  })
}

export const GRASS_BILLBOARD_TEMPLATE: AssemblyTemplate = {
  id: 'mesh-grass',
  label: 'Mesh ảnh · Bụi cỏ',
  category: 'nature',
  hint: 'Một ảnh cỏ tách nền → ba lưới giao nhau dạng billboard 60°/120°, gốc thẳng hàng',
  en: {
    label: 'Image mesh · Grass tuft',
    hint: 'One transparent grass image → three crossing billboard meshes aligned at the roots'
  },
  imageRecipe: {
    slots: [grassSlot],
    variants: standardVariants
  },
  faces: () =>
    [0, 60, 120].map((a, i) =>
      mesh(aroundY(`Cỏ ${i + 1}`, 240, 240, a, [0, 120, 0]), 'grass')
    )
}

export const GRASS_RADIAL_TEMPLATE: AssemblyTemplate = {
  id: 'mesh-grass-radial',
  label: 'Mesh ảnh · Bụi cỏ 360°',
  category: 'nature',
  hint: '1 ảnh phiến lá cỏ duy nhất → uốn cong mesh và tỏa tròn 360° với ngọn cao thấp, nghiêng ngửa ngẫu nhiên',
  en: {
    label: 'Image mesh · 360° Grass clump',
    hint: 'One single grass blade image → curved meshes radiating 360° with randomized height and lean'
  },
  imageRecipe: {
    slots: [grassBladeSlot],
    variants: grassClumpVariants
  },
  faces: radialGrassFaces
}
