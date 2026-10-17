import type { BufferGeometry, BufferAttribute } from 'three'
import type { ImageMeshDefinition } from '@shared/imageMeshDefinition'
import { deformSkin } from '../layerSkinning'
import { deformPlantSpines } from '../plantSpine'

/** Update the existing buffers; no GPU allocations during playback/export. */
export function updateSkinGeometry(geometry: BufferGeometry, def: ImageMeshDefinition, time: number): void {
  if (!def.skin) return
  const rest = geometry.userData.skinRest ??= new Float32Array(def.skin.positions)
  const indices = geometry.getIndex()?.array ?? def.skin.indices
  const skinned = deformSkin(rest, def.skin.binding, def.skin.rig, time, indices)
  const positions = def.skin.plantSpines?.length
    ? deformPlantSpines(skinned, def.skin.binding, def.skin.plantSpines, time, indices) : skinned
  const attribute = geometry.getAttribute('position') as BufferAttribute
  for (let i = 0; i < attribute.count; i++) {
    attribute.setXYZ(i, positions[i * 3] / def.surface.width,
      positions[i * 3 + 1] / def.surface.height, positions[i * 3 + 2] / def.surface.width)
  }
  attribute.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}
