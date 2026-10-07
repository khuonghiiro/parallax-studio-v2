import { describe, expect, it } from 'vitest'
import { buildAlphaTrimmedGeometry } from './alphaMeshBuilder'

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
    // 4 cols * 2 rows = 8 quads = 16 triangles = 48 vertices (non-indexed)
    expect(posAttr.count).toBe(4 * 2 * 6)
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

    const posAttr = geo.getAttribute('position')
    // 8 quads - 2 hidden quads = 6 quads = 36 vertices
    expect(posAttr.count).toBe(6 * 6)
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
    // 4x4 grid where bottom half is completely transparent
    const halfAlpha = [
      [true, true, true, true],
      [true, true, true, true],
      [false, false, false, false],
      [false, false, false, false]
    ]

    // With autoTrimAlpha = true (auto mesh)
    const geoAuto = buildAlphaTrimmedGeometry(
      200, 200, halfAlpha, 4, 4, 0, 0, 'all', [], 0, [], 0, true
    )

    // With autoTrimAlpha = false (manual mesh)
    const geoManual = buildAlphaTrimmedGeometry(
      200, 200, halfAlpha, 4, 4, 0, 0, 'all', [], 0, [], 0, false
    )

    const countAuto = geoAuto.getAttribute('position').count
    const countManual = geoManual.getAttribute('position').count

    // Manual mode preserves all 16 quads (16 * 6 = 96 vertices)
    expect(countManual).toBe(96)
    // Auto mode trims transparent cells in the bottom half, so fewer vertices
    expect(countAuto).toBeLessThan(countManual)
  })
})
