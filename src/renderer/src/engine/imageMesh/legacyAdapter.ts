/**
 * Legacy Adapter for Face3D ↔ ImageMeshDefinition
 *
 * Ensures full backward compatibility with models and projects authored using
 * legacy Face3D properties (bendX, bendY, bendLateral, depthProfile, motionType).
 */

import type { Face3D } from '../../ui/assets/models3d/types'
import {
  type ImageMeshDefinition,
  type ImageMeshModifier,
  type BendModifier,
  type DepthProfileModifier,
  IMAGE_MESH_DEFINITION_VERSION
} from '@shared/imageMeshDefinition'

export function faceToMeshDefinition(face: Face3D): ImageMeshDefinition {
  const cols = face.gridCols ?? face.gridRes ?? 32
  const rows = face.gridRows ?? face.gridRes ?? 48
  const modifiers: ImageMeshModifier[] = []

  // 1. Horizontal / arc bend
  if (face.bendX || face.arcAngle) {
    const bendMod: BendModifier = {
      type: 'bend',
      id: 'legacy-bend-x',
      enabled: true,
      axis: 'x',
      intensity: face.bendX ?? 0,
      arcAngle: face.arcAngle,
      taperRatio: face.taperRatio,
      region: face.bendRegion
    }
    modifiers.push(bendMod)
  }

  // 2. Vertical / lateral bend
  if (face.bendY || face.bendLateral) {
    const bendYMod: BendModifier = {
      type: 'bend',
      id: 'legacy-bend-y',
      enabled: true,
      axis: 'y',
      intensity: face.bendY ?? 0,
      lateral: face.bendLateral ?? 0,
      region: face.bendRegion
    }
    modifiers.push(bendYMod)
  }

  // 3. Depth Profile (After Effects 2.5D relief)
  if (face.depthProfile && face.depthProfile !== 'none') {
    const depthMod: DepthProfileModifier = {
      type: 'depthProfile',
      id: 'legacy-depth',
      enabled: true,
      profile: face.depthProfile,
      intensity: face.depthIntensity ?? 0,
      invert: face.depthInvert
    }
    modifiers.push(depthMod)
  }

  return {
    version: IMAGE_MESH_DEFINITION_VERSION,
    id: face.id,
    name: face.name,
    surface: {
      width: face.width,
      height: face.height,
      subdivisions: [cols, rows],
      restUVBounds: face.cropBounds ?? [0, 0, 1, 1]
    },
    anchorUV: [0.5, 0.0],
    tipUV: [0.5, 1.0],
    silhouettePolygon: face.silhouettePolygon,
    modifiers,
    motion: face.motionType && face.motionType !== 'none'
      ? {
          type: face.motionType,
          speed: face.motionSpeed ?? 1,
          amplitude: face.motionAmplitude ?? 20,
          direction: face.motionDirection ?? 'horizontal',
          anchor: face.motionAnchor ?? 'bottom'
        }
      : undefined,
    materials: {
      frontAssetId: face.assetId,
      frontAssetPath: face.assetPath,
      alphaCutoff: face.alphaCutoff ?? 0.05,
      color: face.color,
      doubleSided: true
    }
  }
}
