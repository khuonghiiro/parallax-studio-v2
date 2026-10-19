import type { BufferGeometry, BufferAttribute } from 'three'
import type { ImageMeshDefinition } from '@shared/imageMeshDefinition'
import { deformSkin } from '../layerSkinning'
import { deformPlantSpines } from '../plantSpine'

/** Update the existing buffers; no GPU or typed-array allocations during playback/export. */
export function updateSkinGeometry(geometry: BufferGeometry, def: ImageMeshDefinition, time: number): void {
  if (!def.skin) return
  const ud = geometry.userData
  const quantizedTime = Math.round(time * 240) / 240
  if (ud.lastSkinDef === def && ud.lastSkinTime === quantizedTime) return
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

