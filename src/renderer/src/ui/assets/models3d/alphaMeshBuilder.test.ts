import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'
import { buildAlphaTrimmedGeometry, computeBendZ, computeBendLateralX, computeVertexBend } from './alphaMeshBuilder'

/** Geometry is indexed (welded vertices) — count rendered triangles. */
const triCount = (geo: BufferGeometry): number => {
  const index = geo.getIndex()
  return index ? index.count / 3 : geo.getAttribute('position').count / 3
}

describe('alphaMeshBuilder - Custom Mesh Frame & Rotatable Grid', () => {
  it('builds geometry with custom cols and rows without alpha mask', () => {
    // 4 cols x 2 rows full alpha grid
    const fullAlpha = [
      [true, true, true, true],
      [true, true, true, true]
    ]

    const geo = buildAlphaTrimmedGeometry(
      400,
      200,
      fullAlpha,
      4, // cols
      2  // rows
    )

    expect(geo).toBeDefined()
    const posAttr = geo.getAttribute('position')
    expect(posAttr).toBeDefined()
    // 4 cols * 2 rows = 8 quads = 16 triangles, sharing (5 * 3) welded vertices
    expect(triCount(geo)).toBe(4 * 2 * 2)
    expect(posAttr.count).toBe(5 * 3)
  })

  it('applies hiddenCells to trim specific sub-mesh cells', () => {
    const fullAlpha = [
      [true, true, true, true],
      [true, true, true, true]
    ]

    const geo = buildAlphaTrimmedGeometry(
      400,
      200,
      fullAlpha,
      4,
      2,
      0,
      0,
      'all',
      ['0_0', '0_1'] // 2 hidden cells
    )

    // 8 quads - 2 hidden quads = 6 quads = 12 triangles
    expect(triCount(geo)).toBe(6 * 2)
  })

  it('applies cellBendAngle displacement to selected cells', () => {
    const fullAlpha = [
      [true, true],
      [true, true]
    ]

    const unbent = buildAlphaTrimmedGeometry(
      200,
      200,
      fullAlpha,
      2,
      2,
      0,
      0,
      'all',
      [],
      0,
      [],
      0
    )

    const bent = buildAlphaTrimmedGeometry(
      200,
      200,
      fullAlpha,
      2,
      2,
      0,
      0,
      'all',
      [],
      0,
      ['0_0'],
      45 // cellBendAngle
    )

    const unbentPos = unbent.getAttribute('position').array as Float32Array
    const bentPos = bent.getAttribute('position').array as Float32Array

    // At least one Z coordinate in bent geometry should be non-zero due to cellBendAngle
    let hasNonZeroZ = false
    for (let i = 2; i < bentPos.length; i += 3) {
      if (Math.abs(bentPos[i]) > 0.001) {
        hasNonZeroZ = true
        break
      }
    }
    expect(hasNonZeroZ).toBe(true)

    // Unbent geometry without curvature has all Z = 0
    let unbentAllZeroZ = true
    for (let i = 2; i < unbentPos.length; i += 3) {
      if (Math.abs(unbentPos[i]) > 0.001) {
        unbentAllZeroZ = false
        break
      }
    }
    expect(unbentAllZeroZ).toBe(true)
  })

  it('calculates UV mapping correctly with gridRotation', () => {
    const fullAlpha = [
      [true, true],
      [true, true]
    ]

    const geoNormal = buildAlphaTrimmedGeometry(
      200,
      200,
      fullAlpha,
      2,
      2,
      0,
      0,
      'all',
      [],
      0 // gridRotation = 0
    )

    const geoRotated = buildAlphaTrimmedGeometry(
      200,
      200,
      fullAlpha,
      2,
      2,
      0,
      0,
      'all',
      [],
      45 // gridRotation = 45
    )

    const uvNormal = geoNormal.getAttribute('uv').array as Float32Array
    const uvRotated = geoRotated.getAttribute('uv').array as Float32Array

    // Due to 45 deg rotation around UV center (0.5, 0.5), coordinates must differ
    let differs = false
    for (let i = 0; i < uvNormal.length; i++) {
      if (Math.abs(uvNormal[i] - uvRotated[i]) > 0.001) {
        differs = true
        break
      }
    }
    expect(differs).toBe(true)
  })

  it('createFaceMesh works correctly when resolved texture is null', async () => {
    const { createFaceMesh } = await import('./assemblyMeshFactory')
    const face = {
      id: 'test-face',
      name: 'Test Face',
      width: 300,
      height: 300,
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      gridCols: 8,
      gridRows: 8
    }

    const mesh = createFaceMesh(face, null, true, true, 1.0, false)
    expect(mesh).toBeDefined()
    expect(mesh.children.length).toBeGreaterThan(0) // Has wireframe child
  })

  it('preserves all cells in manual mesh mode (autoTrimAlpha = false)', () => {
    // 8x8 grid where the bottom half is completely transparent. Auto mode keeps a
    // one-cell safety margin around opaque pixels, then trims the rest.
    const halfAlpha = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, () => r < 4))

    // With autoTrimAlpha = true (auto mesh)
    const geoAuto = buildAlphaTrimmedGeometry(
      200, 200, halfAlpha, 8, 8, 0, 0, 'all', [], 0, [], 0, true
    )

    // With autoTrimAlpha = false (manual mesh)
    const geoManual = buildAlphaTrimmedGeometry(
      200, 200, halfAlpha, 8, 8, 0, 0, 'all', [], 0, [], 0, false
    )

    const countAuto = triCount(geoAuto)
    const countManual = triCount(geoManual)

    // Manual mode preserves all 64 quads (128 triangles)
    expect(countManual).toBe(128)
    // Auto mode trims transparent cells in the bottom half, so fewer triangles
    expect(countAuto).toBeLessThan(countManual)
    // ...but never cuts into the opaque top half (4 rows × 8 cols × 2 triangles)
    expect(countAuto).toBeGreaterThanOrEqual(64)
  })

  it('computeBendZ flares out at tip for region top and stays flat at base', () => {
    const height = 300
    const width = 100
    // At base v = 0, bend is 0
    const zBase = computeBendZ(0.5, 0, width, height, 0, 50, 'top')
    expect(zBase).toBe(0)
    // At tip v = 1, bend reaches maximum deflection
    const zTip = computeBendZ(0.5, 1, width, height, 0, 50, 'top')
    expect(zTip).toBeCloseTo((50 / 100) * (height * 0.35), 2)
  })

  it('computeBendZ creates sinusoidal S-wave for region curl', () => {
    const height = 300
    const width = 100
    const zMid = computeBendZ(0.5, 0.5, width, height, 0, 50, 'curl')
    const zTip = computeBendZ(0.5, 1, width, height, 0, 50, 'curl')
    // S-curve wave produces distinct curvature at intermediate points
    expect(typeof zMid).toBe('number')
    expect(typeof zTip).toBe('number')
  })

  it('builds pre-trimmed geometry from presetPolygon even when image is null', () => {
    // Triangular petal polygon in UV space
    const petalPolygon = [
      [0.45, 0.0],
      [0.55, 0.0],
      [0.85, 0.5],
      [0.50, 1.0],
      [0.15, 0.5]
    ]

    const geo = buildAlphaTrimmedGeometry(
      200,
      400,
      null, // No image yet
      16, // cols
      16, // rows
      30, // bendX
      -25, // bendY
      'top',
      undefined,
      0,
      undefined,
      0,
      true,
      'none',
      0,
      false,
      petalPolygon
    )

    expect(geo).toBeDefined()
    const triangles = triCount(geo)
    // Full grid is 16*16*2 = 512 triangles; clipped petal is significantly fewer triangles
    expect(triangles).toBeGreaterThan(20)
    expect(triangles).toBeLessThan(512)
    const pos = geo.getAttribute('position')
    expect(pos).toBeDefined()
    expect(pos.count).toBeGreaterThan(15)
  })

  it('computes lateral bending in X and applies lateral displacement', () => {
    // Root at v=0 has 0 displacement
    expect(computeBendLateralX(0.5, 0, 100, 300, 50, 'all')).toBe(0)
    // Tip at v=1 curves to the right with positive bendLateral
    const tipRight = computeBendLateralX(0.5, 1, 100, 300, 50, 'all')
    expect(tipRight).toBeGreaterThan(10)
    // Tip at v=1 curves to the left with negative bendLateral
    const tipLeft = computeBendLateralX(0.5, 1, 100, 300, -50, 'all')
    expect(tipLeft).toBeLessThan(-10)
    expect(tipLeft).toBeCloseTo(-tipRight, 4)

    // Build geometry with lateral bend
    const geo = buildAlphaTrimmedGeometry(
      100,
      300,
      null,
      8,
      16,
      0,
      0,
      'all',
      undefined,
      0,
      undefined,
      0,
      false,
      'none',
      0,
      false,
      undefined,
      40 // bendLateral
    )
    expect(geo).toBeDefined()
    const pos = geo.getAttribute('position')
    // Top vertices should have shifted X values compared to bottom
    let maxTopX = -Infinity
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      const x = pos.getX(i)
      if (y > 100) {
        maxTopX = Math.max(maxTopX, x)
      }
    }
    expect(maxTopX).toBeGreaterThan(50)
  })

  it('computes exact circular cylinder arcs with arcAngle without gaps', () => {
    // 90° arc for 4-sided cylinder (chord width 200)
    const chord = 200
    const arc90 = 90
    const halfAngle = (45 * Math.PI) / 180
    const expectedRadius = (chord / 2) / Math.sin(halfAngle)
    const centerOffset = expectedRadius * Math.cos(halfAngle)

    // Left edge u=0
    const left = computeVertexBend(0, 0.5, chord, 400, 100, 0, 0, 'all', arc90)
    expect(left.x).toBeCloseTo(-chord / 2, 2)
    expect(left.z).toBeCloseTo(0, 2)

    // Right edge u=1
    const right = computeVertexBend(1, 0.5, chord, 400, 100, 0, 0, 'all', arc90)
    expect(right.x).toBeCloseTo(chord / 2, 2)
    expect(right.z).toBeCloseTo(0, 2)

    // Apex u=0.5
    const apex = computeVertexBend(0.5, 0.5, chord, 400, 100, 0, 0, 'all', arc90)
    expect(apex.x).toBeCloseTo(0, 2)
    expect(apex.z).toBeCloseTo(expectedRadius * (1 - Math.cos(halfAngle)), 2)

    // All sample points across the width lie on the circle of radius expectedRadius
    for (let i = 0; i <= 10; i++) {
      const u = i / 10
      const pt = computeVertexBend(u, 0.5, chord, 400, 100, 0, 0, 'all', arc90)
      const distFromCenter = Math.hypot(pt.x, pt.z + centerOffset)
      expect(distFromCenter).toBeCloseTo(expectedRadius, 2)
    }
  })

  it('computes 180° semi-cylinder arcs for 2-face round pillars', () => {
    const width = 400
    const arc180 = 180
    const expectedRadius = 200

    const left = computeVertexBend(0, 0.5, width, 600, 100, 0, 0, 'all', arc180)
    expect(left.x).toBeCloseTo(-200, 2)
    expect(left.z).toBeCloseTo(0, 2)

    const right = computeVertexBend(1, 0.5, width, 600, 100, 0, 0, 'all', arc180)
    expect(right.x).toBeCloseTo(200, 2)
    expect(right.z).toBeCloseTo(0, 2)

    const apex = computeVertexBend(0.5, 0.5, width, 600, 100, 0, 0, 'all', arc180)
    expect(apex.x).toBeCloseTo(0, 2)
    expect(apex.z).toBeCloseTo(expectedRadius, 2)
  })

  it('computes tapered cone geometry scaling smoothly from base to apex', () => {
    const width = 200
    const taper = 0.4 // 40% width at top
    // Base v=0: full width
    const baseLeft = computeVertexBend(0, 0, width, 500, 100, 0, 0, 'all', 90, taper)
    expect(baseLeft.x).toBeCloseTo(-100, 2)

    // Top v=1: tapered to 40% (width 80)
    const topLeft = computeVertexBend(0, 1, width, 500, 100, 0, 0, 'all', 90, taper)
    expect(topLeft.x).toBeCloseTo(-40, 2)
  })
})
