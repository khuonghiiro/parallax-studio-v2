import type { Layer, Project, Vec3, WorkflowNode } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { findWorkflowContact, type WorkflowContact } from './workflowBboxContact'
import { upsertCollisionKey } from './workflowV2CollisionKeys'

function hasAuthoredPath(layer: Layer, start: number, end: number): boolean {
  const keys = layer.transform.position.keyframes.filter(k => !k.id.startsWith('wfcol:'))
  return keys.length > 1 && keys[0].t < end && keys[keys.length - 1].t > start
}

/** Legacy approach is retained for a pair without an authored Motion/BBox trajectory. */
export function resolveWorkflowCollisionContact(
  project: Project, node: WorkflowNode, a: Layer, b: Layer, start: number, end: number
): WorkflowContact | null {
  const tolerance = node.params?.depthMode === 'flat_2d' ? Number.MAX_VALUE : 24
  const actual = findWorkflowContact(project, a, b, start, end, tolerance)
  if (actual || hasAuthoredPath(a, start, end) || hasAuthoredPath(b, start, end) || end <= start) return actual
  if (!a.visible || !b.visible || (a.shotId && b.shotId && a.shotId !== b.shotId)) return null
  const from = Math.max(start, a.inPoint, b.inPoint), to = Math.min(end, a.outPoint, b.outPoint)
  if (to <= from) return null
  const nominalHit = from + (to - from) * 0.45
  const positionA = evaluate(a.transform.position, from), positionB = evaluate(b.transform.position, nominalHit)
  const members = a.composite?.lockedGroup && a.composite.instanceId
    ? project.layers.filter(l => l.composite?.instanceId === a.composite!.instanceId) : [a]
  const bases = members.map(layer => ({ layer, pos: evaluate(layer.transform.position, from) }))
  for (const { layer, pos } of bases) {
    const destination = pos.map((v, axis) => v + positionB[axis] - positionA[axis]) as Vec3
    upsertCollisionKey(layer.transform.position, from, [...pos] as Vec3, 'easeIn', node.id, `${layer.id}-approach-start`)
    upsertCollisionKey(layer.transform.position, nominalHit, destination, 'linear', node.id, `${layer.id}-approach-contact`)
  }
  const hit = findWorkflowContact(project, a, b, from, nominalHit, tolerance)
  if (!hit) return null
  const force = Math.max(0.2, Math.min(2.5, node.params?.collisionForce ?? 1.2))
  const mode = node.params?.collisionMode ?? 'elastic_bounce'
  const dir = positionB[0] >= positionA[0] ? 1 : -1
  for (const { layer, pos } of bases) {
    const contact = pos.map((v, axis) => v + hit.positionA[axis] - positionA[axis]) as Vec3
    layer.transform.position.keyframes = layer.transform.position.keyframes.filter(k => k.id !== `wfcol:${node.id}:${layer.id}-approach-contact`)
    upsertCollisionKey(layer.transform.position, hit.time, contact, 'easeOut', node.id, `${layer.id}-approach-contact`)
    const recovery = [...contact] as Vec3
    if (mode === 'elastic_bounce' || mode === 'heavy_punch') recovery[0] -= dir * (mode === 'heavy_punch' ? 45 : 140) * force
    if (mode === 'wall_vault') { recovery[0] = positionB[0] + dir * 180; recovery[1] += 190 * force }
    upsertCollisionKey(layer.transform.position, Math.min(to, hit.time + 1.1), recovery, 'easeOut', node.id, `${layer.id}-approach-end`)
  }
  return hit
}
