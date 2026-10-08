import * as THREE from 'three'
import {
  computeDepthProfileZ,
  createLuminanceSampler,
  type DepthProfileType,
  type LuminanceSampler
} from './meshEffectsAE'
import { computeContourCells, makeUVTransform } from './contourMesh'
import { getImageSilhouette, silhouetteFromBoolGrid, silhouetteFromPolygon, type Silhouette } from './silhouette'

export type AlphaSampler = (u: number, v: number) => number

/**
 * Creates a high-resolution alpha sampler function from an image or canvas.
 * Returns alpha value in 0..255 range for normalized UV coordinates (0..1).
 */
export function createAlphaSampler(
  image: HTMLImageElement | HTMLCanvasElement,
  sampleWidth = 128,
  sampleHeight = 128
): AlphaSampler {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = sampleWidth
    canvas.height = sampleHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return () => 255

    ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight)
    const imgData = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data

    return (u: number, v: number) => {
      // Clamp UV to 0..1
      const cu = Math.max(0, Math.min(1, u))
      // In texture space v=1 is top, v=0 is bottom; in canvas y=0 is top, y=1 is bottom
      const cv = Math.max(0, Math.min(1, 1 - v))

      const px = Math.floor(cu * (sampleWidth - 1))
      const py = Math.floor(cv * (sampleHeight - 1))
      const idx = (py * sampleWidth + px) * 4 + 3
      return imgData[idx] ?? 0
    }
  } catch {
    return () => 255
  }
}

/**
 * Samples the alpha transparency of an image downsampled to a cols x rows grid.
 * Returns a 2D boolean array where true means the cell contains visible pixels.
 */
export function sampleAlphaGrid(
  image: HTMLImageElement | HTMLCanvasElement,
  cols = 32,
  rows = 32,
  alphaThreshold = 12
): boolean[][] {
  const sampler = createAlphaSampler(image, Math.max(64, cols * 2), Math.max(64, rows * 2))
  const grid: boolean[][] = []

  for (let r = 0; r < rows; r++) {
    const row: boolean[] = []
    const vCenter = 1 - (r + 0.5) / rows
    for (let c = 0; c < cols; c++) {
      const uCenter = (c + 0.5) / cols
      const a = sampler(uCenter, vCenter)
      row.push(a > alphaThreshold)
    }
    grid.push(row)
  }
  return grid
}

export type BendRegion = 'all' | 'bottom' | 'top' | 'left' | 'right' | 'curl'

/**
 * Calculates Z displacement for curving / bending a plane into an arch, flared tip, eave or wave.
 * Supports partial region bending (e.g. flaring petal tips, curling eaves while keeping base flat,
 * or sinusoidal ruffled curls).
 */
export function computeBendZ(
  u: number,
  v: number,
  width: number,
  height: number,
  bendX = 0,
  bendY = 0,
  region: BendRegion = 'all'
): number {
  let z = 0

  if (region === 'top') {
    // Only bend top portion (v in 0.15..1); bottom stays straight/flat (stem/root attachment)
    // Smooth cubic easing: 0 at v=0.15, 1 at v=1.0. Allows petals/leaves to flare out at tips.
    const t = Math.max(0, Math.min(1, (v - 0.15) / 0.85))
    const curveY = t * t * (3 - 2 * t)
    if (bendY !== 0) {
      z += (bendY / 100) * curveY * (height * 0.35)
    }
  } else if (region === 'bottom') {
    // Only bend bottom portion (v in 0..0.85); top stays flat (roof ridge)
    const t = Math.max(0, Math.min(1, (0.85 - v) / 0.85))
    const curveY = t * t * (3 - 2 * t)
    if (bendY !== 0) {
      z += (bendY / 100) * curveY * (height * 0.35)
    }
  } else if (region === 'curl') {
    // Sinusoidal S-curve / wave for ruffled, curly flower petals and leaves
    const wave = Math.sin(v * Math.PI) * 0.65 - Math.sin(v * 2 * Math.PI) * 0.55
    if (bendY !== 0) {
      z += (bendY / 100) * wave * (height * 0.35)
    }
  } else {
    // Classic symmetric parabolic arch across the entire height
    if (bendY !== 0) {
      z += (bendY / 100) * Math.sin(v * Math.PI) * (height * 0.35)
    }
  }

  // Horizontal curvature (bendX)
  if (region === 'left') {
    const t = Math.max(0, Math.min(1, (0.85 - u) / 0.85))
    const curveX = t * t * (3 - 2 * t)
    if (bendX !== 0) {
      z += (bendX / 100) * curveX * (width * 0.35)
    }
  } else if (region === 'right') {
    const t = Math.max(0, Math.min(1, (u - 0.15) / 0.85))
    const curveX = t * t * (3 - 2 * t)
    if (bendX !== 0) {
      z += (bendX / 100) * curveX * (width * 0.35)
    }
  } else {
    if (bendX !== 0) {
      z += (bendX / 100) * Math.sin(u * Math.PI) * (width * 0.35)
    }
  }

  return z
}

/**
 * Builds a custom Three.js plane geometry that hugs the visible pixels of the image.
 *
 * Boundary cells are clipped against the exact outline polygons of the opaque pixels (see
 * `silhouette.ts` / `contourMesh.ts`), so the outline hugs the pixels within ~1 px, never
 * cuts away opaque pixels and stays watertight. Remaining sub-pixel detail comes from the
 * material's alpha cutout.
 */
export function buildAlphaTrimmedGeometry(
  width: number,
  height: number,
  alphaGridOrImage: boolean[][] | HTMLImageElement | HTMLCanvasElement | null | undefined,
  cols = 32,
  rows = 32,
  bendX = 0,
  bendY = 0,
  region: BendRegion = 'all',
  hiddenCells?: string[],
  gridRotation = 0,
  selectedCells?: string[],
  cellBendAngle = 0,
  autoTrimAlpha = true,
  depthProfile: DepthProfileType = 'none',
  depthIntensity = 0,
  depthInvert = false,
  presetPolygon?: number[][]
): THREE.BufferGeometry {
  const hiddenSet = new Set(hiddenCells || [])
  const selectedSet = new Set(selectedCells || [])
  const transformUV = makeUVTransform(gridRotation)
  const image = alphaGridOrImage && !Array.isArray(alphaGridOrImage) ? alphaGridOrImage : undefined

  let silhouette: Silhouette | null = null
  if (presetPolygon && presetPolygon.length >= 3) {
    silhouette = silhouetteFromPolygon(presetPolygon, 'uv')
  } else if (autoTrimAlpha) {
    silhouette = image
      ? getImageSilhouette(image)
      : alphaGridOrImage && Array.isArray(alphaGridOrImage)
        ? silhouetteFromBoolGrid(alphaGridOrImage, cols, rows)
        : null
  }
  const lumSampler: LuminanceSampler | undefined =
    image && depthProfile === 'luminance'
      ? createLuminanceSampler(image, Math.max(64, cols * 2), Math.max(64, rows * 2))
      : undefined

  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  // Shared edges produce bit-identical grid points, so vertices can be welded for smooth normals.
  const vertexIds = new Map<string, number>()
  const vertexIndex = (gx: number, gy: number, extraZ: number): number => {
    const id = `${gx}|${gy}|${extraZ}`
    const existing = vertexIds.get(id)
    if (existing !== undefined) return existing
    const u = gx
    const v = 1 - gy
    const z =
      computeBendZ(u, v, width, height, bendX, bendY, region) +
      computeDepthProfileZ({
        u, v, width, height, profile: depthProfile, intensity: depthIntensity, invert: depthInvert, luminanceSampler: lumSampler
      }) +
      extraZ
    const [tu, tv] = transformUV(u, v)
    positions.push(-width / 2 + gx * width, height / 2 - gy * height, z)
    uvs.push(tu, tv)
    const index = positions.length / 3 - 1
    vertexIds.set(id, index)
    return index
  }

  for (const cell of computeContourCells(cols, rows, silhouette, gridRotation, autoTrimAlpha)) {
    if (hiddenSet.has(cell.key)) continue
    const extraZ = selectedSet.has(cell.key) && cellBendAngle !== 0 ? (cellBendAngle / 90) * (height * 0.25) : 0
    // Triangle-level erase keys only map onto full quads; a clipped cell is dropped entirely.
    if (!cell.full && (hiddenSet.has(`${cell.key}_t0`) || hiddenSet.has(`${cell.key}_t1`))) continue
    cell.triangles.forEach((tri, tIdx) => {
      if (cell.full && hiddenSet.has(`${cell.key}_t${tIdx}`)) return
      for (const idx of tri) indices.push(vertexIndex(cell.polygon[idx][0], cell.polygon[idx][1], extraZ))
    })
  }

  // Fallback if no visible vertices found
  if (indices.length === 0) {
    return buildCurvedPlaneGeometry(
      width, height, cols, rows, bendX, bendY, region, depthProfile, depthIntensity, depthInvert, image
    )
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()

  // Store base positions & UVs for After Effects procedural motion dynamics
  geo.userData = {
    basePositions: new Float32Array(positions),
    uvs: new Float32Array(uvs)
  }
  return geo
}

/**
 * Builds a subdivided rectangular plane deformed by bendX, bendY curvature and depth profile.
 */
export function buildCurvedPlaneGeometry(
  width: number,
  height: number,
  cols = 32,
  rows = 32,
  bendX = 0,
  bendY = 0,
  region: BendRegion = 'all',
  depthProfile: DepthProfileType = 'none',
  depthIntensity = 0,
  depthInvert = false,
  image?: HTMLImageElement | HTMLCanvasElement
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, height, cols, rows)
  const posAttr = geo.getAttribute('position')
  const uvAttr = geo.getAttribute('uv')

  const lumSampler =
    depthProfile === 'luminance' && image
      ? createLuminanceSampler(image, Math.max(64, cols * 2), Math.max(64, rows * 2))
      : undefined

  const hasBend = bendX !== 0 || bendY !== 0
  const hasDepth = depthProfile !== 'none' && depthIntensity !== 0

  if (hasBend || hasDepth) {
    for (let i = 0; i < posAttr.count; i++) {
      const u = uvAttr.getX(i)
      const v = uvAttr.getY(i)
      const bendZ = computeBendZ(u, v, width, height, bendX, bendY, region)
      const depthZ = computeDepthProfileZ({
        u,
        v,
        width,
        height,
        profile: depthProfile,
        intensity: depthIntensity,
        invert: depthInvert,
        luminanceSampler: lumSampler
      })
      posAttr.setZ(i, bendZ + depthZ)
    }
    posAttr.needsUpdate = true
    geo.computeVertexNormals()
  }

  // Store base positions for dynamic procedural motion
  const posArray = new Float32Array(posAttr.array)
  const uvArray = new Float32Array(uvAttr.array)
  geo.userData = {
    basePositions: posArray,
    uvs: uvArray
  }
  return geo
}
