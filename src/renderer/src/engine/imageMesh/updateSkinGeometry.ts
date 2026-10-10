import type { BufferGeometry, BufferAttribute } from 'three'
import type { ImageMeshDefinition } from '@shared/imageMeshDefinition'
import { deformSkin } from '../layerSkinning'

/** Update the existing buffers; no GPU allocations during playback/export. */
export function updateSkinGeometry(geometry: BufferGeometry, def: ImageMeshDefinition, time: number): void {
  if (!def.skin) return
  const rest = geometry.userData.skinRest ??= new Float32Array(def.skin.positions)
  const positions = deformSkin(rest, def.skin.binding, def.skin.rig, time)
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
