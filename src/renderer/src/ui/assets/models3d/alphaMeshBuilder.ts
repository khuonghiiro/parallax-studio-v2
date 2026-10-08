import * as THREE from 'three'
import {
  computeDepthProfileZ,
  createLuminanceSampler,
  type DepthProfileType,
  type LuminanceSampler
} from './meshEffectsAE'
import type { OrigamiFoldLine, Warp3x3Preset } from './types'

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

/**
 * Calculates Z displacement for curving / bending a plane into an arch or eave wave.
 * Supports partial region bending (e.g. curling bottom eaves while keeping top flat).
 */
export function computeBendZ(
  u: number,
  v: number,
  width: number,
  height: number,
  bendX = 0,
  bendY = 0,
  region: 'all' | 'bottom' | 'top' | 'left' | 'right' = 'all'
): number {
  let z = 0

  // Region attenuation factors (0..1)
  let factorX = 1
  let factorY = 1

  if (region === 'bottom') {
    // Only bend bottom portion (v in 0..0.5); top (v in 0.5..1) stays completely flat
    factorY = v < 0.5 ? Math.cos((v / 0.5) * (Math.PI / 2)) : 0
  } else if (region === 'top') {
    // Only bend top portion (v in 0.5..1); bottom stays flat
    factorY = v > 0.5 ? Math.sin(((v - 0.5) / 0.5) * (Math.PI / 2)) : 0
  } else if (region === 'left') {
    // Only bend left flap (u < 0.5)
    factorX = u < 0.5 ? Math.cos((u / 0.5) * (Math.PI / 2)) : 0
  } else if (region === 'right') {
    // Only bend right flap (u > 0.5)
    factorX = u > 0.5 ? Math.sin(((u - 0.5) / 0.5) * (Math.PI / 2)) : 0
  }

  if (bendX !== 0) {
    z += (bendX / 100) * Math.sin(u * Math.PI) * (width * 0.35) * factorX
  }
  if (bendY !== 0) {
    z += (bendY / 100) * Math.sin(v * Math.PI) * (height * 0.35) * factorY
  }
  return z
}

/**
 * Calculates Origami 3D fold transformation for vertex (x, y, z) along crease line.
 */
export function applyOrigamiFold(
  u: number,
  v: number,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  foldLine?: OrigamiFoldLine
): { x: number; y: number; z: number } {
  if (!foldLine || !foldLine.enabled || foldLine.angle === 0) {
    return { x, y, z }
  }

  // Convert p1, p2 from UV space (0..1) to local plane coordinates (x in -w/2..w/2, y in -h/2..h/2)
  const ax = -width / 2 + foldLine.p1[0] * width
  const ay = -height / 2 + (1 - foldLine.p1[1]) * height
  const bx = -width / 2 + foldLine.p2[0] * width
  const by = -height / 2 + (1 - foldLine.p2[1]) * height

  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy)
  if (len < 0.001) return { x, y, z }

  // Unit vector along crease
  const ux = dx / len
  const uy = dy / len

  // In-plane 2D normal perpendicular to crease
  const nx = -uy
  const ny = ux

  // Signed distance of vertex from fold line
  const sdist = (x - ax) * nx + (y - ay) * ny
  const isSideA = sdist >= 0
  const shouldFold = foldLine.foldSide === 'sideA' ? isSideA : !isSideA

  if (!shouldFold) {
    return { x, y, z }
  }

  // Rodrigues rotation around axis (ux, uy, 0) through point (ax, ay, 0)
  const rad = (foldLine.angle * Math.PI) / 180
  const cosT = Math.cos(rad)
  const sinT = Math.sin(rad)

  const rx = x - ax
  const ry = y - ay
  const rz = z

  const cx = uy * rz
  const cy = -ux * rz
  const cz = ux * ry - uy * rx

  const dot = ux * rx + uy * ry

  const rotX = rx * cosT + cx * sinT + ux * dot * (1 - cosT)
  const rotY = ry * cosT + cy * sinT + uy * dot * (1 - cosT)
  const rotZ = rz * cosT + cz * sinT

  return {
    x: ax + rotX,
    y: ay + rotY,
    z: rotZ
  }
}

/**
 * Calculates Photoshop 3x3 Warp displacement for staircase steps, arches, or corners.
 */
export function computeWarp3x3Displacement(
  u: number,
  v: number,
  width: number,
  height: number,
  mode?: Warp3x3Preset,
  intensity = 30
): { dx: number; dy: number; dz: number } {
  if (!mode || mode === 'none' || intensity === 0) {
    return { dx: 0, dy: 0, dz: 0 }
  }

  const factor = intensity / 40

  if (mode === 'stairs') {
    // 3 staircase step bands along height (v in 0..1)
    const stepIdx = Math.min(2, Math.floor(v * 3))
    const dz = stepIdx * (height * 0.12) * factor
    const bandV = v * 3 - stepIdx
    const riserZ = Math.sin(bandV * Math.PI) * (height * 0.03) * factor
    return { dx: 0, dy: 0, dz: dz + riserZ }
  }

  if (mode === 'corner') {
    if (u > 0.5) {
      const dist = (u - 0.5) * width
      return { dx: 0, dy: 0, dz: dist * factor }
    }
  }

  if (mode === 'arch') {
    const dz = Math.sin(u * Math.PI) * (width * 0.25) * factor
    return { dx: 0, dy: 0, dz }
  }

  if (mode === 'wave') {
    const dz = Math.sin(u * Math.PI * 2) * (width * 0.15) * factor
    return { dx: 0, dy: 0, dz }
  }

  return { dx: 0, dy: 0, dz: 0 }
}

interface VertexData {
  u: number
  v: number
  x: number
  y: number
  z: number
  alpha: number
}

/**
 * Builds a custom Three.js Plane BufferGeometry with TRIANGLE-LEVEL ALPHA TRIMMING.
 * Along diagonal boundaries (like roof slopes), it eliminates empty 90-degree right-angle
 * corners by discarding triangles that fall in the transparent area, following the diagonal contour.
 */
export function buildAlphaTrimmedGeometry(
  width: number,
  height: number,
  alphaGridOrImage: boolean[][] | HTMLImageElement | HTMLCanvasElement,
  cols = 32,
  rows = 32,
  bendX = 0,
  bendY = 0,
  region: 'all' | 'bottom' | 'top' | 'left' | 'right' = 'all',
  hiddenCells?: string[],
  gridRotation = 0,
  selectedCells?: string[],
  cellBendAngle = 0,
  autoTrimAlpha = true,
  depthProfile: DepthProfileType = 'none',
  depthIntensity = 0,
  depthInvert = false,
  foldLine?: OrigamiFoldLine,
  warp3x3Mode?: Warp3x3Preset,
  warp3x3Intensity = 30
): THREE.BufferGeometry {
  const hiddenSet = new Set(hiddenCells || [])
  const selectedSet = new Set(selectedCells || [])

  // Grid angle rotation helper: rotates the sampling frame to match diagonal angles
  const angleRad = (gridRotation * Math.PI) / 180
  const cosA = Math.cos(angleRad)
  const sinA = Math.sin(angleRad)

  const transformUV = (u: number, v: number): [number, number] => {
    if (gridRotation === 0) return [u, v]
    const du = u - 0.5
    const dv = v - 0.5
    return [
      Math.max(0, Math.min(1, 0.5 + (du * cosA - dv * sinA))),
      Math.max(0, Math.min(1, 0.5 + (du * sinA + dv * cosA)))
    ]
  }

  // Create high-res alpha sampler
  let sampler: AlphaSampler
  let lumSampler: LuminanceSampler | undefined

  if (Array.isArray(alphaGridOrImage)) {
    // Fallback if pre-computed grid passed
    const grid = alphaGridOrImage
    sampler = (u, v) => {
      const c = Math.floor(u * (cols - 1))
      const r = Math.floor((1 - v) * (rows - 1))
      return grid[r]?.[c] ? 255 : 0
    }
  } else {
    sampler = createAlphaSampler(alphaGridOrImage, Math.max(64, cols * 2), Math.max(64, rows * 2))
    if (depthProfile === 'luminance') {
      lumSampler = createLuminanceSampler(alphaGridOrImage, Math.max(64, cols * 2), Math.max(64, rows * 2))
    }
  }

  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let vertCount = 0

  const alphaThreshold = 12

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellKey = `${r}_${c}`
      if (hiddenSet.has(cellKey)) continue

      // Normalized coordinates (0..1)
      const u0 = c / cols
      const u1 = (c + 1) / cols
      const v0 = 1 - (r + 1) / rows
      const v1 = 1 - r / rows

      // Rotated UV coordinates
      const uvTL = transformUV(u0, v1)
      const uvTR = transformUV(u1, v1)
      const uvBR = transformUV(u1, v0)
      const uvBL = transformUV(u0, v0)

      // 3D coordinates
      const x0 = -width / 2 + u0 * width
      const x1 = -width / 2 + u1 * width
      const y0 = height / 2 - ((r + 1) / rows) * height
      const y1 = height / 2 - (r / rows) * height

      // Localized cell bend displacement
      const isSelectedCell = selectedSet.has(cellKey)
      let extraZ = 0
      if (isSelectedCell && cellBendAngle !== 0) {
        extraZ = (cellBendAngle / 90) * (height * 0.25)
      }

      // After Effects Depth Extrusion (Displacement Map / Relief)
      const depthZ_TL = computeDepthProfileZ({
        u: u0, v: v1, width, height, profile: depthProfile, intensity: depthIntensity, invert: depthInvert, luminanceSampler: lumSampler
      })
      const depthZ_TR = computeDepthProfileZ({
        u: u1, v: v1, width, height, profile: depthProfile, intensity: depthIntensity, invert: depthInvert, luminanceSampler: lumSampler
      })
      const depthZ_BR = computeDepthProfileZ({
        u: u1, v: v0, width, height, profile: depthProfile, intensity: depthIntensity, invert: depthInvert, luminanceSampler: lumSampler
      })
      const depthZ_BL = computeDepthProfileZ({
        u: u0, v: v0, width, height, profile: depthProfile, intensity: depthIntensity, invert: depthInvert, luminanceSampler: lumSampler
      })

      // Corner builder with 3x3 Warp & Origami Fold
      const buildCorner = (
        uVal: number,
        vVal: number,
        uvRot: [number, number],
        baseX: number,
        baseY: number,
        depthZ: number
      ): VertexData => {
        let x = baseX
        let y = baseY
        let z = computeBendZ(uVal, vVal, width, height, bendX, bendY, region) + extraZ + depthZ
        const warp = computeWarp3x3Displacement(uVal, vVal, width, height, warp3x3Mode, warp3x3Intensity)
        x += warp.dx
        y += warp.dy
        z += warp.dz
        const folded = applyOrigamiFold(uVal, vVal, x, y, z, width, height, foldLine)
        return {
          u: uvRot[0],
          v: uvRot[1],
          x: folded.x,
          y: folded.y,
          z: folded.z,
          alpha: sampler(uvRot[0], uvRot[1])
        }
      }

      const vTL = buildCorner(u0, v1, uvTL, x0, y1, depthZ_TL)
      const vTR = buildCorner(u1, v1, uvTR, x1, y1, depthZ_TR)
      const vBR = buildCorner(u1, v0, uvBR, x1, y0, depthZ_BR)
      const vBL = buildCorner(u0, v0, uvBL, x0, y0, depthZ_BL)

      // Check center alpha
      const uvCen = transformUV((u0 + u1) / 2, (v0 + v1) / 2)
      const aCenter = sampler(uvCen[0], uvCen[1])

      // In autoTrimAlpha mode, discard completely transparent cells
      if (
        autoTrimAlpha &&
        vTL.alpha <= alphaThreshold &&
        vTR.alpha <= alphaThreshold &&
        vBR.alpha <= alphaThreshold &&
        vBL.alpha <= alphaThreshold &&
        aCenter <= alphaThreshold
      ) {
        continue
      }

      // Adaptive diagonal selection:
      // Connect opposite corners that have the SMALLEST alpha difference (aligning with the contour/isoline)
      const diffSlash = Math.abs(vBL.alpha - vTR.alpha)
      const diffBackslash = Math.abs(vTL.alpha - vBR.alpha)

      let tri1: [VertexData, VertexData, VertexData]
      let tri2: [VertexData, VertexData, VertexData]

      if (diffSlash <= diffBackslash) {
        // Slash diagonal (/) connecting BL to TR
        // tri1 is top-left (outer side if roof rises), tri2 is bottom-right (inner roof)
        tri1 = [vTL, vBL, vTR]
        tri2 = [vTR, vBL, vBR]
      } else {
        // Backslash diagonal (\) connecting TL to BR
        // tri1 is bottom-left (inner roof if roof falls), tri2 is top-right (outer side)
        tri1 = [vTL, vBL, vBR]
        tri2 = [vTL, vBR, vTR]
      }

      // Helper to test if a triangle has visible pixels:
      // Eliminates empty 90-degree right-angle corner triangles that jut out into transparent space
      const isTriangleActive = (t: [VertexData, VertexData, VertexData], tIdx: number) => {
        if (hiddenSet.has(`${cellKey}_t${tIdx}`)) return false
        if (!autoTrimAlpha) return true

        // Sample triangle centroid
        const uCen = (t[0].u + t[1].u + t[2].u) / 3
        const vCen = (t[0].v + t[1].v + t[2].v) / 3
        const aCen = sampler(uCen, vCen)
        if (aCen > alphaThreshold) return true

        // If centroid is transparent, only keep if ALL 3 vertices are opaque
        const opCount =
          (t[0].alpha > alphaThreshold ? 1 : 0) +
          (t[1].alpha > alphaThreshold ? 1 : 0) +
          (t[2].alpha > alphaThreshold ? 1 : 0)

        // If opCount < 3 and centroid is transparent, it's an empty corner triangle -> discard!
        return opCount === 3
      }

      const active1 = isTriangleActive(tri1, 0)
      const active2 = isTriangleActive(tri2, 1)

      // Emit Triangle 1 if active
      if (active1) {
        positions.push(
          tri1[0].x, tri1[0].y, tri1[0].z,
          tri1[1].x, tri1[1].y, tri1[1].z,
          tri1[2].x, tri1[2].y, tri1[2].z
        )
        uvs.push(
          tri1[0].u, tri1[0].v,
          tri1[1].u, tri1[1].v,
          tri1[2].u, tri1[2].v
        )
        indices.push(vertCount, vertCount + 1, vertCount + 2)
        vertCount += 3
      }

      // Emit Triangle 2 if active
      if (active2) {
        positions.push(
          tri2[0].x, tri2[0].y, tri2[0].z,
          tri2[1].x, tri2[1].y, tri2[1].z,
          tri2[2].x, tri2[2].y, tri2[2].z
        )
        uvs.push(
          tri2[0].u, tri2[0].v,
          tri2[1].u, tri2[1].v,
          tri2[2].u, tri2[2].v
        )
        indices.push(vertCount, vertCount + 1, vertCount + 2)
        vertCount += 3
      }
    }
  }

  // Fallback if no visible vertices found
  if (positions.length === 0) {
    return buildCurvedPlaneGeometry(
      width,
      height,
      cols,
      rows,
      bendX,
      bendY,
      region,
      depthProfile,
      depthIntensity,
      depthInvert,
      !Array.isArray(alphaGridOrImage) ? alphaGridOrImage : undefined
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
  region: 'all' | 'bottom' | 'top' | 'left' | 'right' = 'all',
  depthProfile: DepthProfileType = 'none',
  depthIntensity = 0,
  depthInvert = false,
  image?: HTMLImageElement | HTMLCanvasElement,
  foldLine?: OrigamiFoldLine,
  warp3x3Mode?: Warp3x3Preset,
  warp3x3Intensity = 30
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
  const hasFold = foldLine?.enabled && foldLine.angle !== 0
  const hasWarp = warp3x3Mode && warp3x3Mode !== 'none'

  if (hasBend || hasDepth || hasFold || hasWarp) {
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
      let x = posAttr.getX(i)
      let y = posAttr.getY(i)
      let z = bendZ + depthZ
      const warp = computeWarp3x3Displacement(u, v, width, height, warp3x3Mode, warp3x3Intensity)
      x += warp.dx
      y += warp.dy
      z += warp.dz
      const folded = applyOrigamiFold(u, v, x, y, z, width, height, foldLine)
      posAttr.setXYZ(i, folded.x, folded.y, folded.z)
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
