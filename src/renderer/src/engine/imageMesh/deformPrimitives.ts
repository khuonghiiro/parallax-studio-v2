/**
 * Mathematical Deform Primitives
 *
 * Implements pure vertex deformation operations:
 * - Cylindrical arc bend / angle curvature
 * - Longitudinal bend (vertical / horizontal)
 * - Taper & lateral S-curves
 * - Longitudinal twist around centerline
 * - After Effects style 2.5D depth profiles
 */

import type {
  BendModifier,
  TwistModifier,
  DepthProfileModifier,
  BaseSurface
} from '@shared/imageMeshDefinition'

/**
 * Applies bend, cylindrical arc, lateral curve, and taper to positions array in-place.
 */
export function applyBendPrimitive(
  positions: Float32Array,
  uvs: Float32Array,
  count: number,
  mod: BendModifier,
  surface: BaseSurface
): void {
  const { width: w, height: h } = surface
  const { axis, intensity, arcAngle = 0, taperRatio = 1, lateral = 0, region = 'all' } = mod

  for (let i = 0; i < count; i++) {
    const idx = i * 3
    const u = uvs[i * 2]
    const v = uvs[i * 2 + 1]

    // 1. Tapering along height (v: 0 is base, 1 is tip)
    if (taperRatio !== 1) {
      const taperFactor = 1.0 - (1.0 - taperRatio) * v
      positions[idx] *= taperFactor
    }

    // 2. Exact cylindrical arc bend along horizontal axis
    if (arcAngle > 0) {
      const rad = ((u - 0.5) * arcAngle * Math.PI) / 180
      const r = w / ((arcAngle * Math.PI) / 180)
      positions[idx] = r * Math.sin(rad)
      positions[idx + 2] += r * (1 - Math.cos(rad))
    } else if (axis === 'x' && intensity !== 0) {
      const normalizedU = (u - 0.5) * 2 // -1..1
      positions[idx + 2] += -intensity * 0.25 * (1 - normalizedU * normalizedU)
    }

    // 3. Vertical curvature (bend along height)
    if (axis === 'y' && intensity !== 0) {
      let factor = v * v
      if (region === 'bottom') factor = (1 - v) * (1 - v)
      else if (region === 'top') factor = Math.max(0, (v - 0.5) * 2) ** 2
      positions[idx + 2] += intensity * 0.3 * factor
    }

    // 4. Lateral curve displacement (S-curl or side-bend)
    if (lateral !== 0) {
      if (region === 'curl') {
        positions[idx] += Math.sin(v * Math.PI * 2) * lateral * 0.2
      } else {
        positions[idx] += v * v * lateral * 0.25
      }
    }
  }
}

/**
 * Applies longitudinal twist deformation around the vertical/longitudinal axis.
 */
export function applyTwistPrimitive(
  positions: Float32Array,
  uvs: Float32Array,
  count: number,
  mod: TwistModifier,
  _surface: BaseSurface
): void {
  const { angle, center = 0.5, falloff = 1.0 } = mod
  const angleRad = (angle * Math.PI) / 180

  for (let i = 0; i < count; i++) {
    const idx = i * 3
    const v = uvs[i * 2 + 1]

    // Distance from twist center
    const dist = Math.abs(v - center)
    const factor = Math.pow(dist * 2, falloff)
    const twist = (v >= center ? 1 : -1) * angleRad * factor

    const x = positions[idx]
    const z = positions[idx + 2]
    const cosT = Math.cos(twist)
    const sinT = Math.sin(twist)

    positions[idx] = x * cosT - z * sinT
    positions[idx + 2] = x * sinT + z * cosT
  }
}

/**
 * Applies 2.5D depth relief profile (ridge, sphere, slope, cylinder, luminance).
 */
export function applyDepthProfilePrimitive(
  positions: Float32Array,
  uvs: Float32Array,
  count: number,
  mod: DepthProfileModifier,
  _surface: BaseSurface
): void {
  const { profile, intensity, invert = false } = mod
  if (profile === 'none' || intensity === 0) return

  const sign = invert ? -1 : 1
  const scale = (intensity / 100) * 20 * sign

  for (let i = 0; i < count; i++) {
    const idx = i * 3
    const u = uvs[i * 2]
    const v = uvs[i * 2 + 1]

    let depth = 0
    if (profile === 'ridge') {
      // Raised midrib ridge along central vertical line (u = 0.5)
      const distFromCenter = Math.abs(u - 0.5) * 2 // 0 at center, 1 at edge
      depth = Math.max(0, 1 - distFromCenter * distFromCenter)
    } else if (profile === 'sphere') {
      const dx = (u - 0.5) * 2
      const dy = (v - 0.5) * 2
      const r2 = dx * dx + dy * dy
      depth = r2 < 1 ? Math.sqrt(1 - r2) : 0
    } else if (profile === 'cylinder') {
      const dx = (u - 0.5) * 2
      depth = Math.abs(dx) < 1 ? Math.sqrt(1 - dx * dx) : 0
    } else if (profile === 'slope') {
      depth = v // ramps from base to tip
    }

    positions[idx + 2] += depth * scale
  }
}
