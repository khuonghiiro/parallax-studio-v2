import { describe, expect, it } from 'vitest'
import {
  createLayerAlphaTrimmedGeometry,
  getLayerContourCells
} from './layerAssemblyAlphaMesh'
import { silhouetteFromBoolGrid } from '../assets/models3d/silhouette'
import { computeContourCells } from '../assets/models3d/contourMesh'

describe('layerAssemblyAlphaMesh (Pixel-hugging alpha contour mesh)', () => {
  it('does not create faces for a fully transparent image', () => {
    const geometry = createLayerAlphaTrimmedGeometry(100, 100, [[false]], 1, 1)
    expect(geometry.getIndex()?.count ?? 0).toBe(0)
  })
  it('returns null when no imageUrl is provided', () => {
    const cells = getLayerContourCells(null)
    expect(cells).toBeNull()
  })

  it('creates fallback plane geometry when image is null or undefined', () => {
    const geom = createLayerAlphaTrimmedGeometry(100, 200, null, 8, 10)
    expect(geom).toBeDefined()
    expect(geom.getAttribute('position')).toBeDefined()
    expect(geom.getAttribute('uv')).toBeDefined()
  })

  it('trims transparent cells and hugs opaque cells using contour mesh', () => {
    const cols = 8
    const rows = 8
    // Tạo lưới nhị phân: chỉ 1 nửa bên trái là có pixel
    const grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, (_, c) => c < 4)
    )
    const sil = silhouetteFromBoolGrid(grid, cols, rows, 16)
    const cells = computeContourCells(cols, rows, sil, 0, true)

    // Các ô ở xa phía bên phải hoàn toàn trong suốt sẽ bị loại bỏ hoàn toàn
    expect(cells.length).toBeLessThan(cols * rows)
    expect(cells.find((c) => c.key === '0_7')).toBeUndefined()
    expect(cells.find((c) => c.key === '0_0')).toBeDefined()
  })
})
