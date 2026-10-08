import type { Vec3 } from './assemblyGeometry'
import {
  AWAY,
  BACK,
  DEG,
  FRONT,
  LEFT,
  RIGHT,
  UP,
  aroundY,
  awning,
  boxFaces,
  face,
  prismFaces,
  ridgeSlopes,
  tilted,
  curvedCylinderFaces,
  taperedConeFaces,
  type AssemblyTemplate
} from './assemblyTemplateKit'
import { HOUSE_SHELLS } from './assemblyTemplatesShells'
import { DECOR_PARTS, EXTRA_PROPS } from './assemblyTemplatesDecor'

/**
 * Geometry-only template catalogue for the Assembly workshop (see assemblyTemplateKit.ts
 * for the conventions). Building templates are *shells only* (walls + roof); windows,
 * doors, chimneys, columns, plants… live in the `decor` category so they can be built as
 * separate 3D assets and merged onto a shell afterwards.
 */
export { TEMPLATE_CATEGORIES } from './assemblyTemplateKit'
export type { AssemblyTemplate, TemplateCategory, TemplateFaceSpec } from './assemblyTemplateKit'

const architecture: AssemblyTemplate[] = [
  {
    id: 'gable-house', label: 'Khung nhà mái chữ A', category: 'architecture',
    hint: 'Chỉ khung: 2 mặt đầu hồi + 2 vách + 2 mái dốc (trang trí ghép riêng)',
    en: { label: 'Gable house shell', hint: 'Shell only: 2 gable ends + 2 side walls + 2 roof slopes (add decor separately)' },
    faces: () => {
      const W = 600, H = 400, D = 600, R = 260
      return [
        face('Mặt trước', W, H + R, [0, R / 2, 0], FRONT),
        face('Mặt sau', W, H + R, [0, R / 2, D], BACK),
        face('Vách trái', D, H, [-W / 2, 0, D / 2], LEFT),
        face('Vách phải', D, H, [W / 2, 0, D / 2], RIGHT),
        ...ridgeSlopes(W, R, D, H / 2, 30)
      ]
    }
  },
  {
    id: 'flat-house', label: 'Khung nhà mái bằng', category: 'architecture',
    hint: 'Hộp 4 vách + mái phẳng',
    en: { label: 'Flat-roof house shell', hint: 'Box of 4 walls + flat roof' },
    faces: () => boxFaces(600, 450, 500)
  },
  {
    id: 'shop-awning', label: 'Cửa hiệu mái hiên', category: 'architecture',
    hint: 'Hộp nhà + mái hiên nghiêng phía trước',
    en: { label: 'Shop with awning', hint: 'House box + sloped awning at the front' },
    faces: () => [...boxFaces(600, 450, 450, { back: false }), awning('Mái hiên', 640, 170, 175, 0, 28)]
  },
  {
    id: 'tower-8', label: 'Tháp bát giác', category: 'architecture',
    hint: 'Lăng trụ 8 mặt – xoay quanh trông như khối tròn',
    en: { label: 'Octagonal tower', hint: '8-sided prism – reads as round when orbiting' },
    faces: () => prismFaces(8, 260, 620)
  },
  {
    id: 'gate', label: 'Cổng chào', category: 'architecture',
    hint: '2 trụ + bảng tên + mái cổng',
    en: { label: 'Welcome gate', hint: '2 pillars + name board + gate roof' },
    faces: () => [
      face('Trụ trái', 110, 520, [-280, 0, 0], FRONT),
      face('Trụ phải', 110, 520, [280, 0, 0], FRONT),
      face('Bảng tên', 760, 150, [0, 300, -10], FRONT),
      awning('Mái cổng', 840, 170, 455, 60, 22)
    ]
  },
  {
    id: 'stairs', label: 'Bậc thang', category: 'architecture',
    hint: '4 bậc: mặt đứng + mặt bậc',
    en: { label: 'Stairs', hint: '4 steps: risers + treads' },
    faces: () => {
      const W = 500, h = 90, d = 110, y0 = -180
      return Array.from({ length: 4 }, (_, k) => [
        face(`Bậc ${k + 1} đứng`, W, h, [0, y0 + h * (k + 0.5), d * k], FRONT),
        face(`Bậc ${k + 1} mặt`, W, d, [0, y0 + h * (k + 1), d * k + d / 2], UP, AWAY)
      ]).flat()
    }
  },
  {
    id: 'pyramid', label: 'Kim tự tháp', category: 'architecture',
    hint: '4 mặt nghiêng chụm đỉnh (dùng ảnh tam giác)',
    en: { label: 'Pyramid', hint: '4 slanted faces meeting at the apex (use triangular images)' },
    faces: () => {
      const B = 500, H = 400
      const apex: Vec3 = [0, H / 2, B / 2]
      return [0, 90, 180, 270].map((deg, i) => {
        const a = deg * DEG
        const d: Vec3 = [Math.sin(a), 0, -Math.cos(a)]
        const mid: Vec3 = [d[0] * (B / 2), -H / 2, B / 2 + d[2] * (B / 2)]
        const slant = Math.hypot(H, B / 2)
        const up: Vec3 = [(apex[0] - mid[0]) / slant, (apex[1] - mid[1]) / slant, (apex[2] - mid[2]) / slant]
        const nLen = Math.hypot(H, B / 2)
        const n: Vec3 = [(d[0] * H) / nLen, B / 2 / nLen, (d[2] * H) / nLen]
        const c: Vec3 = [(mid[0] + apex[0]) / 2, (mid[1] + apex[1]) / 2, (mid[2] + apex[2]) / 2]
        return face(`Mặt ${i + 1}`, B, slant, c, n, up)
      })
    }
  },
  {
    id: 'tent', label: 'Lều chữ A', category: 'architecture',
    hint: '2 mái chạm đất + cửa lều + vách sau',
    en: { label: 'A-frame tent', hint: '2 slopes touching the ground + entrance + back wall' },
    faces: () => [
      face('Cửa lều', 500, 360, [0, 0, 0], FRONT),
      face('Vách sau', 500, 360, [0, 0, 600], BACK),
      ...ridgeSlopes(500, 360, 600, -180)
    ]
  }
]

const props: AssemblyTemplate[] = [
  {
    id: 'box', label: 'Hộp kín 6 mặt', category: 'props', hint: 'Khối hộp khép kín',
    en: { label: 'Closed 6-sided box', hint: 'Fully closed box' },
    faces: () => boxFaces(500, 500, 500, { bottom: true })
  },
  {
    id: 'chest-open', label: 'Rương mở nắp', category: 'props', hint: 'Hộp 4 vách + nắp bản lề mở 105°',
    en: { label: 'Open chest', hint: '4-wall box + lid hinged open at 105°' },
    faces: () => {
      const W = 500, H = 320, D = 340, a = 105 * DEG
      const dir: Vec3 = [0, Math.sin(a), -Math.cos(a)]
      const lid = face('Nắp', W, D, [0, H / 2 + dir[1] * (D / 2), D + dir[2] * (D / 2)], [0, Math.cos(a), Math.sin(a)], [0, -dir[1], -dir[2]])
      return [...boxFaces(W, H, D, { top: false }), lid]
    }
  },
  {
    id: 'popup-card', label: 'Thiệp pop-up', category: 'props', hint: 'Nền + lưng + 2 lớp pop-up xếp chiều sâu',
    en: { label: 'Pop-up card', hint: 'Base + back + 2 pop-up layers stacked in depth' },
    faces: () => [
      face('Nền', 600, 400, [0, -150, 200], UP, AWAY),
      face('Lưng', 600, 400, [0, 50, 400], FRONT),
      face('Lớp giữa', 360, 260, [0, -20, 200], FRONT),
      face('Lớp trước', 480, 140, [0, -80, 60], FRONT)
    ]
  },
  {
    id: 'folding-screen', label: 'Bình phong 3 tấm', category: 'props', hint: '3 tấm gấp khúc hướng về người xem',
    en: { label: '3-panel folding screen', hint: '3 zig-zag panels facing the viewer' },
    faces: () => {
      const pw = 260, ph = 480, b = 30 * DEG
      const side = (s: -1 | 1, name: string) =>
        face(name, pw, ph, [s * (pw / 2 + Math.cos(b) * (pw / 2)), 0, -Math.sin(b) * (pw / 2)], [-s * Math.sin(b), 0, -Math.cos(b)])
      return [side(-1, 'Tấm trái'), face('Tấm giữa', pw, ph, [0, 0, 0], FRONT), side(1, 'Tấm phải')]
    }
  },
  {
    id: 'standee', label: 'Standee chân đế', category: 'props', hint: 'Bảng đứng nghiêng + đế + thanh chống',
    en: { label: 'Standee with base', hint: 'Slightly tilted board + base + back strut' },
    faces: () => {
      const strutLen = Math.hypot(450, 120)
      return [
        tilted('Bảng', 400, 600, [0, 0, 0], 8),
        face('Đế', 420, 180, [0, -300, 50], UP, AWAY),
        face('Thanh chống', 120, strutLen, [0, -75, 90], [0, 120 / strutLen, 450 / strutLen], [0, 450 / strutLen, -120 / strutLen])
      ]
    }
  },
  {
    id: 'lantern-6', label: 'Đèn lồng lục giác', category: 'props', hint: 'Lăng trụ 6 mặt',
    en: { label: 'Hexagonal lantern', hint: '6-sided prism' },
    faces: () => prismFaces(6, 150, 300)
  },
  {
    id: 'curved-pillar', label: 'Thân trụ cong', category: 'props', hint: '2 mặt uốn cong úp vào nhau thành khối tròn',
    en: { label: 'Curved pillar', hint: '2 bent faces closing into a round body' },
    faces: () => [
      face('Nửa trước', 400, 600, [0, 0, 0], FRONT, undefined, { bendX: 100 }),
      face('Nửa sau', 400, 600, [0, 0, 0], BACK, undefined, { bendX: 100 })
    ]
  },
  {
    id: 'cylinder-round', label: 'Ống trụ tròn 360°', category: 'props', hint: '4 mặt uốn cong trụ tròn ghép hít mép tạo thành cột tròn / ống trụ 360°',
    en: { label: '360° Round cylinder tube', hint: '4 bent curved faces meeting at side edges to form a seamless 360° round column or pipe' },
    faces: () => curvedCylinderFaces(180, 500, 4, 55, 'Mảnh cong trụ')
  },
  {
    id: 'cone-tapered', label: 'Ống trụ nhọn / Thân cây côn 3D', category: 'props', hint: '4 mặt uốn cong thuôn đỉnh ghép thành ống côn nhọn / thân cây 3D',
    en: { label: '360° Tapered cone / trunk', hint: '4 bent curved faces tilted inward to form a seamless 360° tapered cone, trunk, or spire' },
    faces: () => taperedConeFaces(180, 70, 520, 4, 55, 'Vách côn nhọn')
  },
  {
    id: 'signpost', label: 'Biển hiệu có cột', category: 'props', hint: 'Bảng 2 mặt + cột chữ thập',
    en: { label: 'Signpost', hint: 'Double-sided board + cross-shaped post' },
    faces: () => [
      face('Bảng trước', 600, 300, [0, 150, 0], FRONT),
      face('Bảng sau', 600, 300, [0, 150, 0], BACK),
      face('Cột', 60, 500, [0, -250, 0], FRONT),
      face('Cột ngang', 60, 500, [0, -250, 0], RIGHT)
    ]
  }
]

const nature: AssemblyTemplate[] = [
  {
    id: 'tree-cross', label: 'Cây tán đa hướng thể tích', category: 'nature', hint: '4 mặt đứng xoay góc 45° + thân cây trụ + 2 tầng đĩa vòm tán tròn đầy',
    en: { label: 'Volumetric multi-angle tree', hint: '4-way standing planes + trunk + 2 dome canopy discs, looking realistic from all angles' },
    faces: () => [
      // Thân cây chính tạo gốc vững chãi
      aroundY('Thân cây trước', 120, 360, 0, [0, -180, 0]),
      aroundY('Thân cây ngang', 120, 360, 90, [0, -180, 0]),
      // 4 Mặt tán lá xoay đều 4 hướng (0°, 45°, 90°, 135°)
      aroundY('Tán chính (0°)', 520, 600, 0, [0, 80, 0]),
      aroundY('Tán chéo 1 (45°)', 500, 580, 45, [0, 80, 0]),
      aroundY('Tán ngang (90°)', 520, 600, 90, [0, 80, 0]),
      aroundY('Tán chéo 2 (135°)', 500, 580, 135, [0, 80, 0]),
      // 2 Tầng đĩa vòm tán ngang che góc nhìn từ trên xuống
      face('Tán vòm giữa', 460, 460, [0, 60, 0], UP, AWAY, { bendX: 30, bendY: 30 }),
      face('Tán vòm ngọn', 360, 360, [0, 240, 0], UP, AWAY, { bendX: 45, bendY: 45 })
    ]
  },
  {
    id: 'bush-3', label: 'Bụi cây đa cụm tự nhiên', category: 'nature', hint: '5 cụm lá đan xen: cụm trung tâm, 2 cụm lệch bên, nền sau và vòm che nóc',
    en: { label: 'Volumetric bush cluster', hint: '5 staggered foliage clumps: center, left/right offset, back ground and top canopy dome' },
    faces: () => [
      face('Cụm chính giữa', 460, 380, [0, 0, 0], FRONT, undefined, { bendX: 25 }),
      aroundY('Cụm lệch trái', 400, 340, -35, [-110, -20, 40]),
      aroundY('Cụm lệch phải', 400, 340, 35, [110, -20, 40]),
      face('Cụm nền sau', 500, 400, [0, 30, 90], BACK, undefined, { bendX: -20 }),
      face('Nóc vòm bụi', 420, 320, [0, 130, 40], UP, AWAY, { bendX: 40, bendY: 20 })
    ]
  },
  {
    id: 'foliage-layers', label: 'Tán lá nhiều lớp', category: 'nature', hint: '4 lớp so le chiều sâu cho parallax mượt',
    en: { label: 'Layered foliage', hint: '4 staggered depth layers for smooth parallax' },
    faces: () => [
      face('Lớp 1 (trước)', 420, 300, [-120, -60, 0], FRONT),
      face('Lớp 2', 460, 360, [140, -20, 80], FRONT),
      face('Lớp 3', 520, 420, [-40, 20, 160], FRONT),
      face('Lớp 4 (sau)', 600, 480, [60, 60, 240], FRONT)
    ]
  },
  {
    id: 'ground-patch', label: 'Thảm cỏ có viền', category: 'nature', hint: 'Mặt đất + viền cỏ trước + bụi phía sau',
    en: { label: 'Grass patch with edge', hint: 'Ground + front grass edge + bushes behind' },
    faces: () => [
      face('Mặt đất', 800, 600, [0, -150, 300], UP, AWAY),
      face('Viền trước', 800, 120, [0, -100, 0], FRONT),
      face('Bụi sau', 800, 260, [0, -30, 600], FRONT)
    ]
  },
  {
    id: 'flower-patch', label: 'Thảm hoa sân vườn', category: 'nature', hint: 'Mặt đất nền + các khóm hoa xòe nhiều hướng phía trước và xung quanh',
    en: { label: 'Garden flower patch', hint: 'Ground base + multi-directional blooming flower clumps' },
    faces: () => [
      face('Mặt đất nền', 700, 500, [0, -100, 200], UP, AWAY),
      face('Cụm hoa trước', 500, 180, [0, -30, 50], FRONT, undefined, { bendX: 15 }),
      aroundY('Cụm hoa trái', 360, 200, -30, [-160, -10, 180]),
      aroundY('Cụm hoa phải', 360, 200, 30, [160, -10, 180]),
      face('Cụm hoa sau', 620, 240, [0, 40, 320], FRONT)
    ]
  },
  {
    id: 'hedge', label: 'Bờ rào cây bụi uốn mềm', category: 'nature', hint: 'Hàng rào bụi cây bo cong các góc, mặt trên lượn sóng tự nhiên',
    en: { label: 'Curved hedge row', hint: 'Smooth rounded bush hedge with curved top and rounded ends' },
    faces: () => [
      face('Mặt trước', 680, 220, [0, 0, 0], FRONT, undefined, { bendX: 20 }),
      face('Mặt sau', 680, 220, [0, 0, 160], BACK, undefined, { bendX: 20 }),
      face('Đầu trái', 160, 220, [-340, 0, 80], LEFT, undefined, { bendX: 30 }),
      face('Đầu phải', 160, 220, [340, 0, 80], RIGHT, undefined, { bendX: 30 }),
      face('Vòm nóc', 680, 160, [0, 110, 80], UP, AWAY, { bendY: 50 })
    ]
  }
]

const stage: AssemblyTemplate[] = [
  {
    id: 'room-open', label: 'Phòng mở 3 vách', category: 'stage', hint: 'Sàn + tường sau + 2 tường bên nhìn vào trong',
    en: { label: 'Open 3-wall room', hint: 'Floor + back wall + 2 side walls facing inward' },
    faces: () => {
      const W = 700, H = 500, D = 600
      return [
        face('Sàn', W, D, [0, -H / 2, D / 2], UP, AWAY),
        face('Tường sau', W, H, [0, 0, D], FRONT),
        face('Tường trái', D, H, [-W / 2, 0, D / 2], RIGHT),
        face('Tường phải', D, H, [W / 2, 0, D / 2], LEFT)
      ]
    }
  },
  {
    id: 'street-corner', label: 'Góc phố chữ L', category: 'stage', hint: '2 vách vuông góc + vỉa hè',
    en: { label: 'L-shaped street corner', hint: '2 perpendicular facades + sidewalk' },
    faces: () => [
      face('Vách trước', 600, 600, [0, 0, 0], FRONT),
      face('Vách hông', 600, 600, [-300, 0, 300], LEFT),
      face('Vỉa hè', 900, 900, [0, -300, 300], UP, AWAY)
    ]
  },
  {
    id: 'cyclorama', label: 'Phông nền bo cong', category: 'stage', hint: 'Sàn + góc bo 45° + phông đứng (studio vô cực)',
    en: { label: 'Cyclorama backdrop', hint: 'Floor + 45° cove + upright backdrop (infinity studio)' },
    faces: () => {
      const c45 = Math.SQRT1_2, cove = 200
      return [
        face('Sàn', 900, 500, [0, -250, 250], UP, AWAY),
        face('Góc bo', 900, cove, [0, -250 + (c45 * cove) / 2, 500 + (c45 * cove) / 2], [0, c45, -c45], [0, c45, c45]),
        face('Phông', 900, 500, [0, -250 + c45 * cove + 250, 500 + c45 * cove], FRONT)
      ]
    }
  },
  {
    id: 'diorama', label: 'Hộp diorama 3 lớp', category: 'stage', hint: 'Tường + sàn + 3 lớp cảnh xa/giữa/tiền cảnh',
    en: { label: '3-layer diorama box', hint: 'Back wall + floor + far/mid/foreground layers' },
    faces: () => [
      face('Tường sau', 800, 500, [0, 0, 500], FRONT),
      face('Sàn', 800, 500, [0, -250, 250], UP, AWAY),
      face('Cảnh xa', 700, 350, [0, -75, 380], FRONT),
      face('Cảnh giữa', 600, 280, [0, -110, 250], FRONT),
      face('Tiền cảnh', 760, 180, [0, -160, 60], FRONT)
    ]
  }
]

export const ASSEMBLY_TEMPLATES: AssemblyTemplate[] = [
  ...architecture,
  ...HOUSE_SHELLS,
  ...DECOR_PARTS,
  ...props,
  ...EXTRA_PROPS,
  ...nature,
  ...stage
]
