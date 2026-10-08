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
    id: 'tree-cross', label: 'Cây chữ X', category: 'nature', hint: '2 mặt cắt chéo – nhìn góc nào cũng có cây',
    en: { label: 'X-cross tree', hint: '2 crossed planes – looks full from any angle' },
    faces: () => [aroundY('Mặt A', 500, 700, 45), aroundY('Mặt B', 500, 700, -45)]
  },
  {
    id: 'bush-3', label: 'Bụi cây 3 lá', category: 'nature', hint: '3 mặt xoay 60° quanh trục đứng',
    en: { label: '3-blade bush', hint: '3 planes rotated 60° around the vertical axis' },
    faces: () => [aroundY('Lá 1', 450, 350, 0), aroundY('Lá 2', 450, 350, 60), aroundY('Lá 3', 450, 350, -60)]
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
    id: 'hedge', label: 'Bờ rào cây bụi', category: 'nature', hint: 'Khối bụi dài: trước, sau, 2 đầu + mặt trên',
    en: { label: 'Hedge row', hint: 'Long bush block: front, back, 2 ends + top' },
    faces: () => boxFaces(640, 170, 130)
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
