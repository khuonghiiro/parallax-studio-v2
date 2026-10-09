/**
 * Base Rest Domain Mesh Builder
 *
 * Generates initial planar grid geometry, vertex coordinates, UV rest domain and indices.
 * Optionally trims triangles against silhouette polygon outlines.
 */

import type { BaseSurface } from '@shared/imageMeshDefinition'

export interface BaseMeshData {
  positions: Float32Array
  uvs: Float32Array
  normals: Float32Array
  indices: Uint32Array
  vertexCount: number
  indexCount: number
}

/**
 * Tests whether point [u, v] lies inside a 2D polygon using ray-casting.
 */
function isPointInPolygon(u: number, v: number, poly: number[][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0]
    const yi = poly[i][1]
    const xj = poly[j][0]
    const yj = poly[j][1]

    const intersect = ((yi > v) !== (yj > v)) && (u < (xj - xi) * (v - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

export function buildBaseGridMesh(
  surface: BaseSurface,
  silhouettePolygon?: number[][]
): BaseMeshData {
  const { width: w, height: h, subdivisions } = surface
  const [cols, rows] = subdivisions
  const vertexCount = (cols + 1) * (rows + 1)

  const positions = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)
  const normals = new Float32Array(vertexCount * 3)

  let vIdx = 0
  for (let r = 0; r <= rows; r++) {
    const v = r / rows
    const y = (v - 0.5) * h
    for (let c = 0; c <= cols; c++) {
      const u = c / cols
      const x = (u - 0.5) * w

      positions[vIdx * 3] = x
      positions[vIdx * 3 + 1] = y
      positions[vIdx * 3 + 2] = 0

      uvs[vIdx * 2] = u
      uvs[vIdx * 2 + 1] = v

      normals[vIdx * 3] = 0
      normals[vIdx * 3 + 1] = 0
      normals[vIdx * 3 + 2] = 1

      vIdx++
    }
  }

  // Generate triangle indices (two triangles per quad cell)
  const maxIndices = cols * rows * 6
  const rawIndices = new Uint32Array(maxIndices)
  let iIdx = 0

  const stride = cols + 1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i0 = r * stride + c
      const i1 = r * stride + (c + 1)
      const i2 = (r + 1) * stride + c
      const i3 = (r + 1) * stride + (c + 1)

      // If silhouette polygon provided, check cell center
      if (silhouettePolygon && silhouettePolygon.length >= 3) {
        const uCenter = (c + 0.5) / cols
        const vCenter = (r + 0.5) / rows
        if (!isPointInPolygon(uCenter, vCenter, silhouettePolygon)) {
          continue // Exclude triangle outside polygon
        }
      }

      // Tri 1: i0 - i1 - i2
      rawIndices[iIdx++] = i0
      rawIndices[iIdx++] = i1
      rawIndices[iIdx++] = i2

      // Tri 2: i1 - i3 - i2
      rawIndices[iIdx++] = i1
      rawIndices[iIdx++] = i3
      rawIndices[iIdx++] = i2
    }
  }

  const indices = rawIndices.slice(0, iIdx)

  return {
    positions,
    uvs,
    normals,
    indices,
    vertexCount,
    indexCount: iIdx
  }
}
