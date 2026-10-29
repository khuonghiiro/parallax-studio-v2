import type { Layer, LayerPhysicsMaterial, PhysicsImpactPulse, Vec3, WorkflowNode } from '@shared/types'
import { createDefaultLayerPhysics, MATERIAL_PHYSICS_PRESETS } from '../engine/layerPhysicsPresets'
import type { WorkflowContact } from './workflowBboxContact'

type Material = Exclude<LayerPhysicsMaterial, 'none'>

/** Response is an impact, never a replacement for either layer's authored trajectory. */
export function writeWorkflowCollisionResponse(
  node: WorkflowNode, a: Layer, b: Layer, contact: WorkflowContact, end: number, materialA: Material, materialB: Material
): void {
  const p = node.params ?? {}, mode = p.collisionMode ?? 'elastic_bounce'
  const force = Math.max(0.2, Math.min(2.5, p.collisionForce ?? 1.2))
  const deform = Math.max(0.2, Math.min(2.5, p.deformIntensity ?? 1.25))
  const matB = mode === 'jelly_crush' && materialB === 'flesh_body' ? 'jelly_slime' : materialB
  const presetA = MATERIAL_PHYSICS_PRESETS[materialA], presetB = MATERIAL_PHYSICS_PRESETS[matB]
  const dir = contact.positionB[0] >= contact.positionA[0] ? 1 : -1
  const zTolerance = p.depthMode === 'flat_2d' ? Number.MAX_VALUE : 24
  const duration = Math.max(0.05, end - contact.time)
  const pulseA: PhysicsImpactPulse = {
    id: `wf-col-a-${node.id}`, time: contact.time, type: mode === 'wall_vault' ? 'vault' : 'punch',
    velocity: [-dir * 420 * force, 120 * force, 0], contactUV: [0.5, 0.5], sourceLayerId: b.id, duration
  }
  const velocity: Vec3 = mode === 'jelly_crush' ? [dir * 80 * force, -760 * force, 0]
    : mode === 'heavy_punch' ? [dir * 960 * force, 85 * force, 0]
      : mode === 'projectile_stick' ? [dir * 680 * force, -40, 420 * force] : [dir * 640 * force, -60 * force, 0]
  const pulseB: PhysicsImpactPulse = {
    id: `wf-col-${node.id}`, time: contact.time,
    type: mode === 'jelly_crush' ? 'press' : mode === 'wall_vault' ? 'vault' : mode === 'projectile_stick' ? 'arrow' : 'punch',
    velocity, contactUV: mode === 'jelly_crush' ? [0.5, 0.85] : [0.5, 0.55], sourceLayerId: a.id, duration
  }
  const physicsA = a.physics ?? createDefaultLayerPhysics(materialA)
  const physicsB = b.physics ?? createDefaultLayerPhysics(matB)
  a.physics = { ...physicsA, enabled: true, material: materialA,
    role: mode === 'projectile_stick' ? 'projectile' : mode === 'wall_vault' ? 'vault_jumper' : 'striker',
    stickOnHit: mode === 'projectile_stick', zTolerance,
    bounciness: Number((presetA.bounciness * deform).toFixed(2)), hitSensitivity: force,
    impacts: [...(physicsA.impacts ?? []).filter(i => i.id !== pulseA.id), pulseA] }
  b.physics = { ...physicsB, enabled: true, material: matB, role: 'prop_target', zTolerance,
    stiffness: presetB.stiffness, damping: presetB.damping,
    bounciness: Number((presetB.bounciness * deform).toFixed(2)), hitSensitivity: Number((force * deform).toFixed(2)),
    impacts: [...(physicsB.impacts ?? []).filter(i => i.id !== pulseB.id), pulseB] }
}
