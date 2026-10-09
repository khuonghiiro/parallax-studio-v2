/**
 * Free-Form Deformation (FFD) Lattice Module
 *
 * Implements smooth 4x4 Bernstein polynomial lattice deformation over rest-space domain.
 */

import type { LatticeModifier, BaseSurface } from '@shared/imageMeshDefinition'

/**
 * Evaluates cubic Bernstein basis polynomial:
 * B_0(t) = (1-t)^3
 * B_1(t) = 3t(1-t)^2
 * B_2(t) = 3t^2(1-t)
 * B_3(t) = t^3
 */
function bernstein3(t: number): [number, number, number, number] {
  const clamped = Math.max(0, Math.min(1, t))
  const inv = 1 - clamped
  const inv2 = inv * inv
  const inv3 = inv2 * inv
  const t2 = clamped * clamped
  const t3 = t2 * clamped

  return [
    inv3,
    3 * clamped * inv2,
    3 * t2 * inv,
    t3
  ]
}

export function applyLatticePrimitive(
  positions: Float32Array,
  uvs: Float32Array,
  count: number,
  mod: LatticeModifier,
  _surface: BaseSurface
): void {
  const { dimensions, offsets } = mod
  const [nx, ny, nz] = dimensions
  if (nx !== 4 || ny !== 4 || !offsets || offsets.length < 16) return

  for (let k = 0; k < count; k++) {
    const idx = k * 3
    const u = uvs[k * 2]
    const v = uvs[k * 2 + 1]

    const bU = bernstein3(u)
    const bV = bernstein3(v)

    let dx = 0
    let dy = 0
    let dz = 0

    // Evaluate 4x4 tensor product of Bernstein polynomials
    for (let j = 0; j < 4; j++) {
      const weightV = bV[j]
      for (let i = 0; i < 4; i++) {
        const weight = bU[i] * weightV
        const latticeIdx = j * 4 + i
        const offset = offsets[latticeIdx]
        if (offset) {
          dx += weight * offset[0]
          dy += weight * offset[1]
          dz += weight * offset[2]
        }
      }
    }

    positions[idx] += dx
    positions[idx + 1] += dy
    positions[idx + 2] += dz
  }
}
