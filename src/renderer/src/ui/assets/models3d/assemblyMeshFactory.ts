import * as THREE from 'three'
import type { Face3D } from './types'
import type { ResolvedTexture } from './textureResolver'
import { buildAlphaTrimmedGeometry, buildCurvedPlaneGeometry } from './alphaMeshBuilder'

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
  showAxes: boolean
): void {
  while (helpersGroup.children.length > 0) {
    helpersGroup.remove(helpersGroup.children[0])
  }

  if (showGrid) {
    const grid = new THREE.GridHelper(2000, 20, 0x334155, 0x1e293b)
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
 * Creates a Three.js Mesh for a Face3D with sub-mesh trimming and curvature.
 */
export function createFaceMesh(
  face: Face3D,
  resolved: ResolvedTexture | null,
  meshOnlyPixels: boolean,
  showWireframe: boolean,
  scale: number,
  isSelected: boolean
): THREE.Mesh {
  const bendX = face.bendX || 0
  const bendY = face.bendY || 0
  const bendRegion = face.bendRegion || 'all'
  const cols = face.gridCols || face.gridRes || 32
  const rows = face.gridRows || face.gridRes || 32
  const gridRotation = face.gridRotation || 0
  const selectedCells = face.selectedCells || []
  const cellBendAngle = face.cellBendAngle || 0
  const hiddenCells = face.hiddenCells || []

  let mat: THREE.Material
  let geo: THREE.BufferGeometry

  if (resolved) {
    mat = new THREE.MeshStandardMaterial({
      map: resolved.texture,
      side: THREE.DoubleSide,
      transparent: true,
      roughness: 0.5,
      metalness: 0.05
    })

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
    mat = new THREE.MeshStandardMaterial({
      color: face.color || '#8b7bff',
      side: THREE.DoubleSide,
      roughness: 0.5
    })
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

  // Transform: Depth space to Three.js coordinates
  mesh.position.set(
    face.position[0] * scale,
    face.position[1] * scale,
    -face.position[2] * scale
  )

  const euler = new THREE.Euler(
    face.rotation[0] * DEG,
    -face.rotation[1] * DEG,
    -face.rotation[2] * DEG,
    'YXZ'
  )
  mesh.quaternion.setFromEuler(euler)
  mesh.userData = {
    faceId: face.id,
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
      color: isSelected ? 0x00ffff : 0x64748b,
      linewidth: isSelected ? 2 : 1,
      transparent: true,
      opacity: isSelected ? 0.95 : 0.55
    })
    const wire = new THREE.LineSegments(wireGeo, wireMat)
    mesh.add(wire)
  }

  // Selection outline box if selected
  if (isSelected) {
    const boxGeo = new THREE.EdgesGeometry(geo)
    const boxMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 2.5
    })
    const outline = new THREE.LineSegments(boxGeo, boxMat)
    outline.position.z += 1
    mesh.add(outline)
  }

  return mesh
}
