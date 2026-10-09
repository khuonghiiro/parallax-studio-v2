import { face, FRONT, type AssemblyTemplate, type TemplateFaceSpec } from '../assemblyTemplateKit'
import type { ImageMeshVariant } from '../imageMeshTypes'
import { slot, mesh, STEM_POLYGON } from './templateCommon'

export const trumpetVariants: ImageMeshVariant[] = [
  { id: 'standard', label: 'Tiêu chuẩn (phễu vừa)', en: 'Standard (medium trumpet)', scale: [1, 1, 1], bend: 1 },
  { id: 'slender', label: 'Thuôn dài / cong nhẹ', en: 'Slender / gentle flare', scale: [0.85, 1.2, 0.85], bend: 0.75 },
  { id: 'wide', label: 'Loe rộng / xoăn cánh', en: 'Wide flare / curled petals', scale: [1.25, 0.9, 1.25], bend: 1.4 }
]

export const callaVariants: ImageMeshVariant[] = [
  { id: 'standard', label: 'Tiêu chuẩn (cuộn vừa)', en: 'Standard (medium wrap)', scale: [1, 1, 1], bend: 1 },
  { id: 'slender', label: 'Thuôn dài / cuộn chặt', en: 'Slender / tight wrap', scale: [0.85, 1.2, 0.85], bend: 0.75 },
  { id: 'wide', label: 'Miệng xòe / vểnh mép', en: 'Wide flare / curled lip', scale: [1.25, 0.95, 1.25], bend: 1.35 },
  { id: 'tilted', label: 'Nghiêng duyên dáng', en: 'Graceful tilt', scale: [1.05, 1.05, 1.05], bend: 1.1 }
]

export const trumpetPetalSlot = slot(
  'petal',
  'Cánh hoa kèn',
  'Trumpet petal',
  [1, 2],
  'One isolated long trumpet lily petal, narrow base touching bottom edge at center, expanding gradually toward flared pointed tip at top center. Transparent background with 4% padding at sides; real alpha cutout, no stem or leaves.',
  'Một cánh hoa loa kèn thuôn dài hình phễu kèn, gốc hẹp ở mép dưới, ngọn xòe rộng ở trên; ảnh dùng chung cho sáu cánh xếp thành loa kèn 3D.'
)

export const stamenSlot = slot(
  'stamen',
  'Nhụy hoa kèn',
  'Lily stamens',
  [1, 2],
  'Cluster of slender flower stamens and pistil, narrow stalks emerging from bottom, pollen anthers clustered near top, transparent background.',
  'Chùm nhụy hoa loa kèn dài vươn ra từ đáy hoa, đầu nhụy phấn vàng; ngoài nhụy trong suốt.'
)

export const spatheSlot = slot(
  'spathe',
  'Cánh mo hoa rum',
  'Calla spathe',
  [2, 3],
  'One isolated white calla lily spathe, elegant rolled funnel petal, broad flared lip with sharp asymmetric tip at top, narrow coiled base touching bottom center. Transparent background with 4% padding; real alpha cutout, no stem or spadix.',
  'Một cánh mo hoa rum trắng trải phẳng, gốc cuộn ở mép dưới, ngọn xòe rộng với mũi nhọn bất đối xứng ở đỉnh; cuốn thành phễu hoa 3D duyên dáng.'
)

export const spadixSlot = slot(
  'spadix',
  'Trụ nhụy hoa rum',
  'Calla spadix',
  [1, 4],
  'One isolated upright golden-yellow cylindrical spadix for calla lily, textured surface with pollen grains, rounded tip at top, base touching bottom edge. Transparent background; real alpha cutout.',
  'Một trụ nhụy hoa rum màu vàng thuôn dài thẳng đứng, bề mặt hạt phấn mịn, đáy ở mép dưới, đỉnh tròn ở trên; đặt vươn ra từ trung tâm phễu hoa.'
)

export const stemSlot = slot(
  'stem',
  'Thân cành',
  'Stem',
  [1, 10],
  'Straight vertical plant stem, same width throughout, top and bottom ends touch canvas edges, transparent sides, no leaves.',
  'Thân thẳng đứng chạm mép trên/dưới, hai bên trong suốt, không kèm lá.'
)

/** Viền mesh cánh hoa loa kèn chuẩn: gốc thon hẹp, phình đều qua họng kèn, đỉnh xòe nhọn */
export const TRUMPET_PETAL_POLYGON: Array<[number, number]> = [
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
export const TRUMPET_STAMEN_POLYGON: Array<[number, number]> = [
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
 * Viền mesh cánh mo Calla Lily (bất đối xứng tự nhiên):
 * Cuống thon hẹp ở đáy, bụng trái xòe vòng cung mềm mại,
 * mép phải uốn lượn và mũi nhọn cao vút vểnh nhẹ ở đỉnh bên trái tâm.
 */
export const CALLA_SPATHE_POLYGON: Array<[number, number]> = [
  [0.44, 0.0],
  [0.56, 0.0],
  [0.70, 0.15],
  [0.86, 0.35],
  [0.96, 0.60],
  [0.92, 0.82],
  [0.75, 0.94],
  [0.56, 0.98],
  [0.46, 1.0], // Mũi nhọn vút cao bất đối xứng
  [0.38, 0.94],
  [0.22, 0.85],
  [0.10, 0.68],
  [0.06, 0.45],
  [0.14, 0.25],
  [0.28, 0.12]
]

/** Viền mesh trụ nhụy Spadix: hình trụ thuôn dài, đỉnh bo tròn */
export const CALLA_SPADIX_POLYGON: Array<[number, number]> = [
  [0.36, 0.0],
  [0.64, 0.0],
  [0.66, 0.40],
  [0.68, 0.82],
  [0.62, 0.94],
  [0.50, 1.0],
  [0.38, 0.94],
  [0.32, 0.82],
  [0.34, 0.40]
]

export function trumpetFlowerFaces(): TemplateFaceSpec[] {
  // Trục phễu hoa loa kèn nghiêng 20° ngước lên và hướng về phía trước (-Z)
  const tiltDeg = 20
  const tiltRad = (tiltDeg * Math.PI) / 180
  const cosT = Math.cos(tiltRad)
  const sinT = Math.sin(tiltRad)

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
  const coneAngleRad = Math.atan2(72 - 18, funnelLength)
  const cosCone = Math.cos(coneAngleRad)
  const sinCone = Math.sin(coneAngleRad)

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

export function callaLilyFaces(): TemplateFaceSpec[] {
  // Trục phễu hoa rum nghiêng 18° ngước lên và hướng về phía trước (-Z)
  const tiltDeg = 18
  const tiltRad = (tiltDeg * Math.PI) / 180
  const cosT = Math.cos(tiltRad)
  const sinT = Math.sin(tiltRad)

  const axis: [number, number, number] = [0, sinT, -cosT]
  const yCross: [number, number, number] = [0, cosT, sinT]

  const baseP: [number, number, number] = [0, 40, 75]
  const funnelHeight = 360

  // Tâm phễu cánh mo
  const spatheCenter: [number, number, number] = [
    baseP[0] + axis[0] * (funnelHeight * 0.45),
    baseP[1] + axis[1] * (funnelHeight * 0.45),
    baseP[2] + axis[2] * (funnelHeight * 0.45)
  ]

  // Cánh mo: cuốn ôm quanh trục phễu với arcAngle=280 và taperRatio=1.75
  const spathe = mesh(
    face('Cánh mo hoa rum', 240, funnelHeight, spatheCenter, yCross, axis, {
      arcAngle: 280,
      taperRatio: 1.75,
      bendY: -32,
      bendLateral: 16,
      bendRegion: 'top',
      silhouettePolygon: CALLA_SPATHE_POLYGON
    }),
    'spathe',
    'ridge',
    12
  )

  // Trụ nhụy Spadix đặt trong lòng phễu, vươn thẳng theo trục hoa
  const spadixHeight = 160
  const spadixCenter: [number, number, number] = [
    baseP[0] + axis[0] * (spadixHeight * 0.55),
    baseP[1] + axis[1] * (spadixHeight * 0.55),
    baseP[2] + axis[2] * (spadixHeight * 0.55)
  ]
  const spadix = mesh(
    face('Trụ nhụy vàng', 40, spadixHeight, spadixCenter, yCross, axis, {
      arcAngle: 180,
      silhouettePolygon: CALLA_SPADIX_POLYGON
    }),
    'spadix',
    'ridge',
    14
  )

  // Thân cành nối từ dưới lên khớp với đáy cuống hoa tại baseP
  const stem = mesh(
    face('Thân cành', 38, 380, [0, -130, 95], FRONT, [0, 0.98, -0.2], {
      silhouettePolygon: STEM_POLYGON
    }),
    'stem'
  )

  return [stem, spathe, spadix]
}

export const TRUMPET_FLOWER_TEMPLATE: AssemblyTemplate = {
  id: 'mesh-trumpet-flower',
  label: 'Mesh ảnh · Hoa loa kèn',
  category: 'nature',
  hint: '3 ảnh: cánh kèn, nhụy, thân → cánh loe hình phễu 3D, miệng kèn vểnh 360°',
  en: {
    label: 'Image mesh · Trumpet lily',
    hint: '3 images: trumpet petal, stamen, stem → 3D flared funnel with outward-curling petals'
  },
  imageRecipe: {
    slots: [trumpetPetalSlot, stamenSlot, stemSlot],
    variants: trumpetVariants
  },
  faces: trumpetFlowerFaces
}

export const CALLA_LILY_TEMPLATE: AssemblyTemplate = {
  id: 'mesh-calla-lily',
  label: 'Mesh ảnh · Hoa rum (Calla lily)',
  category: 'nature',
  hint: '3 ảnh: cánh mo, trụ nhụy, thân → một cánh mo phễu cuộn bất đối xứng và nhụy trụ vàng 3D',
  en: {
    label: 'Image mesh · Calla lily',
    hint: '3 images: spathe, spadix, stem → elegant asymmetric rolled funnel spathe and 3D golden spadix'
  },
  imageRecipe: {
    slots: [spatheSlot, spadixSlot, stemSlot],
    variants: callaVariants
  },
  faces: callaLilyFaces
}
