import { Box3 } from 'three'
import type { Layer, Project, Vec3 } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { composeDepthMatrix, layerNominalSize, transformedBox } from '../engine/spatial'

/** Bounds before collision response, using the same plane size/pivot as the renderer. */
export function workflowLayerBounds(project: Project, layer: Layer, t: number): Box3 {
  const instance = layer.composite?.lockedGroup ? layer.composite.instanceId : undefined
  const members = instance ? project.layers.filter(l => l.composite?.instanceId === instance) : [layer]
  const box = new Box3()
  for (const member of members) {
    if (!member.visible || t < member.inPoint || t > member.outPoint) continue
    const size = layerNominalSize(member)
    const tr = member.transform
    const matrix = composeDepthMatrix(evaluate(tr.position, t), evaluate(tr.rotation, t),
      evaluate(tr.scale, t), undefined, tr.anchor ? evaluate(tr.anchor, t) : [0, 0, 0], size)
    box.union(transformedBox(size[0], size[1], 0, matrix))
  }
  return box
}

/** Earliest intersection of two linearly swept AABBs, including changing extents. */
function sweptContact(a0: Box3, a1: Box3, b0: Box3, b1: Box3, depthTolerance: number): number | null {
  if ([a0, a1, b0, b1].some(b => b.isEmpty())) return null
  let enter = 0, leave = 1
  for (const axis of ['x', 'y', 'z'] as const) {
    const margin = axis === 'z' ? depthTolerance : 0
    const pairs = [
      [a0.max[axis] - b0.min[axis] + margin, a1.max[axis] - b1.min[axis] + margin],
      [b0.max[axis] - a0.min[axis] + margin, b1.max[axis] - a1.min[axis] + margin]
    ]
    for (const [v0, v1] of pairs) {
      if (v0 < 0 && v1 < 0) return null
      if (v0 < 0) enter = Math.max(enter, -v0 / (v1 - v0))
      if (v1 < 0) leave = Math.min(leave, v0 / (v0 - v1))
    }
  }
  return enter <= leave ? enter : null
}

export interface WorkflowContact { time: number; positionA: Vec3; positionB: Vec3 }

/** Sample BOTH trajectories at the same time, sweep between samples to avoid tunnelling. */
export function findWorkflowContact(
  project: Project, a: Layer, b: Layer, start: number, end: number, depthTolerance = 24
): WorkflowContact | null {
  if (!a.visible || !b.visible || a.id === b.id || (a.shotId && b.shotId && a.shotId !== b.shotId)) return null
  const from = Math.max(start, a.inPoint, b.inPoint)
  const to = Math.min(end, a.outPoint, b.outPoint)
  if (to < from) return null
  const count = Math.max(1, Math.min(12000, Math.ceil((to - from) * 120)))
  let a0 = workflowLayerBounds(project, a, from), b0 = workflowLayerBounds(project, b, from)
  for (let i = 1; i <= count; i++) {
    const t0 = from + (to - from) * (i - 1) / count
    const t1 = from + (to - from) * i / count
    const a1 = workflowLayerBounds(project, a, t1), b1 = workflowLayerBounds(project, b, t1)
    const u = sweptContact(a0, a1, b0, b1, depthTolerance)
    if (u !== null) {
      const time = t0 + (t1 - t0) * u
      return { time, positionA: evaluate(a.transform.position, time), positionB: evaluate(b.transform.position, time) }
    }
    a0 = a1; b0 = b1
  }
  return null
}
