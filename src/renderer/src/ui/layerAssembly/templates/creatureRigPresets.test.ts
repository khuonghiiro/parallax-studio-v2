import { describe, expect, it } from 'vitest'
import {
  createQuadrupedBones,
  generateQuadrupedWalk,
  generateQuadrupedWagTail,
  generateQuadrupedGraze,
  createFishBones,
  generateFishSwim,
  generateFishFloat,
  createBirdBones,
  generateBirdPeckWalk,
  generateBirdWingFlap,
  createChildBones,
  generateChildToddle,
  createElderlyBones,
  generateElderlyCaneWalk
} from './creatureRigPresets'

describe('creatureRigPresets', () => {
  it('creates valid quadruped bones and animations', () => {
    const bones = createQuadrupedBones()
    expect(bones.length).toBe(14)
    expect(bones.some((b) => b.id === 'bone-pelvis')).toBe(true)
    expect(bones.some((b) => b.id === 'bone-torso')).toBe(true)
    expect(bones.some((b) => b.id === 'bone-tail')).toBe(true)

    const walk = generateQuadrupedWalk(bones, 1.4)
    expect(Object.keys(walk).length).toBe(bones.length)
    expect(walk['bone-leg-fl-thigh'].length).toBeGreaterThan(2)

    const wag = generateQuadrupedWagTail(bones, 1.0)
    expect(wag['bone-tail'].length).toBeGreaterThan(2)

    const graze = generateQuadrupedGraze(bones, 2.0)
    expect(graze['bone-head'].length).toBeGreaterThan(2)
  })

  it('creates valid fish bones and swim wave animation', () => {
    const bones = createFishBones()
    expect(bones.length).toBe(7)
    expect(bones.some((b) => b.id === 'bone-fish-head')).toBe(true)
    expect(bones.some((b) => b.id === 'bone-fish-mid')).toBe(true)
    expect(bones.some((b) => b.id === 'bone-fish-fin-tail')).toBe(true)

    const swim = generateFishSwim(bones, 1.6)
    expect(Object.keys(swim).length).toBe(bones.length)
    expect(swim['bone-fish-mid'].length).toBeGreaterThan(2)

    const float = generateFishFloat(bones, 2.4)
    expect(float['bone-fish-head'].length).toBeGreaterThan(2)
  })

  it('creates valid bird bones and peck/flap animations', () => {
    const bones = createBirdBones()
    expect(bones.length).toBe(10)

    const peck = generateBirdPeckWalk(bones, 1.4)
    expect(peck['bone-bird-head'].length).toBeGreaterThan(2)

    const flap = generateBirdWingFlap(bones, 0.8)
    expect(flap['bone-bird-wing-l'].length).toBeGreaterThan(2)
  })

  it('creates child and elderly specific armatures and gait animations', () => {
    const childBones = createChildBones()
    expect(childBones.length).toBe(11)
    const toddle = generateChildToddle(childBones, 1.1)
    expect(toddle['bone-pelvis'].length).toBeGreaterThan(2)

    const oldBones = createElderlyBones()
    expect(oldBones.length).toBe(11)
    const caneWalk = generateElderlyCaneWalk(oldBones, 2.4)
    expect(caneWalk['bone-arm-r'].length).toBeGreaterThan(2)
  })
})
