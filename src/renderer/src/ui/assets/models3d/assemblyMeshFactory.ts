import * as THREE from 'three'
import { faceGridSize, type Face3D } from './types'
import type { ResolvedTexture } from './textureResolver'
import { buildAlphaTrimmedGeometry, buildCurvedPlaneGeometry } from './alphaMeshBuilder'
import { DEFAULT_SCENE_THEME, type AssemblySceneTheme } from './assemblyTheme'

/** Alpha below this is cut out (no colour, no depth write) for textured faces. */
export const FACE_ALPHA_CUTOFF = 0.5

export interface OrbitState {
  azimuth: number
  elevation: number
  radius: number
  target: THREE.Vector3
}

export type CameraPreset = 'front' | 'left' | 'right' | 'top' | 'iso'

const DEG = Math.PI / 180

/**
 * Updates camera orbit angles based on preset.
 */
export function applyCameraPreset(orbit: OrbitState, preset: CameraPreset): void {
  switch (preset) {
    case 'front':
      orbit.azimuth = 0
      orbit.elevation = 0.05
      orbit.radius = 1500
      break
    case 'left':
      orbit.azimuth = -Math.PI / 2
      orbit.elevation = 0.05
      orbit.radius = 1500
      break
    case 'right':
      orbit.azimuth = Math.PI / 2
      orbit.elevation = 0.05
      orbit.radius = 1500
      break
    case 'top':
      orbit.azimuth = 0
      orbit.elevation = Math.PI / 2 - 0.05
      orbit.radius = 1500
      break
    case 'iso':
      orbit.azimuth = -Math.PI / 4
      orbit.elevation = 0.45
      orbit.radius = 1600
      break
  }
}

/**
 * Rebuilds Grid and Axes helpers.
 */
export function updateHelpersGroup(
  helpersGroup: THREE.Group,
  showGrid: boolean,
  showAxes: boolean,
  theme: AssemblySceneTheme = DEFAULT_SCENE_THEME
): void {
  while (helpersGroup.children.length > 0) {
    const child = helpersGroup.children[0] as THREE.LineSegments
    helpersGroup.remove(child)
    child.geometry?.dispose()
    ;(child.material as THREE.Material | undefined)?.dispose()
  }

  if (showGrid) {
    const grid = new THREE.GridHelper(2000, 20, new THREE.Color(theme.gridMajor), new THREE.Color(theme.gridMinor))
    grid.position.y = -150
    helpersGroup.add(grid)
  }

  if (showAxes) {
    const axes = new THREE.AxesHelper(300)
    axes.position.set(0, -145, 0)
    helpersGroup.add(axes)
  }
}

/**
 * Places a face mesh in Three.js space (depth space: z grows away from the viewer).
 */
export function applyFaceTransform(mesh: THREE.Object3D, face: Face3D, scale: number): void {
  mesh.position.set(face.position[0] * scale, face.position[1] * scale, -face.position[2] * scale)
  mesh.quaternion.setFromEuler(
    new THREE.Euler(face.rotation[0] * DEG, -face.rotation[1] * DEG, -face.rotation[2] * DEG, 'YXZ')
  )
}

/**
 * Everything that affects a face's geometry/material. Position, rotation and name are
 * excluded so transform-only edits can reuse the existing mesh instead of rebuilding it.
 */
export function faceGeometrySignature(face: Face3D): string {
  const { position: _p, rotation: _r, name: _n, hidden: _h, locked: _l, ...rest } = face
  return JSON.stringify(rest)
}

/**
 * Material for a face. Textured faces use an alpha *cutout* (alphaTest) instead of blending:
 * transparent texels are discarded and never write depth, so they can no longer hide the
 * faces behind them when the camera orbits. alphaToCoverage (MSAA) keeps cut edges smooth.
 * Only faces with opacity < 1 fall back to real blending (without depth writes).
 */
export function createFaceMaterial(face: Face3D, texture: THREE.Texture | null, fallbackColor: string): THREE.Material {
  const opacity = Math.max(0, Math.min(1, face.opacity ?? 1))
  const translucent = opacity < 0.999
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: texture ? 0xffffff : face.color || fallbackColor,
    side: THREE.DoubleSide,
    roughness: 0.5,
    metalness: texture ? 0.05 : 0,
    alphaTest: texture ? FACE_ALPHA_CUTOFF : 0,
    alphaToCoverage: Boolean(texture) && !translucent,
    transparent: translucent,
    opacity,
    depthWrite: !translucent
  })
}

/**
 * Creates a Three.js Mesh for a Face3D with sub-mesh trimming and curvature.
 */
export function createFaceMesh(
  face: Face3D,
  resolved: ResolvedTexture | null,
  meshOnlyPixels: boolean,
  showWireframe: boolean,
  scale: number,
  isSelected: boolean,
  theme: AssemblySceneTheme = DEFAULT_SCENE_THEME
): THREE.Mesh {
  const bendX = face.bendX || 0
  const bendY = face.bendY || 0
  const bendRegion = face.bendRegion || 'all'
  const { cols, rows } = faceGridSize(face)
  const gridRotation = face.gridRotation || 0
  const selectedCells = face.selectedCells || []
  const cellBendAngle = face.cellBendAngle || 0
  const hiddenCells = face.hiddenCells || []

  const mat = createFaceMaterial(face, resolved?.texture ?? null, theme.fallbackFace)
  let geo: THREE.BufferGeometry

  if (resolved) {
    const depthProfile = face.depthProfile || 'none'
    const depthIntensity = face.depthIntensity || 0
    const depthInvert = face.depthInvert || false

    // Pixel-aware tight mesh with custom frame and rotation
    if (meshOnlyPixels && resolved.image) {
      geo = buildAlphaTrimmedGeometry(
        face.width * scale,
        face.height * scale,
        resolved.image,
        cols,
        rows,
        bendX,
        bendY,
        bendRegion,
        hiddenCells,
        gridRotation,
        selectedCells,
        cellBendAngle,
        face.meshMode !== 'manual',
        depthProfile,
        depthIntensity,
        depthInvert
      )
    } else {
      geo = buildCurvedPlaneGeometry(
        face.width * scale,
        face.height * scale,
        cols,
        rows,
        bendX,
        bendY,
        bendRegion,
        depthProfile,
        depthIntensity,
        depthInvert,
        resolved.image
      )
    }
  } else {
    geo = buildCurvedPlaneGeometry(
      face.width * scale,
      face.height * scale,
      cols,
      rows,
      bendX,
      bendY,
      bendRegion,
      face.depthProfile || 'none',
      face.depthIntensity || 0,
      face.depthInvert || false
    )
  }

  const mesh = new THREE.Mesh(geo, mat)
  applyFaceTransform(mesh, face, scale)
  mesh.userData = {
    faceId: face.id,
    size: [face.width * scale, face.height * scale],
    motion:
      face.motionType && face.motionType !== 'none'
        ? {
            type: face.motionType,
            speed: face.motionSpeed ?? 1.0,
            amplitude: face.motionAmplitude ?? 20,
            direction: face.motionDirection ?? 'both',
            anchor: face.motionAnchor ?? 'bottom',
            pinnedCells: face.pinnedCells ?? [],
            width: face.width * scale,
            height: face.height * scale
          }
        : null
  }

  // Wireframe overlay: if meshOnlyPixels is true, wireframe only shows on visible pixels!
  if (showWireframe) {
    const wireGeo = new THREE.WireframeGeometry(geo)
    const wireMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(isSelected ? theme.wireSelected : theme.wire),
      transparent: true,
      opacity: isSelected ? 0.9 : 0.45,
      depthWrite: false
    })
    const wire = new THREE.LineSegments(wireGeo, wireMat)
    mesh.add(wire)
  }

  // Selection outline: with welded vertices EdgesGeometry yields the contour silhouette.
  if (isSelected) {
    const boxGeo = new THREE.EdgesGeometry(geo)
    const boxMat = new THREE.LineBasicMaterial({ color: new THREE.Color(theme.outline) })
    const outline = new THREE.LineSegments(boxGeo, boxMat)
    outline.position.z += 1
    mesh.add(outline)
  }

  return mesh
}
