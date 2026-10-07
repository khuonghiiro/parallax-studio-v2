import type { Vec3 } from './assemblyGeometry'

/**
 * Geometry-only template catalogue for the Assembly workshop.
 *
 * Every template describes *how planes are folded together* (centre, facing direction and
 * image-up direction in depth space: x → right, y → up, z → away from the viewer). They
 * never carry textures or content-specific names, so a template can be applied to any set
 * of user images.
 */
export type TemplateCategory = 'architecture' | 'props' | 'nature' | 'stage'

export interface TemplateFaceSpec {
  name: string
  w: number
  h: number
  /** Centre (depth space). */
  c: Vec3
  /** Direction the image front faces (depth space). */
  n: Vec3
  /** Direction of the image top (depth space). */
  up?: Vec3
  bendX?: number
  bendY?: number
}

export interface AssemblyTemplate {
  id: string
  label: string
  category: TemplateCategory
  hint: string
  faces: () => TemplateFaceSpec[]
}

export const TEMPLATE_CATEGORIES: Array<{ id: TemplateCategory; label: string }> = [
  { id: 'architecture', label: 'Kiến trúc' },
  { id: 'props', label: 'Đồ vật' },
  { id: 'nature', label: 'Thiên nhiên' },
  { id: 'stage', label: 'Bối cảnh' }
]

const FRONT: Vec3 = [0, 0, -1]
const BACK: Vec3 = [0, 0, 1]
const LEFT: Vec3 = [-1, 0, 0]
const RIGHT: Vec3 = [1, 0, 0]
const UP: Vec3 = [0, 1, 0]
const AWAY: Vec3 = [0, 0, 1]
const DEG = Math.PI / 180
const r1 = (v: number): number => Math.round(v * 10) / 10

const face = (name: string, w: number, h: number, c: Vec3, n: Vec3, up?: Vec3, extra?: Partial<TemplateFaceSpec>): TemplateFaceSpec => ({
  name, w: Math.round(w), h: Math.round(h), c: c.map(r1) as Vec3, n, up, ...extra
})

/** Closed or open box walls around a centre; `top`/`back` optional. */
function boxFaces(w: number, h: number, d: number, opts: { top?: boolean; back?: boolean; bottom?: boolean } = {}): TemplateFaceSpec[] {
  const list = [
    face('Trước', w, h, [0, 0, 0], FRONT),
    face('Trái', d, h, [-w / 2, 0, d / 2], LEFT),
    face('Phải', d, h, [w / 2, 0, d / 2], RIGHT)
  ]
  if (opts.back !== false) list.push(face('Sau', w, h, [0, 0, d], BACK))
  if (opts.top !== false) list.push(face('Trên', w, d, [0, h / 2, d / 2], UP, AWAY))
  if (opts.bottom) list.push(face('Dưới', w, d, [0, -h / 2, d / 2], [0, -1, 0], [0, 0, -1]))
  return list
}

/** Regular prism with `sides` faces; face 0 looks at the viewer and touches z = 0. */
function prismFaces(sides: number, apothem: number, h: number, prefix = 'Mặt'): TemplateFaceSpec[] {
  const w = 2 * apothem * Math.tan(Math.PI / sides)
  return Array.from({ length: sides }, (_, i) => {
    const phi = (i * 2 * Math.PI) / sides
    const n: Vec3 = [Math.sin(phi), 0, -Math.cos(phi)]
    return face(`${prefix} ${i + 1}`, w, h, [apothem * n[0], 0, apothem + apothem * n[2]], n)
  })
}

/** Two slopes meeting at a ridge along depth (roof / tent). */
function ridgeSlopes(span: number, rise: number, depth: number, baseY: number, overhang = 0): TemplateFaceSpec[] {
  const hyp = Math.hypot(span / 2, rise)
  const len = hyp + overhang
  const mk = (side: -1 | 1, name: string) => {
    const up: Vec3 = [(-side * span) / 2 / hyp, rise / hyp, 0]
    const n: Vec3 = [(side * rise) / hyp, span / 2 / hyp, 0]
    const c: Vec3 = [(side * span) / 4 - up[0] * (overhang / 2), baseY + rise / 2 - up[1] * (overhang / 2), depth / 2]
    return face(name, depth + overhang * 2, len, c, n, up)
  }
  return [mk(-1, 'Dốc trái'), mk(1, 'Dốc phải')]
}

/** A plane hinged on a horizontal line, tilted `deg` below horizontal towards the viewer. */
function awning(name: string, w: number, len: number, hingeY: number, hingeZ: number, deg: number): TemplateFaceSpec {
  const a = deg * DEG
  const up: Vec3 = [0, Math.sin(a), Math.cos(a)]
  const n: Vec3 = [0, Math.cos(a), -Math.sin(a)]
  return face(name, w, len, [0, hingeY - up[1] * (len / 2), hingeZ - up[2] * (len / 2)], n, up)
}

function tilted(name: string, w: number, h: number, c: Vec3, backDeg: number): TemplateFaceSpec {
  const a = backDeg * DEG
  return face(name, w, h, c, [0, Math.sin(a), -Math.cos(a)], [0, Math.cos(a), Math.sin(a)])
}

function aroundY(name: string, w: number, h: number, deg: number, c: Vec3 = [0, 0, 0]): TemplateFaceSpec {
  const a = deg * DEG
  return face(name, w, h, c, [Math.sin(a), 0, -Math.cos(a)])
}

const architecture: AssemblyTemplate[] = [
  {
    id: 'gable-house', label: 'Nhà mái chữ A', category: 'architecture',
    hint: 'Mặt trước/sau hình đầu hồi + 2 vách + 2 mái dốc',
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
    id: 'flat-house', label: 'Nhà mái bằng', category: 'architecture',
    hint: 'Hộp 4 vách + mái phẳng', faces: () => boxFaces(600, 450, 500)
  },
  {
    id: 'shop-awning', label: 'Cửa hiệu mái hiên', category: 'architecture',
    hint: 'Hộp nhà + mái hiên nghiêng phía trước',
    faces: () => [...boxFaces(600, 450, 450, { back: false }), awning('Mái hiên', 640, 170, 175, 0, 28)]
  },
  {
    id: 'tower-8', label: 'Tháp bát giác', category: 'architecture',
    hint: 'Lăng trụ 8 mặt – xoay quanh trông như khối tròn', faces: () => prismFaces(8, 260, 620)
  },
  {
    id: 'gate', label: 'Cổng chào', category: 'architecture',
    hint: '2 trụ + bảng tên + mái cổng',
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
    faces: () => [
      face('Cửa lều', 500, 360, [0, 0, 0], FRONT),
      face('Vách sau', 500, 360, [0, 0, 600], BACK),
      ...ridgeSlopes(500, 360, 600, -180)
    ]
  }
]

const props: AssemblyTemplate[] = [
  { id: 'box', label: 'Hộp kín 6 mặt', category: 'props', hint: 'Khối hộp khép kín', faces: () => boxFaces(500, 500, 500, { bottom: true }) },
  {
    id: 'chest-open', label: 'Rương mở nắp', category: 'props', hint: 'Hộp 4 vách + nắp bản lề mở 105°',
    faces: () => {
      const W = 500, H = 320, D = 340, a = 105 * DEG
      const dir: Vec3 = [0, Math.sin(a), -Math.cos(a)]
      const lid = face('Nắp', W, D, [0, H / 2 + dir[1] * (D / 2), D + dir[2] * (D / 2)], [0, Math.cos(a), Math.sin(a)], [0, -dir[1], -dir[2]])
      return [...boxFaces(W, H, D, { top: false }), lid]
    }
  },
  {
    id: 'popup-card', label: 'Thiệp pop-up', category: 'props', hint: 'Nền + lưng + 2 lớp pop-up xếp chiều sâu',
    faces: () => [
      face('Nền', 600, 400, [0, -150, 200], UP, AWAY),
      face('Lưng', 600, 400, [0, 50, 400], FRONT),
      face('Lớp giữa', 360, 260, [0, -20, 200], FRONT),
      face('Lớp trước', 480, 140, [0, -80, 60], FRONT)
    ]
  },
  {
    id: 'folding-screen', label: 'Bình phong 3 tấm', category: 'props', hint: '3 tấm gấp khúc hướng về người xem',
    faces: () => {
      const pw = 260, ph = 480, b = 30 * DEG
      const side = (s: -1 | 1, name: string) =>
        face(name, pw, ph, [s * (pw / 2 + Math.cos(b) * (pw / 2)), 0, -Math.sin(b) * (pw / 2)], [-s * Math.sin(b), 0, -Math.cos(b)])
      return [side(-1, 'Tấm trái'), face('Tấm giữa', pw, ph, [0, 0, 0], FRONT), side(1, 'Tấm phải')]
    }
  },
  {
    id: 'standee', label: 'Standee chân đế', category: 'props', hint: 'Bảng đứng nghiêng + đế + thanh chống',
    faces: () => {
      const strutLen = Math.hypot(450, 120)
      return [
        tilted('Bảng', 400, 600, [0, 0, 0], 8),
        face('Đế', 420, 180, [0, -300, 50], UP, AWAY),
        face('Thanh chống', 120, strutLen, [0, -75, 90], [0, 120 / strutLen, 450 / strutLen], [0, 450 / strutLen, -120 / strutLen])
      ]
    }
  },
  { id: 'lantern-6', label: 'Đèn lồng lục giác', category: 'props', hint: 'Lăng trụ 6 mặt', faces: () => prismFaces(6, 150, 300) },
  {
    id: 'curved-pillar', label: 'Thân trụ cong', category: 'props', hint: '2 mặt uốn cong úp vào nhau thành khối tròn',
    faces: () => [
      face('Nửa trước', 400, 600, [0, 0, 0], FRONT, undefined, { bendX: 100 }),
      face('Nửa sau', 400, 600, [0, 0, 0], BACK, undefined, { bendX: 100 })
    ]
  },
  {
    id: 'signpost', label: 'Biển hiệu có cột', category: 'props', hint: 'Bảng 2 mặt + cột chữ thập',
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
    faces: () => [aroundY('Mặt A', 500, 700, 45), aroundY('Mặt B', 500, 700, -45)]
  },
  {
    id: 'bush-3', label: 'Bụi cây 3 lá', category: 'nature', hint: '3 mặt xoay 60° quanh trục đứng',
    faces: () => [aroundY('Lá 1', 450, 350, 0), aroundY('Lá 2', 450, 350, 60), aroundY('Lá 3', 450, 350, -60)]
  },
  {
    id: 'foliage-layers', label: 'Tán lá nhiều lớp', category: 'nature', hint: '4 lớp so le chiều sâu cho parallax mượt',
    faces: () => [
      face('Lớp 1 (trước)', 420, 300, [-120, -60, 0], FRONT),
      face('Lớp 2', 460, 360, [140, -20, 80], FRONT),
      face('Lớp 3', 520, 420, [-40, 20, 160], FRONT),
      face('Lớp 4 (sau)', 600, 480, [60, 60, 240], FRONT)
    ]
  },
  {
    id: 'ground-patch', label: 'Thảm cỏ có viền', category: 'nature', hint: 'Mặt đất + viền cỏ trước + bụi phía sau',
    faces: () => [
      face('Mặt đất', 800, 600, [0, -150, 300], UP, AWAY),
      face('Viền trước', 800, 120, [0, -100, 0], FRONT),
      face('Bụi sau', 800, 260, [0, -30, 600], FRONT)
    ]
  }
]

const stage: AssemblyTemplate[] = [
  {
    id: 'room-open', label: 'Phòng mở 3 vách', category: 'stage', hint: 'Sàn + tường sau + 2 tường bên nhìn vào trong',
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
    faces: () => [
      face('Vách trước', 600, 600, [0, 0, 0], FRONT),
      face('Vách hông', 600, 600, [-300, 0, 300], LEFT),
      face('Vỉa hè', 900, 900, [0, -300, 300], UP, AWAY)
    ]
  },
  {
    id: 'cyclorama', label: 'Phông nền bo cong', category: 'stage', hint: 'Sàn + góc bo 45° + phông đứng (studio vô cực)',
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
    faces: () => [
      face('Tường sau', 800, 500, [0, 0, 500], FRONT),
      face('Sàn', 800, 500, [0, -250, 250], UP, AWAY),
      face('Cảnh xa', 700, 350, [0, -75, 380], FRONT),
      face('Cảnh giữa', 600, 280, [0, -110, 250], FRONT),
      face('Tiền cảnh', 760, 180, [0, -160, 60], FRONT)
    ]
  }
]

export const ASSEMBLY_TEMPLATES: AssemblyTemplate[] = [...architecture, ...props, ...nature, ...stage]
