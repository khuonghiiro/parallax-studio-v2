import { describe, expect, it } from 'vitest'
import { createHumanoidBones, generateWalkCycle } from './workshopRigPresets'
import { evaluateRig, rotatePoint, sampleBonePose } from '../../engine/layerRig'

describe('walk cycle joint attachment', () => {
  const bones = createHumanoidBones()
  const rig = { bones, duration: 1.6, loop: true, tracks: generateWalkCycle(bones) }
  it('keeps knees attached to the end of the thigh throughout the cycle', () => {
    for (let frame = 0; frame < 48; frame++) {
      const transforms = evaluateRig(rig, frame / 30)
      for (const side of ['l', 'r']) {
        const thigh = bones.find((b) => b.id === `bone-thigh-${side}`)!
        const hip = transforms.get(thigh.id)!
        const knee = transforms.get(`bone-shin-${side}`)!
        const tail = rotatePoint(thigh.length, 0, thigh.angle + hip.rotation)
        expect(Math.hypot(knee.x - hip.x - tail.x, knee.y - hip.y - tail.y)).toBeLessThan(10)
      }
    }
  })
  it('keeps limb length constant and both sides half a cycle apart', () => {
    for (let frame = 0; frame < 48; frame++) {
      const left = sampleBonePose(rig, 'bone-thigh-l', frame / 30)
      const right = sampleBonePose(rig, 'bone-thigh-r', frame / 30 + 0.8)
      expect(left.rotation).toBeCloseTo(-right.rotation, 4)
      expect(left.scaleY ?? 1).toBeCloseTo(right.scaleY ?? 1, 4)
      expect(left.y).toBeCloseTo(right.y, 4)
    }
  })
  it('matches upper arms independently of bone array order', () => {
    const reverse = generateWalkCycle([...bones].reverse())
    expect(reverse['bone-arm-l']).toEqual(rig.tracks['bone-arm-l'])
    expect(reverse['bone-arm-r']).toEqual(rig.tracks['bone-arm-r'])
  })
  it('plants the supporting ankle while the body shifts weight', () => {
    const shin = bones.find((b) => b.id === 'bone-shin-l')!
    for (let t = 0; t < 0.93; t += 0.013) {
      const tf = evaluateRig(rig, t).get(shin.id)!
      const tip = rotatePoint(shin.length, 0, shin.angle + tf.rotation)
      expect(Math.abs(tf.x + tip.x - shin.x)).toBeLessThan(10)
      expect(Math.abs(tf.y + tip.y - (shin.y + shin.length))).toBeLessThan(20)
    }
    const lifted = evaluateRig(rig, 1.28).get(shin.id)!
    const tip = rotatePoint(shin.length, 0, shin.angle + lifted.rotation)
    expect(Number.isFinite(lifted.y + tip.y)).toBe(true)
  })
})
