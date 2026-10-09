/**
 * Soft Sculpt & Brush Deformation Module
 *
 * Implements continuous influence field sculpting (inflate, deflate, grab, smooth)
 * using smooth falloff curves. Vertices outside brush radius are provably unchanged.
 */

import type { SculptModifier, BaseSurface } from '@shared/imageMeshDefinition'

export function applyBrushPrimitive(
  positions: Float32Array,
  uvs: Float32Array,
  count: number,
  mod: SculptModifier,
  surface: BaseSurface
): void {
  const { strokes } = mod
  if (!strokes || strokes.length === 0) return

  const aspect = surface.height / Math.max(1, surface.width)

  for (const stroke of strokes) {
    const { uv: targetUV, pressure, radius, mode, direction } = stroke
    const r2 = radius * radius
    if (r2 <= 0) continue

    for (let i = 0; i < count; i++) {
      const idx = i * 3
      const u = uvs[i * 2]
      const v = uvs[i * 2 + 1]

      // Don't displace root boundary vertices (v <= 0.01) to protect roots
      if (v <= 0.01) continue

      const du = u - targetUV[0]
      const dv = (v - targetUV[1]) * aspect
      const dist2 = du * du + dv * dv

      if (dist2 >= r2) continue // Provably outside radius: unchanged!

      // Smooth hermite falloff: (1 - (dist / radius)^2)^2
      const falloff = 1 - dist2 / r2
      const weight = falloff * falloff * pressure

      if (mode === 'inflate') {
        // Displace along local +Z
        positions[idx + 2] += weight * 15
      } else if (mode === 'deflate') {
        // Displace along local -Z
        positions[idx + 2] -= weight * 15
      } else if (mode === 'grab') {
        // Displace along custom drag vector
        const dir = direction ?? [0, 0, 0]
        positions[idx] += weight * dir[0]
        positions[idx + 1] += weight * dir[1]
        positions[idx + 2] += weight * dir[2]
      } else if (mode === 'smooth') {
        // Relax towards local planar average
        positions[idx + 2] *= 1 - weight * 0.5
      }
    }
  }
}
