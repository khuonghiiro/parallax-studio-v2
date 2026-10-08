import { face, FRONT, UP, AWAY, boxFaces, aroundY, offset, type AssemblyTemplate, type TemplateFaceSpec } from './assemblyTemplateKit'
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

function flowerFaces(): TemplateFaceSpec[] {
  const petals = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3
    return mesh(face(`Cánh ${i + 1}`, 160, 240,
      [Math.sin(a) * 120, 150 + Math.cos(a) * 120, 0], FRONT,
      [Math.sin(a), Math.cos(a), 0], { bendY: 24, bendRegion: 'top' }), 'petal', 'ridge', 8)
  })
  return [mesh(face('Thân', 40, 400, [0, -50, 12], FRONT), 'stem'), ...petals,
    mesh(face('Nhụy', 100, 100, [0, 150, -12], FRONT), 'center', 'sphere', 18)]
}

function trumpetFlowerFaces(): TemplateFaceSpec[] {
  const petals = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3
    const deg = i * 60
    const rMid = 85
    const sinA = Math.sin(a)
    const cosA = Math.cos(a)
    const up: [number, number, number] = [sinA * 0.42, 0.72 + cosA * 0.32, -0.55 + cosA * 0.28]
    const upLen = Math.hypot(up[0], up[1], up[2])
    const normUp: [number, number, number] = [up[0] / upLen, up[1] / upLen, up[2] / upLen]
    const n: [number, number, number] = [sinA * 0.85, cosA * 0.65, -0.45]
    const nLen = Math.hypot(n[0], n[1], n[2])
    const normN: [number, number, number] = [n[0] / nLen, n[1] / nLen, n[2] / nLen]
    const c: [number, number, number] = [sinA * rMid, 160 + cosA * (rMid * 0.65), 10 + cosA * (rMid * 0.65)]
    return mesh(face(`Cánh kèn ${i + 1} (${deg}°)`, 130, 260, c, normN, normUp, {
      bendX: 42,
      bendY: -36,
      bendRegion: 'top'
    }), 'petal', 'ridge', 12)
  })
  return [
    mesh(face('Thân cành', 40, 400, [0, -90, 80], FRONT), 'stem'),
    ...petals,
    mesh(face('Nhụy hoa kèn', 80, 160, [0, 160, -10], FRONT, [0, 0.85, -0.52], {
      bendY: 18,
      bendRegion: 'top'
    }), 'stamen', 'ridge', 14)
  ]
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
}

const GRASS_BLADES: GrassBladeSpec[] = [
  // 4 lá non ở tâm: cao, vươn thẳng (h=300..350, tilt=8°..11°)
  { name: 'Lá cỏ tâm 1', deg: 20, w: 70, h: 350, tilt: 8, radius: 10, bendY: 20, bendX: 20 },
  { name: 'Lá cỏ tâm 2', deg: 110, w: 60, h: 300, tilt: 10, radius: 12, bendY: 24, bendX: 22 },
  { name: 'Lá cỏ tâm 3', deg: 200, w: 70, h: 350, tilt: 9, radius: 11, bendY: 21, bendX: 20 },
  { name: 'Lá cỏ tâm 4', deg: 290, w: 60, h: 300, tilt: 11, radius: 12, bendY: 25, bendX: 22 },

  // 5 lá tầm trung: uốn lượn tỏa vừa (h=250, tilt=23°..28°)
  { name: 'Lá cỏ vừa 1', deg: 55, w: 50, h: 250, tilt: 24, radius: 26, bendY: 36, bendX: 22 },
  { name: 'Lá cỏ vừa 2', deg: 145, w: 50, h: 250, tilt: 27, radius: 28, bendY: 40, bendX: 24 },
  { name: 'Lá cỏ vừa 3', deg: 235, w: 50, h: 250, tilt: 23, radius: 25, bendY: 35, bendX: 22 },
  { name: 'Lá cỏ vừa 4', deg: 325, w: 50, h: 250, tilt: 28, radius: 29, bendY: 41, bendX: 24 },
  { name: 'Lá cỏ vừa 5', deg: 185, w: 50, h: 250, tilt: 25, radius: 27, bendY: 37, bendX: 23 },

  // 5 lá ngoài cùng: già hơn, ngả thấp uốn rủ sát đất (h=175..200, tilt=42°..50°)
  { name: 'Lá cỏ ngoài 1', deg: 0, w: 40, h: 200, tilt: 44, radius: 46, bendY: 50, bendX: 24 },
  { name: 'Lá cỏ ngoài 2', deg: 80, w: 35, h: 175, tilt: 48, radius: 48, bendY: 54, bendX: 25 },
  { name: 'Lá cỏ ngoài 3', deg: 165, w: 40, h: 200, tilt: 42, radius: 45, bendY: 48, bendX: 24 },
  { name: 'Lá cỏ ngoài 4', deg: 255, w: 35, h: 175, tilt: 50, radius: 50, bendY: 56, bendX: 26 },
  { name: 'Lá cỏ ngoài 5', deg: 340, w: 40, h: 200, tilt: 46, radius: 47, bendY: 52, bendX: 25 }
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
      bendRegion: 'top'
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
    faces: () => [mesh(face('Phiến lá', 240, 480, [0, 0, 0], FRONT, undefined, { bendY: 22 }), 'leaf', 'ridge', 12)]
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
      ...Array.from({ length: 4 }, (_, i) => mesh({ ...aroundY(`Lá ${i + 1}`, 120, 240, i * 90, [0, 230, 130]), bendY: 28 }, 'leaf', 'ridge', 10))]
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
