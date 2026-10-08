import type { Vec3 } from './assemblyGeometry'

/**
 * Shared types and geometry helpers for the Assembly template catalogue.
 *
 * Every template describes *how planes are folded together* (centre, facing direction and
 * image-up direction in depth space: x → right, y → up, z → away from the viewer). They
 * never carry textures or content-specific face names, so a template can be applied to any
 * set of user images.
 */
export type TemplateCategory = 'architecture' | 'decor' | 'props' | 'nature' | 'stage'

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
  /** Vietnamese label shown in the UI. */
  label: string
  category: TemplateCategory
  /** Vietnamese hint shown in the UI. */
  hint: string
  /** English label/hint for AI agents (MCP `list_assembly_templates`). Must stay in sync. */
  en: { label: string; hint: string }
  /**
   * Decor parts only: where the part's local origin sits, so it can be mounted on a shell
   * with `append_assembly_model` / "Ghép vào mô hình" (e.g. back plane touching z = 0).
   */
  anchor?: string
  faces: () => TemplateFaceSpec[]
}

export const TEMPLATE_CATEGORIES: Array<{ id: TemplateCategory; label: string; en: string }> = [
  { id: 'architecture', label: 'Khung nhà', en: 'Building shells' },
  { id: 'decor', label: 'Bộ phận trang trí', en: 'Decor parts' },
  { id: 'props', label: 'Đồ vật', en: 'Props' },
  { id: 'nature', label: 'Thiên nhiên', en: 'Nature' },
  { id: 'stage', label: 'Bối cảnh', en: 'Stage sets' }
]

/** Standard anchor text for wall-mounted parts. */
export const WALL_ANCHOR = 'Origin = wall contact point; back plane at z = 0, part protrudes toward the viewer (z < 0).'

export const FRONT: Vec3 = [0, 0, -1]
export const BACK: Vec3 = [0, 0, 1]
export const LEFT: Vec3 = [-1, 0, 0]
export const RIGHT: Vec3 = [1, 0, 0]
export const UP: Vec3 = [0, 1, 0]
export const DOWN: Vec3 = [0, -1, 0]
export const AWAY: Vec3 = [0, 0, 1]
export const TOWARD: Vec3 = [0, 0, -1]
export const DEG = Math.PI / 180
const r1 = (v: number): number => Math.round(v * 10) / 10

export const face = (
  name: string,
  w: number,
  h: number,
  c: Vec3,
  n: Vec3,
  up?: Vec3,
  extra?: Partial<TemplateFaceSpec>
): TemplateFaceSpec => ({
  name,
  w: Math.round(w),
  h: Math.round(h),
  c: c.map(r1) as Vec3,
  n,
  up,
  ...extra
})

/** Moves every face of a part by `d` (depth space). */
export function offset(list: TemplateFaceSpec[], d: Vec3): TemplateFaceSpec[] {
  return list.map((f) => ({ ...f, c: [r1(f.c[0] + d[0]), r1(f.c[1] + d[1]), r1(f.c[2] + d[2])] as Vec3 }))
}

/** Prefixes face names, e.g. 'Đế' + 'Trước' → 'Đế · Trước'. */
export function prefixed(prefix: string, list: TemplateFaceSpec[]): TemplateFaceSpec[] {
  return list.map((f) => ({ ...f, name: `${prefix} · ${f.name}` }))
}

/** Closed or open box walls: front plane at z = 0, centred on x/y; `top`/`back` optional. */
export function boxFaces(
  w: number,
  h: number,
  d: number,
  opts: { top?: boolean; back?: boolean; bottom?: boolean } = {}
): TemplateFaceSpec[] {
  const list = [
    face('Trước', w, h, [0, 0, 0], FRONT),
    face('Trái', d, h, [-w / 2, 0, d / 2], LEFT),
    face('Phải', d, h, [w / 2, 0, d / 2], RIGHT)
  ]
  if (opts.back !== false) list.push(face('Sau', w, h, [0, 0, d], BACK))
  if (opts.top !== false) list.push(face('Trên', w, d, [0, h / 2, d / 2], UP, AWAY))
  if (opts.bottom) list.push(face('Dưới', w, d, [0, -h / 2, d / 2], DOWN, TOWARD))
  return list
}

/** Regular prism with `sides` faces; face 0 looks at the viewer and touches z = 0. */
export function prismFaces(sides: number, apothem: number, h: number, prefix = 'Mặt'): TemplateFaceSpec[] {
  const w = 2 * apothem * Math.tan(Math.PI / sides)
  return Array.from({ length: sides }, (_, i) => {
    const phi = (i * 2 * Math.PI) / sides
    const n: Vec3 = [Math.sin(phi), 0, -Math.cos(phi)]
    return face(`${prefix} ${i + 1}`, w, h, [apothem * n[0], 0, apothem + apothem * n[2]], n)
  })
}

/** Two slopes meeting at a ridge along depth (roof / tent). */
export function ridgeSlopes(span: number, rise: number, depth: number, baseY: number, overhang = 0): TemplateFaceSpec[] {
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

/**
 * A roof slope rising from an eave line. `eave` is the centre of the eave edge, `inward` the
 * horizontal unit direction towards the ridge, `rise`/`run` the slope's vertical/horizontal
 * extent and `width` the eave length.
 */
export function slopePlane(name: string, width: number, eave: Vec3, inward: Vec3, rise: number, run: number): TemplateFaceSpec {
  const len = Math.hypot(rise, run)
  const up: Vec3 = [(inward[0] * run) / len, rise / len, (inward[2] * run) / len]
  const n: Vec3 = [(-inward[0] * rise) / len, run / len, (-inward[2] * rise) / len]
  const c: Vec3 = [eave[0] + (up[0] * len) / 2, eave[1] + (up[1] * len) / 2, eave[2] + (up[2] * len) / 2]
  return face(name, width, len, c, n, up)
}

/** A plane hinged on a horizontal line, tilted `deg` below horizontal towards the viewer. */
export function awning(name: string, w: number, len: number, hingeY: number, hingeZ: number, deg: number): TemplateFaceSpec {
  const a = deg * DEG
  const up: Vec3 = [0, Math.sin(a), Math.cos(a)]
  const n: Vec3 = [0, Math.cos(a), -Math.sin(a)]
  return face(name, w, len, [0, hingeY - up[1] * (len / 2), hingeZ - up[2] * (len / 2)], n, up)
}

export function tilted(name: string, w: number, h: number, c: Vec3, backDeg: number): TemplateFaceSpec {
  const a = backDeg * DEG
  return face(name, w, h, c, [0, Math.sin(a), -Math.cos(a)], [0, Math.cos(a), Math.sin(a)])
}

export function aroundY(name: string, w: number, h: number, deg: number, c: Vec3 = [0, 0, 0]): TemplateFaceSpec {
  const a = deg * DEG
  return face(name, w, h, c, [Math.sin(a), 0, -Math.cos(a)])
}

/**
 * A vertical panel hinged on a vertical line at (hingeX, z = 0) and swung `deg` towards the
 * viewer — e.g. opened shutters. side = -1 opens to the left, +1 to the right.
 */
export function swungPanel(name: string, w: number, h: number, hingeX: number, side: -1 | 1, deg: number, y = 0): TemplateFaceSpec {
  const a = deg * DEG
  const c: Vec3 = [hingeX + side * Math.cos(a) * (w / 2), y, -Math.sin(a) * (w / 2)]
  return aroundY(name, w, h, side === -1 ? deg : -deg, c)
}

/**
 * 360° Round cylinder tube made of curved 2D faces meeting along their side edges.
 * For 4 faces (quadrants), each curved by bendX forms a seamless circular pipe/pillar.
 */
export function curvedCylinderFaces(
  radius: number,
  h: number,
  sides = 4,
  bendAmount = 55,
  prefix = 'Mặt cong'
): TemplateFaceSpec[] {
  const w = 2 * radius * Math.tan(Math.PI / sides) * 1.15
  return Array.from({ length: sides }, (_, i) => {
    const deg = (i * 360) / sides
    const phi = deg * DEG
    const n: Vec3 = [Math.sin(phi), 0, -Math.cos(phi)]
    const dist = radius * 0.72
    return face(
      `${prefix} ${i + 1} (${deg}°)`,
      w,
      h,
      [dist * Math.sin(phi), 0, -dist * Math.cos(phi)],
      n,
      undefined,
      { bendX: bendAmount }
    )
  })
}

/**
 * 360° Tapered cone / trunk tube made of curved 2D faces tilted inward towards the apex.
 */
export function taperedConeFaces(
  bottomRadius: number,
  topRadius: number,
  h: number,
  sides = 4,
  bendAmount = 55,
  prefix = 'Vách côn'
): TemplateFaceSpec[] {
  const midRadius = (bottomRadius + topRadius) / 2
  const w = 2 * midRadius * Math.tan(Math.PI / sides) * 1.15
  const tiltDeg = (Math.atan2(bottomRadius - topRadius, h) * 180) / Math.PI

  return Array.from({ length: sides }, (_, i) => {
    const deg = (i * 360) / sides
    const phi = deg * DEG
    const dist = midRadius * 0.72
    const tRad = tiltDeg * DEG
    const n: Vec3 = [
      Math.sin(phi) * Math.cos(tRad),
      Math.sin(tRad),
      -Math.cos(phi) * Math.cos(tRad)
    ]
    const up: Vec3 = [
      -Math.sin(phi) * Math.sin(tRad),
      Math.cos(tRad),
      Math.cos(phi) * Math.sin(tRad)
    ]
    return face(
      `${prefix} ${i + 1} (${deg}°)`,
      w,
      h,
      [dist * Math.sin(phi), 0, -dist * Math.cos(phi)],
      n,
      up,
      { bendX: bendAmount }
    )
  })
}
