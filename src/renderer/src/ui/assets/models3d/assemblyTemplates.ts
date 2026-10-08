import * as THREE from 'three'
import type { Face3D } from './types'
import { faceCornersThree, modelBounds, poseFromFrame, type Vec3 } from './assemblyGeometry'
import { ASSEMBLY_TEMPLATES, type AssemblyTemplate } from './assemblyTemplateData'

export { ASSEMBLY_TEMPLATES, TEMPLATE_CATEGORIES } from './assemblyTemplateData'
export type { AssemblyTemplate, TemplateCategory } from './assemblyTemplateData'

/** Neutral swatches for untextured template faces (model data, not UI chrome). */
const NEUTRAL_COLORS = ['#7c8cff', '#38bdf8', '#22d3ee', '#a78bfa', '#60a5fa', '#94a3b8']

/** Template-controlled shape fields; reset when a template is applied. */
const SHAPE_KEYS = ['bendX', 'bendY', 'bendLateral', 'bendRegion', 'silhouettePolygon'] as const

export function findTemplate(id: string): AssemblyTemplate | undefined {
  return ASSEMBLY_TEMPLATES.find((t) => t.id === id)
}

/** Geometry-only faces of a template: no textures, positional names, neutral colours. */
export function templateFaces(template: AssemblyTemplate, idPrefix = template.id): Face3D[] {
  return template.faces().map((spec, i) => {
    const pose = poseFromFrame(spec.c, spec.n, spec.up)
    const f: Face3D = {
      id: `${idPrefix}-${i + 1}`,
      name: spec.name,
      color: NEUTRAL_COLORS[i % NEUTRAL_COLORS.length],
      width: spec.w,
      height: spec.h,
      position: pose.position,
      rotation: pose.rotation
    }
    Object.assign(f, spec.mesh)
    if (spec.imageSlot) f.imageSlot = spec.imageSlot
    if (spec.bendX) f.bendX = spec.bendX
    if (spec.bendY) f.bendY = spec.bendY
    if (spec.bendLateral) f.bendLateral = spec.bendLateral
    if (spec.bendRegion) f.bendRegion = spec.bendRegion
    if (spec.silhouettePolygon) f.silhouettePolygon = spec.silhouettePolygon
    return f
  })
}

function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 7)
}

/**
 * Replace: re-folds the current faces into the template. The user's images, ids and mesh
 * work (grid, erased cells, depth, motion…) are carried over in order; faces beyond the
 * template's slot count are kept untouched so no image is ever dropped.
 */
export function replaceWithTemplate(template: AssemblyTemplate, current: Face3D[]): Face3D[] {
  const slots = templateFaces(template, `${template.id}-${uniqueSuffix()}`)
  const folded = slots.map((slot, i) => {
    const src = current[i]
    if (!src) return slot
    const merged: Face3D = { ...src }
    for (const key of SHAPE_KEYS) delete merged[key]
    return {
      ...merged,
      ...slot,
      id: src.id,
      assetPath: src.assetPath,
      assetId: src.assetId,
      color: src.color ?? slot.color
    }
  })
  return [...folded, ...current.slice(slots.length)]
}

/** Append: adds the template's faces next to (to the right of) the current model. */
export function appendTemplate(template: AssemblyTemplate, current: Face3D[], gap = 80): Face3D[] {
  const added = templateFaces(template, `${template.id}-${uniqueSuffix()}`)
  const cur = modelBounds(current.filter((f) => !f.hidden))
  const tpl = modelBounds(added)
  if (!cur || !tpl) return [...current, ...added]
  const shift: Vec3 = [cur.max[0] - tpl.min[0] + gap, cur.min[1] - tpl.min[1], cur.center[2] - tpl.center[2]]
  const moved = added.map((f) => ({
    ...f,
    position: [
      Math.round(f.position[0] + shift[0]),
      Math.round(f.position[1] + shift[1]),
      Math.round(f.position[2] + shift[2])
    ] as Vec3
  }))
  return [...current, ...moved]
}

export interface PreviewPolygon {
  points: string
  shade: number
}

/**
 * Isometric line-art preview of a template (SVG polygons, painter-sorted far → near).
 * `shade` (0..1) encodes how much each plane faces the light so the card reads as 3D.
 */
export function templatePreview(template: AssemblyTemplate, size = 64): PreviewPolygon[] {
  const faces = templateFaces(template)
  const view = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.42, -0.62, 0, 'XYZ'))
  const light = new THREE.Vector3(0.4, 0.8, 0.45).normalize()
  const projected = faces.map((f) => {
    const pts = faceCornersThree(f).map((p) => p.applyMatrix4(view))
    const normal = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[3], pts[0])).normalize()
    const depth = pts.reduce((s, p) => s + p.z, 0) / pts.length
    return { pts, depth, shade: Math.abs(normal.dot(light)) }
  })
  const all = projected.flatMap((p) => p.pts)
  const minX = Math.min(...all.map((p) => p.x))
  const maxX = Math.max(...all.map((p) => p.x))
  const minY = Math.min(...all.map((p) => p.y))
  const maxY = Math.max(...all.map((p) => p.y))
  const k = (size * 0.86) / Math.max(1, maxX - minX, maxY - minY)
  const ox = (size - (maxX - minX) * k) / 2
  const oy = (size - (maxY - minY) * k) / 2
  return projected
    .sort((a, b) => a.depth - b.depth)
    .map((p) => ({
      points: p.pts.map((v) => `${(ox + (v.x - minX) * k).toFixed(1)},${(oy + (maxY - v.y) * k).toFixed(1)}`).join(' '),
      shade: Math.round(p.shade * 100) / 100
    }))
}
