import type { BufferGeometry, BufferAttribute } from 'three'
import type { ImageMeshDefinition } from '@shared/imageMeshDefinition'
import type { Layer, Project } from '@shared/types'
import { deformSkin } from '../layerSkinning'
import { deformPlantSpines } from '../plantSpine'
import { deformVerticesByPhysics } from '../layerPhysics'

/** Update the existing buffers; no GPU or typed-array allocations during playback/export. */
export function updateSkinGeometry(
  geometry: BufferGeometry,
  def: ImageMeshDefinition,
  time: number,
  layer?: Layer,
  project?: Project
): void {
  if (!def.skin) return
  const ud = geometry.userData
  const quantizedTime = Math.round(time * 240) / 240
  const hasPhysics = Boolean(layer?.physics?.enabled && layer.physics.material !== 'none' && project)
  if (!hasPhysics && ud.lastSkinDef === def && ud.lastSkinTime === quantizedTime) return
  ud.lastSkinDef = def
  ud.lastSkinTime = quantizedTime

  const rest: Float32Array = (ud.skinRest ??= new Float32Array(def.skin.positions))
  const workA: Float32Array =
    ud.skinWorkA && ud.skinWorkA.length === rest.length
      ? ud.skinWorkA
      : (ud.skinWorkA = new Float32Array(rest.length))
  const workB: Float32Array =
    ud.skinWorkB && ud.skinWorkB.length === rest.length
      ? ud.skinWorkB
      : (ud.skinWorkB = new Float32Array(rest.length))

  const indices = geometry.getIndex()?.array ?? def.skin.indices
  const skinned = deformSkin(rest, def.skin.binding, def.skin.rig, time, indices, workA)
  const positions = def.skin.plantSpines?.length
    ? deformPlantSpines(skinned, def.skin.binding, def.skin.plantSpines, time, indices, rest, workB)
    : skinned

  if (hasPhysics && layer && project) {
    deformVerticesByPhysics(positions, def.surface.width, def.surface.height, layer, project, time)
  }

  const attribute = geometry.getAttribute('position') as BufferAttribute
  const arr = attribute.array as Float32Array
  const invW = 1 / def.surface.width
  const invH = 1 / def.surface.height
  const count = attribute.count
  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    arr[i3] = positions[i3] * invW
    arr[i3 + 1] = positions[i3 + 1] * invH
    arr[i3 + 2] = positions[i3 + 2] * invW
  }
  attribute.needsUpdate = true
}

/** Deform a unit-space subdivided plane geometry by 2.5D material physics when no custom skin is present. */
export function updatePhysicsPlaneGeometry(
  geometry: BufferGeometry,
  layer: Layer,
  project: Project,
  time: number
): void {
  const attribute = geometry.getAttribute('position') as BufferAttribute | undefined
  if (!attribute) return
  const ud = geometry.userData
  const arr = attribute.array as Float32Array
  const rest: Float32Array = (ud.physRest ??= new Float32Array(arr))
  const work: Float32Array =
    ud.physWork && ud.physWork.length === rest.length
      ? ud.physWork
      : (ud.physWork = new Float32Array(rest.length))

  work.set(rest)
  if (layer.physics?.enabled && layer.physics.material !== 'none') {
    deformVerticesByPhysics(work, 1, 1, layer, project, time)
  }
  arr.set(work)
  attribute.needsUpdate = true
}

