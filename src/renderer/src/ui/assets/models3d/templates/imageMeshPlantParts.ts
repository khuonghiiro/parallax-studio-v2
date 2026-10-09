import { face, FRONT, UP, AWAY, boxFaces, aroundY, offset, type AssemblyTemplate, type TemplateFaceSpec } from '../assemblyTemplateKit'
import { slot, mesh, standardVariants, LEAF_POLYGON } from './templateCommon'

export { LEAF_POLYGON }

export const leafSlot = slot(
  'leaf',
  'Phiến lá',
  'Leaf blade',
  [1, 2],
  'One flattened leaf, top surface facing camera, central vein vertical at x=50%, tip at top center, petiole at bottom center. Entire leaf within 4% transparent padding; no stem branch or pot.',
  'Lá trải phẳng nhìn từ trên, gân giữa thẳng đứng; đầu lá ở trên, cuống ở dưới, chừa 4% viền alpha. Thay ảnh để đổi loài lá.'
)

function potFaces(): TemplateFaceSpec[] {
  return boxFaces(260, 240, 260, { top: false, bottom: true }).map((f, i) =>
    mesh(f, i === 4 ? 'bottom' : 'pot')
  )
}

export const LEAF_TEMPLATE: AssemblyTemplate = {
  id: 'mesh-leaf',
  label: 'Mesh ảnh · Lá cây',
  category: 'nature',
  hint: 'Một ảnh lá → lưới bám viền alpha, gân nổi và mặt lá uốn cong',
  en: {
    label: 'Image mesh · Leaf',
    hint: 'One leaf image → alpha contour mesh, raised midrib and curved blade'
  },
  imageRecipe: { slots: [leafSlot], variants: standardVariants },
  faces: () => [
    mesh(
      face('Phiến lá', 240, 480, [0, 0, 0], FRONT, undefined, {
        bendY: 22,
        silhouettePolygon: LEAF_POLYGON
      }),
      'leaf',
      'ridge',
      12
    )
  ]
}

export const PLANTER_TEMPLATE: AssemblyTemplate = {
  id: 'mesh-planter',
  label: 'Mesh ảnh · Chậu cây',
  category: 'nature',
  hint: 'Chậu vuông kín đáy + đất + lá nhiều hướng; 4 ảnh tái sử dụng cho 10 mặt',
  en: {
    label: 'Image mesh · Planter',
    hint: 'Square planter with base, soil and multi-angle leaves; 4 images for 10 faces'
  },
  imageRecipe: {
    slots: [
      slot(
        'pot',
        'Vách chậu',
        'Planter wall',
        [13, 12],
        'Flat square planter wall elevation, rectangular surface fills canvas edge to edge, straight horizontal rim at top. No perspective or other walls.',
        'Một vách chậu vuông nhìn thẳng, phủ kín canvas; mép chậu nằm ngang phía trên. Dùng lại cho bốn vách.'
      ),
      slot(
        'bottom',
        'Đáy chậu',
        'Planter bottom',
        [1, 1],
        'Flat square underside of planter, fills canvas edge to edge.',
        'Đáy chậu vuông nhìn vuông góc, phủ kín ảnh.'
      ),
      slot(
        'soil',
        'Mặt đất',
        'Soil surface',
        [1, 1],
        'Top-down square soil patch filling entire canvas, no pot rim or plant.',
        'Đất nhìn từ trên, kín ảnh vuông; không vẽ lại vành chậu hoặc cây.'
      ),
      leafSlot
    ],
    variants: standardVariants
  },
  faces: () => [
    ...potFaces(),
    mesh(face('Đất', 250, 250, [0, 108, 130], UP, AWAY), 'soil'),
    ...Array.from({ length: 4 }, (_, i) =>
      mesh(
        {
          ...aroundY(`Lá ${i + 1}`, 120, 240, i * 90, [0, 230, 130]),
          bendY: 28,
          silhouettePolygon: LEAF_POLYGON
        },
        'leaf',
        'ridge',
        10
      )
    )
  ]
}

export const HIGHRISE_TEMPLATE: AssemblyTemplate = {
  id: 'mesh-highrise',
  label: 'Mesh ảnh · Nhà cao tầng',
  category: 'architecture',
  hint: '4 mặt đứng + mái, ảnh mặt tiền và hông phải khớp cao độ các tầng',
  en: {
    label: 'Image mesh · High-rise',
    hint: '4 elevations and roof; match floor heights across front and side images'
  },
  imageRecipe: {
    slots: [
      slot(
        'front',
        'Mặt trước / sau',
        'Front / back elevation',
        [1, 3],
        'Orthographic high-rise front elevation, 12 floors at equal intervals, rectangular facade fills canvas, roofline at top and ground at bottom, no visible side or roof.',
        'Mặt tiền thẳng 12 tầng đều nhau, kín khung; đỉnh mái ở trên, chân nhà ở dưới. Dùng lại phía sau.'
      ),
      slot(
        'side',
        'Mặt hông',
        'Side elevation',
        [1, 4],
        'Orthographic side elevation of the same 12-floor building, same floor heights and materials as front, rectangular wall fills canvas; no perspective.',
        'Mặt hông thẳng, cùng 12 tầng và cao độ với mặt tiền; kín khung, không phối cảnh.'
      ),
      slot(
        'roof',
        'Mái bằng',
        'Roof plan',
        [4, 3],
        'Top-down flat rectangular rooftop, fills canvas, no visible vertical walls or sky. Image top is the far/back edge of roof.',
        'Mái nhìn thẳng từ trên; đỉnh ảnh là cạnh phía sau. Không có tường đứng hoặc bầu trời.'
      )
    ],
    variants: standardVariants
  },
  faces: () =>
    offset(boxFaces(400, 1200, 300), [0, 600, 0]).map((f, i) =>
      mesh(f, ['front', 'side', 'side', 'front', 'roof'][i])
    )
}

export const RAILING_TEMPLATE: AssemblyTemplate = {
  id: 'mesh-railing',
  label: 'Mesh ảnh · Lan can',
  category: 'decor',
  anchor: 'Origin = panel center at z = 0; handrail at y = 100. Mount at the balcony edge.',
  hint: 'Tấm song có lỗ alpha + tay vịn ngang, dùng ảnh sắt / gỗ / hoa văn',
  en: {
    label: 'Image mesh · Railing',
    hint: 'Alpha-cut baluster panel plus horizontal handrail; swap iron, wood or ornament images'
  },
  imageRecipe: {
    slots: [
      slot(
        'panel',
        'Tấm song',
        'Baluster panel',
        [3, 1],
        'Front orthographic railing panel, full width, vertical posts meet top and bottom edges. All gaps between bars have real transparent alpha; no background or handrail.',
        'Song nhìn chính diện, chân/đầu song chạm mép ảnh; khoảng trống giữa song phải có alpha thật, không kèm tay vịn.'
      ),
      slot(
        'rail',
        'Tay vịn',
        'Handrail top',
        [15, 1],
        'Top-down straight rectangular handrail, material fills the entire canvas edge to edge, no perspective.',
        'Tay vịn nhìn từ trên, hình chữ nhật dài phủ kín ảnh.'
      )
    ],
    variants: standardVariants
  },
  faces: () => [
    mesh(face('Song lan can', 600, 200, [0, 0, 0], FRONT), 'panel'),
    mesh(face('Tay vịn', 600, 40, [0, 100, 0], UP, AWAY), 'rail')
  ]
}

export const PLANT_PARTS_TEMPLATES: AssemblyTemplate[] = [
  LEAF_TEMPLATE,
  PLANTER_TEMPLATE,
  HIGHRISE_TEMPLATE,
  RAILING_TEMPLATE
]
