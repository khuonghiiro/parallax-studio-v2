import * as THREE from 'three'
import { computeProceduralMotionOffset } from './meshEffectsAE'

/**
 * Applies the After-Effects-style procedural vertex motion (wind, wave, breathe, wiggle)
 * stored in `mesh.userData.motion` to every face mesh of the group.
 */
export function applyProceduralMotion(group: THREE.Group, time: number): void {
  for (const child of group.children) {
    const obj = child as THREE.Mesh
    const motion = obj.userData?.motion
    if (!motion || motion.type === 'none' || motion.amplitude === 0) continue
    const geo = obj.geometry
    const basePos = geo.userData?.basePositions as Float32Array | undefined
    const uvs = geo.userData?.uvs as Float32Array | undefined
    const posAttr = geo.getAttribute('position')
    if (!basePos || !uvs || !posAttr) continue
    for (let vi = 0; vi < posAttr.count; vi++) {
      const [dx, dy, dz] = computeProceduralMotionOffset({
        u: uvs[vi * 2],
        v: uvs[vi * 2 + 1],
        width: motion.width,
        height: motion.height,
        time,
        motionType: motion.type,
        speed: motion.speed,
        amplitude: motion.amplitude,
        direction: motion.direction,
        anchor: motion.anchor
      })
      posAttr.setXYZ(vi, basePos[vi * 3] + dx, basePos[vi * 3 + 1] + dy, basePos[vi * 3 + 2] + dz)
    }
    posAttr.needsUpdate = true
  }
}
