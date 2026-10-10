/**
 * Deformation Evaluation Pipeline
 *
 * Evaluates full modifier stack, procedural motion and normal recomputation.
 * Produces GPU-ready THREE.BufferGeometry with clean disposal.
 */

import * as THREE from 'three'
import { deformSkin } from '../layerSkinning'
import type { ImageMeshDefinition } from '@shared/imageMeshDefinition'
import { buildBaseGridMesh } from './buildBaseMesh'
import {
  applyBendPrimitive,
  applyTwistPrimitive,
  applyDepthProfilePrimitive
} from './deformPrimitives'
import { applyCurvePrimitive } from './deformCurve'
import { applyLatticePrimitive } from './deformLattice'
import { applyBrushPrimitive } from './deformBrush'

export interface EvaluateOptions {
  /** When true, normalizes vertex coordinates to [-0.5, 0.5] for SceneRenderer unit plane scaling */
  unitSpace?: boolean
  /** Scene time in seconds for procedural motion evaluation */
  time?: number
}

/**
 * Applies procedural timeline motion (wind, wave, breathe, wiggle) based on scene time.
 */
function applyTimelineMotion(
  positions: Float32Array,
  uvs: Float32Array,
  count: number,
  motion: NonNullable<ImageMeshDefinition['motion']>,
  t: number
): void {
  const { type, speed, amplitude, direction } = motion
  if (type === 'none' || amplitude === 0) return

  const phase = t * speed * Math.PI * 2

  for (let i = 0; i < count; i++) {
    const idx = i * 3
    const u = uvs[i * 2]
    const v = uvs[i * 2 + 1]

    // Base of the part is anchored / stationary
    const weight = v * v

    let wave = 0
    if (type === 'wind') {
      wave = Math.sin(phase + u * 4) * amplitude * weight
    } else if (type === 'wave') {
      wave = Math.sin(phase + v * 6) * amplitude * weight
    } else if (type === 'breathe') {
      wave = Math.sin(phase) * (amplitude * 0.5) * weight
    } else if (type === 'wiggle') {
      wave = (Math.sin(phase * 1.7) + Math.cos(phase * 2.3 + u * 3)) * (amplitude * 0.5) * weight
    }

    if (direction === 'horizontal' || direction === 'both') {
      positions[idx] += wave * 0.5
    }
    if (direction === 'depthZ' || direction === 'both') {
      positions[idx + 2] += wave
    }
  }
}

/**
 * Main evaluation entry point: transforms base mesh into final deformed THREE.BufferGeometry.
 */
export function evaluateMeshGeometry(
  def: ImageMeshDefinition,
  options: EvaluateOptions = {}
): THREE.BufferGeometry {
  const { unitSpace = false, time = 0 } = options
  const { surface, modifiers, motion, silhouettePolygon } = def

  // 1. Build initial planar rest grid
  const base = def.skin ? {
    positions: new Float32Array(def.skin.positions), uvs: new Float32Array(def.skin.uvs),
    indices: new Uint32Array(def.skin.indices), vertexCount: def.skin.positions.length / 3
  } : buildBaseGridMesh(surface, silhouettePolygon)
  const pos = def.skin ? deformSkin(base.positions, def.skin.binding, def.skin.rig, time) : base.positions.slice() // Clone for modifier mutations
  const uvs = base.uvs
  const count = base.vertexCount

  // 2. Evaluate ordered modifiers
  for (const mod of modifiers) {
    if (!mod.enabled) continue

    if (mod.type === 'bend') {
      applyBendPrimitive(pos, uvs, count, mod, surface)
    } else if (mod.type === 'twist') {
      applyTwistPrimitive(pos, uvs, count, mod, surface)
    } else if (mod.type === 'curve') {
      applyCurvePrimitive(pos, uvs, count, mod, surface)
    } else if (mod.type === 'lattice') {
      applyLatticePrimitive(pos, uvs, count, mod, surface)
    } else if (mod.type === 'sculpt') {
      applyBrushPrimitive(pos, uvs, count, mod, surface)
    } else if (mod.type === 'depthProfile') {
      applyDepthProfilePrimitive(pos, uvs, count, mod, surface)
    }
  }

  // 3. Evaluate timeline procedural motion
  if (motion && motion.type !== 'none') {
    applyTimelineMotion(pos, uvs, count, motion, time)
  }

  // 4. Optionally normalize coordinates to unit space [-0.5, 0.5]
  if (unitSpace) {
    const invW = 1.0 / Math.max(1, surface.width)
    const invH = 1.0 / Math.max(1, surface.height)
    for (let i = 0; i < count; i++) {
      const idx = i * 3
      pos[idx] *= invW
      pos[idx + 1] *= invH
      pos[idx + 2] *= invW // Depth scaled uniformly with width
    }
  }

  // 5. Construct BufferGeometry
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(base.indices, 1))

  // Recompute normals and bounds
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  return geometry
}
