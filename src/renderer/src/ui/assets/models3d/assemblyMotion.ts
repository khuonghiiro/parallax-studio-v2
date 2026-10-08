import * as THREE from 'three'
import { computeProceduralMotionOffset } from './meshEffectsAE'

/**
 * Applies the After-Effects-style procedural vertex motion (wind, wave, breathe, wiggle)
 * stored in `mesh.userData.motion` to every face mesh of the group.
 */
export function applyProceduralMotion(group: THREE.Group, time: number): void {
  const tmpVec = new THREE.Vector3()
  const invQ = new THREE.Quaternion()

  for (const child of group.children) {
    const obj = child as THREE.Mesh
    const motion = obj.userData?.motion
    if (!motion || motion.type === 'none' || motion.amplitude === 0) continue
    const geo = obj.geometry
    const basePos = geo.userData?.basePositions as Float32Array | undefined
    const uvs = geo.userData?.uvs as Float32Array | undefined
    const posAttr = geo.getAttribute('position')
    if (!basePos || !uvs || !posAttr) continue

    const isLocked = !!(obj.userData?.lockedStructure || group.userData?.lockedStructure)
    if (isLocked) {
      invQ.copy(obj.quaternion).invert()
    }

    for (let vi = 0; vi < posAttr.count; vi++) {
      let [dx, dy, dz] = computeProceduralMotionOffset({
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

      if (isLocked) {
        // Biến đổi vector chuyển động theo không gian chung của model vào toạ độ local của mesh
        tmpVec.set(dx, dy, dz).applyQuaternion(invQ)
        dx = tmpVec.x
        dy = tmpVec.y
        dz = tmpVec.z
      }

      posAttr.setXYZ(vi, basePos[vi * 3] + dx, basePos[vi * 3 + 1] + dy, basePos[vi * 3 + 2] + dz)
    }
    posAttr.needsUpdate = true
  }
}
