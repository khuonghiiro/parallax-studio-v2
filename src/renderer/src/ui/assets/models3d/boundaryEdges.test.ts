import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createBoundaryEdgesGeometry } from './assemblyMeshFactory'

describe('createBoundaryEdgesGeometry - Clean Silhouette Outline Without Internal Mesh Grid', () => {
  it('extracts ONLY perimeter boundary edges and strips out all internal quad/diagonal edges', () => {
    // 2x2 grid PlaneGeometry = 4 quads = 8 triangles = 16 half-edges
    const geo = new THREE.PlaneGeometry(100, 100, 2, 2)
    const boundaryGeo = createBoundaryEdgesGeometry(geo)

    const pos = boundaryGeo.getAttribute('position')
    expect(pos).toBeDefined()
    expect(pos.count).toBeGreaterThan(0)

    // Mỗi đường thẳng biểu diễn bởi 2 đỉnh (LineSegments format)
    const numEdges = pos.count / 2

    // 2x2 grid có 2 đoạn ở trên, 2 đoạn bên phải, 2 đoạn ở dưới, 2 đoạn bên trái = đúng 8 cạnh chu vi!
    expect(numEdges).toBe(8)

    // So sánh với THREE.EdgesGeometry:
    // Nếu uốn cong Z (cong nếp gấp), EdgesGeometry sẽ vẽ luôn các cạnh gập bên trong.
    // Nhưng createBoundaryEdgesGeometry luôn CHỈ giữ lại đúng 8 cạnh chu vi ngoài cùng!
    const bentGeo = geo.clone()
    const bentPos = bentGeo.getAttribute('position')
    // Uốn nhấp nhô đỉnh ở tâm
    bentPos.setZ(4, 25)
    bentPos.needsUpdate = true

    const bentBoundaryGeo = createBoundaryEdgesGeometry(bentGeo)
    const bentNumEdges = bentBoundaryGeo.getAttribute('position').count / 2
    expect(bentNumEdges).toBe(8)
  })
})
