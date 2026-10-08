import { face, FRONT, UP, AWAY, boxFaces, aroundY, offset, type AssemblyTemplate, type TemplateFaceSpec } from './assemblyTemplateKit'
import type { Face3D } from './types'
import type { ImageMeshSlot, ImageMeshVariant } from './imageMeshTypes'
import { IMAGE_MESH_SLOT_RULES } from './imageMeshSlotRules'

const variants: ImageMeshVariant[] = [
  { id: 'standard', label: 'Tiêu chuẩn', en: 'Standard', scale: [1, 1, 1], bend: 1 },
  { id: 'slender', label: 'Nhỏ / cong nhẹ', en: 'Compact / gently curved', scale: [0.75, 0.75, 0.75], bend: 0.7 },
  { id: 'wide', label: 'Lớn / cong rõ', en: 'Large / strongly curved', scale: [1.3, 1.3, 1.3], bend: 1.2 }
]

function slot(id: keyof typeof IMAGE_MESH_SLOT_RULES, label: string, en: string, aspect: [number, number], prompt: string, guidance: string): ImageMeshSlot {
  return { id, label, en, aspect, prompt, guidance, ...IMAGE_MESH_SLOT_RULES[id] }
}

function mesh(spec: TemplateFaceSpec, imageSlot: string, profile: 'none' | 'ridge' | 'sphere' = 'none', intensity = 0): TemplateFaceSpec {
  return { ...spec, imageSlot, mesh: { meshMode: 'auto', gridRes: 48, depthProfile: profile, depthIntensity: intensity } }
}

const leafSlot = slot('leaf', 'Phiến lá', 'Leaf blade', [1, 2],
  'One flattened leaf, top surface facing camera, central vein vertical at x=50%, tip at top center, petiole at bottom center. Entire leaf within 4% transparent padding; no stem branch or pot.',
  'Lá trải phẳng nhìn từ trên, gân giữa thẳng đứng; đầu lá ở trên, cuống ở dưới, chừa 4% viền alpha. Thay ảnh để đổi loài lá.')
const petalSlot = slot('petal', 'Cánh hoa', 'Petal', [2, 3],
  'One isolated flattened flower petal, broad tip at top, narrow attachment at bottom center touching the bottom edge. No center disk, leaves or stem.',
  'Một cánh hoa trải phẳng, đầu rộng ở trên, gốc hẹp ở chính giữa mép dưới; ảnh được dùng lại cho sáu cánh.')
const trumpetPetalSlot = slot('petal', 'Cánh hoa kèn', 'Trumpet petal', [1, 2],
  'One isolated long trumpet lily petal, narrow base touching bottom edge at center, expanding gradually toward flared pointed tip at top center. Transparent background with 4% padding at sides; real alpha cutout, no stem or leaves.',
  'Một cánh hoa loa kèn thuôn dài hình phễu kèn, gốc hẹp ở mép dưới, ngọn xòe rộng ở trên; ảnh dùng chung cho sáu cánh xếp thành loa kèn 3D.')
const stamenSlot = slot('stamen', 'Nhụy hoa kèn', 'Lily stamens', [1, 2],
  'Cluster of slender flower stamens and pistil, narrow stalks emerging from bottom, pollen anthers clustered near top, transparent background.',
  'Chùm nhụy hoa loa kèn dài vươn ra từ đáy hoa, đầu nhụy phấn vàng; ngoài nhụy trong suốt.')
const stemSlot = slot('stem', 'Thân cây', 'Stem', [1, 10],
  'Straight vertical plant stem, same width throughout, top and bottom ends touch canvas edges, transparent sides, no leaves.',
  'Thân thẳng đứng chạm mép trên/dưới, hai bên trong suốt, không kèm lá.')
const grassBladeSlot = slot('blade', 'Phiến lá cỏ', 'Grass blade', [1, 5],
  'One isolated tall slender grass blade, upright vertical, pointed tip at top center, root sheath at bottom edge. Transparent background with 4% padding at top and sides; real alpha cutout, no dirt or multiple blades.',
  'Một phiến lá cỏ đơn lẻ thuôn dài, ngọn nhọn ở đỉnh, gốc ở mép dưới; ảnh dùng chung cho toàn bộ các lá cỏ tỏa tròn 360° tạo thành khóm bụi rậm rạp.')

const flowerVariants: ImageMeshVariant[] = [
  { id: 'standard', label: 'Tiêu chuẩn', en: 'Standard', scale: [1, 1, 1], bend: 1 },
  { id: 'slender', label: 'Nhỏ / cong nhẹ', en: 'Compact / gently curved', scale: [0.75, 0.75, 0.75], bend: 0.6 },
  { id: 'curled', label: 'Uốn xoăn cánh', en: 'Curled / wavy petals', scale: [1.1, 1.1, 1.1], bend: 1.8 },
  { id: 'wide', label: 'Lớn / cong rõ', en: 'Large / strongly curved', scale: [1.3, 1.3, 1.3], bend: 1.2 }
]

const trumpetVariants: ImageMeshVariant[] = [
  { id: 'standard', label: 'Tiêu chuẩn (phễu vừa)', en: 'Standard (medium trumpet)', scale: [1, 1, 1], bend: 1 },
  { id: 'slender', label: 'Thuôn dài / cong nhẹ', en: 'Slender / gentle flare', scale: [0.85, 1.2, 0.85], bend: 0.75 },
  { id: 'wide', label: 'Loe rộng / xoăn cánh', en: 'Wide flare / curled petals', scale: [1.25, 0.9, 1.25], bend: 1.4 }
]

const grassClumpVariants: ImageMeshVariant[] = [
  { id: 'standard', label: 'Bụi vừa (14 lá tỏa đều)', en: 'Medium clump (14 radial blades)', scale: [1, 1, 1], bend: 1 },
  { id: 'slender', label: 'Cỏ cao / vươn thẳng', en: 'Tall / upright shoots', scale: [0.85, 1.25, 0.85], bend: 0.65 },
  { id: 'wide', label: 'Bụi rậm / cong rủ', en: 'Dense / wide drooping bush', scale: [1.25, 0.85, 1.25], bend: 1.35 }
]

/** Viền mesh cánh hoa loa kèn chuẩn: gốc thon hẹp, phình đều qua họng kèn, đỉnh xòe nhọn */
const TRUMPET_PETAL_POLYGON: Array<[number, number]> = [
  [0.44, 0.0],
  [0.56, 0.0],
  [0.68, 0.2],
  [0.82, 0.45],
  [0.92, 0.72],
  [0.86, 0.90],
  [0.68, 0.98],
  [0.50, 1.0],
  [0.32, 0.98],
  [0.14, 0.90],
  [0.08, 0.72],
  [0.18, 0.45],
  [0.32, 0.2]
]

/** Viền mesh chùm nhụy hoa loa kèn: các cuống mảnh xòe ra các đầu bao phấn nhụy hạt */
const TRUMPET_STAMEN_POLYGON: Array<[number, number]> = [
  [0.42, 0.0],
  [0.58, 0.0],
  [0.62, 0.45],
  [0.85, 0.75],
  [0.88, 0.94],
  [0.72, 1.0],
  [0.56, 0.84],
  [0.50, 1.0],
  [0.44, 0.84],
  [0.28, 1.0],
  [0.12, 0.94],
  [0.15, 0.75],
  [0.38, 0.45]
]

/**
 * Viền mesh cánh hoa chuẩn hoa tự nhiên (như hoa cúc, hoa trà, hoa giấy, cosmos trong ảnh 2):
 * Đáy cuống hẹp ở mép dưới, thân cánh xòe rộng bầu tròn dạng muỗng (spoon petal),
 * hai thùy tròn mềm mại ôm lấy đỉnh với khía hõm nhẹ ở giữa tâm đỉnh cánh.
 */
const FLOWER_PETAL_POLYGON: Array<[number, number]> = [
  // Cuống gắn ở đáy tâm (v=0)
  [0.44, 0.0],
  [0.56, 0.0],
  // Mép phải xòe nở ra ngoài
  [0.66, 0.12],
  [0.80, 0.28],
  [0.92, 0.50],
  [0.96, 0.70], // Bụng cánh mở rộng tối đa
  [0.90, 0.88], // Vai cánh uốn lượn vào trong
  [0.74, 0.98], // Đỉnh thùy phải
  [0.60, 0.96],
  [0.50, 0.93], // Khía lõm nhẹ ở tâm đỉnh cánh (chuẩn hoa tự nhiên như ảnh 2)
  [0.40, 0.96],
  [0.26, 0.98], // Đỉnh thùy trái
  [0.10, 0.88], // Vai cánh trái
  [0.04, 0.70], // Bụng cánh trái
  [0.08, 0.50],
  [0.20, 0.28],
  [0.34, 0.12]
]

/** Viền mesh nhụy hoa tròn: đĩa tròn 16 cạnh đều */
const FLOWER_CENTER_POLYGON: Array<[number, number]> = Array.from({ length: 16 }, (_, i) => {
  const rad = (i * 2 * Math.PI) / 16
  return [
    Math.round((0.5 + 0.46 * Math.cos(rad)) * 1000) / 1000,
    Math.round((0.5 + 0.46 * Math.sin(rad)) * 1000) / 1000
  ]
})

/** Viền mesh lá cỏ uốn lượn sang trái: từ gốc thẳng uốn cong dần sang trái */
const GRASS_BLADE_CURVE_LEFT_POLYGON: Array<[number, number]> = [
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
const GRASS_BLADE_FAR_LEFT_POLYGON: Array<[number, number]> = [
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
const GRASS_BLADE_CURVE_RIGHT_POLYGON: Array<[number, number]> = [
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
const GRASS_BLADE_FAR_RIGHT_POLYGON: Array<[number, number]> = [
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
const GRASS_BLADE_DROOP_POLYGON: Array<[number, number]> = [
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
const GRASS_BLADE_S_CURVE_POLYGON: Array<[number, number]> = [
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
const GRASS_BLADE_UPRIGHT_POLYGON: Array<[number, number]> = [
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

const GRASS_BLADE_POLYGON = GRASS_BLADE_UPRIGHT_POLYGON

/** Viền mesh phiến lá: thuôn bầu dục, nhọn đỉnh, thon cuống */
const LEAF_POLYGON: Array<[number, number]> = [
  [0.46, 0.0],
  [0.54, 0.0],
  [0.76, 0.25],
  [0.92, 0.55],
  [0.82, 0.82],
  [0.50, 1.0],
  [0.18, 0.82],
  [0.08, 0.55],
  [0.24, 0.25]
]

/** Viền mesh thân cây / cành hoa thẳng */
const STEM_POLYGON: Array<[number, number]> = [
  [0.40, 0.0],
  [0.60, 0.0],
  [0.60, 1.0],
  [0.40, 1.0]
]

function flowerFaces(): TemplateFaceSpec[] {
  const petals = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3
    return mesh(face(`Cánh ${i + 1}`, 160, 240,
      [Math.sin(a) * 115, 150 + Math.cos(a) * 115, 0], FRONT,
      [Math.sin(a), Math.cos(a), 0], {
        bendX: 28,
        bendY: 24,
        bendRegion: 'top',
        silhouettePolygon: FLOWER_PETAL_POLYGON
      }), 'petal', 'ridge', 10)
  })

  return [
    mesh(face('Thân', 40, 400, [0, -50, 12], FRONT, undefined, {
      silhouettePolygon: STEM_POLYGON
    }), 'stem'),
    ...petals,
    mesh(face('Nhụy', 100, 100, [0, 150, -14], FRONT, undefined, {
      silhouettePolygon: FLOWER_CENTER_POLYGON
    }), 'center', 'sphere', 20)
  ]
}

function trumpetFlowerFaces(): TemplateFaceSpec[] {
  // Trục phễu hoa loa kèn nghiêng 20° ngước lên và hướng về phía trước (-Z)
  const tiltDeg = 20
  const tiltRad = (tiltDeg * Math.PI) / 180
  const cosT = Math.cos(tiltRad) // ~0.9397
  const sinT = Math.sin(tiltRad) // ~0.3420

  const axis: [number, number, number] = [0, sinT, -cosT]
  const yCross: [number, number, number] = [0, cosT, sinT]

  const funnelLength = 260
  const baseP: [number, number, number] = [0, 45, 80]
  const midP: [number, number, number] = [
    baseP[0] + axis[0] * (funnelLength * 0.5),
    baseP[1] + axis[1] * (funnelLength * 0.5),
    baseP[2] + axis[2] * (funnelLength * 0.5)
  ]

  const midRadius = 45
  const coneAngleRad = Math.atan2(72 - 18, funnelLength) // ~11.7°
  const cosCone = Math.cos(coneAngleRad) // ~0.979
  const sinCone = Math.sin(coneAngleRad) // ~0.203

  const petals = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3
    const deg = i * 60
    const cosA = Math.cos(a)
    const sinA = Math.sin(a)

    // Hướng bán kính trong mặt phẳng thiết diện phễu
    const rad: [number, number, number] = [
      cosA,
      sinA * yCross[1],
      sinA * yCross[2]
    ]

    // Pháp tuyến n hướng ra ngoài mặt nón
    const n: [number, number, number] = [
      rad[0] * cosCone - axis[0] * sinCone,
      rad[1] * cosCone - axis[1] * sinCone,
      rad[2] * cosCone - axis[2] * sinCone
    ]

    // Vector up hướng dọc cánh từ cuống hoa đến miệng phễu
    const up: [number, number, number] = [
      axis[0] * cosCone + rad[0] * sinCone,
      axis[1] * cosCone + rad[1] * sinCone,
      axis[2] * cosCone + rad[2] * sinCone
    ]

    // Tâm cánh nằm trên mặt nón tại độ cao trung điểm
    const c: [number, number, number] = [
      midP[0] + rad[0] * midRadius,
      midP[1] + rad[1] * midRadius,
      midP[2] + rad[2] * midRadius
    ]

    return mesh(
      face(`Cánh kèn ${i + 1} (${deg}°)`, 130, funnelLength, c, n, up, {
        bendX: 42,
        bendY: -36,
        bendRegion: 'top',
        silhouettePolygon: TRUMPET_PETAL_POLYGON
      }),
      'petal',
      'ridge',
      12
    )
  })

  // Nhị hoa vươn từ sâu trong họng kèn ra miệng hoa
  const stamenC: [number, number, number] = [
    baseP[0] + axis[0] * 105,
    baseP[1] + axis[1] * 105,
    baseP[2] + axis[2] * 105
  ]
  const stamen = mesh(
    face('Nhụy hoa kèn', 100, 200, stamenC, yCross, axis, {
      bendY: 18,
      bendRegion: 'top',
      silhouettePolygon: TRUMPET_STAMEN_POLYGON
    }),
    'stamen',
    'ridge',
    14
  )

  // Thân cành nối từ dưới lên khớp với đáy cuống hoa tại baseP
  const stem = mesh(
    face('Thân cành', 40, 400, [0, -120, 95], FRONT, [0, 0.98, -0.2], {
      silhouettePolygon: STEM_POLYGON
    }),
    'stem'
  )

  return [stem, ...petals, stamen]
}

interface GrassBladeSpec {
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

const GRASS_BLADES: GrassBladeSpec[] = [
  // 4 ngọn cỏ cao ở tâm: vươn cao, uốn vòm rủ ngọn và uốn lượn hình chữ S
  { name: 'Cỏ cao rủ 1', deg: 30, w: 76, h: 380, tilt: 8, radius: 10, bendY: 26, bendX: 20, bendLateral: -28, region: 'top', polygon: GRASS_BLADE_DROOP_POLYGON },
  { name: 'Cỏ cao thẳng 2', deg: 120, w: 70, h: 350, tilt: 10, radius: 12, bendY: 24, bendX: 20, bendLateral: 22, region: 'top', polygon: GRASS_BLADE_UPRIGHT_POLYGON },
  { name: 'Cỏ cao sóng 3', deg: 210, w: 76, h: 380, tilt: 9, radius: 11, bendY: 25, bendX: 20, bendLateral: -30, region: 'curl', polygon: GRASS_BLADE_S_CURVE_POLYGON },
  { name: 'Cỏ cao rủ 4', deg: 300, w: 72, h: 360, tilt: 11, radius: 12, bendY: 28, bendX: 22, bendLateral: 32, region: 'top', polygon: GRASS_BLADE_DROOP_POLYGON },

  // 5 ngọn cỏ tầm trung: uốn lượn tỏa đều vòng cung sang trái / phải
  { name: 'Cỏ uốn trái 1', deg: 20, w: 52, h: 260, tilt: 24, radius: 24, bendY: 38, bendX: 22, bendLateral: -38, region: 'all', polygon: GRASS_BLADE_CURVE_LEFT_POLYGON },
  { name: 'Cỏ uốn phải 2', deg: 90, w: 50, h: 250, tilt: 26, radius: 26, bendY: 40, bendX: 24, bendLateral: 42, region: 'all', polygon: GRASS_BLADE_CURVE_RIGHT_POLYGON },
  { name: 'Cỏ uốn trái 3', deg: 165, w: 52, h: 260, tilt: 23, radius: 25, bendY: 36, bendX: 22, bendLateral: -36, region: 'all', polygon: GRASS_BLADE_CURVE_LEFT_POLYGON },
  { name: 'Cỏ uốn phải 4', deg: 235, w: 50, h: 250, tilt: 28, radius: 27, bendY: 42, bendX: 24, bendLateral: 40, region: 'all', polygon: GRASS_BLADE_CURVE_RIGHT_POLYGON },
  { name: 'Cỏ sóng chữ S 5', deg: 310, w: 54, h: 270, tilt: 22, radius: 23, bendY: 35, bendX: 22, bendLateral: -32, region: 'curl', polygon: GRASS_BLADE_S_CURVE_POLYGON },

  // 5 ngọn cỏ tầng thấp: già hơn, xòe ngang uốn lượn sát đất sang hai bên (như nét vẽ tay ảnh 1)
  { name: 'Cỏ xòe ngang trái 1', deg: 55, w: 36, h: 180, tilt: 46, radius: 42, bendY: 52, bendX: 24, bendLateral: -46, region: 'all', polygon: GRASS_BLADE_FAR_LEFT_POLYGON },
  { name: 'Cỏ xòe ngang phải 2', deg: 135, w: 32, h: 160, tilt: 52, radius: 46, bendY: 56, bendX: 25, bendLateral: 50, region: 'all', polygon: GRASS_BLADE_FAR_RIGHT_POLYGON },
  { name: 'Cỏ xòe ngang trái 3', deg: 195, w: 38, h: 190, tilt: 44, radius: 40, bendY: 50, bendX: 24, bendLateral: -44, region: 'all', polygon: GRASS_BLADE_FAR_LEFT_POLYGON },
  { name: 'Cỏ xòe ngang phải 4', deg: 275, w: 32, h: 160, tilt: 54, radius: 48, bendY: 58, bendX: 26, bendLateral: 52, region: 'all', polygon: GRASS_BLADE_FAR_RIGHT_POLYGON },
  { name: 'Cỏ xòe ngang trái 5', deg: 345, w: 36, h: 180, tilt: 48, radius: 44, bendY: 54, bendX: 25, bendLateral: -48, region: 'all', polygon: GRASS_BLADE_FAR_LEFT_POLYGON }
]

function radialGrassFaces(): TemplateFaceSpec[] {
  const DEG_RAD = Math.PI / 180
  return GRASS_BLADES.map((b) => {
    const phi = b.deg * DEG_RAD
    const tRad = b.tilt * DEG_RAD
    const up: [number, number, number] = [
      -Math.sin(phi) * Math.sin(tRad),
      Math.cos(tRad),
      Math.cos(phi) * Math.sin(tRad)
    ]
    const n: [number, number, number] = [
      Math.sin(phi) * Math.cos(tRad),
      Math.sin(tRad),
      -Math.cos(phi) * Math.cos(tRad)
    ]
    const rootX = b.radius * Math.sin(phi)
    const rootY = 0
    const rootZ = -b.radius * Math.cos(phi)
    const c: [number, number, number] = [
      rootX + up[0] * (b.h / 2),
      rootY + up[1] * (b.h / 2),
      rootZ + up[2] * (b.h / 2)
    ]
    return mesh(face(b.name, b.w, b.h, c, n, up, {
      bendX: b.bendX,
      bendY: b.bendY,
      bendLateral: b.bendLateral,
      bendRegion: 'top',
      silhouettePolygon: b.polygon
    }), 'blade', 'ridge', 12)
  })
}

function potFaces(): TemplateFaceSpec[] {
  return boxFaces(260, 240, 260, { top: false, bottom: true }).map((f, i) =>
    mesh(f, i === 4 ? 'bottom' : 'pot'))
}

export const IMAGE_MESH_TEMPLATES: AssemblyTemplate[] = [
  {
    id: 'mesh-leaf', label: 'Mesh ảnh · Lá cây', category: 'nature',
    hint: 'Một ảnh lá → lưới bám viền alpha, gân nổi và mặt lá uốn cong',
    en: { label: 'Image mesh · Leaf', hint: 'One leaf image → alpha contour mesh, raised midrib and curved blade' },
    imageRecipe: { slots: [leafSlot], variants },
    faces: () => [mesh(face('Phiến lá', 240, 480, [0, 0, 0], FRONT, undefined, {
      bendY: 22,
      silhouettePolygon: LEAF_POLYGON
    }), 'leaf', 'ridge', 12)]
  },
  {
    id: 'mesh-flower', label: 'Mesh ảnh · Bông hoa', category: 'nature',
    hint: '3 ảnh: cánh, nhụy, thân → hoa sáu cánh cong, thay ảnh tạo nhiều loài',
    en: { label: 'Image mesh · Flower', hint: '3 images: petal, center, stem → six curved petals with interchangeable textures' },
    imageRecipe: { slots: [petalSlot, slot('center', 'Nhụy hoa', 'Flower center', [1, 1],
      'Circular flower center viewed straight on, centered, filling 92% of square canvas, transparent outside disk, no petals.',
      'Nhụy tròn chính diện, ở giữa và chiếm 92% ảnh vuông; ngoài nhụy trong suốt.'), stemSlot], variants: flowerVariants },
    faces: flowerFaces
  },
  {
    id: 'mesh-trumpet-flower', label: 'Mesh ảnh · Hoa loa kèn', category: 'nature',
    hint: '3 ảnh: cánh kèn, nhụy, thân → cánh loe hình phễu 3D, miệng kèn vểnh 360°',
    en: { label: 'Image mesh · Trumpet lily', hint: '3 images: trumpet petal, stamen, stem → 3D flared funnel with outward-curling petals' },
    imageRecipe: { slots: [trumpetPetalSlot, stamenSlot, stemSlot], variants: trumpetVariants },
    faces: trumpetFlowerFaces
  },
  {
    id: 'mesh-planter', label: 'Mesh ảnh · Chậu cây', category: 'nature',
    hint: 'Chậu vuông kín đáy + đất + lá nhiều hướng; 4 ảnh tái sử dụng cho 10 mặt',
    en: { label: 'Image mesh · Planter', hint: 'Square planter with base, soil and multi-angle leaves; 4 images for 10 faces' },
    imageRecipe: { slots: [
      slot('pot', 'Vách chậu', 'Planter wall', [13, 12], 'Flat square planter wall elevation, rectangular surface fills canvas edge to edge, straight horizontal rim at top. No perspective or other walls.', 'Một vách chậu vuông nhìn thẳng, phủ kín canvas; mép chậu nằm ngang phía trên. Dùng lại cho bốn vách.'),
      slot('bottom', 'Đáy chậu', 'Planter bottom', [1, 1], 'Flat square underside of planter, fills canvas edge to edge.', 'Đáy chậu vuông nhìn vuông góc, phủ kín ảnh.'),
      slot('soil', 'Mặt đất', 'Soil surface', [1, 1], 'Top-down square soil patch filling entire canvas, no pot rim or plant.', 'Đất nhìn từ trên, kín ảnh vuông; không vẽ lại vành chậu hoặc cây.'), leafSlot
    ], variants },
    faces: () => [...potFaces(), mesh(face('Đất', 250, 250, [0, 108, 130], UP, AWAY), 'soil'),
      ...Array.from({ length: 4 }, (_, i) => mesh({
        ...aroundY(`Lá ${i + 1}`, 120, 240, i * 90, [0, 230, 130]),
        bendY: 28,
        silhouettePolygon: LEAF_POLYGON
      }, 'leaf', 'ridge', 10))]
  },
  {
    id: 'mesh-highrise', label: 'Mesh ảnh · Nhà cao tầng', category: 'architecture',
    hint: '4 mặt đứng + mái, ảnh mặt tiền và hông phải khớp cao độ các tầng',
    en: { label: 'Image mesh · High-rise', hint: '4 elevations and roof; match floor heights across front and side images' },
    imageRecipe: { slots: [
      slot('front', 'Mặt trước / sau', 'Front / back elevation', [1, 3], 'Orthographic high-rise front elevation, 12 floors at equal intervals, rectangular facade fills canvas, roofline at top and ground at bottom, no visible side or roof.', 'Mặt tiền thẳng 12 tầng đều nhau, kín khung; đỉnh mái ở trên, chân nhà ở dưới. Dùng lại phía sau.'),
      slot('side', 'Mặt hông', 'Side elevation', [1, 4], 'Orthographic side elevation of the same 12-floor building, same floor heights and materials as front, rectangular wall fills canvas; no perspective.', 'Mặt hông thẳng, cùng 12 tầng và cao độ với mặt tiền; kín khung, không phối cảnh.'),
      slot('roof', 'Mái bằng', 'Roof plan', [4, 3], 'Top-down flat rectangular rooftop, fills canvas, no visible vertical walls or sky. Image top is the far/back edge of roof.', 'Mái nhìn thẳng từ trên; đỉnh ảnh là cạnh phía sau. Không có tường đứng hoặc bầu trời.')
    ], variants },
    faces: () => offset(boxFaces(400, 1200, 300), [0, 600, 0]).map((f, i) => mesh(f, ['front', 'side', 'side', 'front', 'roof'][i]))
  },
  {
    id: 'mesh-railing', label: 'Mesh ảnh · Lan can', category: 'decor',
    anchor: 'Origin = panel center at z = 0; handrail at y = 100. Mount at the balcony edge.',
    hint: 'Tấm song có lỗ alpha + tay vịn ngang, dùng ảnh sắt / gỗ / hoa văn',
    en: { label: 'Image mesh · Railing', hint: 'Alpha-cut baluster panel plus horizontal handrail; swap iron, wood or ornament images' },
    imageRecipe: { slots: [
      slot('panel', 'Tấm song', 'Baluster panel', [3, 1], 'Front orthographic railing panel, full width, vertical posts meet top and bottom edges. All gaps between bars have real transparent alpha; no background or handrail.', 'Song nhìn chính diện, chân/đầu song chạm mép ảnh; khoảng trống giữa song phải có alpha thật, không kèm tay vịn.'),
      slot('rail', 'Tay vịn', 'Handrail top', [15, 1], 'Top-down straight rectangular handrail, material fills the entire canvas edge to edge, no perspective.', 'Tay vịn nhìn từ trên, hình chữ nhật dài phủ kín ảnh.')
    ], variants },
    faces: () => [mesh(face('Song lan can', 600, 200, [0, 0, 0], FRONT), 'panel'),
      mesh(face('Tay vịn', 600, 40, [0, 100, 0], UP, AWAY), 'rail')]
  },
  {
    id: 'mesh-grass', label: 'Mesh ảnh · Bụi cỏ', category: 'nature',
    hint: 'Một ảnh cỏ tách nền → ba lưới giao nhau, gốc thẳng hàng',
    en: { label: 'Image mesh · Grass tuft', hint: 'One transparent grass image → three crossing meshes aligned at the roots' },
    imageRecipe: { slots: [slot('grass', 'Bụi cỏ', 'Grass tuft', [1, 1],
      'Single grass tuft front elevation, roots on bottom edge, blades point upward, 4% transparent padding at sides and top, real alpha between blades, no soil.',
      'Cỏ nhìn ngang, gốc sát mép dưới, ngọn hướng lên; alpha giữa từng lá cỏ, không kèm đất.')], variants },
    faces: () => [0, 60, 120].map((a, i) => mesh(aroundY(`Cỏ ${i + 1}`, 240, 240, a, [0, 120, 0]), 'grass'))
  },
  {
    id: 'mesh-grass-radial', label: 'Mesh ảnh · Bụi cỏ 360°', category: 'nature',
    hint: '1 ảnh phiến lá cỏ duy nhất → uốn cong mesh và tỏa tròn 360° với ngọn cao thấp, nghiêng ngửa ngẫu nhiên',
    en: { label: 'Image mesh · 360° Grass clump', hint: 'One single grass blade image → curved meshes radiating 360° with randomized height and lean' },
    imageRecipe: { slots: [grassBladeSlot], variants: grassClumpVariants },
    faces: radialGrassFaces
  }
]
