import * as THREE from 'three'
import { faceGridSize, type Face3D } from './types'
import type { ResolvedTexture } from './textureResolver'
import { buildAlphaTrimmedGeometry, buildCurvedPlaneGeometry } from './alphaMeshBuilder'
import { DEFAULT_SCENE_THEME, type AssemblySceneTheme } from './assemblyTheme'

/** Alpha below this is cut out (no colour, no depth write) for textured faces. Default is 0.05 so fine foliage tips and antialiased edges are preserved. */
export const FACE_ALPHA_CUTOFF = 0.05

export interface OrbitState {
  azimuth: number
  elevation: number
  radius: number
  target: THREE.Vector3
}

export type CameraPreset = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'iso' | 'custom'

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
    case 'back':
      orbit.azimuth = Math.PI
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
    case 'bottom':
      orbit.azimuth = 0
      orbit.elevation = -Math.PI / 2 + 0.05
      orbit.radius = 1500
      break
    case 'iso':
      orbit.azimuth = -Math.PI / 4
      orbit.elevation = 0.45
      orbit.radius = 1600
      break
    case 'custom':
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
  theme: AssemblySceneTheme = DEFAULT_SCENE_THEME,
  isDarkScene?: boolean
): void {
  while (helpersGroup.children.length > 0) {
    const child = helpersGroup.children[0] as THREE.LineSegments
    helpersGroup.remove(child)
    child.geometry?.dispose()
    ;(child.material as THREE.Material | undefined)?.dispose()
  }

  if (showGrid) {
    const major = isDarkScene ? '#526077' : theme.gridMajor
    const minor = isDarkScene ? '#283244' : theme.gridMinor
    const grid = new THREE.GridHelper(2000, 20, new THREE.Color(major), new THREE.Color(minor))
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
  const { position: _p, rotation: _r, name: _n, hidden: _h, locked: _l, clipBy: _cb, joinPoints: _jp, ...rest } = face
  return JSON.stringify(rest)
}

/**
 * Material for a face. Uses MeshLambertMaterial (diffuse-only reflection) so the sun tints
 * and shades the image colours without any unnatural specular glare on angled faces.
 * Textured faces use an alpha cutout (alphaTest) instead of blending: transparent texels
 * are discarded and never write depth, so they can no longer hide faces behind them.
 * alphaToCoverage keeps cut edges smooth with MSAA.
 */
export function createFaceMaterial(face: Face3D, texture: THREE.Texture | null, fallbackColor: string): THREE.Material {
  const opacity = Math.max(0, Math.min(1, face.opacity ?? 1))
  const translucent = opacity < 0.999
  const cutoff = face.alphaCutoff ?? FACE_ALPHA_CUTOFF
  const mat = new THREE.MeshLambertMaterial({
    map: texture,
    color: texture ? 0xffffff : face.color || fallbackColor,
    side: THREE.DoubleSide,
    alphaTest: texture ? cutoff : 0,
    alphaToCoverage: Boolean(texture) && !translucent,
    transparent: translucent,
    opacity,
    depthWrite: !translucent
  })
  mat.shadowSide = THREE.DoubleSide
  return mat
}

function buildFaceGeometry(
  face: Face3D,
  resolved: ResolvedTexture | null,
  meshOnlyPixels: boolean,
  scale: number,
  cols: number,
  rows: number,
  bendX: number,
  bendY: number,
  bendRegion: Face3D['bendRegion'],
  hiddenCells: string[],
  gridRotation: number,
  selectedCells: string[],
  cellBendAngle: number,
  bendLateral = 0
): THREE.BufferGeometry {
  const w = face.width * scale
  const h = face.height * scale
  const depthProfile = face.depthProfile || 'none'
  const depthIntensity = face.depthIntensity || 0
  const depthInvert = face.depthInvert || false
  const presetPolygon = face.silhouettePolygon
  const arcAngle = face.arcAngle || 0
  const taperRatio = face.taperRatio ?? 1

  let geo: THREE.BufferGeometry
  if (presetPolygon && presetPolygon.length >= 3) {
    geo = buildAlphaTrimmedGeometry(
      w, h, resolved?.image ?? null, cols, rows, bendX, bendY, bendRegion,
      hiddenCells, gridRotation, selectedCells, cellBendAngle, true,
      depthProfile, depthIntensity, depthInvert, presetPolygon, bendLateral,
      arcAngle, taperRatio
    )
  } else if (resolved) {
    if (meshOnlyPixels && resolved.image) {
      geo = buildAlphaTrimmedGeometry(
        w, h, resolved.image, cols, rows, bendX, bendY, bendRegion,
        hiddenCells, gridRotation, selectedCells, cellBendAngle, face.meshMode !== 'manual',
        depthProfile, depthIntensity, depthInvert, undefined, bendLateral,
        arcAngle, taperRatio
      )
    } else {
      geo = buildCurvedPlaneGeometry(
        w, h, cols, rows, bendX, bendY, bendRegion,
        depthProfile, depthIntensity, depthInvert, resolved.image, bendLateral,
        arcAngle, taperRatio
      )
    }
  } else {
    geo = buildCurvedPlaneGeometry(
      w, h, cols, rows, bendX, bendY, bendRegion, depthProfile, depthIntensity, depthInvert, undefined, bendLateral,
      arcAngle, taperRatio
    )
  }

  // Áp dụng các độ lệch điêu khắc cọ cục bộ (Sculpt deltas) nếu có
  if (face.sculptOffsets && face.sculptOffsets.length > 0) {
    const posAttr = geo.getAttribute('position')
    if (posAttr) {
      const count = Math.min(posAttr.count, Math.floor(face.sculptOffsets.length / 3))
      for (let i = 0; i < count; i++) {
        const ox = face.sculptOffsets[i * 3] || 0
        const oy = face.sculptOffsets[i * 3 + 1] || 0
        const oz = face.sculptOffsets[i * 3 + 2] || 0
        if (ox !== 0 || oy !== 0 || oz !== 0) {
          posAttr.setXYZ(i, posAttr.getX(i) + ox, posAttr.getY(i) + oy, posAttr.getZ(i) + oz)
        }
      }
      posAttr.needsUpdate = true
      geo.computeVertexNormals()
    }
  }

  return geo
}

/**
 * Trích xuất CHỈ các cạnh biên ngoài cùng (Boundary Edges) của mesh
 * (những cạnh chỉ thuộc về đúng 1 tam giác, không bị chia sẻ giữa 2 tam giác).
 * Nhờ đó, đường viền chọn mặt (selection outline) CHỈ ôm theo chu vi ngoài cùng,
 * tuyệt đối KHÔNG sinh ra các đường lưới nội bộ bên trong bề mặt khi uốn cong hay điêu khắc cọ.
 */
export function createBoundaryEdgesGeometry(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const index = geo.getIndex()
  const posAttr = geo.getAttribute('position')
  if (!posAttr || posAttr.count === 0) return new THREE.BufferGeometry()

  const edgeCount = new Map<string, [number, number]>()
  const addEdge = (a: number, b: number) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`
    if (edgeCount.has(key)) {
      edgeCount.delete(key)
    } else {
      edgeCount.set(key, [a, b])
    }
  }

  if (index) {
    const arr = index.array
    for (let i = 0; i < arr.length; i += 3) {
      addEdge(arr[i], arr[i + 1])
      addEdge(arr[i + 1], arr[i + 2])
      addEdge(arr[i + 2], arr[i])
    }
  } else {
    for (let i = 0; i < posAttr.count; i += 3) {
      addEdge(i, i + 1)
      addEdge(i + 1, i + 2)
      addEdge(i + 2, i)
    }
  }

  const linePositions: number[] = []
  for (const [a, b] of edgeCount.values()) {
    linePositions.push(
      posAttr.getX(a), posAttr.getY(a), posAttr.getZ(a),
      posAttr.getX(b), posAttr.getY(b), posAttr.getZ(b)
    )
  }

  const edgeGeo = new THREE.BufferGeometry()
  edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
  return edgeGeo
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
  theme: AssemblySceneTheme = DEFAULT_SCENE_THEME,
  lockedStructure?: boolean
): THREE.Mesh {
  const bendX = face.bendX || 0
  const bendY = face.bendY || 0
  const bendLateral = face.bendLateral || 0
  const bendRegion = face.bendRegion || 'all'
  const { cols, rows } = faceGridSize(face)
  const gridRotation = face.gridRotation || 0
  const selectedCells = face.selectedCells || []
  const cellBendAngle = face.cellBendAngle || 0
  const hiddenCells = face.hiddenCells || []

  const mat = createFaceMaterial(face, resolved?.texture ?? null, theme.fallbackFace)
  const geo = buildFaceGeometry(
    face, resolved, meshOnlyPixels, scale, cols, rows,
    bendX, bendY, bendRegion, hiddenCells, gridRotation, selectedCells, cellBendAngle, bendLateral
  )

  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  applyFaceTransform(mesh, face, scale)
  mesh.userData = {
    faceId: face.id,
    size: [face.width * scale, face.height * scale],
    lockedStructure: !!lockedStructure,
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

  // Wireframe overlay: CHỈ hiển thị khi người dùng bật nút Mesh (showWireframe === true)
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

  // Selection outline: CHỈ vẽ đường bao mép ngoài cùng (boundary silhouette), không vẽ lưới bên trong!
  if (isSelected) {
    const boundaryGeo = createBoundaryEdgesGeometry(geo)
    const boxMat = new THREE.LineBasicMaterial({ color: new THREE.Color(theme.outline) })
    const outline = new THREE.LineSegments(boundaryGeo, boxMat)
    outline.position.z += 0.5
    mesh.add(outline)
  }

  return mesh
}
