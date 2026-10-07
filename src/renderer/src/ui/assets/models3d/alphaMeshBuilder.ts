import * as THREE from 'three'

/**
 * Samples the alpha transparency of an image downsampled to a cols x rows grid.
 * Returns a 2D boolean array where true means the cell contains visible pixels (alpha > threshold).
 */
export function sampleAlphaGrid(
  image: HTMLImageElement | HTMLCanvasElement,
  cols = 16,
  rows = 16,
  alphaThreshold = 15
): boolean[][] {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = cols
    canvas.height = rows
    const ctx = canvas.getContext('2d')
    if (!ctx) return Array.from({ length: rows }, () => Array(cols).fill(true))

    ctx.drawImage(image, 0, 0, cols, rows)
    const imgData = ctx.getImageData(0, 0, cols, rows).data
    const grid: boolean[][] = []

    for (let r = 0; r < rows; r++) {
      const row: boolean[] = []
      for (let c = 0; c < cols; c++) {
        const alpha = imgData[(r * cols + c) * 4 + 3]
        row.push(alpha > alphaThreshold)
      }
      grid.push(row)
    }
    return grid
  } catch {
    return Array.from({ length: rows }, () => Array(cols).fill(true))
  }
}

/**
 * Builds a custom Three.js Plane BufferGeometry where triangles and vertices
 * ONLY exist for cells that have visible pixels according to the alphaGrid.
 * Cells with alpha == 0 are omitted, leaving NO wireframe and NO geometry in empty air.
 */
export function buildAlphaTrimmedGeometry(
  width: number,
  height: number,
  alphaGrid: boolean[][],
  cols = 16,
  rows = 16
): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const normals: number[] = []
  const indices: number[] = []

  let vertCount = 0

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // If cell has no pixels, skip creating triangles
      if (!alphaGrid[r]?.[c]) continue

      // Normalized coordinates (0..1)
      const u0 = c / cols
      const u1 = (c + 1) / cols
      // Texture V is inverted compared to canvas row
      const v0 = 1 - (r + 1) / rows
      const v1 = 1 - r / rows

      // Plane 3D coordinates centered at origin (0, 0, 0)
      const x0 = -width / 2 + u0 * width
      const x1 = -width / 2 + u1 * width
      const y0 = height / 2 - ((r + 1) / rows) * height
      const y1 = height / 2 - (r / rows) * height

      // Quad 4 vertices: Top-Left (0), Top-Right (1), Bottom-Right (2), Bottom-Left (3)
      // v0: Top-Left (x0, y1)
      positions.push(x0, y1, 0)
      uvs.push(u0, v1)
      normals.push(0, 0, 1)

      // v1: Top-Right (x1, y1)
      positions.push(x1, y1, 0)
      uvs.push(u1, v1)
      normals.push(0, 0, 1)

      // v2: Bottom-Right (x1, y0)
      positions.push(x1, y0, 0)
      uvs.push(u1, v0)
      normals.push(0, 0, 1)

      // v3: Bottom-Left (x0, y0)
      positions.push(x0, y0, 0)
      uvs.push(u0, v0)
      normals.push(0, 0, 1)

      // 2 Triangles for this quad
      indices.push(
        vertCount + 0,
        vertCount + 3,
        vertCount + 1,
        vertCount + 1,
        vertCount + 3,
        vertCount + 2
      )

      vertCount += 4
    }
  }

  // If no cells had visible pixels, fallback to standard plane
  if (positions.length === 0) {
    return new THREE.PlaneGeometry(width, height, 1, 1)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setIndex(indices)
  return geo
}
