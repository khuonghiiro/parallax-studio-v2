/**
 * Image Mesh Contract Engine Module
 *
 * Provides coordinate transformations, anchor position evaluation on deformed faces,
 * and contract utilities for the 3D engine and assembly tools.
 */

import * as THREE from 'three'
import type { Face3D } from '../../ui/assets/models3d/types'
import {
  type AttachmentBand,
  type ContentBounds,
  type ImageMeshSlotContract,
  type CoordinateSpace,
  IMAGE_CONTRACT_SCHEMA_VERSION,
  imageYToUvV,
  uvVToImageY,
  imagePointToUV,
  uvToImagePoint,
  imageBoundsToUvBounds,
  uvBoundsToImageBounds,
  convertPolygonSpace,
  buildSlotPrompts,
  generateSlotGuideSvg,
  generateSlotGuideDataUrl
} from '@shared/imageMeshContract'

export {
  type AttachmentBand,
  type ContentBounds,
  type ImageMeshSlotContract,
  type CoordinateSpace,
  IMAGE_CONTRACT_SCHEMA_VERSION,
  imageYToUvV,
  uvVToImageY,
  imagePointToUV,
  uvToImagePoint,
  imageBoundsToUvBounds,
  uvBoundsToImageBounds,
  convertPolygonSpace,
  buildSlotPrompts,
  generateSlotGuideSvg,
  generateSlotGuideDataUrl
}

/**
 * Calculates the local 3D position [lx, ly, lz] on a face at UV (0..1, v up),
 * taking into account face dimensions and curvature deformations (bendX, bendY, bendLateral).
 */
export function evaluateLocalPointOnFace(
  face: Pick<Face3D, 'width' | 'height' | 'bendX' | 'bendY' | 'bendLateral' | 'bendRegion' | 'arcAngle' | 'taperRatio'>,
  uv: [number, number]
): [number, number, number] {
  const [u, v] = uv
  const w = face.width
  const h = face.height

  // Taper factor along height (v=0 is base, v=1 is tip)
  const taper = face.taperRatio !== undefined ? 1.0 - (1.0 - face.taperRatio) * v : 1.0
  const localX = (u - 0.5) * w * taper
  const localY = (v - 0.5) * h
  let localZ = 0

  // 1. Horizontal curvature (bendX / arcAngle)
  const bendX = face.bendX ?? 0
  const arcAngle = face.arcAngle ?? 0
  if (arcAngle > 0) {
    const rad = ((u - 0.5) * arcAngle * Math.PI) / 180
    const r = (w / (arcAngle * Math.PI / 180))
    const defX = r * Math.sin(rad)
    const defZ = r * (1 - Math.cos(rad))
    return [defX, localY, defZ]
  } else if (bendX !== 0) {
    const normalizedU = (u - 0.5) * 2 // -1..1
    localZ += -bendX * 0.25 * (1 - normalizedU * normalizedU)
  }

  // 2. Vertical curvature (bendY)
  const bendY = face.bendY ?? 0
  if (bendY !== 0) {
    const region = face.bendRegion ?? 'all'
    let factor = v * v // curvature grows toward tip
    if (region === 'bottom') factor = (1 - v) * (1 - v)
    else if (region === 'top') factor = Math.max(0, (v - 0.5) * 2) ** 2
    localZ += bendY * 0.3 * factor
  }

  // 3. Lateral curve (bendLateral)
  const bendLateral = face.bendLateral ?? 0
  let defX = localX
  if (bendLateral !== 0) {
    const region = face.bendRegion ?? 'all'
    if (region === 'curl') {
      // S-curve oscillation
      defX += Math.sin(v * Math.PI * 2) * bendLateral * 0.2
    } else {
      defX += (v * v) * bendLateral * 0.25
    }
  }

  return [defX, localY, localZ]
}

/**
 * Calculates the exact 3D world position of a face's anchor in model space,
 * evaluated AFTER local curvature deformation and face rotation/translation.
 */
export function evaluateFaceAnchor3D(
  face: Face3D,
  anchorUV?: [number, number]
): [number, number, number] {
  const uv = anchorUV ?? [0.5, 0.0]
  const [lx, ly, lz] = evaluateLocalPointOnFace(face, uv)

  // Construct face basis matrix according to depth space convention (Euler YXZ with flipped z)
  const DEG = Math.PI / 180
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(face.rotation[0] * DEG, -face.rotation[1] * DEG, -face.rotation[2] * DEG, 'YXZ')
  )
  const posThree = new THREE.Vector3(face.position[0], face.position[1], -face.position[2])
  const scale = new THREE.Vector3(...(face.scale ?? [1, 1, 1]))
  const mat = new THREE.Matrix4().compose(posThree, q, scale)

  const ptInThree = new THREE.Vector3(lx, ly, -lz).applyMatrix4(mat)
  return [
    Math.round(ptInThree.x * 100) / 100,
    Math.round(ptInThree.y * 100) / 100,
    Math.round(-ptInThree.z * 100) / 100
  ]
}
